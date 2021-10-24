import sharp from 'sharp'
import * as fse from 'fs-extra'
import * as fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

//const [exe, loc, col, lenStr, prettyStr] = [, , "2520842", "383", "0"];//
//const len = parseInt(lenStr, 10)
//const pretty = parseInt(prettyStr)

function range(start, stop) {
    return [...Array(stop).keys()].slice(start, stop);
}

function wait(delay){
    return new Promise((resolve) => setTimeout(resolve, delay));
}

function fetchRetry(url, delay = 500, tries = 30, fetchOptions = {}) {
    return fetch(url,fetchOptions).catch(err => {
        const triesLeft = tries - 1,
			wacky_delay = delay + (Math.random() * 500)
        if (!triesLeft) {
            throw err
        }
        return wait(wacky_delay).then(() => fetchRetry(url, wacky_delay, triesLeft, fetchOptions))
	});
}

Promise.all(JSON.parse(process.argv[2]).map(([col, len, pretty]) => {
	const folder = `./photos/${pretty ? 'pretty' : 'ugly'}/unsplash_collection_${col}`
	fse.outputFile(path.resolve(`${folder}/source.txt`), `https://unsplash.com/collections/${col}/`, () => {})
	return Promise.all(range(1, Math.floor(len / 30) + 1).map(page => (
		fetchRetry(`https://unsplash.com/napi/collections/${col}/photos?per_page=30&order_by=latest&page=${page}`)
			.then(res => res.json())
			.then(objs => (
				Promise.all(objs.map(({id, links: {download: url}}) => (
					fetchRetry(url)
						.then(res => res.buffer())
						.then(buffer => (
							sharp(buffer)
								.resize(100, 100, {fit: 'fill'})
								.png()
								.toFile(path.resolve(`${folder}/${id}.png`).toString())
						))
				)))
			))
			.catch(console.error)
	)))
}))
	.then((results) => {
		console.log("FINISHED!")
	})
