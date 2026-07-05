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
  
  // Guided Story Tour State
  tourActive: false,
  currentTourStep: 0,
  
  // Interactive Layout Tutorial State
  tutorialActive: false,
  currentTutorialStep: 0,

  // Sidebar Toggling & Sound State
  leftCollapsed: false,
  rightCollapsed: false,
  voiceMuted: localStorage.getItem('uncrpd_voice_muted') === 'true'
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
const tourSteps = [
  {
    chapter: "Chapter 1/6: Overview Map",
    title: "Ami's UNCRPD Interactive Tour!",
    text: "Hello! I'm Ami, your rights guide guardian. I'll walk you through the key findings of the UNCRPD report for India. We are starting at the Overview Map showing the 31 articles of the report clustered around the central hub. Click Next to proceed!",
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
    text: "Let's inspect the demographic data. According to Census 2011, India recorded 26.8 million persons with disabilities (2.21% of the total population). Look at the details panel on the right: it displays Figure 1 and Figure 2 which present the disability prevalence by source and rural-urban population split.",
    expression: "excited",
    action: () => {
      selectPoint(3);
    }
  },
  {
    chapter: "Chapter 3/6: Rights Act, 2016",
    title: "Rights of Persons with Disabilities Act",
    text: "Here we see the primary legislative milestone. The RPwD Act, 2016 came into force on April 19, 2017, aligning Indian domestic law with the UNCRPD. It expanded specified disability categories from 7 to 21, and raised government job reservations to 4%. Check out Figure 6 for details on these changes!",
    expression: "happy",
    action: () => {
      selectPoint(8);
    }
  },
  {
    chapter: "Chapter 4/6: Universal Accessibility",
    title: "Accessible India Campaign",
    text: "Accessibility is vital. Under the Sugamya Bharat Abhiyan (Accessible India Campaign), over 1,600 government buildings, all major railway stations, and 71% of schools have been made barrier-free. You can review the built environment indicators in Figure 16 and digital accessibility frameworks in Figure 17.",
    expression: "excited",
    action: () => {
      selectArticle("Article 9: Accessibility");
    }
  },
  {
    chapter: "Chapter 5/6: Access to Justice",
    title: "Landmark Judicial Precedents",
    text: "The Supreme Court has played a critical role in enforcing rights. In Vikash Kumar, the Court granted scribes as a reasonable accommodation for non-benchmark disabilities. In Rajive Raturi, accessibility was affirmed as integral to the right to life. See Figure 21 and Figure 22 for equal recognition maps.",
    expression: "thinking",
    action: () => {
      selectPoint(9);
    }
  },
  {
    chapter: "Chapter 6/6: Inclusive Education",
    title: "Inclusive Education Support",
    text: "Finally, let's explore Article 24 (Education). The right to education guarantees free, barrier-free schooling for children with disabilities, supported by pupil-teacher ratios and special allowances. Look at the comprehensive inclusive education ecosystem layout shown in Figure 40 on the right!",
    expression: "happy",
    action: () => {
      selectArticle("Article 24 - Education");
    }
  }
];

let typeTimer = null;
function typeSpeechText(text, targetId = 'tour-step-text') {
  const container = document.getElementById(targetId);
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

function updateMascotAvatar(expression, avatarId = 'mascot-avatar') {
  const avatar = document.getElementById(avatarId);
  if (avatar) avatar.className = 'mascot-avatar ' + expression;
}

function executeTourStep(index) {
  if (index < 0 || index >= tourSteps.length) return;
  state.currentTourStep = index;
  
  const step = tourSteps[index];
  
  document.getElementById('tour-chapter-badge').textContent = step.chapter;
  document.getElementById('tour-step-title').textContent = step.title;
  typeSpeechText(step.text, 'tour-step-text');
  updateMascotAvatar(step.expression, 'mascot-avatar');
  
  step.action();
  speakAmi(step.text);
  
  document.getElementById('tour-back-btn').disabled = (index === 0);
  const nextBtn = document.getElementById('tour-next-btn');
  if (index === tourSteps.length - 1) {
    nextBtn.textContent = 'Finish';
  } else {
    nextBtn.textContent = 'Next';
  }
  
  const speedlines = document.getElementById('tour-speedlines');
  speedlines.style.animation = 'none';
  void speedlines.offsetWidth;
  speedlines.style.animation = 'speedlines-spin 25s linear infinite';
}

function startStoryTour() {
  if (state.tutorialActive) exitHelpTutorial();
  state.tourActive = true;
  document.getElementById('story-tour-overlay').classList.remove('hidden');
  executeTourStep(0);
}

function exitStoryTour() {
  state.tourActive = false;
  document.getElementById('story-tour-overlay').classList.add('hidden');
  if (typeTimer) clearInterval(typeTimer);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  graph3D.resetView();
  renderDefaultInspector();
}

// DEDICATED HELP TUTORIAL WIDGET
const helpTutorialSteps = [
  {
    badge: "Step 1/5: Interactive 3D Map",
    title: "Control the 3D Mind Map",
    text: "This central workspace renders the report nodes in WebGL. Left-click drag to rotate the network; scroll your mouse wheel to zoom in and out. Click any node to focus the camera and view its details!",
    targetId: "threejs-wrapper",
    expression: "happy",
    action: () => {
      graph3D.resetView();
    }
  },
  {
    badge: "Step 2/5: Graph Configuration",
    title: "Toggle Perspectives & Filters",
    text: "Use these toggles to switch between Overview clusters, cross-cutting Themes, citation Sources, or All Points. You can also filter by a specific chapter using the dropdown, or adjust tilt angles and node spacing with these sliders!",
    targetId: "view-mode-widget",
    expression: "excited",
    action: () => {}
  },
  {
    badge: "Step 3/5: Real-time Search",
    title: "Locate Case Laws & Schemes",
    text: "Type acts, case names (like 'Vikash Kumar'), or key terms here. Search results appear instantly in a list below: clicking any item focuses the 3D node and loads its full text!",
    targetId: "search-box-widget",
    expression: "happy",
    action: () => {}
  },
  {
    badge: "Step 4/5: Contextual Details",
    title: "Read Detailed Text & Visuals",
    text: "When you select a node, its details load here. Scroll down to read the full body paragraph text, check footnotes, or view embedded visual infographics! Click any image preview to expand it to fullscreen.",
    targetId: "sidebar-right",
    expression: "excited",
    action: () => {}
  },
  {
    badge: "Step 5/5: Light / Dark Toggle",
    title: "Warm Sepia Graph Paper",
    text: "Designed with comfort in mind: click this button to switch between the cosmic dark mode and the warm gold-sand graph paper light mode!",
    targetId: "theme-toggle-btn",
    expression: "happy",
    action: () => {}
  }
];

let tutTypeTimer = null;
function executeHelpStep(index) {
  if (index < 0 || index >= helpTutorialSteps.length) return;
  state.currentTutorialStep = index;
  
  const step = helpTutorialSteps[index];
  
  // Highlight targeted element with spotlight backdrop cutout
  const target = document.getElementById(step.targetId);
  const spotlight = document.getElementById('tutorial-spotlight');
  if (target) {
    const rect = target.getBoundingClientRect();
    spotlight.style.left = `${rect.left - 8}px`;
    spotlight.style.top = `${rect.top - 8}px`;
    spotlight.style.width = `${rect.width + 16}px`;
    spotlight.style.height = `${rect.height + 16}px`;
    // spotlight is display: block
    spotlight.style.display = 'block';
  } else {
    spotlight.style.display = 'none';
  }
  
  document.getElementById('tut-step-badge').textContent = step.badge;
  document.getElementById('tut-step-title').textContent = step.title;
  
  // Typewriter speech bubbles
  const textEl = document.getElementById('tut-step-text');
  if (tutTypeTimer) clearInterval(tutTypeTimer);
  textEl.textContent = '';
  let i = 0;
  tutTypeTimer = setInterval(() => {
    if (i < step.text.length) {
      textEl.textContent += step.text[i];
      i++;
    } else {
      clearInterval(tutTypeTimer);
    }
  }, 14);
  
  updateMascotAvatar(step.expression, 'tutorial-mascot');
  
  step.action();
  speakAmi(step.text);
  
  document.getElementById('tut-back-btn').disabled = (index === 0);
  const nextBtn = document.getElementById('tut-next-btn');
  if (index === helpTutorialSteps.length - 1) {
    nextBtn.textContent = 'Finish';
  } else {
    nextBtn.textContent = 'Next';
  }
}

function startHelpTutorial() {
  if (state.tourActive) exitStoryTour();
  state.tutorialActive = true;
  document.getElementById('tutorial-overlay').classList.remove('hidden');
  executeHelpStep(0);
}

function exitHelpTutorial() {
  state.tutorialActive = false;
  document.getElementById('tutorial-overlay').classList.add('hidden');
  if (tutTypeTimer) clearInterval(tutTypeTimer);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.getElementById('tutorial-spotlight').style.display = 'none';
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

  // Mute Voice toggles
  document.getElementById('tour-voice-btn').addEventListener('click', toggleVoiceMute);
  document.getElementById('tut-voice-btn').addEventListener('click', toggleVoiceMute);
  updateVoiceMuteUI();
  
  // Theme Switching Event Listener (Dark vs. Light mode toggle)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    const newTheme = isLight ? 'light' : 'dark';
    themeToggleBtn.textContent = isLight ? '🌙 Dark Mode' : '☀ Light Mode';
    graph3D.setTheme(newTheme);
    
    // Reposition spotlights if tutorial is active to recalculate backdrop alpha
    if (state.tutorialActive) {
      executeHelpStep(state.currentTutorialStep);
    }
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
    if (state.currentTourStep < tourSteps.length - 1) {
      executeTourStep(state.currentTourStep + 1);
    } else {
      exitStoryTour();
    }
  });
  
  // Help Tutorial Button actions
  document.getElementById('help-tutorial-btn').addEventListener('click', startHelpTutorial);
  document.getElementById('tut-exit-btn').addEventListener('click', exitHelpTutorial);
  document.getElementById('tut-back-btn').addEventListener('click', () => {
    if (state.currentTutorialStep > 0) {
      executeHelpStep(state.currentTutorialStep - 1);
    }
  });
  document.getElementById('tut-next-btn').addEventListener('click', () => {
    if (state.currentTutorialStep < helpTutorialSteps.length - 1) {
      executeHelpStep(state.currentTutorialStep + 1);
    } else {
      exitHelpTutorial();
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
