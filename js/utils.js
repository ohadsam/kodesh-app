
// ═══════════════════════════════════════════
// LOG CAPTURE SYSTEM
// ═══════════════════════════════════════════
const appLogs = [];
const MAX_LOGS = 300;
const LOG_TTL_MS = 60 * 60 * 1000;  // 1 hour

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

const APP_VERSION  = '5.27';
const STORAGE_KEY  = 'kodesh_app_v1';
const SIDDUR_CACHE_KEY = 'siddur_cache_v';

// Version is displayed in splash by the inline HEAD script in index.html
// Cache clearing on version change is also handled there (runs before SW can intercept)
// Do NOT add a second version check here – it causes an infinite reload loop!

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
function cleanSefariaHtml(str) {
  if (!str) return '';

  return str
    .replace(/&thinsp;/g, '\u2009').replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
    .replace(/<small[^>]*>(.*?)<\/small>/gi, (_, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      // Remove English instructions entirely (Sefaria adds these as <small><i>...</i></small>)
      if (/^[A-Za-z(]/.test(text) || /^If you/.test(text) || /^During/.test(text) || /^From the/.test(text)) {
        return ''; // Remove English instructions
      }
      // Hebrew instructional text (בעשי"ת, בקיץ, בחורף labels) → remove
      const t = text.replace(/[\u0591-\u05C7]/g, '').trim();
      if (/^בקיץ$|^בחורף$|^בעשי.ת$/.test(t)) return '';
      // Muted inline text (ברוך שם, etc.)
      return `<span style="color:var(--muted);font-style:italic;font-size:.9em">${text}</span>`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?!\/?(?:b|i|strong|em|span)\b)[^>]+>/gi, '')
    .trim();
}

// Split a cleaned verse that may contain section markers
function splitVerseOnHeaders(v) {
  const SEP = '|||HEADER|||';
  if (!v.includes(SEP)) return [v];
  const parts = v.split(SEP);
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (!p) continue;
    if (i % 2 === 1) result.push('__HEADER__' + p);
    else result.push(p);
  }
  return result;
}

// Detect label for a seasonal insert
function _seasonalLabel(text) {
  // New format: "label::content" from splitSeasonalText
  if (text.includes('::')) {
    return text.split('::')[0].trim();
  }
  const t = text.replace(/[\u0591-\u05C7]/g,'');
  if (/ר.?ח|ראש.?ח/.test(t))   return 'ר"ח';
  if (/פסח/.test(t))             return 'פסח';
  if (/שבועות/.test(t))         return 'שבועות';
  if (/סוכות/.test(t))          return 'סוכות';
  if (/חנוכה/.test(t))          return 'חנוכה';
  if (/פורים/.test(t))          return 'פורים';
  if (/שבת/.test(t))            return 'שבת';
  if (/על הנסים/.test(t))       return 'חנוכה/פורים';
  if (/עשי.ת|תשובה/.test(t))   return 'עשי"ת';
  if (/חורף|מטר|גשם|משיב הרוח/.test(t))  return 'חורף';
  if (/קיץ|מוריד הטל|ותן ברכה/.test(t))  return 'קיץ';
  return '';
}

// Extract content from seasonal marker (strips label:: prefix if present)
function _seasonalContent(text) {
  if (text.includes('::')) {
    return text.split('::').slice(1).join('::').trim();
  }
  return text;
}

function buildParagraphs(flat) {
  // stripD removes cantillation but preserves sof-pasuk as ':'
  const stripD = s => s.replace(/\u05C3/g, ':').replace(/[\u0591-\u05C7]/g, '');

  // Break paragraph BEFORE these patterns
  const BREAK_BEFORE = [
    /^לשם יחוד/,
    /^יהי רצון/,
    /^הריני/,
    /^שמע ישראל/,
    /^ואהבת/,
    /^והיה אם/,
    /^ויאמר/,
    /^אני מאמין/,
    // Amida bracha openers
    /^עבודה רצה/,
    /^מודים אנחנו/,
    /^שים שלום/,
    /^אלהינו ואלהי אבותינו/,
    /^יעלה ויבוא/,
    /^על הנסים/,
    /^רצה והחליצנו/,
    /^אתה חונן/,
    /^השיבנו/,
    /^סלח לנו/,
    /^ראה נא/,
    /^רפאנו/,
    /^ברך עלינו/,
    /^תקע בשופר/,
    /^השיבה שופטינו/,
    /^למשומדים/,
    /^על הצדיקים/,
    /^ולירושלים/,
    /^את צמח/,
    /^שמע קולנו/,
    // Psalm / poetry structure
    /^הללויה/,
    /^הללו/,
    /^למנצח/,
    /^מזמור/,
    /^שיר המעלות/,
    /^שיר/,
    /^אשרי יושבי/,
    /^אשרי העם/,
    /^אשרי האיש/,
    // Kaddish / kedusha / common prayers
    /^יתגדל/,
    /^יהא שמה/,
    /^יתברך/,
    /^עלינו לשבח/,
    /^על כן נקוה/,
    /^ואנחנו כורעים/,
    /^קדוש קדוש/,
    /^נקדישך/,
    /^כתר יתנו/,
    // Tachanun / selichot
    /^אבינו מלכנו/,
    /^רחום וחנון/,
    /^שומר ישראל/,
    /^ויעבר/,
    /^אל מלך יושב/,
    /^אל ארך אפים/,
    // ובא לציון / אשרי
    /^ובא לציון/,
    /^ואני זאת בריתי/,
    /^ואתה קדוש/,
    // Common section starters
    /^ברוך שאמר/,
    /^ישתבח/,
    /^יוצר אור/,
    /^אהבת עולם/,
    /^אהבה רבה/,
    /^אמת ויציב/,
    /^אמת ואמונה/,
    /^השכיבנו/,
    /^ברכו את/,
    /^וידבר/,
    /^צדקתך/,
  ];

  const MAX_WORDS_PER_PARA = 45; // flush if current buffer exceeds this

  // Flush AFTER this pattern (marks end of a bracha)
  const BRACHA_END = /ברוך אתה י[יה]/;

  // Sof-pasuk: verse ending with ':' (Hebrew sof-pasuk mark or colon)
  // This is the natural verse boundary in Tanakh text
  const SOF_PASUK = /[:]\s*$/;

  const paragraphs = [];
  let current = [];

  const flush = () => {
    const joined = current.join(' ').trim();
    if (joined) paragraphs.push(joined);
    current = [];
  };

  for (let v of flat) {
    // Convert sof-pasuk to colon BEFORE other processing
    v = v.replace(/\u05C3/g, ':');
    // Normalize whitespace but preserve \uE001 markers
    v = v.replace(/\n/g, ' ').replace(/ +/g, ' ').trim();

    // ── Handle seasonal markers ────────────────────────────────────────
    if (v.includes('\uE001')) {
      const segs = v.split('\uE001');
      segs.forEach((seg, idx) => {
        seg = seg.trim();
        if (!seg) return;
        if (idx % 2 === 1) {
          flush();
          const label = _seasonalLabel(seg);
          const content = _seasonalContent(seg);
          paragraphs.push('\uE002' + label + '\uE003' + content + '\uE004');
        } else {
          const plain = stripD(seg.replace(/<[^>]+>/g, ''));
          if (BREAK_BEFORE.some(r => r.test(plain))) flush();
          current.push(seg);
          if (BRACHA_END.test(plain)) flush();
          else if (SOF_PASUK.test(plain)) flush();
        }
      });
      continue;
    }

    // ── Regular verse ────────────────────────────────────────────────
    const plain = stripD(v.replace(/<[^>]+>/g, '').trim());
    if (!plain) { flush(); continue; }
    if (v.startsWith('__HEADER__')) {
      flush();
      paragraphs.push('__HEADER__' + v.slice(10));
      continue;
    }

    if (BREAK_BEFORE.some(r => r.test(plain))) flush();
    current.push(v);

    // Flush priority: bracha end > sof-pasuk > word count
    if (BRACHA_END.test(plain)) {
      flush();
    } else if (SOF_PASUK.test(plain)) {
      // Sof-pasuk (end of biblical verse) = natural paragraph break
      flush();
    } else {
      // Flush if buffer is getting too long
      const currentWordCount = current.join(' ').replace(/<[^>]+>/g,'').split(/\s+/).filter(Boolean).length;
      if (currentWordCount >= MAX_WORDS_PER_PARA) flush();
    }
  }
  flush();
  return paragraphs;
}

// Debug helper
function _logParagraphs(label, paragraphs) {
  console.log(`[Siddur-para] ${label}: ${paragraphs.length} paragraphs`);
  if (paragraphs.length <= 25) {
    const stripD = s => s.replace(/[\u0591-\u05C7\uE001-\uE004]/g, '');
    paragraphs.forEach((p, i) => {
      if (p.startsWith('\uE002')) {
        const label2 = p.slice(1, p.indexOf('\uE003'));
        const content = p.slice(p.indexOf('\uE003')+1, p.lastIndexOf('\uE004'));
        console.log(`  [${i+1}] [seasonal "${label2}"] ${content.slice(0,30)}...`);
      } else if (p.startsWith('__HEADER__')) {
        console.log(`  [${i+1}] [header] ${p.slice(10)}`);
      } else {
        const words = stripD(p.replace(/<[^>]+>/g,'')).trim().split(/\s+/);
        console.log(`  [${i+1}] ${words.length}w: ${words.slice(0,6).join(' ')}...`);
      }
    });
  }
}

