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
  theme: localStorage.getItem('uncrpd_theme') || 'dark',
  
  // Guided Story Tour State
  tourActive: false,
  currentTourStep: 0,
  
  // Interactive Layout Tutorial State
  tutorialActive: false,
  currentTutorialStep: 0,

  // Sidebar Toggling & Sound State
  leftCollapsed: false,
  rightCollapsed: false,
  voiceMuted: localStorage.getItem('uncrpd_voice_muted') === 'true',

  // 5s Viewport Hover Zen Focus Mode State
  zenActive: false
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

// Voiceover Speech Engine for Ami Tutorial Guide
let speechUtterance = null;
function speakAmi(text) {
  if (state.voiceMuted) return;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    // Strip HTML tags and markdown symbols before reading
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/[*#]/g, '').trim();
    speechUtterance = new SpeechSynthesisUtterance(cleanText);
    
    const voices = window.speechSynthesis.getVoices();
    let voice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Female'));
    if (!voice) {
      voice = voices.find(v => v.lang.startsWith('en'));
    }
    if (voice) {
      speechUtterance.voice = voice;
    }
    
    speechUtterance.pitch = 1.25; // Mascot tone
    speechUtterance.rate = 1.0;
    
    window.speechSynthesis.speak(speechUtterance);
  }
}

function updateVoiceMuteUI() {
  const tourVoiceBtn = document.getElementById('tour-voice-btn');
  const tutVoiceBtn = document.getElementById('tut-voice-btn');
  const icon = state.voiceMuted ? '🔇' : '🔊';
  
  if (tourVoiceBtn) {
    tourVoiceBtn.textContent = icon;
    tourVoiceBtn.classList.toggle('muted', state.voiceMuted);
  }
  if (tutVoiceBtn) {
    tutVoiceBtn.textContent = icon;
    tutVoiceBtn.classList.toggle('muted', state.voiceMuted);
  }
}

function toggleVoiceMute() {
  state.voiceMuted = !state.voiceMuted;
  localStorage.setItem('uncrpd_voice_muted', state.voiceMuted);
  updateVoiceMuteUI();
  if (state.voiceMuted && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  } else if (!state.voiceMuted) {
    if (state.tourActive) {
      const step = tourSteps[state.currentTourStep];
      if (step) speakAmi(step.text);
    } else if (state.tutorialActive) {
      const step = helpTutorialSteps[state.currentTutorialStep];
      if (step) speakAmi(step.text);
    }
  }
}

// Pre-load voices
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
}

// Index all raw JSON data for quick lookups
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
    meta: `${DATA.sources.length} footnote/source entries extracted`,
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

function getFigureEmbedHTML(caption, sectionName) {
  const cleanCap = caption.split(':')[0].trim();
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
  
  const figures = DATA.metadata.figuresAndTables.filter(f => f.section === title);
  const figuresHTML = figures.map(f => getFigureEmbedHTML(f.caption, title)).join('');
  
  inspectorPanel.innerHTML = `
    <div class="bonsai-frame">
      <div class="kicker">Article / Section</div>
      <h2 class="detail-title">${esc(title)}</h2>
      
      <div class="chips-container">
        <span class="badge-chip accent">Points ${a ? a.start : 0}-${a ? a.end : 0}</span>
        <span class="badge-chip accent">${a ? a.count : 0} Points</span>
        <span class="badge-chip accent">${a ? a.sourceCount : 0} Citations</span>
      </div>
      
      <p class="detail-description">${esc(a?.summary || 'Article section extracted from the UNCRPD India report.')}</p>
      
      <button class="btn btn-action btn-doc-highlight" style="margin-top: 12px; width: 100%; justify-content: center; display: flex; align-items: center; gap: 8px;" onclick="openInDocViewer('${esc(title)}')">
        <span>📄 Open Chapter in Official Report Doc</span>
      </button>
    </div>
    
    ${figuresHTML ? `
      <details class="bonsai-accordion">
        <summary>Visual Infographics (${figures.length})</summary>
        <div class="accordion-content">
          ${figuresHTML}
        </div>
      </details>
    ` : ''}
    
    <details class="bonsai-accordion" open>
      <summary>Point Index (${pts.length} Paragraphs)</summary>
      <div class="accordion-content">
        <div class="inspector-list" style="margin-top: 10px;">
          ${pts.slice(0, 60).map(p => `
            <div class="inspector-list-item" onclick="selectPoint(${p.no})">
              <h5>Point ${p.no}</h5>
              <p>${esc(trunc(p.title, 140))}</p>
              <small>${esc(p.subsection || '')}</small>
            </div>
          `).join('')}
          ${pts.length > 60 ? `<div class="empty-state">Showing first 60 points. Use map search to view other points.</div>` : ''}
        </div>
      </div>
    </details>
  `;
}

function showThemeDetails(theme) {
  const pts = DATA.points.filter(p => p.themes.includes(theme));
  
  inspectorPanel.innerHTML = `
    <div class="bonsai-frame">
      <div class="kicker">Cross-cutting Theme</div>
      <h2 class="detail-title">${esc(theme)}</h2>
      
      <div class="chips-container">
        <span class="badge-chip accent">${pts.length} Linked Points</span>
        <span class="badge-chip accent">${new Set(pts.map(p => p.article)).size} Connected Chapters</span>
      </div>
      
      <p class="detail-description">This rights theme runs across multiple articles and points in the UNCRPD report. Selecting it displays its full network map.</p>
    </div>
    
    <details class="bonsai-accordion" open>
      <summary>Linked Numbered Points (${pts.length})</summary>
      <div class="accordion-content">
        <div class="inspector-list" style="margin-top: 10px;">
          ${pts.slice(0, 60).map(p => `
            <div class="inspector-list-item" onclick="selectPoint(${p.no})">
              <h5>Point ${p.no}</h5>
              <p>${esc(trunc(p.title, 140))}</p>
              <small>${esc(p.article)}</small>
            </div>
          `).join('')}
          ${pts.length > 60 ? `<div class="empty-state">Showing first 60 linked points. Use search for exact filter.</div>` : ''}
        </div>
      </div>
    </details>
  `;
}

function showPointDetails(no) {
  const p = byPoint.get(no);
  if (!p) return;
  
  const sources = p.sourceIds.map(id => bySource.get(String(id))).filter(Boolean);
  
  const sectionFigures = DATA.metadata.figuresAndTables.filter(f => f.section === p.article);
  let directFigureHTML = '';
  sectionFigures.forEach(f => {
    const cleanCap = f.caption.split(':')[0].trim();
    if (p.text.includes(cleanCap) || p.title.includes(cleanCap)) {
      directFigureHTML += getFigureEmbedHTML(f.caption, p.article);
    }
  });
  
  const fallbackFiguresHTML = directFigureHTML ? '' : sectionFigures.map(f => {
    const cleanCap = f.caption.split(':')[0].trim();
    const imgFile = CAPTION_IMAGE_MAP[cleanCap];
    if (imgFile && imgFile !== 'None') {
      return `<button class="btn btn-action" style="font-size:11px;padding:4px 8px;margin-bottom:6px" onclick="openImageModal('images/${imgFile}', '${esc(f.caption)}')">View ${cleanCap}</button> `;
    }
    return '';
  }).join('');

  inspectorPanel.innerHTML = `
    <div class="bonsai-frame">
      <div class="kicker">Numbered Paragraph Point</div>
      <h2 class="detail-title">Point ${p.no}</h2>
      
      <div class="chips-container">
        <span class="badge-chip accent">${esc(p.article)}</span>
        ${p.subsection ? `<span class="badge-chip accent">${esc(p.subsection)}</span>` : ''}
        ${p.themes.map(t => `<span class="badge-chip">${esc(t)}</span>`).join('')}
        <span class="badge-chip accent">${sources.length} Footnote${sources.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div class="bonsai-quote-card">
        ${esc(p.text)}
      </div>
      
      <button class="btn btn-action btn-doc-highlight" style="margin-top: 10px; width: 100%; justify-content: center; display: flex; align-items: center; gap: 8px;" onclick="openInDocViewer('Point ${p.no} - ${esc(p.article)}')">
        <span>📄 Open Point in Official Report Doc</span>
      </button>
    </div>
    
    ${directFigureHTML ? `
      <details class="bonsai-accordion" open>
        <summary>Direct Figure Reference</summary>
        <div class="accordion-content">
          ${directFigureHTML}
        </div>
      </details>
    ` : ''}
    
    ${fallbackFiguresHTML ? `
      <details class="bonsai-accordion">
        <summary>Related Chapter Visuals</summary>
        <div class="accordion-content" style="padding-top: 14px;">
          <div style="margin-bottom:14px">${fallbackFiguresHTML}</div>
        </div>
      </details>
    ` : ''}
    
    <details class="bonsai-accordion" ${sources.length ? 'open' : ''}>
      <summary>Footnotes & Bibliography (${sources.length})</summary>
      <div class="accordion-content">
        <div class="inspector-list" style="margin-top: 10px;">
          ${sources.length ? sources.map(s => `
            <div class="inspector-list-item source-item" onclick="showSourceDetails('${s.id}')">
              <h5>Source Footnote ${s.id}</h5>
              <p>${esc(s.text)}</p>
              <small>Type: ${esc(s.type)} · Linked by ${s.points.length} points</small>
            </div>
          `).join('') : `<div class="notice" style="padding:10px; font-size:12px; background:rgba(255,255,255,0.02); color:var(--color-muted); border-radius:8px">No direct footnote citation attached to this paragraph.</div>`}
        </div>
      </div>
    </details>
  `;
}

function showSourceDetails(id) {
  const s = bySource.get(String(id));
  if (!s) return;
  
  inspectorPanel.innerHTML = `
    <div class="bonsai-frame">
      <div class="kicker">Citation Footnote Source</div>
      <h2 class="detail-title">Source ${s.id}</h2>
      
      <div class="chips-container">
        <span class="badge-chip accent">${esc(s.type)}</span>
        <span class="badge-chip accent">Linked by ${s.points.length} Paragraphs</span>
      </div>
      
      <div class="bonsai-quote-card" style="border-left-color: var(--accent-pink); background: rgba(255, 121, 198, 0.04);">
        ${esc(s.text)}
      </div>
    </div>
    
    <details class="bonsai-accordion" open>
      <summary>Linked Numbered Points (${s.points.length})</summary>
      <div class="accordion-content">
        <div class="inspector-list" style="margin-top: 10px;">
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
      </div>
    </details>
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
  
  DATA.articles.forEach(a => {
    const opt = document.createElement('option');
    opt.value = 'article:' + a.title;
    opt.textContent = a.title;
    filterSelect.appendChild(opt);
  });
  
  const sep = document.createElement('option');
  sep.disabled = true;
  sep.textContent = '────── Themes ──────';
  filterSelect.appendChild(sep);
  
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

// Guided Story Tour Steps
// =========================================================================
// AMI 3-LEVEL STORY & AUTOPILOT TOUR DEFINITIONS
// =========================================================================
const tourLevel1Steps = [
  {
    chapter: "Level 1 (1/4): 3D Constellation",
    title: "India UNCRPD 3D Mind Map",
    text: "Welcome to the India UNCRPD State Report! I'm Ami, your rights guide guardian. This central 3D cosmos maps all 31 Articles, numbered points, and legal citations into an interactive starlight constellation. Drag to tilt and rotate, or scroll to zoom!",
    expression: "happy",
    action: () => {
      state.selected = null;
      state.mode = 'overview';
      triggerGraphRender();
      graph3D.resetView();
    }
  },
  {
    chapter: "Level 1 (2/4): Modes & Clustering",
    title: "Perspectives & Geometry Sliders",
    text: "You can switch perspectives anytime: explore cross-cutting thematic hubs, browse footnote sources, or examine all points. Use the Tilt and Spread sliders on the left to customize the graph geometry for your screen!",
    expression: "excited",
    action: () => {
      state.mode = 'themes';
      triggerGraphRender();
      graph3D.resetView();
    }
  },
  {
    chapter: "Level 1 (3/4): Real-time Search",
    title: "Instant Legal Search & Filters",
    text: "Type any case law (like 'Vikash Kumar'), statute ('RPwD Act'), or key phrase into the search box to jump directly to relevant report points and citations in real time!",
    expression: "happy",
    action: () => {
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.focus();
    }
  },
  {
    chapter: "Level 1 (4/4): Official In-Doc Viewer",
    title: "Live Report Doc & Themes",
    text: "Need to check the original submission? Click '📄 Report Doc' at the top to browse the official India UNCRPD state document directly inside the dashboard with chapter quick-jumps! You can also switch between Dark, Light, and Reading modes anytime.",
    expression: "excited",
    action: () => {
      state.mode = 'overview';
      triggerGraphRender();
      graph3D.resetView();
    }
  }
];

const tourLevel2Steps = [
  {
    chapter: "Level 2 (1/4): Demographic Baseline",
    title: "Point 3: Census Disability Profile",
    text: "Let's begin our case study with the demographics. Census 2011 records 26.8 million persons with disabilities across India. In the right panel, Figure 1 and Figure 2 illustrate the disability type distribution and rural-urban population split.",
    expression: "excited",
    action: () => {
      selectPoint(3);
    }
  },
  {
    chapter: "Level 2 (2/4): Universal Accessibility",
    title: "Point 18: Sugamya Bharat Abhiyan",
    text: "Under Article 9 (Accessibility), the Accessible India Campaign has retrofitted over 1,600 government buildings, major transit terminals, and public websites with national harmonized accessibility guidelines.",
    expression: "happy",
    action: () => {
      selectPoint(18);
    }
  },
  {
    chapter: "Level 2 (3/4): Inclusive Education",
    title: "Point 52: Samagra Shiksha Support",
    text: "Under Article 24, India's Right to Education mandate provides barrier-free classrooms, individualized education plans, special educator allocations, and accessible digital learning resources for children with disabilities.",
    expression: "excited",
    action: () => {
      selectPoint(52);
    }
  },
  {
    chapter: "Level 2 (4/4): Employment Rights",
    title: "Point 94: RPwD Act Statutory Quotas",
    text: "Under Article 27, the RPwD Act 2016 mandates a 4% public sector employment reservation, incentivizes private sector hiring, and prohibits disability discrimination in job promotions and postings.",
    expression: "happy",
    action: () => {
      selectPoint(94);
    }
  }
];

const tourLevel3Steps = [
  {
    chapter: "Level 3 Autopilot (1/10): Core Principles",
    title: "Point 1: Human Dignity & Inherent Worth",
    text: "Autopilot engaged! Step 1 explores the foundational principles of the UNCRPD: individual autonomy, non-discrimination, full participation, and respect for difference across all statutory frameworks.",
    expression: "happy",
    action: () => selectPoint(1)
  },
  {
    chapter: "Level 3 Autopilot (2/10): Reasonable Accommodation",
    title: "Point 7: Article 5 Equality Mandate",
    text: "Reasonable accommodation is recognized as a non-negotiable fundamental right. Denial of necessary modifications constitutes prohibited discrimination under Article 5.",
    expression: "thinking",
    action: () => selectPoint(7)
  },
  {
    chapter: "Level 3 Autopilot (3/10): Women & Girls",
    title: "Point 12: Article 6 Intersectional Protections",
    text: "Addressing multiple vulnerabilities: dedicated institutional safeguards, reproductive healthcare access, and safety mechanisms for women and children with disabilities.",
    expression: "excited",
    action: () => selectPoint(12)
  },
  {
    chapter: "Level 3 Autopilot (4/10): Infrastructure Audits",
    title: "Point 18: Article 9 Built Environment Standards",
    text: "Sugamya Bharat Abhiyan mandates comprehensive accessibility audits for physical infrastructure, public transport fleets, and government digital portals.",
    expression: "happy",
    action: () => selectPoint(18)
  },
  {
    chapter: "Level 3 Autopilot (5/10): Legal Capacity",
    title: "Point 31: Article 12 Supported Decision-Making",
    text: "Reforming legal guardianship: shifting from plenary substituted guardianship to supported decision-making frameworks ensuring individual will and preferences are respected.",
    expression: "thinking",
    action: () => selectPoint(31)
  },
  {
    chapter: "Level 3 Autopilot (6/10): Inclusive Curriculum",
    title: "Point 52: Article 24 Early Childhood to Higher Ed",
    text: "Universal access to education with Indian Sign Language (ISL) standardization, Braille textbook distribution, and specialized resource rooms across districts.",
    expression: "excited",
    action: () => selectPoint(52)
  },
  {
    chapter: "Level 3 Autopilot (7/10): Employment Mandate",
    title: "Point 68: Article 27 4% Public Sector Reservation",
    text: "Ensuring economic independence through statutory public sector reservations and reasonable accommodation in workplace assessments.",
    expression: "happy",
    action: () => selectPoint(68)
  },
  {
    chapter: "Level 3 Autopilot (8/10): Vocational Skills",
    title: "Point 74: DEPwD Skill Development Programs",
    text: "National Action Plan for Skill Development providing vocational certifications, assistive tech kits, and self-employment micro-credit support.",
    expression: "excited",
    action: () => selectPoint(74)
  },
  {
    chapter: "Level 3 Autopilot (9/10): Landmark Judicial Precedents",
    title: "Point 9: Vikash Kumar & Rajive Raturi Rulings",
    text: "The Supreme Court in Vikash Kumar affirmed scribes as an essential accommodation for all disabilities, and in Rajive Raturi mandated time-bound national accessibility compliance.",
    expression: "thinking",
    action: () => selectPoint(9)
  },
  {
    chapter: "Level 3 Autopilot (10/10): Disaggregated Data",
    title: "Point 137: Article 31 Evidence-Based Policy",
    text: "Concluding our research tour! Establishing national disability databases (UDID card ecosystem) to inform targeted welfare interventions and track international treaty compliance.",
    expression: "happy",
    action: () => selectPoint(137)
  }
];

let activeTourSteps = tourLevel1Steps;
let currentTourLevel = 1;
let autopilotTimer = null;
let typeTimer = null;

function typeSpeechText(text, targetId = 'tour-step-text') {
  const container = document.getElementById(targetId);
  if (typeTimer) clearInterval(typeTimer);
  if (!container) return;
  container.textContent = '';
  
  let i = 0;
  typeTimer = setInterval(() => {
    if (i < text.length) {
      container.textContent += text[i];
      i++;
    } else {
      clearInterval(typeTimer);
    }
  }, 12);
}

function updateMascotAvatar(expression, avatarId = 'mascot-avatar') {
  const avatar = document.getElementById(avatarId);
  if (avatar) avatar.className = 'mascot-avatar ' + expression;
}

function executeTourStep(index) {
  if (index < 0 || index >= activeTourSteps.length) return;
  state.currentTourStep = index;
  
  const step = activeTourSteps[index];
  
  const badgeEl = document.getElementById('tour-chapter-badge');
  const titleEl = document.getElementById('tour-step-title');
  if (badgeEl) badgeEl.textContent = step.chapter;
  if (titleEl) titleEl.textContent = step.title;
  
  typeSpeechText(step.text, 'tour-step-text');
  updateMascotAvatar(step.expression, 'mascot-avatar');
  
  step.action();
  speakAmi(step.text);
  
  const backBtn = document.getElementById('tour-back-btn');
  const nextBtn = document.getElementById('tour-next-btn');
  if (backBtn) backBtn.disabled = (index === 0);
  if (nextBtn) {
    if (index === activeTourSteps.length - 1) {
      nextBtn.textContent = 'Finish';
    } else {
      nextBtn.textContent = 'Next';
    }
  }
  
  // Autopilot handling for Level 3
  if (currentTourLevel === 3 && state.tourActive) {
    if (autopilotTimer) clearTimeout(autopilotTimer);
    if (index < activeTourSteps.length - 1) {
      autopilotTimer = setTimeout(() => {
        if (state.tourActive && currentTourLevel === 3) {
          executeTourStep(index + 1);
        }
      }, 7000);
    }
  }
  
  const speedlines = document.getElementById('tour-speedlines');
  if (speedlines) {
    speedlines.style.animation = 'none';
    void speedlines.offsetWidth;
    speedlines.style.animation = 'speedlines-spin 25s linear infinite';
  }
}

function openTourLevelModal() {
  const modal = document.getElementById('tour-level-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeTourLevelModal() {
  const modal = document.getElementById('tour-level-modal');
  if (modal) modal.classList.add('hidden');
}

function startTourLevel(level) {
  closeTourLevelModal();
  if (state.tutorialActive) exitHelpTutorial();
  
  currentTourLevel = level;
  if (level === 1) activeTourSteps = tourLevel1Steps;
  else if (level === 2) activeTourSteps = tourLevel2Steps;
  else if (level === 3) activeTourSteps = tourLevel3Steps;
  
  state.tourActive = true;
  const overlay = document.getElementById('story-tour-overlay');
  if (overlay) overlay.classList.remove('hidden');
  
  executeTourStep(0);
}

function startStoryTour() {
  openTourLevelModal();
}

function exitStoryTour() {
  state.tourActive = false;
  if (autopilotTimer) clearTimeout(autopilotTimer);
  const overlay = document.getElementById('story-tour-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (typeTimer) clearInterval(typeTimer);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  graph3D.resetView();
  renderDefaultInspector();
}

// DEDICATED HELP TUTORIAL WIDGET
function startHelpTutorial() {
  openTourLevelModal();
}

function exitHelpTutorial() {
  state.tutorialActive = false;
  const overlay = document.getElementById('tutorial-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (typeTimer) clearInterval(typeTimer);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const spotlight = document.getElementById('tutorial-spotlight');
  if (spotlight) spotlight.style.display = 'none';
  graph3D.resetView();
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
  document.getElementById('stat-points').textContent = DATA.metadata.realExtractedPoints || DATA.metadata.pointsTotal;
  document.getElementById('stat-citations').textContent = DATA.metadata.sourcesTotal;
  document.getElementById('stat-articles').textContent = DATA.metadata.articlesTotal;
  document.getElementById('stat-themes').textContent = DATA.themes.length;
  
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
  
  const sliderTilt = document.getElementById('slider-tilt');
  sliderTilt.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('slider-tilt-val').textContent = `${val}°`;
    graph3D.setTilt(val);
  });
  
  const sliderDensity = document.getElementById('slider-density');
  sliderDensity.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('slider-density-val').textContent = `${val}%`;
    graph3D.setDensity(val / 100);
  });
  
  document.getElementById('reset-view-btn').addEventListener('click', () => {
    graph3D.resetView();
    state.selected = null;
    triggerGraphRender();
    renderDefaultInspector();
  });
  
  // Sidebar Toggling & Reopen Handle Logic
  const sidebarLeft = document.getElementById('sidebar-left');
  const sidebarRight = document.getElementById('sidebar-right');
  const closeLeftBtn = document.getElementById('close-left-btn');
  const closeRightBtn = document.getElementById('close-right-btn');
  const reopenLeftBtn = document.getElementById('reopen-left-btn');
  const reopenRightBtn = document.getElementById('reopen-right-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const appContainer = document.querySelector('.app-container');
  const zenPill = document.getElementById('zen-focus-pill');
  
  function updateSidebarBackdrop() {
    const isMobileTablet = window.innerWidth <= 1024;
    const isAnyOpen = !sidebarLeft.classList.contains('collapsed') || !sidebarRight.classList.contains('collapsed');
    if (isMobileTablet && isAnyOpen) {
      sidebarBackdrop.classList.remove('hidden');
    } else {
      sidebarBackdrop.classList.add('hidden');
    }
  }

  function collapseLeft() {
    sidebarLeft.classList.add('collapsed');
    reopenLeftBtn.classList.remove('hidden');
    state.leftCollapsed = true;
    updateSidebarBackdrop();
    setTimeout(() => { if (window.graph3D) window.graph3D.resize(); }, 350);
  }

  function expandLeft() {
    sidebarLeft.classList.remove('collapsed');
    reopenLeftBtn.classList.add('hidden');
    state.leftCollapsed = false;
    if (window.innerWidth <= 1024) {
      collapseRight();
    }
    updateSidebarBackdrop();
    setTimeout(() => { if (window.graph3D) window.graph3D.resize(); }, 350);
  }

  function collapseRight() {
    sidebarRight.classList.add('collapsed');
    reopenRightBtn.classList.remove('hidden');
    state.rightCollapsed = true;
    updateSidebarBackdrop();
    setTimeout(() => { if (window.graph3D) window.graph3D.resize(); }, 350);
  }

  function expandRight() {
    sidebarRight.classList.remove('collapsed');
    reopenRightBtn.classList.add('hidden');
    state.rightCollapsed = false;
    if (window.innerWidth <= 1024) {
      collapseLeft();
    }
    updateSidebarBackdrop();
    setTimeout(() => { if (window.graph3D) window.graph3D.resize(); }, 350);
  }

  closeLeftBtn.addEventListener('click', collapseLeft);
  reopenLeftBtn.addEventListener('click', expandLeft);
  closeRightBtn.addEventListener('click', collapseRight);
  reopenRightBtn.addEventListener('click', expandRight);
  
  document.getElementById('toggle-right-btn').addEventListener('click', () => {
    if (sidebarRight.classList.contains('collapsed')) {
      expandRight();
    } else {
      collapseRight();
    }
  });

  sidebarBackdrop.addEventListener('click', () => {
    collapseLeft();
    collapseRight();
  });

  window.addEventListener('resize', updateSidebarBackdrop);

  // =========================================================================
  // 5-SECOND HOVER AUTO-ZEN FOCUS MODE
  // =========================================================================
  let zenHoverTimer = null;

  function activateZenFocusMode() {
    if (state.zenActive || state.tourActive || state.tutorialActive) return;
    state.zenActive = true;
    if (appContainer) appContainer.classList.add('zen-focus-mode');
    if (zenPill) zenPill.classList.remove('hidden');
    setTimeout(() => { if (window.graph3D) window.graph3D.resize(); }, 350);
  }

  function deactivateZenFocusMode() {
    if (!state.zenActive) return;
    state.zenActive = false;
    if (appContainer) appContainer.classList.remove('zen-focus-mode');
    if (zenPill) zenPill.classList.add('hidden');
    if (zenHoverTimer) {
      clearTimeout(zenHoverTimer);
      zenHoverTimer = null;
    }
    setTimeout(() => { if (window.graph3D) window.graph3D.resize(); }, 350);
  }

  function resetZenHoverTimer() {
    if (zenHoverTimer) clearTimeout(zenHoverTimer);
    if (!state.zenActive && !state.tourActive && !state.tutorialActive) {
      zenHoverTimer = setTimeout(() => {
        activateZenFocusMode();
      }, 5000); // 5 seconds of viewport interaction
    }
  }

  function cancelZenHoverTimer() {
    if (zenHoverTimer) {
      clearTimeout(zenHoverTimer);
      zenHoverTimer = null;
    }
  }

  const viewportContainer = document.getElementById('viewport-container');
  const threeCanvas = document.getElementById('threejs-canvas');
  
  if (viewportContainer) {
    viewportContainer.addEventListener('pointerenter', () => {
      resetZenHoverTimer();
    });
    
    viewportContainer.addEventListener('pointermove', (e) => {
      // If user moves towards the edges in Zen mode, restore sidebars
      if (state.zenActive) {
        if (e.clientX < 50 || e.clientX > window.innerWidth - 60) {
          deactivateZenFocusMode();
        }
      } else {
        // Reset 5s timer if not in zen mode
        resetZenHoverTimer();
      }
    });

    viewportContainer.addEventListener('pointerleave', () => {
      cancelZenHoverTimer();
    });
  }

  const zenExitBtn = document.getElementById('zen-exit-btn');
  if (zenExitBtn) {
    zenExitBtn.addEventListener('click', deactivateZenFocusMode);
  }

  // Restore on sidebar interaction or key press
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      deactivateZenFocusMode();
      closeInDocViewer();
      closeImageModal();
    }
  });

  // =========================================================================
  // INBUILT TABLE OF CONTENTS & GOOGLE DRIVE VIEWER CONTROLLER
  // =========================================================================
  const indocModal = document.getElementById('indoc-modal');
  const indocIframe = document.getElementById('indoc-iframe');
  const indocSpinner = document.getElementById('indoc-spinner');
  const indocContainer = document.querySelector('.indoc-modal-container');
  const indocBody = document.getElementById('indoc-modal-body');
  const indocViewerBtn = document.getElementById('indoc-viewer-btn');
  const closeIndocBtn = document.getElementById('close-indoc-btn');
  const indocFullscreenBtn = document.getElementById('indoc-fullscreen-btn');
  const indocToggleTocBtn = document.getElementById('indoc-toggle-toc-btn');
  const indocTocList = document.getElementById('indoc-toc-list');
  const indocTocSearch = document.getElementById('indoc-toc-search');
  const indocTocFilters = document.getElementById('indoc-toc-filters');
  const indocSectionPreview = document.getElementById('indoc-section-preview');
  const previewTitle = document.getElementById('preview-section-title');
  const previewMeta = document.getElementById('preview-section-meta');
  const previewSummary = document.getElementById('preview-section-summary');
  const previewFocus3dBtn = document.getElementById('preview-focus-3d-btn');
  const closePreviewBtn = document.getElementById('close-preview-btn');
  const DOC_PREVIEW_URL = 'https://drive.google.com/file/d/1y3Lsy7hITnZfzWgbRUCHY7v7wSIYlVsn/preview';

  let currentTocFilter = 'all';
  let activeTocArticle = null;

  function renderTableOfContents(filterText = '', categoryFilter = 'all') {
    if (!indocTocList || !DATA.articles) return;
    indocTocList.innerHTML = '';

    const q = (filterText || '').toLowerCase().trim();

    const filteredArticles = DATA.articles.filter(art => {
      // Category filtering
      if (categoryFilter !== 'all') {
        const titleL = art.title.toLowerCase();
        const themesL = (art.themes || []).join(' ').toLowerCase();
        if (categoryFilter === 'legal' && !titleL.includes('general') && !themesL.includes('legal') && !titleL.includes('1-4')) return false;
        if (categoryFilter === 'rights' && !themesL.includes('equality') && !themesL.includes('women') && !themesL.includes('children') && !themesL.includes('justice')) return false;
        if (categoryFilter === 'access' && !themesL.includes('accessibility') && !themesL.includes('mobility')) return false;
        if (categoryFilter === 'edu-work' && !themesL.includes('education') && !themesL.includes('employment') && !themesL.includes('work')) return false;
      }

      if (!q) return true;
      const matchTitle = art.title.toLowerCase().includes(q);
      const matchSummary = (art.summary || '').toLowerCase().includes(q);
      const matchThemes = (art.themes || []).some(t => t.toLowerCase().includes(q));
      const matchPts = `points ${art.start}-${art.end}`.includes(q) || `${art.start}` === q || `${art.end}` === q;
      return matchTitle || matchSummary || matchThemes || matchPts;
    });

    const countEl = document.getElementById('indoc-toc-count');
    if (countEl) countEl.textContent = `${filteredArticles.length} of ${DATA.articles.length} Articles`;

    if (filteredArticles.length === 0) {
      indocTocList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--color-muted); font-size: 12px;">
          No articles match "${filterText}". Try another keyword!
        </div>
      `;
      return;
    }

    filteredArticles.forEach(art => {
      const item = document.createElement('div');
      item.className = `indoc-toc-item ${activeTocArticle && activeTocArticle.id === art.id ? 'active' : ''}`;
      item.innerHTML = `
        <div class="toc-item-top">
          <span class="toc-item-title">${art.title}</span>
          <span class="toc-item-badge">Pts ${art.start}-${art.end} (${art.count})</span>
        </div>
        <div class="toc-item-summary">${art.summary || 'Click to view section excerpts and 3D constellation focus.'}</div>
      `;

      item.addEventListener('click', () => {
        selectTocArticle(art);
      });

      indocTocList.appendChild(item);
    });
  }

  function selectTocArticle(art) {
    activeTocArticle = art;
    document.querySelectorAll('.indoc-toc-item').forEach(el => el.classList.remove('active'));
    
    // Show Preview Drawer
    if (indocSectionPreview) {
      indocSectionPreview.classList.remove('hidden');
      if (previewTitle) previewTitle.textContent = art.title;
      if (previewMeta) previewMeta.textContent = `Paragraphs ${art.start} to ${art.end} • ${art.count} Points • Themes: ${(art.themes || []).join(', ')}`;
      if (previewSummary) previewSummary.textContent = art.summary;
      
      if (previewFocus3dBtn) {
        previewFocus3dBtn.onclick = () => {
          closeInDocViewer();
          if (window.graph3D) {
            window.graph3D.selectNode(art.id);
          }
        };
      }
    }
  }

  if (indocTocSearch) {
    indocTocSearch.addEventListener('input', (e) => {
      renderTableOfContents(e.target.value, currentTocFilter);
    });
  }

  if (indocTocFilters) {
    indocTocFilters.querySelectorAll('.toc-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        indocTocFilters.querySelectorAll('.toc-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentTocFilter = pill.dataset.filter || 'all';
        renderTableOfContents(indocTocSearch ? indocTocSearch.value : '', currentTocFilter);
      });
    });
  }

  if (closePreviewBtn && indocSectionPreview) {
    closePreviewBtn.addEventListener('click', () => {
      indocSectionPreview.classList.add('hidden');
    });
  }

  if (indocToggleTocBtn && indocBody) {
    indocToggleTocBtn.addEventListener('click', () => {
      indocBody.classList.toggle('toc-collapsed');
    });
  }

  function openInDocViewer(sectionHint = '') {
    if (!indocModal) return;
    indocModal.classList.remove('hidden');
    deactivateZenFocusMode();
    renderTableOfContents(indocTocSearch ? indocTocSearch.value : '', currentTocFilter);
    
    if (sectionHint) {
      const targetArt = DATA.articles.find(a => a.id === sectionHint || a.title.toLowerCase().includes(sectionHint.toLowerCase()));
      if (targetArt) {
        selectTocArticle(targetArt);
      }
    }
    
    if (!indocIframe.src || indocIframe.src === '' || indocIframe.src === window.location.href) {
      if (indocSpinner) indocSpinner.classList.remove('hidden');
      indocIframe.src = DOC_PREVIEW_URL;
      indocIframe.onload = () => {
        if (indocSpinner) indocSpinner.classList.add('hidden');
      };
    } else {
      if (indocSpinner) indocSpinner.classList.add('hidden');
    }
  }

  function closeInDocViewer() {
    if (!indocModal) return;
    indocModal.classList.add('hidden');
    if (indocContainer) indocContainer.classList.remove('fullscreen');
  }

  function toggleInDocFullscreen() {
    if (indocContainer) {
      const isFull = indocContainer.classList.toggle('fullscreen');
      if (indocFullscreenBtn) {
        indocFullscreenBtn.textContent = isFull ? '✕ Exit Fullscreen' : '⛶ Fullscreen';
      }
    }
  }

  if (indocViewerBtn) indocViewerBtn.addEventListener('click', () => openInDocViewer());
  if (closeIndocBtn) closeIndocBtn.addEventListener('click', closeInDocViewer);
  if (indocFullscreenBtn) indocFullscreenBtn.addEventListener('click', toggleInDocFullscreen);
  
  if (indocModal) {
    indocModal.addEventListener('click', (e) => {
      if (e.target === indocModal) closeInDocViewer();
    });
  }

  // Mute Voice toggles
  document.getElementById('tour-voice-btn').addEventListener('click', toggleVoiceMute);
  document.getElementById('tut-voice-btn').addEventListener('click', toggleVoiceMute);
  updateVoiceMuteUI();
  
  // =========================================================================
  // 3-WAY THEME SWITCHER (Dark / Light / Reading-Friendly)
  // =========================================================================
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  
  function applyTheme(themeName) {
    state.theme = themeName;
    document.body.classList.remove('light-theme', 'reading-theme');
    
    if (themeName === 'reading') {
      document.body.classList.add('reading-theme');
      if (themeToggleBtn) themeToggleBtn.textContent = '📖 Reading Mode';
    } else if (themeName === 'light') {
      document.body.classList.add('light-theme');
      if (themeToggleBtn) themeToggleBtn.textContent = '☀️ Light Mode';
    } else {
      // Dark Mode default
      if (themeToggleBtn) themeToggleBtn.textContent = '🌙 Dark Mode';
    }
    
    localStorage.setItem('uncrpd_theme', themeName);
    if (window.graph3D) {
      window.graph3D.setTheme(themeName);
    }
    
    if (state.tutorialActive) {
      executeHelpStep(state.currentTutorialStep);
    }
  }

  function cycleTheme() {
    if (state.theme === 'dark') {
      applyTheme('light');
    } else if (state.theme === 'light') {
      applyTheme('reading');
    } else {
      applyTheme('dark');
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', cycleTheme);
  }

  // Apply initial saved theme
  applyTheme(state.theme);
  
  // Tour Level Selector Modal actions
  const closeTourLevelBtn = document.getElementById('close-tour-level-btn');
  if (closeTourLevelBtn) closeTourLevelBtn.addEventListener('click', closeTourLevelModal);
  
  const tourLevelModal = document.getElementById('tour-level-modal');
  if (tourLevelModal) {
    tourLevelModal.addEventListener('click', (e) => {
      if (e.target === tourLevelModal) closeTourLevelModal();
    });
  }

  document.querySelectorAll('.level-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = parseInt(btn.dataset.level || '1');
      startTourLevel(level);
    });
  });

  // Story Tour Button actions
  document.getElementById('start-tour-btn').addEventListener('click', startStoryTour);
  document.getElementById('tour-exit-btn').addEventListener('click', exitStoryTour);
  document.getElementById('tour-back-btn').addEventListener('click', () => {
    if (state.currentTourStep > 0) {
      executeTourStep(state.currentTourStep - 1);
    }
  });
  document.getElementById('tour-next-btn').addEventListener('click', () => {
    if (state.currentTourStep < activeTourSteps.length - 1) {
      executeTourStep(state.currentTourStep + 1);
    } else {
      exitStoryTour();
    }
  });
  
  // Help Tutorial Button actions
  document.getElementById('help-tutorial-btn').addEventListener('click', startHelpTutorial);
  
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

// =========================================================================
// SPACE ANOMALIES & EASTER EGGS CONTROLLER
// =========================================================================
function initSpaceAnomalies() {
  const anomaliesBtn = document.getElementById('anomalies-btn');
  const anomalyActions = ['blackhole', 'solarflare', 'quake', 'meteor'];
  let anomalyIndex = 0;

  function triggerNextAnomaly() {
    const action = anomalyActions[anomalyIndex % anomalyActions.length];
    anomalyIndex++;
    
    if (action === 'blackhole') {
      if (window.graph3D) window.graph3D.triggerBlackHole((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 150, 40);
    } else if (action === 'solarflare') {
      if (window.graph3D) window.graph3D.triggerSolarFlare();
    } else if (action === 'quake') {
      if (window.graph3D) window.graph3D.triggerCosmicQuake();
    } else if (action === 'meteor') {
      if (window.graph3D) window.graph3D.triggerMeteorShower();
    }
  }

  if (anomaliesBtn) {
    anomaliesBtn.addEventListener('click', triggerNextAnomaly);
  }

  // Keyboard Shortcuts for Space Anomalies
  window.addEventListener('keydown', (e) => {
    // Ignore if typing in input
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    
    if (e.key === 'b' || e.key === 'B') {
      if (window.graph3D) window.graph3D.triggerBlackHole(0, 0, 50);
    } else if (e.key === 's' || e.key === 'S') {
      if (window.graph3D) window.graph3D.triggerSolarFlare();
    } else if (e.key === 'q' || e.key === 'Q') {
      if (window.graph3D) window.graph3D.triggerCosmicQuake();
    } else if (e.key === 'm' || e.key === 'M') {
      if (window.graph3D) window.graph3D.triggerMeteorShower();
    }
  });

  // Ambient random anomalies every 50 seconds to keep cosmos alive!
  setInterval(() => {
    if (!document.hidden && !state.tourActive) {
      triggerNextAnomaly();
    }
  }, 50000);
}

// App Initialization entry point
window.addEventListener('DOMContentLoaded', () => {
  initDataIndexes();
  populateFilters();
  bindUIEvents();
  
  window.graph3D = new UNCRPDGraph3D(
    'threejs-canvas',
    'threejs-wrapper',
    handleNodeSelection
  );

  // Sync 3D theme with initial state
  window.graph3D.setTheme(state.theme);
  
  triggerGraphRender();
  renderDefaultInspector();
  initSearch();
  initSpaceAnomalies();
});

// Expose open modal and in-doc viewer globally so it can be called from inline onclick attributes
window.openImageModal = openImageModal;
window.selectPoint = selectPoint;
window.showSourceDetails = showSourceDetails;
window.openInDocViewer = (hint) => {
  const indocModal = document.getElementById('indoc-modal');
  const indocIframe = document.getElementById('indoc-iframe');
  const indocSpinner = document.getElementById('indoc-spinner');
  const DOC_PREVIEW_URL = 'https://drive.google.com/file/d/1y3Lsy7hITnZfzWgbRUCHY7v7wSIYlVsn/preview';
  
  if (indocModal) {
    indocModal.classList.remove('hidden');
    if (!indocIframe.src || indocIframe.src === '' || indocIframe.src === window.location.href) {
      if (indocSpinner) indocSpinner.classList.remove('hidden');
      indocIframe.src = DOC_PREVIEW_URL;
      indocIframe.onload = () => {
        if (indocSpinner) indocSpinner.classList.add('hidden');
      };
    }
  }
};
