// ═══════════════════════════════════════════════════════════════════════
// TIKKUN.JS – "תיקון קוראים": the parasha as it is written in a Torah scroll (sofer script),
// with optional layers on the SAME text: ניקוד, טעמי המקרא, verse numbers; a table of the ta'amim
// (js/taamim-data.js); and a best-effort recorded reading of the current aliya.
//
//   tikkunTransform(raw, opts)    pure: Sefaria verse → {html, pe, se} for the chosen layers
//   renderTikkun(el, helpers)     called by renderParasha() when parashaView === 'tikkun'
//   tikkunToggle / tikkunSetScript / tikkunShowTaamim / tikkunBackToText   toolbar actions
//   tikkunAudioToggle             recorded reading (Sefaria's PocketTorah recordings, Ashkenazi) if found
//
// Fonts: fonts/ItimStam{Ashkenaz,Sefarad}.woff2 – Culmus' Stam CLM letters + nikud/ta'amim (tools/build_stam_pointed.py).
// Options persist in appState.tikkun = { nikud, teamim, nums, script }.
// ═══════════════════════════════════════════════════════════════════════

const TIKKUN_DEFAULTS = { nikud: false, teamim: false, nums: true, script: 'ashkenaz' };
let _tikkunSub = 'text';                       // 'text' | 'taamim'

function getTikkunOpts() { return Object.assign({}, TIKKUN_DEFAULTS, appState.tikkun || {}); }

// ── Text layers ─────────────────────────────────────────────────────────
// nikud: the vowel points (and dagesh, shin/sin dots, rafe, qamats qatan);  ta'amim: the accents (U+0591-05AF),
// meteg/silluq, paseq. Sof pasuq stays with either layer. The maqaf joins words only when a layer is on:
// in a Torah scroll there is none (the words are just written with a space).
const TK_NIKUD_RE = /[ְ-ׇּֿׁׂׅׄ]/g;
const TK_TAAMIM_RE = /[֑-ֽ֯׀]/g;
const TK_TOKENS = { b: ['<span class="tk-big">', '</span>'], s: ['<span class="tk-small">', '</span>'], u: ['<span class="tk-sup">', '</span>'] };

function tikkunTransform(raw, o) {
  o = o || {};
  let s = String(raw == null ? '' : raw);
  // footnotes some editions embed are not part of the text
  s = s.replace(/<sup[^>]*footnote[^>]*>[\s\S]*?<\/sup>/gi, '').replace(/<i[^>]*footnote[^>]*>[\s\S]*?<\/i>/gi, '');
  // big / small / raised letters are part of the scroll: keep them as tokens, drop every other tag
  s = s.replace(/<(\/?)(big|small|sup)\b[^>]*>/gi, (m, sl, t) => '\u0001' + (sl ? '/' : '') + t[0].toLowerCase() + '\u0002')
       .replace(/<[^>]*>/g, '');
  s = s.replace(/&nbsp;|&thinsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // petucha / setuma markers → how the line is laid out
  const pe = /\{\s*פ\s*\}/.test(s), se = /\{\s*ס\s*\}/.test(s);
  s = s.replace(/\{\s*[פסר]\s*\}/g, '');
  const layers = !!(o.nikud || o.teamim);
  s = s.replace(/־/g, layers ? '־' : ' ');
  if (!o.nikud) s = s.replace(TK_NIKUD_RE, '');
  if (!o.teamim) s = s.replace(TK_TAAMIM_RE, '');
  if (!layers) s = s.replace(/׃/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  let html = escapeHtml(s).replace(/\u0001(\/?)([bsu])\u0002/g, (m, sl, t) => TK_TOKENS[t][sl ? 1 : 0]);
  return { html, pe, se, text: s };
}

// ── Toolbar ─────────────────────────────────────────────────────────────
function _tikkunChip(label, on, act, extra) {
  return `<button type="button" class="tk-chip${on ? ' on' : ''}" onclick="${act}" aria-pressed="${on ? 'true' : 'false'}"${extra || ''}>${label}</button>`;
}
function _tikkunRenderOpts() {
  const box = document.getElementById('tikkun-opts'); if (!box) return;
  const o = getTikkunOpts();
  const au = TK_AUDIO.state;
  box.innerHTML =
    `<div class="tk-row">` +
      _tikkunChip('ניקוד', o.nikud, "tikkunToggle('nikud')") +
      _tikkunChip('טעמי המקרא', o.teamim, "tikkunToggle('teamim')") +
      _tikkunChip('מספרי פסוקים', o.nums, "tikkunToggle('nums')") +
      _tikkunChip('כתב: ' + (o.script === 'sefarad' ? 'ספרד' : 'אשכנז'), false, 'tikkunSetScript()') +
    `</div><div class="tk-row">` +
      _tikkunChip(au === 'playing' ? '⏸ השהה' : au === 'loading' ? '⏳ מחפש…' : au === 'paused' ? '▶ המשך' : '🎧 הקראה', au === 'playing', 'tikkunAudioToggle()', ' id="tk-audio-btn"') +
      (au === 'playing' || au === 'paused' ? _tikkunChip('⏹', false, 'tikkunAudioStop()', ' aria-label="עצור"') + _tikkunChip(TK_AUDIO.rate + '×', false, 'tikkunAudioRate()') : '') +
      _tikkunChip(_tikkunSub === 'taamim' ? '← חזרה לטקסט' : '📋 רשימת הטעמים', _tikkunSub === 'taamim', _tikkunSub === 'taamim' ? 'tikkunBackToText()' : 'tikkunShowTaamim()') +
    `</div>` + (TK_AUDIO.msg ? `<div class="tk-msg">${escapeHtml(TK_AUDIO.msg)}</div>` : '');
}

function tikkunToggle(key) {
  const o = getTikkunOpts(); o[key] = !o[key];
  appState.tikkun = o; saveState();
  renderParasha();
}
function tikkunSetScript() {
  const o = getTikkunOpts(); o.script = o.script === 'sefarad' ? 'ashkenaz' : 'sefarad';
  appState.tikkun = o; saveState();
  renderParasha();
}
function tikkunShowTaamim() { _tikkunSub = 'taamim'; renderParasha(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function tikkunBackToText() { _tikkunSub = 'text'; renderParasha(); }

// ── The ta'amim table ───────────────────────────────────────────────────
function tikkunTaamimHtml() {
  const o = getTikkunOpts();
  const font = o.script === 'sefarad' ? 'tk-sefarad' : 'tk-ashkenaz';
  const row = t => {
    const alt = t.alt ? `<span class="tk-trop-sign tk-trop-alt ${font}" title="סימון חלופי">${t.alt.map(c => taamimSign([c])).join(' ')}</span>` : '';
    return `<div class="tk-trop"><span class="tk-trop-sign ${font}">${taamimSign(t.cps)}</span>${alt}` +
      `<span class="tk-trop-txt"><b>${escapeHtml(t.he)}</b><span>${escapeHtml(t.pos)}${t.note ? ' · ' + escapeHtml(t.note) : ''}</span></span></div>`;
  };
  const sec = (title, sub, list) => `<div class="tk-trop-h">${title}<span>${sub}</span></div>` + list.map(row).join('');
  return `<div class="tk-troplist">` +
    `<div class="tk-trop-intro">טעמי המקרא – כל טעם נכתב על אות; הסימן מוצג כאן על האות א׳ כדי שיהיה ברור איפה הוא נכתב.</div>` +
    sec('טעמים מפסיקים', 'מפרידים בין חלקי הפסוק (לפי סדר חשיבות משוער)', TAAMIM_DISJUNCTIVE) +
    sec('טעמים מחברים', 'מקשרים את המילה למילה שאחריה', TAAMIM_CONJUNCTIVE) +
    sec('סימנים נוספים', 'בעיקר בספרי אמ״ת ובסימני עזר', TAAMIM_OTHER) +
    `</div>`;
}

// ── Rendering ───────────────────────────────────────────────────────────
function renderTikkun(el, h) {
  if (TK_AUDIO.ref && TK_AUDIO.ref !== _currentAliyaRef) tikkunAudioStop(true);       // another aliya: the recording no longer fits
  _tikkunRenderOpts();
  if (_tikkunSub === 'taamim') { el.innerHTML = tikkunTaamimHtml(); return; }
  const o = getTikkunOpts();
  const marks = o.nikud || o.teamim;
  const cls = 'tk-t ' + (o.script === 'sefarad' ? 'tk-sefarad' : 'tk-ashkenaz') + (marks ? ' tk-marks' : '');
  el.innerHTML = '<div class="tk-scroll">' + parashaVerses.map((v, i) => {
    const t = tikkunTransform(v, o);
    return h.chapterHeader(i) +
      `<div class="tk-v${t.pe ? ' tk-pe' : ''}${t.se ? ' tk-se' : ''}" data-i="${i}">` +
      (o.nums ? `<span class="tk-n">${h.verseLabel(i)}</span>` : '') +
      `<span class="${cls}">${t.html}</span>` +
      (t.pe ? '<span class="tk-mk" title="פרשה פתוחה">פ</span>' : t.se ? '<span class="tk-mk" title="פרשה סתומה">ס</span>' : '') +
      '</div>';
  }).join('') + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════
// RECORDED READING (best effort)
// Sefaria shows "Torah Readings" in a verse's resource panel: human recordings from the PocketTorah app,
// Ashkenazi trope, CC-BY-SA, one clip per verse. Whether Sefaria's public API returns them is NOT verified
// (the sandbox cannot reach sefaria.org): we ask /api/related for the aliya, keep only audio files whose source
// looks like those recordings, and say so when nothing is found. No synthesized speech is ever used.
// Caching (tab 'tikkun' in js/cache.js, IndexedDB): the parsed clip list per aliya and every clip's audio bytes are
// stored the first time (cache hit → no network); the clips after the current one are fetched ahead.
// Verify with: python3 .claude/skills/sefaria-api/scripts/sefaria_probe.py media-check "Genesis 1:1-2:3"
// ═══════════════════════════════════════════════════════════════════════
const TK_AUDIO = { state: 'idle', ref: null, items: [], i: -1, el: null, rate: 1, msg: '', source: '' };
const TK_AUDIO_SRC = /pocket\s*torah|torah\s*reading|chant|trope|cantillation|קריאה|טעמים/i;
const TK_AUDIO_URL = /\.(mp3|m4a|aac|ogg|wav)(\?|#|$)/i;

// related-API media entries → [{key:'ch:v', url, source}] for the verses of this aliya, in reading order
function tikkunParseMedia(related, verseKeys) {
  const media = related && (related.media || related.Media || []);
  if (!Array.isArray(media)) return { items: [], missing: verseKeys.length, source: '' };
  const byKey = {};
  media.forEach(m => {
    const url = m && (m.media_url || m.url);
    if (!url || !/^https:\/\//i.test(url)) return;
    const label = [m.source, m.source_site, m.description && (m.description.en || m.description.he || m.description), url].filter(Boolean).join(' ');
    if (!TK_AUDIO_URL.test(url) && String(m.media_type || '').toLowerCase() !== 'audio') return;
    if (!TK_AUDIO_SRC.test(label)) return;
    const ref = String(m.anchorRef || (Array.isArray(m.anchorRefExpanded) ? m.anchorRefExpanded[0] : '') || '');
    const mm = ref.match(/(\d+):(\d+)$/) || ref.match(/(\d+):(\d+)-\d+(?::\d+)?$/);
    if (!mm) return;
    const key = mm[1] + ':' + mm[2];
    if (!byKey[key]) byKey[key] = { key, url, source: String(m.source || m.source_site || '') };
  });
  const items = verseKeys.map(k => byKey[k]).filter(Boolean);
  return { items, missing: verseKeys.length - items.length, source: (items[0] && items[0].source) || '' };
}

function _tkSetMsg(msg) { TK_AUDIO.msg = msg || ''; _tikkunRenderOpts(); }
function _tkHighlight(i) {
  document.querySelectorAll('#parasha-content .tk-v.tk-playing').forEach(e => e.classList.remove('tk-playing'));
  if (i < 0) return;
  const key = TK_AUDIO.items[i] && TK_AUDIO.items[i].key;
  const idx = _aliyaVerseNums.indexOf(key);
  const v = document.querySelector(`#parasha-content .tk-v[data-i="${idx}"]`);
  if (v) { v.classList.add('tk-playing'); v.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}

// The list of clips for an aliya: session map → IndexedDB (tab 'tikkun') → network (/api/related), then stored.
// Only the small parsed list is cached (the /api/related payload is large); an aliya without recordings is
// remembered for the session only, so a later attempt can still reach the network.
const _tkListMem = {};
async function _tkClipList(ref) {
  const key = 'tikkun-audio-list:' + ref;
  if (_tkListMem[ref]) return _tkListMem[ref];
  if (typeof cacheGetJson === 'function') {
    const hit = await cacheGetJson(key, 'tikkun');
    if (hit && Array.isArray(hit.audioItems)) { console.log('[Cache] HIT tikkun clip list', ref); return (_tkListMem[ref] = hit); }
  }
  const data = await fetchWithDelay('https://www.sefaria.org/api/related/' + encodeURI(ref), 0);
  const found = tikkunParseMedia(data, _aliyaVerseNums.filter(Boolean));
  const list = { audioItems: found.items, missing: found.missing, source: found.source };
  if (found.items.length) { _tkListMem[ref] = list; if (typeof cachePutJson === 'function') cachePutJson(key, list, 'tikkun'); }
  return list;
}

// One clip → something an <audio> can play: IndexedDB copy → else download (CORS) and store → else stream the URL.
const _tkObjUrls = {};
async function _tkClipSrc(item) {
  if (_tkObjUrls[item.url]) return _tkObjUrls[item.url];
  try {
    let blob = typeof cacheGetBlob === 'function' ? await cacheGetBlob(item.url, 'tikkun') : undefined;
    if (!blob) {
      const resp = await fetch(item.url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      blob = await resp.blob();
      if (typeof cachePutBlob === 'function') cachePutBlob(item.url, blob, 'tikkun');
    } else console.log('[Cache] HIT tikkun clip', item.key);
    return (_tkObjUrls[item.url] = URL.createObjectURL(blob));
  } catch (e) {
    console.warn('[Tikkun] clip not cacheable (' + e.message + '), streaming it');       // e.g. the host sends no CORS headers
    return item.url;
  }
}
// while a clip plays, fetch (and thereby cache) the clips that follow it
let _tkWarmToken = 0;
async function _tkWarm(from, token) {
  for (let j = from; j < TK_AUDIO.items.length; j++) {
    if (token !== _tkWarmToken || TK_AUDIO.state === 'idle') return;
    await _tkClipSrc(TK_AUDIO.items[j]);
  }
}

async function tikkunAudioToggle() {
  const a = TK_AUDIO;
  if (a.state === 'loading') return;
  if (a.state === 'playing') { a.el.pause(); a.state = 'paused'; _tikkunRenderOpts(); return; }
  if (a.state === 'paused' && a.el) { a.el.play(); a.state = 'playing'; _tikkunRenderOpts(); return; }
  const ref = _currentAliyaRef;
  if (!ref || !_aliyaVerseNums.length) return;
  a.state = 'loading'; a.ref = ref; _tkSetMsg('');
  let found;
  try {
    found = await _tkClipList(ref);
    if (a.ref !== _currentAliyaRef) { a.state = 'idle'; return; }
  } catch (e) {
    a.state = 'idle'; _tkSetMsg('לא ניתן לבדוק הקראה כרגע (' + e.message + ')'); return;
  }
  if (!found.audioItems.length) { a.state = 'idle'; a.ref = null; _tkSetMsg('לא נמצאה בספריא הקראה מוקלטת (עם טעמים) לעליה זו.'); return; }
  a.items = found.audioItems; a.i = 0; a.source = found.source;
  a.el = a.el || new Audio();
  a.el.playbackRate = a.rate;
  a.el.onended = () => { if (a.i + 1 < a.items.length) _tkPlayAt(a.i + 1); else tikkunAudioStop(); };
  a.el.onerror = () => { if (a.state !== 'idle') { _tkSetMsg('קובץ ההקראה לא נטען'); tikkunAudioStop(true); } };
  _tkSetMsg(`הקראה אנושית · ${a.source || 'ספריא'} · נוסח אשכנז` + (found.missing ? ` · חסרים ${found.missing} פסוקים` : ''));
  _tkWarmToken++;
  _tkPlayAt(0);
}
async function _tkPlayAt(i) {
  const a = TK_AUDIO; a.i = i;
  const token = ++_tkWarmToken;
  a.state = 'playing'; _tikkunRenderOpts(); _tkHighlight(i);
  const src = await _tkClipSrc(a.items[i]);
  if (a.i !== i || a.state === 'idle') return;                     // stopped / jumped while the clip was being fetched
  a.el.src = src; a.el.playbackRate = a.rate;
  const p = a.el.play(); if (p && p.catch) p.catch(() => { a.state = 'paused'; _tikkunRenderOpts(); });
  _tkWarm(i + 1, token);
}
function tikkunAudioStop(keepMsg) {
  const a = TK_AUDIO;
  if (a.el) { a.el.onended = null; a.el.pause(); }
  a.state = 'idle'; a.i = -1; a.items = []; a.ref = null; _tkWarmToken++;
  Object.keys(_tkObjUrls).forEach(u => { URL.revokeObjectURL(_tkObjUrls[u]); delete _tkObjUrls[u]; });   // the bytes stay in IndexedDB
  if (!keepMsg) a.msg = '';
  _tkHighlight(-1); _tikkunRenderOpts();
}
function tikkunAudioRate() {
  const a = TK_AUDIO; const r = [0.8, 1, 1.25]; a.rate = r[(r.indexOf(a.rate) + 1) % r.length];
  if (a.el) a.el.playbackRate = a.rate;
  _tikkunRenderOpts();
}
