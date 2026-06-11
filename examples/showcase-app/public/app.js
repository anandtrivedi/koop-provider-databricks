/* global require */

require([
  'esri/Map',
  'esri/views/MapView',
  'esri/layers/FeatureLayer',
  'esri/widgets/Editor',
  'esri/widgets/Expand'
], function (Map, MapView, FeatureLayer, Editor, Expand) {
  const state = {
    config: null,
    layers: {}, // id -> { config, layer, enabled }
    activeTab: 'cop',
    inspectorPaused: false,
    editorExpand: null,
    replayTimer: null
  }

  const AIS_START = Date.parse('2026-02-16T00:00:00Z')
  const HOUR = 3600 * 1000

  // ---------------------------------------------------------------- renderers

  const RENDERERS = {
    buildings: {
      type: 'simple',
      symbol: {
        type: 'simple-fill',
        color: [255, 158, 44, 0.28],
        outline: { color: [255, 158, 44, 0.9], width: 0.4 }
      }
    },
    infra: {
      type: 'unique-value',
      field: 'infra_category',
      defaultSymbol: marker([138, 148, 160], 5),
      uniqueValueInfos: [
        { value: 'Medical', symbol: marker([244, 112, 103], 7) },
        { value: 'Public Safety', symbol: marker([88, 166, 255], 7) },
        { value: 'Government', symbol: marker([255, 158, 44], 7) },
        { value: 'Energy & Utilities', symbol: marker([63, 185, 80], 7) },
        { value: 'Transport Hub', symbol: marker([188, 140, 255], 7) }
      ]
    },
    roads: {
      type: 'simple',
      symbol: { type: 'simple-line', color: [88, 166, 255, 0.7], width: 1.2 }
    },
    towers: {
      type: 'simple',
      symbol: marker([57, 197, 207], 5)
    },
    towersEditable: {
      type: 'simple',
      symbol: marker([188, 140, 255], 7, [255, 255, 255])
    },
    h3: {
      type: 'class-breaks',
      field: 'place_count',
      classBreakInfos: [
        { minValue: 0, maxValue: 50, symbol: hexFill([255, 158, 44, 0.10]) },
        { minValue: 50, maxValue: 250, symbol: hexFill([255, 158, 44, 0.25]) },
        { minValue: 250, maxValue: 1000, symbol: hexFill([255, 122, 44, 0.40]) },
        { minValue: 1000, maxValue: 10000000, symbol: hexFill([244, 112, 103, 0.55]) }
      ]
    },
    ais: {
      type: 'unique-value',
      field: 'vessel_type',
      defaultSymbol: marker([138, 148, 160], 5),
      uniqueValueInfos: [
        { value: 'Cargo', symbol: marker([255, 158, 44], 6) },
        { value: 'Tanker', symbol: marker([244, 112, 103], 6) },
        { value: 'Passenger', symbol: marker([63, 185, 80], 6) },
        { value: 'Tug', symbol: marker([88, 166, 255], 6) },
        { value: 'Military', symbol: marker([188, 140, 255], 7) }
      ]
    }
  }

  function marker (color, size, outlineColor) {
    return {
      type: 'simple-marker',
      color: color,
      size: size,
      outline: { color: outlineColor || [14, 17, 22], width: 0.6 }
    }
  }

  function hexFill (color) {
    return {
      type: 'simple-fill',
      color: color,
      outline: { color: [255, 158, 44, 0.35], width: 0.5 }
    }
  }

  // ------------------------------------------------------------------- setup

  const map = new Map({ basemap: 'dark-gray-vector' })
  const view = new MapView({
    container: 'view',
    map: map,
    center: [-77.03, 38.89],
    zoom: 12,
    popup: { dockEnabled: false }
  })

  fetch('/api/layers')
    .then(r => r.json())
    .then(config => {
      state.config = config
      buildTabs(config.tabs)
      config.layers.forEach(addLayer)
      applyTab(state.activeTab)
      pollInspector()
      setInterval(pollInspector, 1500)
      setStatus('chip-ok', 'Databricks: connected')
    })
    .catch(() => setStatus('chip-err', 'failed to load layer config'))

  function setStatus (cls, text) {
    const el = document.getElementById('conn-status')
    el.className = 'chip ' + cls
    el.textContent = text
  }

  // ------------------------------------------------------------------ layers

  function layerUrl (cfg) {
    if (cfg.source === 'cdf') return cfg.url
    return `${window.location.origin}/databricks/rest/services/${cfg.table}/FeatureServer/0`
  }

  function addLayer (cfg) {
    const layer = new FeatureLayer({
      url: layerUrl(cfg),
      title: cfg.title,
      visible: false,
      outFields: ['*'],
      minScale: cfg.minScale || 0,
      maxScale: cfg.maxScale || 0,
      definitionExpression: cfg.where || null,
      renderer: RENDERERS[cfg.renderer] || null,
      popupTemplate: {
        title: cfg.title,
        content: [{
          type: 'fields',
          fieldInfos: (cfg.popupFields || []).map(f => ({ fieldName: f }))
        }]
      }
    })

    if (cfg.timeField && cfg.timeExtent) {
      layer.customParameters = initialTimeParams(cfg)
    }

    map.add(layer)
    state.layers[cfg.id] = { config: cfg, layer: layer, enabled: cfg.visible }

    layer.load().catch(() => {
      const row = document.querySelector(`[data-layer="${cfg.id}"] .layer-meta`)
      if (row) {
        row.innerHTML = cfg.source === 'cdf'
          ? '⚠ unreachable — open <a href="' + cfg.url + '?f=json" target="_blank">the service</a> once to trust its certificate, then reload'
          : '⚠ failed to load'
      }
    })

    renderLayerRow(cfg)
    fetchCount(cfg)
  }

  function renderLayerRow (cfg) {
    const row = document.createElement('label')
    row.className = 'layer-row'
    row.dataset.layer = cfg.id
    row.dataset.tab = cfg.tab
    row.innerHTML = `
      <input type="checkbox" ${cfg.visible ? 'checked' : ''} />
      <div>
        <div class="layer-name">${cfg.title}
          <span class="layer-badge ${cfg.source === 'cdf' ? 'badge-cdf' : 'badge-koop'}">${cfg.source === 'cdf' ? 'CDF · LAKEBASE' : 'KOOP · DBSQL'}</span>
        </div>
        <div class="layer-meta"><span class="layer-count">…</span> features${cfg.editable ? ' · editable' : ''}</div>
      </div>`
    row.querySelector('input').addEventListener('change', e => {
      state.layers[cfg.id].enabled = e.target.checked
      syncVisibility()
      if (cfg.editable) toggleEditor()
    })
    document.getElementById('layer-list').appendChild(row)
  }

  function fetchCount (cfg) {
    const params = new URLSearchParams({ where: cfg.where || '1=1', returnCountOnly: 'true', f: 'json' })
    fetch(`${layerUrl(cfg)}/query?${params}`)
      .then(r => r.json())
      .then(d => {
        const el = document.querySelector(`[data-layer="${cfg.id}"] .layer-count`)
        if (el && d.count !== undefined) el.textContent = Number(d.count).toLocaleString()
      })
      .catch(() => {})
  }

  // -------------------------------------------------------------------- tabs

  function buildTabs (tabs) {
    const nav = document.getElementById('tabs')
    Object.keys(tabs).forEach(key => {
      const btn = document.createElement('button')
      btn.textContent = tabs[key].title
      btn.dataset.tab = key
      if (key === state.activeTab) btn.classList.add('active')
      btn.addEventListener('click', () => {
        state.activeTab = key
        nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn))
        applyTab(key)
      })
      nav.appendChild(btn)
    })
  }

  function applyTab (key) {
    const tab = state.config.tabs[key]
    view.goTo({ center: tab.center, zoom: tab.zoom })
    document.querySelectorAll('.layer-row').forEach(row => {
      row.style.display = row.dataset.tab === key ? 'flex' : 'none'
    })
    document.getElementById('time-panel').classList.toggle('hidden', key !== 'maritime')
    syncVisibility()
    toggleEditor()
  }

  function syncVisibility () {
    Object.values(state.layers).forEach(entry => {
      entry.layer.visible = entry.enabled && entry.config.tab === state.activeTab
    })
  }

  // ------------------------------------------------------------------ editor

  function toggleEditor () {
    const editableVisible = Object.values(state.layers).some(
      e => e.config.editable && e.enabled && e.config.tab === state.activeTab
    )
    if (editableVisible && !state.editorExpand) {
      const editor = new Editor({ view: view })
      state.editorExpand = new Expand({ view: view, content: editor, expanded: true, expandTooltip: 'Edit features' })
      view.ui.add(state.editorExpand, 'bottom-right')
    } else if (!editableVisible && state.editorExpand) {
      view.ui.remove(state.editorExpand)
      state.editorExpand.destroy()
      state.editorExpand = null
    }
  }

  // ------------------------------------------------------------ time replay

  function initialTimeParams (cfg) {
    const end = Date.parse(cfg.timeExtent[1])
    return { time: `${Date.parse(cfg.timeExtent[0])},${end}`, timeField: cfg.timeField }
  }

  const slider = document.getElementById('time-slider')
  const readout = document.getElementById('time-readout')
  const windowed = document.getElementById('time-window')

  function applyTime () {
    const hour = parseInt(slider.value, 10)
    const end = AIS_START + (hour + 1) * HOUR
    const start = windowed.checked ? Math.max(AIS_START, end - 6 * HOUR) : AIS_START
    readout.textContent = `${fmt(start)} → ${fmt(end)}Z`
    Object.values(state.layers).forEach(entry => {
      if (!entry.config.timeField) return
      entry.layer.customParameters = { time: `${start},${end}`, timeField: entry.config.timeField }
      entry.layer.refresh()
    })
  }

  function fmt (ms) {
    return new Date(ms).toISOString().slice(5, 16).replace('T', ' ')
  }

  slider.addEventListener('change', applyTime)
  windowed.addEventListener('change', applyTime)

  document.getElementById('time-play').addEventListener('click', () => {
    if (state.replayTimer) {
      clearInterval(state.replayTimer)
      state.replayTimer = null
      document.getElementById('time-play').textContent = '▶ Replay'
      return
    }
    slider.value = 0
    document.getElementById('time-play').textContent = '⏸ Stop'
    state.replayTimer = setInterval(() => {
      const next = parseInt(slider.value, 10) + 1
      if (next > parseInt(slider.max, 10)) {
        clearInterval(state.replayTimer)
        state.replayTimer = null
        document.getElementById('time-play').textContent = '▶ Replay'
        return
      }
      slider.value = next
      applyTime()
    }, 2500)
  })

  // -------------------------------------------------------- query inspector

  document.getElementById('inspector-pause').addEventListener('click', e => {
    state.inspectorPaused = !state.inspectorPaused
    e.target.textContent = state.inspectorPaused ? '▶' : '⏸'
  })

  function pollInspector () {
    if (state.inspectorPaused) return
    fetch('/api/querylog')
      .then(r => r.json())
      .then(d => renderQueries(d.queries || []))
      .catch(() => {})
  }

  function renderQueries (queries) {
    const list = document.getElementById('query-list')
    list.innerHTML = queries.slice(0, 30).map(q => `
      <div class="query-card kind-${q.kind}">
        <div class="query-head">
          <span class="query-kind">${q.kind}</span>
          <span>${q.durationMs} ms</span>
          <span>${q.rows} rows</span>
          <span>${q.at.slice(11, 19)}Z</span>
        </div>
        <div class="query-sql">${highlight(q.sql)}</div>
      </div>`).join('')
  }

  function highlight (sql) {
    return escapeHtml(sql)
      .replace(/'[^']*'/g, m => `<span class="str">${m}</span>`)
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|LIMIT|OFFSET|AS|BETWEEN|IN|DESCRIBE|TIMESTAMP|COUNT|MIN|MAX|NOT|IS|NULL)\b/g,
        '<span class="kw">$1</span>')
      .replace(/\b(ST_[A-Za-z]+|h3_[a-z0-9]+|array_contains)\b/g, '<span class="fn">$1</span>')
  }

  function escapeHtml (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
})
