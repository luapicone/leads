import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const distPath = path.join(projectRoot, 'dist')

const app = express()
const PORT = process.env.PORT || 4174

app.use(cors())
app.use(express.json())

const DEFAULT_HEADERS = [
  'rubro_buscado',
  'zona_buscada',
  'nombre_negocio',
  'categoria',
  'ciudad_zona',
  'sitio_web',
  'fuente_encontrada',
  'email',
  'telefono_whatsapp',
  'instagram_red_social',
  'problema_detectado',
  'servicio_recomendado',
  'score_oportunidad',
  'mensaje_sugerido',
  'estado',
  'notas'
]

function normalizeKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseCsv(csvText = '') {
  const rows = []
  let current = ''
  let row = []
  let insideQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const next = csvText[index + 1]

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === ',' && !insideQuotes) {
      row.push(current)
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(current)
      current = ''
      const hasContent = row.some((cell) => String(cell).trim() !== '')
      if (hasContent) rows.push(row)
      row = []
      continue
    }

    current += char
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current)
    const hasContent = row.some((cell) => String(cell).trim() !== '')
    if (hasContent) rows.push(row)
  }

  return rows
}

function getLeadSourceUrl() {
  const directUrl =
    process.env.LEADS_SOURCE_URL ||
    process.env.GOOGLE_SHEETS_CSV_URL ||
    process.env.GOOGLE_SHEETS_URL ||
    ''

  if (!directUrl) return ''

  try {
    const url = new URL(directUrl)
    if (!url.hostname.includes('docs.google.com')) return directUrl

    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)
    if (!match) return directUrl

    const gid = url.searchParams.get('gid') || process.env.GOOGLE_SHEETS_GID || '0'
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
  } catch {
    return directUrl
  }
}

async function fetchCsvRows() {
  const sourceUrl = getLeadSourceUrl()
  if (!sourceUrl) {
    throw new Error('Falta configurar LEADS_SOURCE_URL o GOOGLE_SHEETS_CSV_URL')
  }

  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 Altum Leads Dashboard',
      accept: 'text/csv,text/plain,application/vnd.ms-excel'
    }
  })

  if (!response.ok) {
    throw new Error(`No se pudo leer Google Sheets: HTTP ${response.status}`)
  }

  const csvText = await response.text()
  const rows = parseCsv(csvText)
  if (!rows.length) return { headers: DEFAULT_HEADERS, items: [] }

  const headerRow = rows[0].map((cell) => normalizeKey(cell))
  const headers = headerRow.some(Boolean) ? headerRow : DEFAULT_HEADERS
  const dataRows = headerRow.some(Boolean) ? rows.slice(1) : rows

  const items = dataRows.map((cells, index) => {
    const item = {}
    headers.forEach((header, cellIndex) => {
      item[header] = String(cells[cellIndex] || '').trim()
    })

    const score = Number(item.score_oportunidad || 0)
    item.score_oportunidad_num = Number.isFinite(score) ? score : 0
    item.id = String(index + 1)
    item.created_order = index + 1
    item.estado = item.estado || 'Pendiente de revisión'
    item.nombre_negocio = item.nombre_negocio || 'Sin nombre'
    item.servicio_recomendado = item.servicio_recomendado || 'Sin definir'
    item.problema_detectado = item.problema_detectado || 'Sin diagnóstico cargado'
    item.zona_buscada = item.zona_buscada || item.ciudad_zona || ''
    return item
  })

  return { headers, items }
}

function matchesFilter(value, query) {
  return String(value || '').toLowerCase().includes(String(query || '').toLowerCase())
}

function filterItems(items, query) {
  return items.filter((item) => {
    if (query.q) {
      const haystack = [
        item.nombre_negocio,
        item.categoria,
        item.ciudad_zona,
        item.rubro_buscado,
        item.zona_buscada,
        item.problema_detectado,
        item.servicio_recomendado,
        item.estado,
        item.notas
      ].join(' ')
      if (!matchesFilter(haystack, query.q)) return false
    }

    if (query.estado && !matchesFilter(item.estado, query.estado)) return false
    if (query.rubro && !matchesFilter(item.rubro_buscado, query.rubro)) return false
    if (query.zona && !matchesFilter(`${item.zona_buscada} ${item.ciudad_zona}`, query.zona)) return false
    if (query.servicio && !matchesFilter(item.servicio_recomendado, query.servicio)) return false

    const minScore = Number(query.minScore || 0)
    if (Number.isFinite(minScore) && item.score_oportunidad_num < minScore) return false

    return true
  })
}

function buildSummary(items) {
  const statusCounts = items.reduce((acc, item) => {
    const key = item.estado || 'Sin estado'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const averageScore = items.length
    ? Number((items.reduce((sum, item) => sum + item.score_oportunidad_num, 0) / items.length).toFixed(2))
    : 0

  return {
    total: items.length,
    averageScore,
    withWebsite: items.filter((item) => item.sitio_web).length,
    withoutWebsite: items.filter((item) => !item.sitio_web).length,
    pendingReview: items.filter((item) => /pendiente/i.test(item.estado)).length,
    statusCounts
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    const sourceUrl = getLeadSourceUrl()
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
    const { items } = await fetchCsvRows()
    const filtered = filterItems(items, req.query)
    const sort = String(req.query.sort || 'score_desc')

    filtered.sort((a, b) => {
      if (sort === 'score_asc') return a.score_oportunidad_num - b.score_oportunidad_num
      if (sort === 'name_asc') return a.nombre_negocio.localeCompare(b.nombre_negocio, 'es')
      if (sort === 'recent') return b.created_order - a.created_order
      return b.score_oportunidad_num - a.score_oportunidad_num
    })

    res.json({
      generatedAt: new Date().toISOString(),
      source: 'google-sheets',
      summary: buildSummary(filtered),
      items: filtered
    })
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
