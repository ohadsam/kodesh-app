// ═══════════════════════════════════════════
// CACHE — IndexedDB cache for Sefaria/Hebcal responses
// ═══════════════════════════════════════════
// Applies to the tabs listed in CACHE_TABS (parasha, tehilim). A call site opts
// in by passing the tab id: sefariaText(ref, delay, 'tehilim'),
// fetchWithDelay(url, delay, 'parasha') or cacheFetch(url, init, 'parasha').
// Cache hit → no network (and no artificial throttling delay); miss → normal
// network call, then store. Everything here is best-effort: any IndexedDB
// failure degrades to "no cache", never to a broken tab.
// Settings (appState.cacheSettings): { enabled: true, tabs: { parasha: true, tehilim: true } }
// — on by default; a tab is cached only if the global switch AND its own switch are on.

const CACHE_DB_NAME = 'itim-cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE = 'entries';
const CACHE_TABS = [
  { id: 'parasha', name: 'פרשת שבוע' },
  { id: 'tehilim', name: 'תהילים' },
];

let _cacheDbPromise = null;

// ── Settings ────────────────────────────────────────────────────────────
function getCacheSettings() {
  const s = appState.cacheSettings || {};
  return { enabled: s.enabled !== false, tabs: s.tabs || {} };
}
function cacheEnabledFor(tab) {
  const s = getCacheSettings();
  return s.enabled && s.tabs[tab] !== false && CACHE_TABS.some(t => t.id === tab);
}

// ── What is worth storing ───────────────────────────────────────────────
// Never persist an empty/error response: a transient bad answer must not
// become permanent (a retry has to be able to reach the network again).
function _cacheHasContent(x) {
  if (typeof x === 'string') return x.trim().length > 0;
  if (Array.isArray(x)) return x.some(_cacheHasContent);
  return false;
}
function cacheWorthStoring(data) {
  if (!data || typeof data !== 'object' || data.error) return false;
  if ('he' in data) return _cacheHasContent(data.he);          // Sefaria texts API
  if (Array.isArray(data.items)) return data.items.length > 0; // Hebcal
  return false;
}

// ── IndexedDB plumbing ──────────────────────────────────────────────────
function _cacheDb() {
  if (_cacheDbPromise) return _cacheDbPromise;
  _cacheDbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        store.createIndex('tab', 'tab', { unique: false });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  });
  return _cacheDbPromise;
}

// Run fn(store) in a transaction; resolves to fn's request result, or `fallback` on any failure.
async function _cacheTx(mode, fn, fallback) {
  const db = await _cacheDb();
  if (!db) return fallback;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(CACHE_STORE, mode);
      const req = fn(tx.objectStore(CACHE_STORE));
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : true);
      tx.onerror = tx.onabort = () => resolve(fallback);
    } catch (e) { resolve(fallback); }
  });
}

// ── Public API ──────────────────────────────────────────────────────────
// Returns the cached JSON, or undefined (miss / disabled / unavailable).
async function cacheGetJson(key, tab) {
  if (!cacheEnabledFor(tab)) return undefined;
  const row = await _cacheTx('readonly', s => s.get(key), undefined);
  return row && row.data !== undefined ? row.data : undefined;
}

async function cachePutJson(key, data, tab) {
  if (!cacheEnabledFor(tab) || !cacheWorthStoring(data)) return false;
  const size = new TextEncoder().encode(JSON.stringify(data)).length;
  return _cacheTx('readwrite', s => s.put({ key, tab, data, size, ts: Date.now() }), false);
}

// Drop-in for fetch(url, init) on a cacheable URL. On a hit returns a minimal
// Response-like object ({ok, status, json()}); on a miss performs the real
// fetch and stores a clone of a valid body.
async function cacheFetch(url, init, tab) {
  if (cacheEnabledFor(tab)) {
    const hit = await cacheGetJson(url, tab);
    if (hit !== undefined) {
      console.log('[Cache] HIT', tab, url.length > 90 ? url.slice(0, 90) + '…' : url);
      return { ok: true, status: 200, fromCache: true, json: async () => hit };
    }
  }
  const resp = await fetch(url, init);
  if (resp.ok && cacheEnabledFor(tab)) {
    try { cachePutJson(url, await resp.clone().json(), tab); } catch (e) { /* not JSON — ignore */ }
  }
  return resp;
}

// Delete everything (no arg) or one tab's entries.
async function cacheClear(tab) {
  if (!tab) return _cacheTx('readwrite', s => s.clear(), false);
  return _cacheTx('readwrite', s => {
    const req = s.index('tab').openKeyCursor(IDBKeyRange.only(tab));
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { s.delete(cur.primaryKey); cur.continue(); }
    };
    return req;
  }, false);
}

// → { available, total:{count,bytes}, byTab:{[id]:{count,bytes}}, usage, quota }
async function cacheStats() {
  const byTab = {};
  CACHE_TABS.forEach(t => { byTab[t.id] = { count: 0, bytes: 0 }; });
  const rows = await _cacheTx('readonly', s => s.getAll(), null);
  const out = { available: rows !== null, total: { count: 0, bytes: 0 }, byTab, usage: null, quota: null };
  (rows || []).forEach(r => {
    const t = byTab[r.tab] || (byTab[r.tab] = { count: 0, bytes: 0 });
    t.count++; t.bytes += r.size || 0;
    out.total.count++; out.total.bytes += r.size || 0;
  });
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      out.usage = e.usage; out.quota = e.quota;
    }
  } catch (e) {}
  return out;
}

function cacheFormatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── Settings panel ──────────────────────────────────────────────────────
async function renderCacheSettings() {
  const rowsEl = document.getElementById('cache-tab-rows');
  if (!rowsEl) return;
  const s = getCacheSettings();
  const globalEl = document.getElementById('cache-global-toggle');
  if (globalEl) globalEl.checked = s.enabled;

  const st = await cacheStats();
  const bdi = b => `<bdi dir="ltr">${cacheFormatBytes(b)}</bdi>`;   // keep "12 KB" intact inside RTL text
  const sumEl = document.getElementById('cache-summary');
  if (sumEl) {
    sumEl.innerHTML = !st.available
      ? 'האחסון המקומי (IndexedDB) אינו זמין במכשיר/דפדפן זה'
      : `סה״כ במטמון: ${st.total.count} פריטים · ${bdi(st.total.bytes)}` +
        (st.usage != null && st.quota ? ` (האפליקציה כולה: ${bdi(st.usage)} מתוך ${bdi(st.quota)})` : '');
  }
  rowsEl.innerHTML = CACHE_TABS.map(t => {
    const on = cacheEnabledFor(t.id);
    const info = st.byTab[t.id] || { count: 0, bytes: 0 };
    const checked = s.tabs[t.id] !== false;
    const status = !s.enabled ? 'כבוי (כל המטמון כבוי)' : (checked ? 'פעיל' : 'כבוי');
    return `
      <div class="settings-row" style="${s.enabled ? '' : 'opacity:.55'}">
        <div>
          <label>${t.name}</label>
          <div style="font-size:11px;color:${on ? 'var(--addition)' : 'var(--muted)'}">${status} · ${info.count} פריטים · ${bdi(info.bytes)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button onclick="clearCacheFromSettings('${t.id}')" aria-label="נקה מטמון ${t.name}"
            style="background:var(--card);border:1px solid var(--border);color:var(--text);padding:5px 10px;border-radius:8px;font-size:11px;cursor:pointer;font-family:'Heebo',sans-serif">נקה</button>
          <label class="toggle"><input type="checkbox" ${checked ? 'checked' : ''} ${s.enabled ? '' : 'disabled'}
            onchange="setCacheTabEnabled('${t.id}', this.checked)" aria-label="מטמון ${t.name}" /><span class="toggle-slider"></span></label>
        </div>
      </div>`;
  }).join('');
}

function setCacheGlobalEnabled(on) {
  appState.cacheSettings = { ...getCacheSettings(), enabled: !!on };
  saveState();
  renderCacheSettings();
}
function setCacheTabEnabled(tab, on) {
  const cur = getCacheSettings();
  appState.cacheSettings = { ...cur, tabs: { ...cur.tabs, [tab]: !!on } };
  saveState();
  renderCacheSettings();
}
async function clearCacheFromSettings(tab) {
  const name = tab ? (CACHE_TABS.find(t => t.id === tab) || {}).name : 'כל המטמון';
  if (!confirm(tab ? `למחוק את המטמון של "${name}"?` : 'למחוק את כל המטמון?')) return;
  await cacheClear(tab);
  renderCacheSettings();
}

// ── Failure popup: offer (never force) a cache clear ────────────────────
let _cacheFailRetry = null;
let _cacheFailTab = null;
const _cacheFailShown = {};   // tab → timestamp, to avoid nagging on repeated errors

// Call from a tab's load-failure path. Offers to clear that tab's cache and
// retry. Skipped when the tab isn't using the cache, when offline (the
// failure is the network, and clearing would throw away the content that
// still works offline), and at most once per 5 minutes per tab.
function offerCacheClearOnFailure(tab, retryFn) {
  if (!cacheEnabledFor(tab)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (Date.now() - (_cacheFailShown[tab] || 0) < 5 * 60 * 1000) return;
  const modal = document.getElementById('cache-fail-modal');
  if (!modal) return;
  _cacheFailShown[tab] = Date.now();
  _cacheFailTab = tab;
  _cacheFailRetry = retryFn || null;
  const name = (CACHE_TABS.find(t => t.id === tab) || {}).name || '';
  const nameEl = document.getElementById('cache-fail-tab');
  if (nameEl) nameEl.textContent = name;
  modal.style.display = 'flex';
}

function closeCacheFailModal() {
  const modal = document.getElementById('cache-fail-modal');
  if (modal) modal.style.display = 'none';
  _cacheFailRetry = null;
}

async function clearCacheFromFailModal() {
  const tab = _cacheFailTab, retry = _cacheFailRetry;
  closeCacheFailModal();
  await cacheClear(tab);
  if (typeof retry === 'function') retry();
}
