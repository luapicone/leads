import { getLeadsPayload } from '../lib/leads.js'

export default async function handler(req, res) {
  try {
    const payload = await getLeadsPayload(req.query || {}, process.env)
    res.status(200).json(payload)
  } catch (error) {
    res.status(500).json({ error: error.message || 'No se pudieron cargar los leads' })
  }
}
