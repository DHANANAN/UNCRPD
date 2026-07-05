// Main Application Controller for UNCRPD 3D Dashboard
const DATA = window.REPORT_DATA;
const CAPTION_IMAGE_MAP = window.CAPTION_IMAGE_MAP;

// State management
const state = {
  mode: 'overview',
  filter: '',
  selected: null,
  tilt: 55,
  density: 1.0,
  
  // Guided Tour State
  tourActive: false,
  currentTourStep: 0
};

// Global Lookup Maps
let byPoint = new Map();
let byArticle = new Map();
let bySource = new Map();

// Helper to escape HTML characters
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[m]));
}

// Helper to truncate long text strings
function trunc(s, n = 120) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Index all raw JSON data for quick O(1) lookups
function initDataIndexes() {
  DATA.points.forEach(p => byPoint.set(p.no, p));
  DATA.articles.forEach(a => byArticle.set(a.title, a));
  DATA.sources.forEach(s => bySource.set(String(s.id), s));
}

// Math layout helpers (replicates original HTML positions for the nodes)
function radialLayout(items, r, phase = 0, z = 0) {
  return items.map((it, i) => {
    const ang = phase + i * (Math.PI * 2 / items.length);
    return {
      ...it,
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      z: z + ((i % 3) - 1) * 18
    };
  });
}

function spiralLayout(items, startR = 120, step = 14, phase = 0) {
  return items.map((it, i) => {
    const ang = phase + i * 0.72;
    const r = startR + Math.sqrt(i) * step;
    return {
      ...it,
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      z: ((i % 7) - 3) * 9
    };
  });
}

// Coordinates layout generators for each Mode
function getOverviewLayout() {
  const nodes = [];
  const links = [];
  
  const center = {
    id: 'center',
    type: 'center',
    label: 'India UNCRPD Report',
    meta: `${DATA.metadata.expectedPoints} numbered points • ${DATA.metadata.sourcesTotal} citation notes`,
    x: 0, y: 0, z: 80,
    badge: 'Overview'
  };
  nodes.push(center);
  
  const arts = DATA.articles.map(a => ({
    id: 'article:' + a.title,
    type: 'article',
    label: a.title.replace('Article ', 'Art. ').replace('Articles ', 'Art. '),
    meta: `Points ${a.start}-${a.end} • ${a.count} points • ${a.sourceCount} sources`,
    badge: a.themes[0] || 'Section',
    article: a.title
  }));
  
  const positionedArts = radialLayout(arts, 520, -Math.PI / 2, 10);
  positionedArts.forEach(n => {
    nodes.push(n);
    links.push({ source: 'center', target: n.id, type: 'strong' });
  });
  
  return { nodes, links };
}

function getThemesLayout() {
  const nodes = [];
  const links = [];
  
  const center = {
    id: 'center',
    type: 'center',
    label: 'Thematic Hubs',
    meta: 'Cross-cutting themes across the numbered report',
    x: 0, y: 0, z: 80,
    badge: 'Themes'
  };
  nodes.push(center);
  
  const themeCounts = DATA.themes.map(t => ({
    theme: t,
    count: DATA.points.filter(p => p.themes.includes(t)).length
  }));
  
  const items = themeCounts.map(t => ({
    id: 'theme:' + t.theme,
    type: 'theme',
    label: t.theme,
    meta: `${t.count} linked report points`,
    badge: 'Theme',
    theme: t.theme
  }));
  
  const positionedThemes = radialLayout(items, 470, 0, 10);
  
  positionedThemes.forEach((n, i) => {
    nodes.push(n);
    links.push({ source: 'center', target: n.id, type: 'strong' });
    
    // Add up to 6 sample points around each theme hub
    const samples = DATA.points
      .filter(p => p.themes.includes(n.theme))
      .slice(0, 6)
      .map(p => ({
        id: 'point:' + p.no,
        type: 'point',
        label: String(p.no),
        point: p.no
      }));
      
    const positionedSamples = radialLayout(samples, 95, i, 0);
    positionedSamples.forEach(s => {
      s.x += n.x;
      s.y += n.y;
      nodes.push(s);
      links.push({ source: n.id, target: s.id, type: 'normal' });
    });
  });
  
  return { nodes, links };
}

function getSourcesLayout() {
  const nodes = [];
  const links = [];
  
  const center = {
    id: 'center',
    type: 'center',
    label: 'Citation Source Index',
    meta: `${DATA.sources.length} extracted footnotes & citation notes`,
    x: 0, y: 0, z: 80,
    badge: 'Sources'
  };
  nodes.push(center);
  
  const types = {};
  DATA.sources.forEach(s => {
    types[s.type] = (types[s.type] || 0) + 1;
  });
  
  const typeNodes = Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      id: 'stype:' + type,
      type: 'source',
      label: type,
      meta: `${count} sources`,
      badge: 'Source Type',
      stype: type
    }));
    
  const positionedTypes = radialLayout(typeNodes, 360, -0.4, 20);
  
  positionedTypes.forEach((n, i) => {
    nodes.push(n);
    links.push({ source: 'center', target: n.id, type: 'strong' });
    
    // Renders up to 14 source nodes in a sub-circle around the type
    const srcs = DATA.sources
      .filter(s => s.type === n.stype)
      .slice(0, 12)
      .map(s => ({
        id: 'source:' + s.id,
        type: 'source',
        label: 'Source ' + s.id,
        meta: trunc(s.text, 60),
        source: s.id
      }));
      
    const positionedSrcs = radialLayout(srcs, 140, i * 0.3, 0);
    positionedSrcs.forEach(s => {
      s.x += n.x;
      s.y += n.y;
      nodes.push(s);
      links.push({ source: n.id, target: s.id, type: 'sourceEdge' });
    });
  });
  
  return { nodes, links };
}

function getAllPointsLayout() {
  const nodes = [];
  const links = [];
  
  const center = {
    id: 'center',
    type: 'center',
    label: 'All Numbered Points',
    meta: `${DATA.points.length} points extracted`,
    x: 0, y: 0, z: 80,
    badge: 'Grand Spiral'
  };
  nodes.push(center);
  
  // Filter points if there's a filter selection (like an article or theme)
  const pts = DATA.points
    .filter(p => !state.filter || p.article === state.filter || p.themes.includes(state.filter))
    .map(p => ({
      id: 'point:' + p.no,
      type: 'point',
      label: String(p.no),
      point: p.no
    }));
    
  const positionedPts = spiralLayout(pts, 140, 25, -0.5);
  positionedPts.forEach(n => {
    nodes.push(n);
    links.push({ source: 'center', target: n.id, type: 'normal' });
  });
  
  return { nodes, links };
}

// Custom layout when a single Article is focused (Expanded view)
function getArticleLayout(title) {
  const nodes = [];
  const links = [];
  
  const a = byArticle.get(title);
  const center = {
    id: 'article:' + title,
    type: 'article center',
    label: title.replace('Article ', 'Art. '),
    meta: a ? `${a.count} points • ${a.sourceCount} citation notes` : 'Article Section',
    x: 0, y: 0, z: 100,
    badge: 'Expanded Chapter'
  };
  nodes.push(center);
  
  const pts = DATA.points
    .filter(p => p.article === title)
    .map(p => ({
      id: 'point:' + p.no,
      type: 'point',
      label: String(p.no),
      point: p.no
    }));
    
  const positionedPts = spiralLayout(pts, 150, 28, 0);
  positionedPts.forEach(n => {
    nodes.push(n);
    links.push({ source: center.id, target: n.id, type: 'normal' });
  });
  
  // Article sources outer ring
  const srcIds = [...new Set(DATA.points.filter(p => p.article === title).flatMap(p => p.sourceIds))].slice(0, 32);
  const srcNodes = srcIds.map(id => ({
    id: 'source:' + id,
    type: 'source',
    label: 'Src ' + id,
    meta: trunc((bySource.get(id) || {}).text, 55),
    source: id
  }));
  
  const positionedSrcs = radialLayout(srcNodes, 670, Math.PI / 10, -25);
  positionedSrcs.forEach(n => {
    nodes.push(n);
    links.push({ source: center.id, target: n.id, type: 'sourceEdge' });
  });
  
  return { nodes, links };
}

// Custom layout when a single Theme is focused (Expanded view)
function getThemeLayout(theme) {
  const nodes = [];
  const links = [];
  
  const linked = DATA.points.filter(p => p.themes.includes(theme));
  const center = {
    id: 'theme:' + theme,
    type: 'theme center',
    label: theme,
    meta: `${linked.length} linked report points`,
    x: 0, y: 0, z: 100,
    badge: 'Theme Hub'
  };
  nodes.push(center);
  
  const pts = linked.map(p => ({
    id: 'point:' + p.no,
    type: 'point',
    label: String(p.no),
    point: p.no
  }));
  
  const positionedPts = spiralLayout(pts, 150, 28, 0.25);
  positionedPts.forEach(n => {
    nodes.push(n);
    links.push({ source: center.id, target: n.id, type: 'normal' });
  });
  
  // Linked articles outer ring
  const articles = [...new Set(linked.map(p => p.article))].map(artTitle => ({
    id: 'article:' + artTitle,
    type: 'article',
    label: artTitle.replace('Article ', 'Art. ').replace('Articles ', 'Art. '),
    meta: `${linked.filter(p => p.article === artTitle).length} theme points`,
    article: artTitle
  }));
  
  const positionedArts = radialLayout(articles, 650, -0.7, -20);
  positionedArts.forEach(n => {
    nodes.push(n);
    links.push({ source: center.id, target: n.id, type: 'strong' });
  });
  
  return { nodes, links };
}

// Custom layout when a single point is focused
function getPointLayout(no) {
  const nodes = [];
  const links = [];
  
  const p = byPoint.get(no);
  if (!p) return { nodes, links };
  
  const center = {
    id: 'point:' + p.no,
    type: 'point center',
    label: 'Point ' + p.no,
    meta: trunc(p.title, 80),
    x: 0, y: 0, z: 110,
    badge: 'Selected'
  };
  nodes.push(center);
  
  // Link to parent Article
  const art = {
    id: 'article:' + p.article,
    type: 'article',
    label: p.article.replace('Article ', 'Art. ').replace('Articles ', 'Art. '),
    meta: p.subsection || 'Section Context',
    article: p.article,
    x: -420, y: 0, z: 30
  };
  nodes.push(art);
  links.push({ source: center.id, target: art.id, type: 'strong' });
  
  // Link to corresponding Themes (surrounding circle)
  const ts = p.themes.map(t => ({
    id: 'theme:' + t,
    type: 'theme',
    label: t,
    theme: t
  }));
  const positionedThemes = radialLayout(ts, 260, -1.4, 15);
  positionedThemes.forEach(n => {
    nodes.push(n);
    links.push({ source: center.id, target: n.id, type: 'normal' });
  });
  
  // Link to citation Sources (surrounding circle)
  const srcs = p.sourceIds.map(id => ({
    id: 'source:' + id,
    type: 'source',
    label: 'Source ' + id,
    meta: trunc((bySource.get(id) || {}).text, 80),
    source: id
  }));
  const positionedSrcs = radialLayout(srcs, 420, 0.4, 0);
  positionedSrcs.forEach(n => {
    nodes.push(n);
    links.push({ source: center.id, target: n.id, type: 'sourceEdge' });
  });
  
  // Link to neighbor Points (context sequence)
  const neighbors = DATA.points
    .filter(x => x.article === p.article && Math.abs(x.no - p.no) <= 3 && x.no !== p.no)
    .map(x => ({
      id: 'point:' + x.no,
      type: 'point',
      label: String(x.no),
      point: x.no
    }));
  const positionedNeighbors = radialLayout(neighbors, 230, 2.4, -15);
  positionedNeighbors.forEach(n => {
    nodes.push(n);
    links.push({ source: center.id, target: n.id, type: 'normal' });
  });
  
  return { nodes, links };
}

// Render data based on current state view mode
function triggerGraphRender() {
  let layout;
  
  if (state.selected && state.selected.type === 'article') {
    layout = getArticleLayout(state.selected.article);
    document.getElementById('current-mode-label').textContent = 'Article Chapter View';
  } else if (state.selected && state.selected.type === 'theme') {
    layout = getThemeLayout(state.selected.theme);
    document.getElementById('current-mode-label').textContent = 'Thematic Connected View';
  } else if (state.selected && state.selected.type === 'point') {
    layout = getPointLayout(state.selected.point);
    document.getElementById('current-mode-label').textContent = `Point ${state.selected.point} Citation Web`;
  } else {
    // Standard Global Modes
    switch (state.mode) {
      case 'themes':
        layout = getThemesLayout();
        document.getElementById('current-mode-label').textContent = 'Thematic Aggregation Map';
        break;
      case 'sources':
        layout = getSourcesLayout();
        document.getElementById('current-mode-label').textContent = 'Citation Bibliography Index';
        break;
      case 'allpoints':
        layout = getAllPointsLayout();
        document.getElementById('current-mode-label').textContent = 'All Report Points Map';
        break;
      case 'overview':
      default:
        layout = getOverviewLayout();
        document.getElementById('current-mode-label').textContent = 'Report Structure Overview';
        break;
    }
  }
  
  graph3D.setData(layout.nodes, layout.links);
}

// Side Panel Detail Inspector Renderers
const inspectorPanel = document.getElementById('detail-inspector-body');

function renderDefaultInspector() {
  inspectorPanel.innerHTML = `
    <div class="default-inspector-state">
      <div class="inspector-icon">ℹ️</div>
      <h3>Select a Node</h3>
      <p>Click on any article circle, theme, citation node, or numbered point in the 3D map to view its details, context figures, and source bibliography notes.</p>
      <div class="quick-tips">
        <h4>Quick Shortcuts</h4>
        <ul>
          <li><strong>Left-Click Drag:</strong> Rotate 3D graph camera</li>
          <li><strong>Scroll Wheel:</strong> Zoom in & out</li>
          <li><strong>Double Click:</strong> Reset camera positioning</li>
        </ul>
      </div>
    </div>
  `;
}

// Lookup mapped figure files for points/captions
function getFigureEmbedHTML(caption, sectionName) {
  // Normalize key lookup
  const cleanCap = caption.split(':')[0].trim(); // e.g. "Figure 1" or "Table 3"
  const imgFile = CAPTION_IMAGE_MAP[cleanCap];
  
  if (!imgFile || imgFile === 'None') return '';
  
  return `
    <div class="figure-embed-card">
      <div class="figure-img-container" onclick="openImageModal('images/${imgFile}', '${esc(caption)}')">
        <img src="images/${imgFile}" alt="${esc(caption)}" loading="lazy">
        <div class="figure-zoom-overlay">
          <span class="zoom-icon">🔍 Click to Zoom</span>
        </div>
      </div>
      <div class="figure-caption">${esc(caption)}</div>
    </div>
  `;
}

function showArticleDetails(title) {
  const a = byArticle.get(title);
  const pts = DATA.points.filter(p => p.article === title);
  
  // Find any figures associated with this article
  const figures = DATA.metadata.figuresAndTables.filter(f => f.section === title);
  const figuresHTML = figures.map(f => getFigureEmbedHTML(f.caption, title)).join('');
  
  inspectorPanel.innerHTML = `
    <div class="kicker">Article / Section</div>
    <h2 class="detail-title">${esc(title)}</h2>
    
    <div class="chips-container">
      <span class="badge-chip accent">Points ${a ? a.start : 0}-${a ? a.end : 0}</span>
      <span class="badge-chip accent">${a ? a.count : 0} Points</span>
      <span class="badge-chip accent">${a ? a.sourceCount : 0} Citations</span>
    </div>
    
    <p class="detail-description">${esc(a?.summary || 'Article section extracted from the UNCRPD India report.')}</p>
    
    ${figuresHTML ? `<div class="sub-section-header">Visual Infographics (${figures.length})</div>${figuresHTML}` : ''}
    
    <div class="sub-section-header">Point Index</div>
    <div class="inspector-list">
      ${pts.slice(0, 60).map(p => `
        <div class="inspector-list-item" onclick="selectPoint(${p.no})">
          <h5>Point ${p.no}</h5>
          <p>${esc(trunc(p.title, 140))}</p>
          <small>${esc(p.subsection || '')}</small>
        </div>
      `).join('')}
      ${pts.length > 60 ? `<div class="empty-state">Showing first 60 points. Use map search to view other points.</div>` : ''}
    </div>
  `;
}

function showThemeDetails(theme) {
  const pts = DATA.points.filter(p => p.themes.includes(theme));
  
  inspectorPanel.innerHTML = `
    <div class="kicker">Cross-cutting Theme</div>
    <h2 class="detail-title">${esc(theme)}</h2>
    
    <div class="chips-container">
      <span class="badge-chip accent">${pts.length} Linked Points</span>
      <span class="badge-chip accent">${new Set(pts.map(p => p.article)).size} Connected Chapters</span>
    </div>
    
    <p class="detail-description">This rights theme runs across multiple articles and points in the UNCRPD report. Selecting it displays its full network map.</p>
    
    <div class="sub-section-header">Linked Numbered Points</div>
    <div class="inspector-list">
      ${pts.slice(0, 60).map(p => `
        <div class="inspector-list-item" onclick="selectPoint(${p.no})">
          <h5>Point ${p.no}</h5>
          <p>${esc(trunc(p.title, 140))}</p>
          <small>${esc(p.article)}</small>
        </div>
      `).join('')}
      ${pts.length > 60 ? `<div class="empty-state">Showing first 60 linked points. Use search for exact filter.</div>` : ''}
    </div>
  `;
}

function showPointDetails(no) {
  const p = byPoint.get(no);
  if (!p) return;
  
  const sources = p.sourceIds.map(id => bySource.get(String(id))).filter(Boolean);
  
  // Let's check if there are figures mentioned or placed in this point's section
  const sectionFigures = DATA.metadata.figuresAndTables.filter(f => f.section === p.article);
  // Find direct figure/table string matching inside text to display it
  let directFigureHTML = '';
  sectionFigures.forEach(f => {
    const cleanCap = f.caption.split(':')[0].trim();
    if (p.text.includes(cleanCap) || p.title.includes(cleanCap)) {
      directFigureHTML += getFigureEmbedHTML(f.caption, p.article);
    }
  });
  
  // If no direct figure, but there are section figures, let's offer to load them
  const fallbackFiguresHTML = directFigureHTML ? '' : sectionFigures.map(f => {
    const cleanCap = f.caption.split(':')[0].trim();
    const imgFile = CAPTION_IMAGE_MAP[cleanCap];
    if (imgFile && imgFile !== 'None') {
      return `<button class="btn btn-action" style="font-size:11px;padding:4px 8px;margin-bottom:6px" onclick="openImageModal('images/${imgFile}', '${esc(f.caption)}')">View ${cleanCap}</button> `;
    }
    return '';
  }).join('');

  inspectorPanel.innerHTML = `
    <div class="kicker">Numbered Paragraph Point</div>
    <h2 class="detail-title">Point ${p.no}</h2>
    
    <div class="chips-container">
      <span class="badge-chip accent">${esc(p.article)}</span>
      ${p.subsection ? `<span class="badge-chip accent">${esc(p.subsection)}</span>` : ''}
      ${p.themes.map(t => `<span class="badge-chip">${esc(t)}</span>`).join('')}
      <span class="badge-chip accent">${sources.length} Footnote${sources.length !== 1 ? 's' : ''}</span>
    </div>
    
    <p class="detail-description" style="font-weight:500; font-size:14px; line-height:1.6; border-left:3px solid var(--accent-cyan); padding-left:12px; margin-bottom:20px;">
      ${esc(p.text)}
    </p>
    
    ${directFigureHTML ? `<div class="sub-section-header">Direct Figure Reference</div>${directFigureHTML}` : ''}
    
    ${fallbackFiguresHTML ? `<div class="sub-section-header">Related Chapter Visuals</div><div style="margin-bottom:14px">${fallbackFiguresHTML}</div>` : ''}
    
    <div class="sub-section-header">Footnotes & Bibliography Bibliography</div>
    <div class="inspector-list">
      ${sources.length ? sources.map(s => `
        <div class="inspector-list-item source-item" onclick="showSourceDetails('${s.id}')">
          <h5>Source Footnote ${s.id}</h5>
          <p>${esc(s.text)}</p>
          <small>Type: ${esc(s.type)} · Linked by ${s.points.length} points</small>
        </div>
      `).join('') : `<div class="notice" style="padding:10px; font-size:12px; background:rgba(255,255,255,0.02); color:var(--color-muted); border-radius:8px">No direct footnote citation attached to this paragraph.</div>`}
    </div>
  `;
}

function showSourceDetails(id) {
  const s = bySource.get(String(id));
  if (!s) return;
  
  inspectorPanel.innerHTML = `
    <div class="kicker">Citation Footnote Source</div>
    <h2 class="detail-title">Source ${s.id}</h2>
    
    <div class="chips-container">
      <span class="badge-chip accent">${esc(s.type)}</span>
      <span class="badge-chip accent">Linked by ${s.points.length} Paragraphs</span>
    </div>
    
    <p class="detail-description" style="font-size:14px; padding:12px; background:rgba(255,121,198,0.06); border:1px solid rgba(255,121,198,0.15); border-radius:10px;">
      ${esc(s.text)}
    </p>
    
    <div class="sub-section-header">Linked Numbered Points</div>
    <div class="inspector-list">
      ${s.points.map(no => {
        const p = byPoint.get(no);
        return p ? `
          <div class="inspector-list-item" onclick="selectPoint(${no})">
            <h5>Point ${no}</h5>
            <p>${esc(trunc(p.title, 140))}</p>
            <small>${esc(p.article)}</small>
          </div>
        ` : '';
      }).join('')}
    </div>
  `;
}

// Selector hooks for updating active node details
function selectPoint(no) {
  state.selected = { type: 'point', point: no, id: 'point:' + no };
  triggerGraphRender();
  graph3D.selectNode('point:' + no);
  showPointDetails(no);
}

function selectArticle(title) {
  state.selected = { type: 'article', article: title, id: 'article:' + title };
  triggerGraphRender();
  graph3D.selectNode('article:' + title);
  showArticleDetails(title);
}

function selectTheme(theme) {
  state.selected = { type: 'theme', theme: theme, id: 'theme:' + theme };
  triggerGraphRender();
  graph3D.selectNode('theme:' + theme);
  showThemeDetails(theme);
}

// Raycasted callback mapping from Three.js node clicks
function handleNodeSelection(nodeData) {
  if (nodeData.type.includes('article') && nodeData.article) {
    state.selected = { type: 'article', article: nodeData.article, id: nodeData.id };
    showArticleDetails(nodeData.article);
    triggerGraphRender();
  } else if (nodeData.type.includes('theme') && nodeData.theme) {
    state.selected = { type: 'theme', theme: nodeData.theme, id: nodeData.id };
    showThemeDetails(nodeData.theme);
    triggerGraphRender();
  } else if (nodeData.type.includes('point') && nodeData.point) {
    state.selected = { type: 'point', point: nodeData.point, id: nodeData.id };
    showPointDetails(nodeData.point);
    triggerGraphRender();
  } else if (nodeData.type.includes('source') && nodeData.source) {
    state.selected = { type: 'source', source: nodeData.source, id: nodeData.id };
    showSourceDetails(nodeData.source);
  } else if (nodeData.id === 'center') {
    state.selected = null;
    renderDefaultInspector();
    triggerGraphRender();
  }
}

// Dynamic Filter Population
function populateFilters() {
  const filterSelect = document.getElementById('filter-select');
  
  // Articles
  DATA.articles.forEach(a => {
    const opt = document.createElement('option');
    opt.value = 'article:' + a.title;
    opt.textContent = a.title;
    filterSelect.appendChild(opt);
  });
  
  // Separator
  const sep = document.createElement('option');
  sep.disabled = true;
  sep.textContent = '────── Themes ──────';
  filterSelect.appendChild(sep);
  
  // Themes
  DATA.themes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = 'theme:' + t;
    opt.textContent = t;
    filterSelect.appendChild(opt);
  });
}

// Real-time Search Index & Query Matching
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const resultsList = document.getElementById('search-results-list');
  
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsList.innerHTML = '';
    
    if (!q) {
      resultsList.innerHTML = `<div class="empty-state">Search query matching keywords will display hits here.</div>`;
      return;
    }
    
    const hits = [];
    
    // Search Articles
    DATA.articles.forEach(a => {
      if ((a.title + ' ' + a.summary).toLowerCase().includes(q)) {
        hits.push({
          type: 'article',
          title: a.title,
          sub: `Article Section · Points ${a.start}-${a.end}`,
          click: () => selectArticle(a.title)
        });
      }
    });
    
    // Search Themes
    DATA.themes.forEach(t => {
      if (t.toLowerCase().includes(q)) {
        hits.push({
          type: 'theme',
          title: t,
          sub: 'Thematic Hub Node',
          click: () => selectTheme(t)
        });
      }
    });
    
    // Search Points
    DATA.points.forEach(p => {
      if ((String(p.no) + ' ' + p.text + ' ' + p.article + ' ' + (p.subsection || '')).toLowerCase().includes(q)) {
        hits.push({
          type: 'point',
          title: `Point ${p.no}`,
          sub: trunc(p.title, 140),
          click: () => selectPoint(p.no)
        });
      }
    });
    
    // Search Sources
    DATA.sources.forEach(s => {
      if ((String(s.id) + ' ' + s.text + ' ' + s.type).toLowerCase().includes(q)) {
        hits.push({
          type: 'source',
          title: `Source Footnote ${s.id} · ${s.type}`,
          sub: trunc(s.text, 140),
          click: () => {
            showSourceDetails(s.id);
            graph3D.selectNode('source:' + s.id);
          }
        });
      }
    });
    
    // Render Hits
    if (!hits.length) {
      resultsList.innerHTML = `<div class="empty-state">No matching case laws, schemes, articles, or citations found.</div>`;
      return;
    }
    
    hits.slice(0, 40).forEach(h => {
      const el = document.createElement('div');
      el.className = 'search-hit-item';
      el.innerHTML = `
        <b>${esc(h.title)}</b>
        <span>${esc(h.sub)}</span>
      `;
      el.onclick = h.click;
      resultsList.appendChild(el);
    });
  });
}

// Animated Chibi Tour Mascot Configurations
// We create the list of steps for the interactive tour
const tourSteps = [
  {
    chapter: "Chapter 1/6: Overview Map",
    title: "Ami's UNCRPD Interactive Tour!",
    text: "Hello! I'm Ami, your rights guide guardian. I'll walk you through the key findings of the UNCRPD report for India. We are starting at the Overview Map showing the 31 articles of the report clustered around the central hub. Click **Next** to proceed!",
    expression: "happy",
    action: () => {
      state.selected = null;
      state.mode = 'overview';
      triggerGraphRender();
      graph3D.resetView();
    }
  },
  {
    chapter: "Chapter 2/6: Demographic Profile",
    title: "Disability Population Split",
    text: "Let's inspect the demographic data. According to Census 2011, India recorded 26.8 million persons with disabilities (2.21% of the total population). Look at the details panel on the right: it displays **Figure 1** and **Figure 2** which present the disability prevalence by source and rural-urban population split.",
    expression: "excited",
    action: () => {
      selectPoint(3);
    }
  },
  {
    chapter: "Chapter 3/6: Rights Act, 2016",
    title: "Rights of Persons with Disabilities Act",
    text: "Here we see the primary legislative milestone. The RPwD Act, 2016 came into force on April 19, 2017, aligning Indian domestic law with the UNCRPD. It expanded specified disability categories from 7 to 21, and raised government job reservations to 4%. Check out **Figure 6** for details on these changes!",
    expression: "happy",
    action: () => {
      selectPoint(8);
    }
  },
  {
    chapter: "Chapter 4/6: Universal Accessibility",
    title: "Accessible India Campaign",
    text: "Accessibility is vital. Under the Sugamya Bharat Abhiyan (Accessible India Campaign), over 1,600 government buildings, all major railway stations, and 71% of schools have been made barrier-free. You can review the built environment indicators in **Figure 16** and digital accessibility frameworks in **Figure 17**.",
    expression: "excited",
    action: () => {
      selectArticle("Article 9: Accessibility");
    }
  },
  {
    chapter: "Chapter 5/6: Access to Justice",
    title: "Landmark Judicial Precedents",
    text: "The Supreme Court has played a critical role in enforcing rights. In *Vikash Kumar*, the Court granted scribes as a reasonable accommodation for non-benchmark disabilities. In *Rajive Raturi*, accessibility was affirmed as integral to the right to life. See **Figure 21** and **Figure 22** for equal recognition maps.",
    expression: "thinking",
    action: () => {
      selectPoint(9);
    }
  },
  {
    chapter: "Chapter 6/6: Inclusive Education",
    title: "Inclusive Education Support",
    text: "Finally, let's explore Article 24 (Education). The right to education guarantees free, barrier-free schooling for children with disabilities, supported by pupil-teacher ratios and special allowances. Look at the comprehensive inclusive education ecosystem layout shown in **Figure 40** on the right!",
    expression: "happy",
    action: () => {
      selectArticle("Article 24 - Education");
    }
  }
];

let typeTimer = null;
function typeSpeechText(text) {
  const container = document.getElementById('tour-step-text');
  if (typeTimer) clearInterval(typeTimer);
  container.textContent = '';
  
  let i = 0;
  typeTimer = setInterval(() => {
    if (i < text.length) {
      container.textContent += text[i];
      i++;
    } else {
      clearInterval(typeTimer);
    }
  }, 14);
}

function updateMascotAvatar(expression) {
  const avatar = document.getElementById('mascot-avatar');
  avatar.className = 'mascot-avatar ' + expression;
}

function executeTourStep(index) {
  if (index < 0 || index >= tourSteps.length) return;
  state.currentTourStep = index;
  
  const step = tourSteps[index];
  
  // Update texts
  document.getElementById('tour-chapter-badge').textContent = step.chapter;
  document.getElementById('tour-step-title').textContent = step.title;
  typeSpeechText(step.text);
  
  // Update avatar anime styling
  updateMascotAvatar(step.expression);
  
  // Trigger layout navigation
  step.action();
  
  // Button active controls
  document.getElementById('tour-back-btn').disabled = (index === 0);
  const nextBtn = document.getElementById('tour-next-btn');
  if (index === tourSteps.length - 1) {
    nextBtn.textContent = 'Finish';
  } else {
    nextBtn.textContent = 'Next';
  }
  
  // Trigger speedlines burst effect for chapter transitions
  const speedlines = document.getElementById('tour-speedlines');
  speedlines.style.animation = 'none';
  void speedlines.offsetWidth; // Trigger reflow
  speedlines.style.animation = 'speedlines-spin 25s linear infinite';
}

function startStoryTour() {
  state.tourActive = true;
  document.getElementById('story-tour-overlay').classList.remove('hidden');
  executeTourStep(0);
}

function exitStoryTour() {
  state.tourActive = false;
  document.getElementById('story-tour-overlay').classList.add('hidden');
  if (typeTimer) clearInterval(typeTimer);
  graph3D.resetView();
  renderDefaultInspector();
}

// Fullscreen Image Modal Expanded Viewer
const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-image-src');
const modalCaption = document.getElementById('modal-image-caption');

function openImageModal(src, caption) {
  modalImg.src = src;
  modalCaption.textContent = caption;
  imageModal.classList.remove('hidden');
}

function closeImageModal() {
  imageModal.classList.add('hidden');
  modalImg.src = '';
}

// Binds all DOM elements and UI triggers
function bindUIEvents() {
  // Stats
  document.getElementById('stat-points').textContent = DATA.metadata.realExtractedPoints || DATA.metadata.pointsTotal;
  document.getElementById('stat-citations').textContent = DATA.metadata.sourcesTotal;
  document.getElementById('stat-articles').textContent = DATA.metadata.articlesTotal;
  document.getElementById('stat-themes').textContent = DATA.themes.length;
  
  // Graph view modes toggle buttons
  document.querySelectorAll('[data-mode]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.mode = b.dataset.mode;
      state.selected = null;
      triggerGraphRender();
      renderDefaultInspector();
      graph3D.resetView();
    });
  });
  
  // Dropdown filter change
  const filterSelect = document.getElementById('filter-select');
  filterSelect.addEventListener('change', () => {
    const val = filterSelect.value;
    if (!val) {
      state.selected = null;
      state.filter = '';
      triggerGraphRender();
      renderDefaultInspector();
      return;
    }
    
    const [type, key] = val.split(':');
    if (type === 'article') {
      selectArticle(key);
    } else if (type === 'theme') {
      selectTheme(key);
    }
  });
  
  // Custom Tilt slider
  const sliderTilt = document.getElementById('slider-tilt');
  sliderTilt.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('slider-tilt-val').textContent = `${val}°`;
    graph3D.setTilt(val);
  });
  
  // Custom Density slider
  const sliderDensity = document.getElementById('slider-density');
  sliderDensity.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('slider-density-val').textContent = `${val}%`;
    graph3D.setDensity(val / 100);
  });
  
  // General Action buttons
  document.getElementById('reset-view-btn').addEventListener('click', () => {
    graph3D.resetView();
    state.selected = null;
    triggerGraphRender();
    renderDefaultInspector();
  });
  
  document.getElementById('toggle-right-btn').addEventListener('click', () => {
    document.getElementById('sidebar-right').classList.toggle('collapsed');
  });
  
  // Mascot guided tour buttons
  document.getElementById('start-tour-btn').addEventListener('click', startStoryTour);
  document.getElementById('tour-exit-btn').addEventListener('click', exitStoryTour);
  document.getElementById('tour-back-btn').addEventListener('click', () => {
    if (state.currentTourStep > 0) {
      executeTourStep(state.currentTourStep - 1);
    }
  });
  document.getElementById('tour-next-btn').addEventListener('click', () => {
    if (state.currentTourStep < tourSteps.length - 1) {
      executeTourStep(state.currentTourStep + 1);
    } else {
      exitStoryTour();
    }
  });
  
  // Close modal
  document.getElementById('close-modal-btn').addEventListener('click', closeImageModal);
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) closeImageModal();
  });
  
  // Export Data JSON
  document.getElementById('download-json-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'uncrpd_india_research_report.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

// App Initialization entry point
window.addEventListener('DOMContentLoaded', () => {
  initDataIndexes();
  populateFilters();
  bindUIEvents();
  
  // Initialize WebGL Graph
  window.graph3D = new UNCRPDGraph3D(
    'threejs-canvas',
    'threejs-wrapper',
    handleNodeSelection
  );
  
  triggerGraphRender();
  renderDefaultInspector();
  initSearch();
});

// Expose open modal globally so it can be called from inline onclick attributes in details templates
window.openImageModal = openImageModal;
window.selectPoint = selectPoint;
window.showSourceDetails = showSourceDetails;
