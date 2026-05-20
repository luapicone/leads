const state = {
  loading: false,
  items: [],
  error: '',
  summary: null,
  selectedId: '',
  filters: {
    q: '',
    estado: '',
    rubro: '',
    zona: '',
    servicio: '',
    minScore: '0',
    sort: 'score_desc'
  }
}

function el(tag, className, content) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (typeof content === 'string') node.textContent = content
  return node
}

function uniqueValues(key) {
  return [...new Set(state.items.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
}

function buildQuery() {
  const params = new URLSearchParams()
  Object.entries(state.filters).forEach(([key, value]) => {
    if (String(value || '').trim() && value !== '0') params.set(key, value)
  })
  return params.toString()
}

async function loadLeads() {
  state.loading = true
  state.error = ''
  render()

  try {
    const query = buildQuery()
    const response = await fetch(`/api/leads${query ? `?${query}` : ''}`)
    const raw = await response.text()
    let data = null

    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      const preview = raw.trim().replace(/\s+/g, ' ').slice(0, 160)
      throw new Error(preview || 'La API respondió un formato inválido')
    }

    if (!response.ok) throw new Error(data?.error || 'No se pudieron cargar los leads')
    state.items = data.items || []
    state.summary = data.summary || null
    if (!state.selectedId && state.items.length) {
      state.selectedId = state.items[0].id
    } else if (state.selectedId && !state.items.some((item) => item.id === state.selectedId)) {
      state.selectedId = state.items[0]?.id || ''
    }
  } catch (error) {
    state.error = error.message
    state.items = []
    state.summary = null
    state.selectedId = ''
  } finally {
    state.loading = false
    render()
  }
}

function renderHero(root) {
  const hero = el('section', 'hero')
  const summary = state.summary || {
    total: 0,
    withPhone: 0,
    withEmail: 0,
    withWebsite: 0
  }

  hero.innerHTML = `
    <div class="hero-copy">
      <span class="eyebrow">Altum.AI</span>
      <h1>Gestor Leads</h1>
      <p>Un panel operativo para revisar oportunidades, ordenar la prospección y detectar rápido qué leads merecen atención inmediata sin perder tiempo en la hoja.</p>
    </div>
    <div class="hero-stats">
      <div class="stat-card"><strong>${summary.total}</strong><span>Total</span></div>
      <div class="stat-card"><strong>${summary.withPhone}</strong><span>Teléfono</span></div>
      <div class="stat-card"><strong>${summary.withEmail}</strong><span>Con Email</span></div>
      <div class="stat-card"><strong>${summary.withWebsite}</strong><span>Con Web</span></div>
    </div>
  `
  root.append(hero)
}

function optionList(values, current, placeholder) {
  return [
    `<option value="">${placeholder}</option>`,
    ...values.map((value) => `<option value="${value}" ${value === current ? 'selected' : ''}>${value}</option>`)
  ].join('')
}

function renderFilters(root) {
  const filters = el('section', 'filters')
  filters.innerHTML = `
    <div class="filters-top">
      <label class="field field-search">
        <span>Buscar</span>
        <input id="qInput" type="text" placeholder="Negocio, problema, servicio, zona..." value="${state.filters.q}" />
      </label>
      <label class="field">
        <span>Estado</span>
        <select id="estadoSelect">${optionList(uniqueValues('estado'), state.filters.estado, 'Todos')}</select>
      </label>
      <label class="field">
        <span>Rubro</span>
        <select id="rubroSelect">${optionList(uniqueValues('rubro_buscado'), state.filters.rubro, 'Todos')}</select>
      </label>
      <label class="field">
        <span>Servicio</span>
        <select id="servicioSelect">${optionList(uniqueValues('servicio_recomendado'), state.filters.servicio, 'Todos')}</select>
      </label>
      <label class="field">
        <span>Score mínimo</span>
        <select id="scoreSelect">
          ${['0', '5', '6', '7', '8', '9'].map((value) => `<option value="${value}" ${value === state.filters.minScore ? 'selected' : ''}>${value === '0' ? 'Todos' : value + '+'}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Orden</span>
        <select id="sortSelect">
          <option value="score_desc" ${state.filters.sort === 'score_desc' ? 'selected' : ''}>Score alto primero</option>
          <option value="score_asc" ${state.filters.sort === 'score_asc' ? 'selected' : ''}>Score bajo primero</option>
          <option value="name_asc" ${state.filters.sort === 'name_asc' ? 'selected' : ''}>Nombre A-Z</option>
          <option value="recent" ${state.filters.sort === 'recent' ? 'selected' : ''}>Últimos primero</option>
        </select>
      </label>
    </div>
    <div class="filters-bottom">
      <label class="field field-zone">
        <span>Zona</span>
        <input id="zonaInput" type="text" placeholder="Ej: Palermo, CABA, Buenos Aires" value="${state.filters.zona}" />
      </label>
      <div class="filter-actions">
        <button id="refreshButton" class="primary-button">${state.loading ? 'Cargando...' : 'Actualizar'}</button>
        <button id="resetButton" class="ghost-button" type="button">Limpiar filtros</button>
      </div>
    </div>
  `

  filters.querySelector('#qInput').addEventListener('input', (event) => {
    state.filters.q = event.target.value
  })
  filters.querySelector('#estadoSelect').addEventListener('change', (event) => {
    state.filters.estado = event.target.value
  })
  filters.querySelector('#rubroSelect').addEventListener('change', (event) => {
    state.filters.rubro = event.target.value
  })
  filters.querySelector('#servicioSelect').addEventListener('change', (event) => {
    state.filters.servicio = event.target.value
  })
  filters.querySelector('#scoreSelect').addEventListener('change', (event) => {
    state.filters.minScore = event.target.value
  })
  filters.querySelector('#sortSelect').addEventListener('change', (event) => {
    state.filters.sort = event.target.value
    loadLeads()
  })
  filters.querySelector('#zonaInput').addEventListener('input', (event) => {
    state.filters.zona = event.target.value
  })
  filters.querySelector('#refreshButton').addEventListener('click', loadLeads)
  filters.querySelector('#resetButton').addEventListener('click', () => {
    state.filters = {
      q: '',
      estado: '',
      rubro: '',
      zona: '',
      servicio: '',
      minScore: '0',
      sort: 'score_desc'
    }
    loadLeads()
  })

  root.append(filters)
}

function renderTable(root) {
  const panel = el('section', 'table-panel')

  if (state.loading) {
    panel.innerHTML = '<div class="empty-state"><h2>Cargando leads...</h2><p>Consultando la hoja publicada de Google Sheets.</p></div>'
    root.append(panel)
    return
  }

  if (state.error) {
    panel.innerHTML = `<div class="empty-state error-state"><h2>No se pudo cargar la hoja</h2><p>${state.error}</p></div>`
    root.append(panel)
    return
  }

  if (!state.items.length) {
    panel.innerHTML = '<div class="empty-state"><h2>No hay filas para mostrar</h2><p>Publicá la hoja como CSV o ajustá los filtros.</p></div>'
    root.append(panel)
    return
  }

  panel.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Negocio</th>
            <th>Zona</th>
            <th>Servicio</th>
            <th>Score</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${state.items
            .map((item) => {
              const selected = item.id === state.selectedId ? 'is-selected' : ''
              return `
                <tr class="${selected}" data-id="${item.id}">
                  <td>
                    <strong>${item.nombre_negocio}</strong>
                    <small>${item.categoria || item.rubro_buscado || ''}</small>
                  </td>
                  <td>${item.ciudad_zona || item.zona_buscada || '-'}</td>
                  <td>${item.servicio_recomendado}</td>
                  <td><span class="score-pill">${item.score_oportunidad_num || item.score_oportunidad || 0}</span></td>
                  <td><span class="status-pill">${item.estado}</span></td>
                </tr>
              `
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `

  panel.querySelectorAll('tbody tr').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedId = row.dataset.id
      render()
    })
  })

  root.append(panel)
}

function field(label, value, link = false) {
  if (!value) return ''
  const content = link ? `<a href="${value}" target="_blank" rel="noreferrer">${value}</a>` : value
  return `<div class="detail-field"><span>${label}</span><p>${content}</p></div>`
}

function renderDetail(root) {
  const item = state.items.find((lead) => lead.id === state.selectedId)
  const panel = el('aside', 'detail-panel')

  if (!item) {
    panel.innerHTML = '<div class="empty-state"><h2>Seleccioná un lead</h2><p>Elegí una fila para ver su detalle.</p></div>'
    root.append(panel)
    return
  }

  panel.innerHTML = `
    <div class="detail-head">
      <span class="eyebrow">Detalle</span>
      <h2>${item.nombre_negocio}</h2>
      <p>${item.categoria || item.rubro_buscado || 'Lead de Altum'}</p>
    </div>
    <div class="detail-grid">
      ${field('Rubro buscado', item.rubro_buscado)}
      ${field('Zona buscada', item.zona_buscada || item.ciudad_zona)}
      ${field('Servicio recomendado', item.servicio_recomendado)}
      ${field('Estado', item.estado)}
      ${field('Sitio web', item.sitio_web, true)}
      ${field('Fuente encontrada', item.fuente_encontrada, true)}
      ${field('Email', item.email)}
      ${field('Teléfono / WhatsApp', item.telefono_whatsapp)}
      ${field('Instagram / Red social', item.instagram_red_social)}
    </div>
    <div class="detail-block">
      <span>Score</span>
      <strong class="detail-score">${item.score_oportunidad_num || item.score_oportunidad || 0}</strong>
    </div>
    <div class="detail-block">
      <span>Problema detectado</span>
      <p>${item.problema_detectado}</p>
    </div>
    <div class="detail-block">
      <span>Mensaje sugerido</span>
      <textarea readonly>${item.mensaje_sugerido || ''}</textarea>
    </div>
    <div class="detail-block">
      <span>Notas</span>
      <p>${item.notas || 'Sin notas'}</p>
    </div>
  `

  root.append(panel)
}

function renderStatusBar(root) {
  const bar = el('section', 'status-bar')
  const counts = state.summary?.statusCounts || {}
  const chips = Object.entries(counts)
    .map(([status, total]) => `<span class="status-chip">${status}: ${total}</span>`)
    .join('')

  bar.innerHTML = `
    <div>
      <strong>Estados</strong>
      <div class="status-chip-row">${chips || '<span class="status-chip">Sin datos</span>'}</div>
    </div>
    <p>Fuente activa: Google Sheets publicado como CSV.</p>
  `
  root.append(bar)
}

function render() {
  const root = document.querySelector('#app')
  root.innerHTML = ''
  const shell = el('main', 'shell')
  renderHero(shell)
  renderFilters(shell)
  renderStatusBar(shell)

  const content = el('section', 'content-grid')
  renderTable(content)
  renderDetail(content)

  shell.append(content)
  root.append(shell)
}

export function createApp(root) {
  if (!root) return
  render()
  loadLeads()
}
