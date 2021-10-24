import fetch from 'node-fetch'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async (req: VercelRequest, res: VercelResponse): Promise<void> => {
	res.send(`Hello, ${req.body}. ${req.method}`)
}