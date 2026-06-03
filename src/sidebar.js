// Theme
const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.getElementById('themeIcon');
let isDark = !window.matchMedia('(prefers-color-scheme: light)').matches;
const saved = localStorage.getItem('li-sb-theme');
if (saved) isDark = saved === 'dark';
applyTheme();

themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  localStorage.setItem('li-sb-theme', isDark ? 'dark' : 'light');
  applyTheme();
});

function applyTheme() {
  if (isDark) {
    html.classList.remove('theme-light');
    html.classList.add('theme-dark');
    themeIcon.textContent = '☀';
    themeToggle.title = 'Switch to light theme';
  } else {
    html.classList.remove('theme-dark');
    html.classList.add('theme-light');
    themeIcon.textContent = '☾';
    themeToggle.title = 'Switch to dark theme';
  }
}

// State
let currentState = 'empty';
let currentData  = null;
let activeFilters = new Set();

// Public API
function updateSidebar(data) {
  currentData = data;
  currentState = (data && data.suggestions && data.suggestions.length > 0)
    ? 'data'
    : 'no-suggestions';
  activeFilters.clear();
  render();
}

function showLoading() {
  currentState = 'loading';
  render();
}

function showEmpty() {
  currentState = 'empty';
  render();
}

function copySelector(selectorText) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(selectorText).catch(() => fallbackCopy(selectorText));
  } else {
    fallbackCopy(selectorText);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function useInPanel(suggestion) {
  if (sidebarPort) {
    sidebarPort.postMessage({
      type: 'USE_IN_PANEL',
      selector: suggestion.selector,
      locatorType: suggestion.type,
    });
  }
}

function highlightElements(suggestion) {
  if (sidebarPort) {
    sidebarPort.postMessage({
      type: 'HIGHLIGHT',
      selector: suggestion.selector,
      locatorType: suggestion.type,
    });
  }
}

// Render
const mainContent = document.getElementById('mainContent');

function render() {
  mainContent.innerHTML = '';
  if (currentState === 'empty')          { mainContent.appendChild(renderEmpty()); return; }
  if (currentState === 'loading')        { mainContent.appendChild(renderLoading()); return; }
  if (currentState === 'no-suggestions') {
    mainContent.appendChild(renderElementSummary(currentData));
    mainContent.appendChild(renderNoSuggestions());
    return;
  }
  mainContent.appendChild(renderElementSummary(currentData));
  mainContent.appendChild(renderSuggestions(currentData.suggestions));
}

function renderElementSummary(data) {
  const section = document.createElement('div');
  section.className = 'element-summary';

  let tagHtml = '<span class="el-tag-name">' + escHtml(data.tag) + '</span>';
  if (data.id) tagHtml += '<span class="el-id">#' + escHtml(data.id) + '</span>';
  if (data.classes && data.classes.length) {
    tagHtml += data.classes.map(c => '<span class="el-class">.' + escHtml(c) + '</span>').join('');
  }
  const tagEl = document.createElement('div');
  tagEl.className = 'element-tag';
  tagEl.innerHTML = '&lt;' + tagHtml + '&gt;';
  section.appendChild(tagEl);

  if (data.attributes && Object.keys(data.attributes).length) {
    const pillsEl = document.createElement('div');
    pillsEl.className = 'attr-pills';
    for (const [key, val] of Object.entries(data.attributes)) {
      const pill = document.createElement('span');
      let cls = 'attr-pill';
      if (key === 'data-testid') cls += ' testid';
      else if (key === 'role') cls += ' role';
      else if (key.startsWith('aria-')) cls += ' aria';
      pill.className = cls;
      const display = val ? key + '="' + val + '"' : key;
      pill.textContent = display;
      pill.title = display;
      pillsEl.appendChild(pill);
    }
    section.appendChild(pillsEl);
  }
  return section;
}

function renderSuggestions(suggestions) {
  const frag = document.createDocumentFragment();
  const types = [...new Set(suggestions.map(s => s.type))];
  if (types.length > 1) frag.appendChild(renderFilterBar(types));

  const visible = getFilteredSuggestions(suggestions);
  const header = document.createElement('div');
  header.className = 'section-header';
  const lbl = document.createElement('span'); lbl.className = 'section-label'; lbl.textContent = 'Locators';
  const cnt = document.createElement('span'); cnt.className = 'section-count';
  cnt.textContent = visible.length + ' suggestion' + (visible.length !== 1 ? 's' : '');
  header.appendChild(lbl); header.appendChild(cnt);
  frag.appendChild(header);

  if (visible.length === 0) { frag.appendChild(renderNoSuggestions()); return frag; }

  const best = visible[0];
  const banner = document.createElement('div');
  banner.className = 'best-banner';
  banner.innerHTML = '<span class="best-star">★</span> Best locator &mdash; ' + escHtml(best.type);
  frag.appendChild(banner);

  const list = document.createElement('div');
  list.className = 'suggestions-list fade-in';
  visible.forEach((s, idx) => list.appendChild(renderSuggestionRow(s, idx === 0)));
  frag.appendChild(list);
  return frag;
}

function getFilteredSuggestions(suggestions) {
  if (activeFilters.size === 0) return suggestions;
  return suggestions.filter(s => activeFilters.has(s.type));
}

function renderFilterBar(types) {
  const bar = document.createElement('div');
  bar.className = 'filter-bar';
  const lbl = document.createElement('span'); lbl.className = 'filter-label'; lbl.textContent = 'Filter:';
  bar.appendChild(lbl);
  types.forEach(type => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip ' + typeClass(type);
    chip.textContent = shortType(type);
    chip.dataset.type = type;
    if (activeFilters.has(type)) chip.classList.add('active');
    chip.addEventListener('click', () => {
      if (activeFilters.has(type)) activeFilters.delete(type);
      else activeFilters.add(type);
      render();
    });
    bar.appendChild(chip);
  });
  return bar;
}

function renderSuggestionRow(s, isBest) {
  const row = document.createElement('div');
  row.className = 'suggestion-row quality-' + s.quality + (isBest ? ' is-best' : '');

  const main = document.createElement('div');
  main.className = 'row-main';

  const badge = document.createElement('span');
  badge.className = 'type-badge ' + typeClass(s.type);
  badge.textContent = shortType(s.type);
  main.appendChild(badge);

  const selWrap = document.createElement('div'); selWrap.className = 'selector-wrap';
  const selText = document.createElement('span'); selText.className = 'selector-text';
  selText.textContent = s.selector;
  selText.title = 'Click to copy';
  selText.addEventListener('click', () => handleCopy(selText, s.selector));
  selWrap.appendChild(selText);
  main.appendChild(selWrap);
  row.appendChild(main);

  const meta = document.createElement('div'); meta.className = 'row-meta';
  const metaLeft = document.createElement('div'); metaLeft.className = 'meta-left';

  const scorePill = document.createElement('div'); scorePill.className = 'score-pill';
  const dc = scoreColor(s.score);
  scorePill.innerHTML =
    '<span class="score-dot ' + dc + '"></span>' +
    '<span class="score-num-text ' + dc + '">' + s.score + '</span>' +
    '<span class="score-denom">/100</span>';
  metaLeft.appendChild(scorePill);

  if (s.matchCount !== -1 && s.matchCount !== null) {
    const matchEl = document.createElement('span');
    const mc = s.matchCount === 1 ? 'unique' : s.matchCount <= 3 ? 'multi' : 'many';
    matchEl.className = 'match-count ' + mc;
    matchEl.textContent = s.matchCount === 1 ? '✓ 1 match' : '⚠ ' + s.matchCount + ' matches';
    metaLeft.appendChild(matchEl);
  }
  meta.appendChild(metaLeft);

  const actions = document.createElement('div'); actions.className = 'row-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn copy-btn';
  copyBtn.title = 'Copy selector';
  copyBtn.innerHTML = '<span class="icon-copy"></span>';
  copyBtn.addEventListener('click', (e) => { e.stopPropagation(); handleCopy(copyBtn, s.selector); });
  actions.appendChild(copyBtn);

  const useBtn = document.createElement('button');
  useBtn.className = 'action-btn use-btn';
  useBtn.title = 'Use in Locator Inspector panel';
  useBtn.textContent = '→';
  useBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    useInPanel(s);
    const orig = useBtn.textContent;
    useBtn.textContent = '✓';
    useBtn.style.color = 'var(--green)';
    setTimeout(() => { useBtn.textContent = orig; useBtn.style.color = ''; }, 1000);
  });
  actions.appendChild(useBtn);

  const hlBtn = document.createElement('button');
  hlBtn.className = 'action-btn';
  hlBtn.title = 'Highlight matching elements on page';
  hlBtn.innerHTML = '<span class="icon-eye"></span>';
  hlBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    highlightElements(s);
    hlBtn.style.color = 'var(--yellow)';
    setTimeout(() => { hlBtn.style.color = ''; }, 1200);
  });
  actions.appendChild(hlBtn);

  meta.appendChild(actions);
  row.appendChild(meta);
  return row;
}

function handleCopy(triggerEl, text) {
  copySelector(text);
  showCopyToast();
  if (triggerEl.classList.contains('action-btn') || triggerEl.classList.contains('copy-btn')) {
    const origHtml = triggerEl.innerHTML;
    triggerEl.classList.add('copied');
    triggerEl.innerHTML = '<span style="font-size:10px">✓</span>';
    setTimeout(() => { triggerEl.classList.remove('copied'); triggerEl.innerHTML = origHtml; }, 1200);
  }
}

const copyToast = document.getElementById('copyToast');
let toastTimer = null;
function showCopyToast() {
  copyToast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => copyToast.classList.remove('show'), 1500);
}

function renderEmpty() {
  const el = document.createElement('div'); el.className = 'state-panel fade-in';
  el.innerHTML =
    '<div class="state-icon">⬡</div>' +
    '<div class="state-title">No element selected</div>' +
    '<div class="state-body">Select an element in the Elements panel to see locator suggestions.</div>';
  return el;
}

function renderLoading() {
  const el = document.createElement('div'); el.className = 'fade-in';
  const spinner = document.createElement('div'); spinner.className = 'spinner-wrap';
  spinner.innerHTML = '<div class="spinner"></div><span>Analyzing element…</span>';
  el.appendChild(spinner);
  for (let i = 0; i < 4; i++) {
    const skelRow = document.createElement('div'); skelRow.className = 'skeleton-row';
    const w1 = 55 + Math.random() * 30;
    const w2 = 30 + Math.random() * 25;
    skelRow.innerHTML =
      '<div class="skel" style="width:' + w1 + '%;margin-bottom:5px;"></div>' +
      '<div class="skel" style="width:' + w2 + '%;"></div>';
    el.appendChild(skelRow);
  }
  return el;
}

function renderNoSuggestions() {
  const el = document.createElement('div'); el.className = 'state-panel fade-in';
  el.innerHTML =
    '<div class="state-icon">○</div>' +
    '<div class="state-title">No reliable locators found</div>' +
    '<div class="state-body">No reliable locators found for this element.</div>';
  return el;
}

// Helpers
function typeClass(type) {
  switch ((type || '').toLowerCase()) {
    case 'playwright': return 'pw';
    case 'css':        return 'css';
    case 'xpath':      return 'xpath';
    case 'smart':      return 'smart';
    default:           return '';
  }
}
function shortType(type) {
  switch ((type || '').toLowerCase()) {
    case 'playwright': return 'PW';
    case 'css':        return 'CSS';
    case 'xpath':      return 'XP';
    case 'smart':      return 'SRT';
    default:           return (type || '').slice(0, 3).toUpperCase();
  }
}
function scoreColor(score) {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initial state
showEmpty();

// Connect to background via a persistent port so background can push updates.
// chrome.runtime.sendMessage between DevTools pages is unreliable — use ports.
// Auto-reconnect handles service-worker restarts (MV3 terminates worker after ~30s idle).
let sidebarPort = null;

function connectToBackground() {
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  try {
    sidebarPort = chrome.runtime.connect({ name: 'sidebar-pane' });

    const tabId = (chrome.devtools && chrome.devtools.inspectedWindow)
      ? chrome.devtools.inspectedWindow.tabId
      : null;
    sidebarPort.postMessage({ type: 'SIDEBAR_INIT', tabId });

    sidebarPort.onMessage.addListener((msg) => {
      if (msg.type === 'SIDEBAR_UPDATE')  { updateSidebar(msg.data); }
      if (msg.type === 'SIDEBAR_LOADING') { showLoading(); }
      if (msg.type === 'SIDEBAR_EMPTY')   { showEmpty(); }
    });

    sidebarPort.onDisconnect.addListener(() => {
      sidebarPort = null;
      setTimeout(connectToBackground, 500);
    });
  } catch (_err) {
    sidebarPort = null;
    setTimeout(connectToBackground, 1000);
  }
}

connectToBackground();

// Expose for external calls
window.updateSidebar     = updateSidebar;
window.showLoading       = showLoading;
window.showEmpty         = showEmpty;
window.copySelector      = copySelector;
window.useInPanel        = useInPanel;
window.highlightElements = highlightElements;
