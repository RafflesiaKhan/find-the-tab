// Content script: builds a floating overlay with a search bar

const OVERLAY_ID = 'find-the-tab-overlay';
const INPUT_ID = 'find-the-tab-input';
const RESULTS_ID = 'find-the-tab-results';

let overlayRoot = null;
let isOpen = false;

function ensureOverlay() {
  if (document.getElementById(OVERLAY_ID)) return document.getElementById(OVERLAY_ID);

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'ftt-overlay';
  overlay.style.display = 'none';

  overlay.innerHTML = `
    <div class="ftt-container" role="dialog" aria-modal="true">
      <input id="${INPUT_ID}" class="ftt-input" type="text" placeholder="Search your tabs and history..." autocomplete="off" />
      <ul id="${RESULTS_ID}" class="ftt-results" aria-live="polite"></ul>
      <div class="ftt-hint">Top 4 results. Refine your prompt for better matches. Press Esc to close.</div>
    </div>
  `;

  document.documentElement.appendChild(overlay);
  overlayRoot = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideOverlay();
  });

  const input = overlay.querySelector('#' + INPUT_ID);
  input.addEventListener('input', onQueryChanged);
  input.addEventListener('keydown', onInputKeydown);

  return overlay;
}

function toggleOverlay() {
  if (!overlayRoot) ensureOverlay();
  if (isOpen) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

function showOverlay() {
  const overlay = ensureOverlay();
  overlay.style.display = 'flex';
  isOpen = true;
  const input = document.getElementById(INPUT_ID);
  input.value = '';
  renderResults([]);
  // Warm load data then focus
  refreshIndex().then(() => {
    input.focus();
  });
}

function hideOverlay() {
  const overlay = ensureOverlay();
  overlay.style.display = 'none';
  isOpen = false;
}

// Data index
let cachedItems = [];

async function refreshIndex() {
  // Query all tabs and a slice of history
  const allTabs = await chrome.runtime.sendMessage({ type: 'FIND_THE_TAB_QUERY_TABS' }).catch(() => []);
  const recentHistory = await chrome.runtime
    .sendMessage({ type: 'FIND_THE_TAB_QUERY_HISTORY' })
    .catch(() => []);

  const items = [];
  for (const tab of allTabs || []) {
    items.push({
      kind: 'tab',
      id: `tab-${tab.id}`,
      tabId: tab.id,
      windowId: tab.windowId,
      title: tab.title || '',
      url: tab.url || '',
      favicon: tab.favIconUrl || '',
      score: 0
    });
  }
  for (const entry of recentHistory) {
    items.push({
      kind: 'history',
      id: `hist-${entry.id}`,
      title: entry.title || entry.url || '',
      url: entry.url || '',
      favicon: entry.url ? `chrome://favicon/${entry.url}` : '',
      score: 0
    });
  }
  cachedItems = items;
}

function normalize(str) {
  return (str || '').toLowerCase().normalize('NFKD');
}

function computeScore(query, item) {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(item.title);
  const url = normalize(item.url);

  let score = 0;
  if (title.includes(q)) score += 10;
  if (url.includes(q)) score += 6;

  // Word-level bonus
  const words = q.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (title.includes(w)) score += 3;
    if (url.includes(w)) score += 2;
  }

  // Prefer tabs over history
  if (item.kind === 'tab') score += 2;

  return score;
}

let selectedIndex = -1;

function onQueryChanged(e) {
  const query = e.target.value;
  const ranked = cachedItems
    .map((item) => ({ ...item, score: computeScore(query, item) }))
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  selectedIndex = ranked.length ? 0 : -1;
  renderResults(ranked);
}

function onInputKeydown(e) {
  const results = document.getElementById(RESULTS_ID);
  const items = Array.from(results.querySelectorAll('li'));
  if (e.key === 'Escape') {
    e.stopPropagation();
    hideOverlay();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    if (!items.length) return;
    selectedIndex = (selectedIndex + 1) % items.length;
    updateSelection(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    if (!items.length) return;
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    updateSelection(items);
  } else if (e.key === 'Enter') {
    e.stopPropagation();
    if (selectedIndex >= 0 && items[selectedIndex]) {
      items[selectedIndex].click();
    }
  }
}

function updateSelection(items) {
  items.forEach((el, idx) => {
    if (idx === selectedIndex) el.classList.add('selected');
    else el.classList.remove('selected');
  });
}

function renderResults(items) {
  const list = document.getElementById(RESULTS_ID);
  list.innerHTML = '';
  for (const [idx, item] of items.entries()) {
    const li = document.createElement('li');
    li.className = 'ftt-item' + (idx === selectedIndex ? ' selected' : '');
    li.tabIndex = 0;
    const favicon = item.favicon ? `<img class="ftt-favicon" src="${item.favicon}" alt="" />` : '<div class="ftt-favicon placeholder"></div>';
    li.innerHTML = `
      ${favicon}
      <div class="ftt-text">
        <div class="ftt-title">${escapeHtml(item.title || item.url)}</div>
        <div class="ftt-url">${escapeHtml(item.url)}</div>
      </div>
    `;
    li.addEventListener('click', () => onActivate(item));
    list.appendChild(li);
  }
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function onActivate(item) {
  try {
    if (item.kind === 'tab' && typeof item.tabId === 'number') {
      await chrome.runtime.sendMessage({ type: 'FIND_THE_TAB_ACTIVATE', tabId: item.tabId, windowId: item.windowId });
    } else if (item.url) {
      await chrome.runtime.sendMessage({ type: 'FIND_THE_TAB_OPEN_URL', url: item.url });
    }
  } catch (e) {}
  hideOverlay();
}

// Listen for toggle command forwarded by background
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'FIND_THE_TAB_TOGGLE') {
    toggleOverlay();
  }
});

// Build overlay at load so it's quick to show later
ensureOverlay();


