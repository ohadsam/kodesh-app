
// ═══════════════════════════════════════════
// LOG CAPTURE SYSTEM
// ═══════════════════════════════════════════
const appLogs = [];
const MAX_LOGS = 300;
const LOG_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Auto-clear logs if last clear was >48h ago
(function() {
  const lastClear = parseInt(localStorage.getItem('logs_last_clear') || '0');
  if (Date.now() - lastClear > LOG_TTL_MS) {
    localStorage.setItem('logs_last_clear', String(Date.now()));
    // appLogs is empty at this point anyway (fresh page load clears memory)
    // but mark the timestamp so we don't re-trigger immediately
  }
})();

function addLog(level, args) {
  const msg = args.map(a => {
    if (a === null) return 'null';
    if (a === undefined) return 'undefined';
    if (typeof a === 'object') { try { return JSON.stringify(a).slice(0,200); } catch { return String(a); } }
    return String(a);
  }).join(' ');
  appLogs.push({ level, msg, time: new Date().toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit',second:'2-digit'}) });
  if (appLogs.length > MAX_LOGS) appLogs.shift();
  // If logs tab is visible, refresh it
  if (document.getElementById('page-logs')?.classList.contains('active')) {
    renderLogs();
  }
}

// Override console methods
const _origLog   = console.log.bind(console);
const _origWarn  = console.warn.bind(console);
const _origError = console.error.bind(console);
console.log   = (...a) => { _origLog(...a);   addLog('log',   a); };
console.warn  = (...a) => { _origWarn(...a);  addLog('warn',  a); };
console.error = (...a) => { _origError(...a); addLog('error', a); };

function renderLogs() {
  const el = document.getElementById('log-container');
  const stats = document.getElementById('log-stats');
  if (!el) return;
  const errors = appLogs.filter(l => l.level === 'error').length;
  const warns  = appLogs.filter(l => l.level === 'warn').length;
  const lastClear = parseInt(localStorage.getItem('logs_last_clear') || '0');
  const sinceStr  = lastClear
    ? `ניקוי אחרון: ${new Date(lastClear).toLocaleDateString('he-IL')} ${new Date(lastClear).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}`
    : '';
  if (stats) stats.textContent = `סה"כ: ${appLogs.length}/${MAX_LOGS} | שגיאות: ${errors} | אזהרות: ${warns}  ${sinceStr}`;
  if (!appLogs.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">אין לוגים</div>';
    return;
  }
  el.innerHTML = [...appLogs].reverse().map(l => {
    const color = l.level === 'error' ? '#e05555' : l.level === 'warn' ? '#c9913a' : '#7ab87a';
    const bg    = l.level === 'error' ? 'rgba(224,85,85,.08)' : l.level === 'warn' ? 'rgba(201,145,58,.08)' : 'transparent';
    return `<div style="padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.04);background:${bg};font-family:monospace;font-size:11px;line-height:1.5">
      <span style="color:var(--muted);margin-left:8px">${l.time}</span>
      <span style="color:${color}">[${l.level.toUpperCase()}]</span>
      <span style="color:#d4c9aa;white-space:pre-wrap;word-break:break-all">${l.msg}</span>
    </div>`;
  }).join('');
}

function clearLogs() {
  appLogs.length = 0;
  localStorage.setItem('logs_last_clear', String(Date.now()));
  renderLogs();
  console.log('[Logs] cleared manually');
}

function copyLogs() {
  const text = appLogs.map(l => `[${l.time}][${l.level.toUpperCase()}] ${l.msg}`).join('\n');
  navigator.clipboard?.writeText(text).then(() => {
    const btn = document.querySelector('[onclick="copyLogs()"]');
    if (btn) { btn.textContent = '✅ הועתק'; setTimeout(() => btn.textContent = '📋 העתק', 2000); }
  });
}

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
let currentOffset = 0; // days from today
let userLat = 32.0833, userLon = 34.8878, userElev = 52; // default: Petah Tikva
let currentTab = 'calendar';
let loaded = {};
let aliyot = [];
let currentAliya = 'all';
let rashiLoaded = false;
let rashiVisible = false;

const APP_VERSION  = '4.7';
const STORAGE_KEY  = 'kodesh_app_v1';
const SIDDUR_CACHE_KEY = 'siddur_cache_v';

// ── Startup: show version in splash + force-clear SW and caches on version change ──
(function() {
  // Show version immediately in splash screen
  const splashV = document.getElementById('splash-version');
  if (splashV) splashV.textContent = 'גרסה ' + APP_VERSION;

  const savedVer = localStorage.getItem('app_version');
  if (savedVer !== APP_VERSION) {
    console.log('[Cache] New version', APP_VERSION, '← was', savedVer);
    if (splashV) splashV.textContent = 'גרסה ' + APP_VERSION + ' – מנקה cache...';

    const doReload = () => {
      localStorage.setItem('app_version', APP_VERSION);
      console.log('[Cache] Reloading with fresh files...');
      // Add nocache param to bust any HTTP cache too
      const url = window.location.href.split('?')[0] + '?nocache=' + APP_VERSION;
      window.location.replace(url);
    };
    const sw = navigator.serviceWorker;
    const p1 = sw ? sw.getRegistrations().then(regs => {
      console.log('[Cache] Unregistering', regs.length, 'SW(s)');
      return Promise.all(regs.map(r => r.unregister()));
    }) : Promise.resolve();
    const p2 = ('caches' in window) ? caches.keys().then(keys => {
      console.log('[Cache] Deleting caches:', keys);
      return Promise.all(keys.map(k => caches.delete(k)));
    }) : Promise.resolve();
    Promise.all([p1, p2]).then(doReload);
  }
})();

let appState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// ═══════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════
function getTargetDate(offset = currentOffset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function hebrewDayName(d) {
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  return 'יום ' + days[d.getDay()];
}

function formatDisplayDate(d) {
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} – ${hebrewDayName(d)}`;
}

// ═══════════════════════════════════════════
// API WITH DELAY
// ═══════════════════════════════════════════
async function fetchWithDelay(url, delay = 300) {
  await new Promise(r => setTimeout(r, delay));
  console.log(`[fetch] GET ${url.length > 120 ? url.slice(0,120)+'...' : url}`);
  const resp = await fetch(url);
  console.log(`[fetch] → ${resp.status}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

// Helper: extract Hebrew text from Sefaria - supports both v2 and v3 responses
function extractHeText(data) {
  // v2 API: data.he is the Hebrew text directly
  if (data?.he) {
    const t = data.he;
    const flat = Array.isArray(t[0]) ? t.flat() : t;
    if (flat.filter(Boolean).length) return flat;
  }
  // v3 API: data.versions array
  if (data?.versions?.length) {
    const heVer = data.versions.find(v => v.actualLanguage === 'he' || v.language === 'he');
    const ver = heVer || data.versions[0];
    const t = ver?.text || [];
    return Array.isArray(t[0]) ? t.flat() : t;
  }
  return [];
}

// ─── Sefaria v2 fetch – the ONLY function that calls Sefaria texts ───
async function sefariaText(ref, delay = 350) {
  await new Promise(r => setTimeout(r, delay));
  // encodeURI preserves commas (needed for siddur refs like "Weekday_Siddur...,_Section")
  // encodeURIComponent would break them by encoding commas as %2C
  const url = `https://www.sefaria.org/api/texts/${encodeURI(ref)}?lang=he&commentary=0&context=0`;
  console.log(`[Sefaria] GET ${url}`);
  const resp = await fetch(url);
  console.log(`[Sefaria] ${resp.status} for "${ref}"`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${ref}`);
  const data = await resp.json();
  // Log what came back so we can diagnose
  if (data?.warnings) console.warn(`[Sefaria] warnings for "${ref}":`, data.warnings);
  const heArr = data?.he;
  const flat = heArr ? (Array.isArray(heArr[0]) ? heArr.flat() : heArr) : [];
  const filled = flat.filter(Boolean);
  console.log(`[Sefaria] "${ref}" → ${filled.length} verses (he), text sample: "${String(filled[0]||'').slice(0,40)}"`);
  if (!filled.length) {
    console.warn(`[Sefaria] EMPTY Hebrew for "${ref}" – full response:`, JSON.stringify(data).slice(0, 300));
  }
  return data;
}

// Helper: flatten data.he from sefariaText result
function heFlat(data) {
  let t = data?.he;
  if (!t && data?.versions?.length) {
    const heVer = data.versions.find(v => v.actualLanguage === 'he' || v.language === 'he') || data.versions[0];
    t = heVer?.text;
  }
  if (!t) return [];
  const flat = Array.isArray(t) ? t.flat(Infinity) : [t];
  return flat.filter(Boolean);
}

// Clean Sefaria HTML: keep <b>/<i> for bold/italic, strip the rest
// Also decode common HTML entities that Sefaria uses
function cleanSefariaHtml(str) {
  if (!str) return '';
  return str
    .replace(/&thinsp;/g, '\u2009').replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
    .replace(/<small[^>]*>(.*?)<\/small>/gi,
      '<span style="display:block;font-size:13px;color:var(--addition);background:var(--addition-bg);' +
      'padding:6px 10px;border-radius:6px;margin:6px 0;line-height:1.5;font-style:normal;' +
      'border-right:3px solid var(--addition)">$1</span>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?!\/?(?:b|i|strong|em|span)\b)[^>]+>/gi, '')
    .trim();
}

// Split a cleaned verse that may contain \u2029 section markers
function splitVerseOnHeaders(v) {
  const SEP = '|||HEADER|||';
  if (!v.includes(SEP)) return [v];
  const parts = v.split(SEP);
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (!p) continue;
    // Odd positions are header labels (between sentinel pairs)
    if (i % 2 === 1) {
      result.push('__HEADER__' + p);
    } else {
      result.push(p);
    }
  }
  return result;
}

function buildParagraphs(flat) {
  // Strip cantillation marks + nikud for pattern matching only
  const stripD = s => s.replace(/[\u0591-\u05C7]/g, '');

  // Only break into a NEW paragraph at these major structural points.
  // Keep each bracha (blessing unit) as ONE flowing paragraph.
  const MAJOR_BREAK = [
    /^לשם יחוד/,     // קבלת עול מצוות – always starts a new unit
    /^יהי רצון/,     // יהי רצון – standalone prayer
    /^הריני/,
    /^שמע ישראל/,    // ק"ש – major unit
    /^ואהבת/,        // פרשת ואהבת
    /^והיה אם/,      // פרשת והיה
    /^ויאמר/,        // פרשת ציצית
    /^אני מאמין/,    // עיקרי האמונה
  ];

  // Flush AFTER these closing formulas
  const BRACHA_END = [
    /ברוך אתה י[יה]/,
    /המברך את עמו ישראל בשלום/,
  ];

  const paragraphs = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  };

  for (let v of flat) {
    v = v.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const plain = stripD(v.replace(/<[^>]+>/g, '').trim());
    if (!plain) { flush(); continue; }
    if (v.startsWith('__HEADER__')) { flush(); paragraphs.push('__HEADER__' + v.slice(10)); continue; }

    if (MAJOR_BREAK.some(r => r.test(plain))) flush();
    current.push(v);
    if (BRACHA_END.some(r => r.test(plain))) flush();
  }
  flush();
  return paragraphs;
}

// Debug helper: log first few words of each paragraph
function _logParagraphs(label, paragraphs) {
  const stripD = s => s.replace(/[\u0591-\u05C7]/g, '');
  console.log(`[Siddur-para] ${label}: ${paragraphs.length} paragraphs`);
  if (paragraphs.length <= 20) {
    paragraphs.forEach((p, i) => {
      const words = stripD(p.replace(/<[^>]+>/g,'')).trim().split(/\s+/);
      console.log(`  [${i+1}] ${words.length}w: ${words.slice(0,5).join(' ')}...`);
    });
  }
}

