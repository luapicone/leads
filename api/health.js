import { getLeadSourceUrl } from '../lib/leads.js'

export default async function handler(_req, res) {
  try {
    const sourceUrl = getLeadSourceUrl(process.env)
    res.status(200).json({
      ok: true,
      sourceConfigured: Boolean(sourceUrl),
      sourceUrlPreview: sourceUrl ? sourceUrl.slice(0, 120) : ''
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
}
