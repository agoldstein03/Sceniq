require('dotenv').config()
import gotImport = require('got')
import	gmaps = require("@googlemaps/google-maps-services-js")
import	polyline = require('@mapbox/polyline')
import	geolib = require('geolib')
import 	tf = require('@tensorflow/tfjs-node')
import 	path = require('path')
import type vercel = require('@vercel/node')
import type { Tensor3D } from '@tensorflow/tfjs-node'

const got = gotImport.default

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  // another common pattern
  // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  return await fn(req, res)
}

module.exports = allowCors(async (req: vercel.VercelRequest, res: vercel.VercelResponse): Promise<void> => {
	const { origin, destination, getAll }: { origin: string, destination: string, getAll: boolean } = req.body,
		[originLoc, destinationLoc] = await Promise.all([origin, destination].map(resolveLocation))
	if (getAll) {
		const routes = await scoreRoutes(originLoc, destinationLoc)
		res.json(routes.map(({ route, score }) => ({
			url: urlToRoute(originLoc, destinationLoc, route),
			score
		})))
	} else {
		const [route, score] = await bestRoute(originLoc, destinationLoc)
		res.json({
			url: urlToRoute(originLoc, destinationLoc, route),
			score 
		})
	}
})

let model: tf.LayersModel

async function getModel() {
	if (model) return model
	model = await tf.loadLayersModel('file://'+path.resolve('../model/build/model.json'))
	return model
}

async function processImageBuffers(imageBuffers: Buffer[]) {
	const model = await getModel(),
		tensors = imageBuffers.map(imageBuffer => tf.node.decodePng(imageBuffer)),
		tensor: tf.Tensor4D = tf.stack(tensors),
		predictionsOrArray = model.predict(tensor),
		predictions = predictionsOrArray instanceof Array ? predictionsOrArray[0] : predictionsOrArray
	return predictions
}

async function scorePath(points: Point[]) {
	const [satPredictions, streetPredictions] = await Promise.all([
		Promise.all(getSatImages(points))
			.then(processImageBuffers),
		Promise.all(getStreetViewImages(points)
			.map(heading => heading.then(processImageBuffers)))
	]),
		processedSatTensor = satPredictions.slice([0, 1], [-1, 1]).reshape([-1]),
		streetPredictionsTensor: Tensor3D = tf.stack(streetPredictions),
		processedStreetTensor = streetPredictionsTensor.slice([0, 0, 1], [-1, -1, 1]).max(0).reshape([-1])
	const combinedTensor = processedStreetTensor.mul(0.9).add(processedSatTensor.mul(0.1)),
		mean = (await combinedTensor.mean().array()) as number
	return mean
}

async function scoreRoutes(origin: Point, destination: Point) {
	const routes = await getRoutes(origin, destination),
		scores = await Promise.all(
			routes.map(route => (
				scorePath(realComputePoints(polyline.decode(route.overview_polyline.points, 5)))
			))
		),
		scoredRoutes = routes.map((route, i) => ({
			score: scores[i],
			route
		}))
	return scoredRoutes
}

async function bestRoute(origin: Point, destination: Point): Promise<[gmaps.DirectionsRoute, number]> {
	const scoredRoutes = await scoreRoutes(origin, destination)
	let max = -Infinity,
		maxRoute: gmaps.DirectionsRoute = null
	for (const { route, score } of scoredRoutes) {
		if (score > max) {
			max = score
			maxRoute = route
		}
	}
	return [maxRoute, max]
}

function urlToRoute(origin: Point, destination: Point, route: gmaps.DirectionsRoute) {
	const waypoints = encodeURIComponent(realComputePoints(polyline.decode(route.overview_polyline.points, 5), 10).map(point => point.join()).join('|')),
		originStr = encodeURIComponent(origin.join()),
		desinationStr = encodeURIComponent(destination.join())
	return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${desinationStr}&waypoints=${waypoints}`
}

const client = new gmaps.Client()

async function getRoutes(origin: Point, destination: Point) {
	const directions = await client.directions({
		params: {
			origin,
			destination,
			alternatives: true,
			key: process.env.KEY
		}
	}),	{ routes } = directions.data
	return routes
}

async function resolveLocation(location: string): Promise<Point> {
	const place = await client.findPlaceFromText({
		params: {
			input: location,
			inputtype: "textquery",
			fields: ["geometry"],
			key: process.env.KEY
		}
	}),
		{ lat, lng } = place.data.candidates[0].geometry.location
	return [lat, lng]
}


type Point = [number, number]
type PolyLine = Point[]

function realComputePoints(poly: PolyLine, points: number = 50) {
	return toggleLonLat(computeEquidistantPointsAlongPolyline(toggleLonLat(poly), points))
}

function toggleLonLat(coords: Point[]): Point[] {
	return coords.map(([num1, num2]) => ([num2, num1]))
}

function computeEquidistantPointsAlongPolyline(poly: PolyLine, points: number = 50) {
	function* computePoints(
		poly: PolyLine,
		distanceSoFar: number,
		pointsLeft: number
	): Generator<Point, void, null> {
		if (pointsLeft > 0) {
			const [firstPoint, secondPoint] = poly,
				distance = geolib.getDistance(firstPoint, secondPoint),
				newDistanceSoFar = distanceSoFar + distance,
				slicedPoly = poly.slice(1)
			if (newDistanceSoFar <= pointDelta) {
				yield* computePoints(slicedPoly, newDistanceSoFar, pointsLeft)
			} else {
				const bearing = geolib.getRhumbLineBearing(firstPoint, secondPoint),
					distanceLeft = pointDelta - distanceSoFar,
					newPointSwapped = geolib.computeDestinationPoint(firstPoint, distanceLeft, bearing),
					newPoint: Point = [newPointSwapped.longitude, newPointSwapped.latitude],
					newPointArray: PolyLine = [newPoint],
					newPoly: PolyLine = newPointArray.concat(slicedPoly)
				yield newPoint
				yield* computePoints(newPoly, 0, pointsLeft - 1)
			}
		}
	}
	const pointDelta = geolib.getPathLength(poly) / (points + 1)
	return [...computePoints(poly, 0, points)]
}

/** THE FOLLOWING CODE COMES FROM GOOGLE MAPS API DOCUMENTATION */

const crypto = require('crypto');
const url = require('url');

/**
 * Convert from 'web safe' base64 to true base64.
 *
 * @param  {string} safeEncodedString The code you want to translate
 *                                    from a web safe form.
 * @return {string}
 */
function removeWebSafe(safeEncodedString: string) {
  return safeEncodedString.replace(/-/g, '+').replace(/_/g, '/');
}

/**
 * Convert from true base64 to 'web safe' base64
 *
 * @param  {string} encodedString The code you want to translate to a
 *                                web safe form.
 * @return {string}
 */
function makeWebSafe(encodedString: string) {
  return encodedString.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Takes a base64 code and decodes it.
 *
 * @param  {string} code The encoded data.
 * @return {string}
 */
function decodeBase64Hash(code: string) {
  // "new Buffer(...)" is deprecated. Use Buffer.from if it exists.
  return Buffer.from(code, 'base64');
}

/**
 * Takes a key and signs the data with it.
 *
 * @param  {Buffer} key  Your unique secret key.
 * @param  {string} data The url to sign.
 * @return {string}
 */
function encodeBase64Hash(key: Buffer, data: string) {
  return crypto.createHmac('sha1', key).update(data).digest('base64');
}

/**
 * Sign a URL using a secret key.
 *
 * @param  {string} path   The url you want to sign.
 * @param  {string} secret Your unique secret key.
 * @return {string}
 */
function sign(path: string, key: string = process.env.KEY, secret: string = process.env.SECRET) {
  const uri = url.parse(`${path}&key=${key}`);
  const safeSecret = decodeBase64Hash(removeWebSafe(secret));
  const hashedSignature = makeWebSafe(encodeBase64Hash(safeSecret, uri.path));
  return `${url.format(uri)}&signature=${hashedSignature}`;
}

function getSatImages(points: Point[]) {
	return points.map(point => (
		got(sign(`https://maps.googleapis.com/maps/api/staticmap?center=${point.join()}&zoom=16&size=100x100&maptype=satellite&format=png`))
			.then(response => response.rawBody)
	))
}

const HEADINGS = [0, 90, 180, 270]

function getStreetViewImages(points: Point[]) {
	const fov = 360 / HEADINGS.length
	return HEADINGS.map(heading => (
		Promise.all(points.map(point => (
			got(sign(`https://maps.googleapis.com/maps/api/streetview?size=100x100&location=${point.join()}&fov=${fov}&heading=${heading}`))
				.then(response => response.rawBody)
		)))
	))
}