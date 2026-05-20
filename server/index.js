import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getLeadSourceUrl, getLeadsPayload } from '../lib/leads.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const distPath = path.join(projectRoot, 'dist')

const app = express()
const PORT = process.env.PORT || 4174

app.use(cors())
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    const sourceUrl = getLeadSourceUrl(process.env)
    res.json({
      ok: true,
      sourceConfigured: Boolean(sourceUrl),
      sourceUrlPreview: sourceUrl ? sourceUrl.slice(0, 120) : ''
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.get('/api/leads', async (req, res) => {
  try {
    res.json(await getLeadsPayload(req.query, process.env))
  } catch (error) {
    res.status(500).json({ error: error.message || 'No se pudieron cargar los leads' })
  }
})

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Altum leads dashboard running on http://localhost:${PORT}`)
})
