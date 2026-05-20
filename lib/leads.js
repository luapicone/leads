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

const HEADER_ALIASES = {
  fecha: 'fecha',
  rubro_buscado: 'rubro_buscado',
  zona_buscada: 'zona_buscada',
  nombre_del_negocio: 'nombre_negocio',
  nombre_negocio: 'nombre_negocio',
  categoria: 'categoria',
  ciudad_zona: 'ciudad_zona',
  sitio_web: 'sitio_web',
  fuente_encontrada: 'fuente_encontrada',
  email: 'email',
  telefono_whatsapp: 'telefono_whatsapp',
  instagram_red_social: 'instagram_red_social',
  problema_detectado: 'problema_detectado',
  servicio_recomendado: 'servicio_recomendado',
  score_oportunidad: 'score_oportunidad',
  mensaje_sugerido: 'mensaje_sugerido',
  estado: 'estado',
  notas: 'notas'
}

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

export function getLeadSourceUrl(env = process.env) {
  const directUrl =
    env.LEADS_SOURCE_URL ||
    env.GOOGLE_SHEETS_CSV_URL ||
    env.GOOGLE_SHEETS_URL ||
    ''

  if (!directUrl) return ''

  try {
    const url = new URL(directUrl)
    if (!url.hostname.includes('docs.google.com')) return directUrl

    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)
    if (!match) return directUrl

    const hashGid = (url.hash.match(/gid=(\d+)/) || [])[1]
    const gid = url.searchParams.get('gid') || hashGid || env.GOOGLE_SHEETS_GID || '0'
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
  } catch {
    return directUrl
  }
}

function buildHtmlSourceError(sourceUrl, preview) {
  const looksLikeGoogleSheet = String(sourceUrl).includes('docs.google.com/spreadsheets')
  if (looksLikeGoogleSheet) {
    return `Google Sheets no devolvió CSV. Revisá que la pestaña esté publicada como CSV y que la URL configurada apunte a una hoja accesible. Respuesta recibida: ${preview}`
  }

  return `La fuente configurada no devolvió CSV válido. Respuesta recibida: ${preview}`
}

export async function fetchCsvRows(env = process.env) {
  const sourceUrl = getLeadSourceUrl(env)
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
  const normalized = csvText.trim().toLowerCase()
  if (normalized.startsWith('<!doctype html') || normalized.startsWith('<html') || normalized.startsWith('the page')) {
    const preview = csvText.trim().replace(/\s+/g, ' ').slice(0, 160)
    throw new Error(buildHtmlSourceError(sourceUrl, preview))
  }

  const rows = parseCsv(csvText)
  if (!rows.length) return { headers: DEFAULT_HEADERS, items: [] }

  const headerRow = rows[0].map((cell) => HEADER_ALIASES[normalizeKey(cell)] || normalizeKey(cell))
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

export function filterItems(items, query) {
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

export function buildSummary(items) {
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
    withPhone: items.filter((item) => item.telefono_whatsapp).length,
    withEmail: items.filter((item) => item.email).length,
    withWebsite: items.filter((item) => item.sitio_web).length,
    withoutWebsite: items.filter((item) => !item.sitio_web).length,
    pendingReview: items.filter((item) => /pendiente/i.test(item.estado)).length,
    statusCounts
  }
}

export async function getLeadsPayload(query = {}, env = process.env) {
  const { items } = await fetchCsvRows(env)
  const filtered = filterItems(items, query)
  const sort = String(query.sort || 'score_desc')

  filtered.sort((a, b) => {
    if (sort === 'score_asc') return a.score_oportunidad_num - b.score_oportunidad_num
    if (sort === 'name_asc') return a.nombre_negocio.localeCompare(b.nombre_negocio, 'es')
    if (sort === 'recent') return b.created_order - a.created_order
    return b.score_oportunidad_num - a.score_oportunidad_num
  })

  return {
    generatedAt: new Date().toISOString(),
    source: 'google-sheets',
    summary: buildSummary(filtered),
    items: filtered
  }
}
