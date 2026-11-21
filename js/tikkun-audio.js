// ═══════════════════════════════════════════════════════════════════════
// TIKKUN-AUDIO.JS – the recorded reading of the current aliya (תיקון קוראים view)
//
// Sefaria shows "Torah Readings" in a verse's resource panel: human recordings from the PocketTorah app,
// Ashkenazi trope, CC-BY-SA, one clip per verse. Whether Sefaria's public API returns them is NOT verified (the
// sandbox cannot reach sefaria.org): we ask /api/related for the aliya, keep audio files whose source looks like
// those recordings, and say so in Hebrew when nothing is found. No synthesized speech is ever used.
// Verify with: python3 .claude/skills/sefaria-api/scripts/sefaria_probe.py media-check "Genesis 1:1-2:3"
//
// What it does (all per aliya, the clips are played one after the other):
//   • speeds 0.5×…2× (pitch kept, so the melody is not distorted)
//   • "גלילה עם ההקראה": the text follows the reading, scrolling at the pace of the audio (so the speed setting
//     also sets the scroll speed); play/pause/stop/seek always act on both; a manual scroll pauses the follow-along
//     for 4 s; the verse being read is highlighted
//   • progress bar over the whole aliya (real clip durations once measured) – drag to move
//   • drop-down with search: jump to an aliya or to a verse (by number, e.g. "17:26" / "כו", or by words of the text)
//   • bookmarks remember the reading position together with the place in the text (tikkunAudioCapture/Restore)
// Caching (tab 'tikkun' in js/cache.js, IndexedDB): the parsed clip list per aliya and every clip's bytes are stored
// the first time (hit → no network); the clips are fetched ahead while one plays.
// Prefs persist in appState.tikkunAudio = { rate, sync }.
// ═══════════════════════════════════════════════════════════════════════

const TK_RATES = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const TK_AUDIO = { state: 'idle', ref: null, items: [], durs: [], i: -1, el: null, rate: 1, sync: true, msg: '', source: '',
  seeking: false, pendingStart: false, jumpOpen: false, jumpQ: '', prefsLoaded: false };
const TK_AUDIO_SRC = /pocket\s*torah|torah\s*reading|chant|trope|cantillation|קריאה|טעמים/i;
const TK_AUDIO_URL = /\.(mp3|m4a|aac|ogg|wav)(\?|#|$)/i;
const TK_BOOKS_HE = { Genesis: 'בראשית', Exodus: 'שמות', Leviticus: 'ויקרא', Numbers: 'במדבר', Deuteronomy: 'דברים' };

// ── Pure helpers (unit-tested) ──────────────────────────────────────────
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

// clip durations (0 = not measured yet → the average of the measured ones, or 4 s) → where does second `sec` fall?
function tikkunDurAt(durs, i) {
  if (durs[i] > 0) return durs[i];
  const known = durs.filter(x => x > 0);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : 4;
}
function tikkunTotal(durs, n) { let s = 0; for (let i = 0; i < n; i++) s += tikkunDurAt(durs, i); return s; }
function tikkunLocate(durs, n, sec) {
  sec = Math.max(0, sec);
  for (let i = 0; i < n; i++) { const d = tikkunDurAt(durs, i); if (sec < d || i === n - 1) return { i, t: Math.min(sec, d) }; sec -= d; }
  return { i: 0, t: 0 };
}
function tikkunAbs(durs, i, t) { let s = 0; for (let k = 0; k < i; k++) s += tikkunDurAt(durs, k); return s + (t || 0); }
function tikkunFmtTime(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

// "Genesis 12:14-13:4" → "בראשית י״ב:י״ד–י״ג:ד׳"
function tikkunRefHe(ref) {
  const m = String(ref || '').match(/^(\w+) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/);
  if (!m) return String(ref || '');
  const g = n => toGematria(+n);
  const end = m[5] ? '–' + (m[4] && m[4] !== m[2] ? g(m[4]) + ':' : '') + g(m[5]) : '';
  return `${TK_BOOKS_HE[m[1]] || m[1]} ${g(m[2])}:${g(m[3])}${end}`;
}

// items of the jump list: aliyot of the parasha + the verses of the current aliya
function tikkunJumpItems(o) {
  const names = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'מפטיר'];
  const out = [];
  (o.aliyot || []).forEach((ref, i) => { if (ref) out.push({ kind: 'aliya', idx: i, label: (i === 7 ? 'מפטיר' : 'עליה ' + names[i]) + ' – ' + tikkunRefHe(ref), hay: (i === 7 ? 'מפטיר' : 'עליה ' + names[i]) + ' ' + ref, current: i === o.currentAliya }); });
  (o.verseKeys || []).forEach((k, i) => {
    const [c, v] = k.split(':').map(Number); if (!c) return;
    out.push({ kind: 'verse', i, key: k, label: `פרק ${toGematria(c)} פסוק ${toGematria(v)}`, text: (o.texts && o.texts[i]) || '', hay: `פרק ${toGematria(c)} פסוק ${toGematria(v)} ${c}:${v} ${(o.texts && o.texts[i]) || ''}`, has: !!(o.hasClip && o.hasClip[k]) });
  });
  return out;
}
function tikkunJumpFilter(items, q, norm) {
  norm = norm || (s => String(s).replace(/[֑-ׇ"'׳״]/g, '').toLowerCase());
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return items;
  return items.filter(it => { const h = norm(it.hay || it.label); return toks.every(t => h.includes(t)); });
}

// ── Prefs ───────────────────────────────────────────────────────────────
function _tkLoadPrefs() {
  const a = TK_AUDIO; if (a.prefsLoaded) return; a.prefsLoaded = true;
  const p = appState.tikkunAudio || {};
  if (TK_RATES.includes(p.rate)) a.rate = p.rate;
  if (p.sync === false) a.sync = false;
}
function _tkSavePrefs() { appState.tikkunAudio = { rate: TK_AUDIO.rate, sync: TK_AUDIO.sync }; saveState(); }

// ── Clip list + clip bytes (cached) ─────────────────────────────────────
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
// real duration of a clip (needed for the progress bar); never throws, gives up after 5 s
function _tkMeasure(i, src) {
  const a = TK_AUDIO; if (a.durs[i] > 0) return Promise.resolve(a.durs[i]);
  return new Promise(res => {
    try {
      const m = new Audio(); m.preload = 'metadata';
      const done = () => { const d = isFinite(m.duration) && m.duration > 0 ? m.duration : 0; if (d) a.durs[i] = d; res(d); };
      m.onloadedmetadata = done; m.onerror = () => res(0); setTimeout(() => res(a.durs[i] || 0), 5000);
      m.src = src;
    } catch (e) { res(0); }
  });
}
// while one clip plays: fetch (= cache) and measure all the others, those after it first
let _tkWarmToken = 0;
async function _tkWarm(from, token) {
  const a = TK_AUDIO, n = a.items.length;
  const order = []; for (let j = from; j < n; j++) order.push(j); for (let j = 0; j < Math.min(from, n); j++) order.push(j);
  for (const j of order) {
    if (token !== _tkWarmToken || a.state === 'idle') return;
    const src = await _tkClipSrc(a.items[j]);
    if (!(a.durs[j] > 0)) { await _tkMeasure(j, src); if (token === _tkWarmToken) _tkUpdateProgress(); }
  }
}

// ── Session ─────────────────────────────────────────────────────────────
function tikkunAudioButtonHtml() {
  const a = TK_AUDIO, st = a.state;
  return _tikkunChip(st === 'playing' ? '⏸ השהה' : st === 'loading' ? '⏳ מחפש…' : st === 'paused' ? '▶ המשך' : '🎧 הקראה', st === 'playing', 'tikkunAudioToggle()', ' id="tk-audio-btn"');
}
function _tkSetMsg(msg) { TK_AUDIO.msg = msg || ''; _tikkunRenderOpts(); }
const _tkVerseEl = i => document.querySelector(`#parasha-content .tk-v[data-i="${i}"]`);
function _tkHighlight(i) {
  document.querySelectorAll('#parasha-content .tk-v.tk-playing').forEach(e => e.classList.remove('tk-playing'));
  if (i < 0 || !TK_AUDIO.items[i]) return;
  const v = _tkVerseEl(_aliyaVerseNums.indexOf(TK_AUDIO.items[i].key));
  if (v) v.classList.add('tk-playing');
}

async function tikkunAudioToggle() {
  const a = TK_AUDIO; _tkLoadPrefs();
  if (a.state === 'loading') return;
  if (a.state === 'playing') return tikkunAudioPause();
  if (a.state === 'paused' && a.el) return tikkunAudioResume();
  await _tkStart({ idx: 0, t: 0, autoplay: true });
}

// open a session for the current aliya (load the clip list, create the player) and go to a clip
async function _tkStart({ idx = 0, key = null, t = 0, autoplay = true }) {
  const a = TK_AUDIO; _tkLoadPrefs();
  const ref = _currentAliyaRef;
  if (!ref || !_aliyaVerseNums.length) return false;
  a.state = 'loading'; a.ref = ref; a.msg = ''; _tikkunRenderOpts();
  let list;
  try {
    list = await _tkClipList(ref);
    if (a.ref !== _currentAliyaRef) { a.state = 'idle'; return false; }
  } catch (e) {
    a.state = 'idle'; _tkSetMsg('לא ניתן לבדוק הקראה כרגע (' + e.message + ')'); return false;
  }
  if (!list.audioItems.length) { a.state = 'idle'; a.ref = null; _tkSetMsg('לא נמצאה בספריא הקראה מוקלטת (עם טעמים) לעליה זו.'); return false; }
  a.items = list.audioItems; a.durs = new Array(a.items.length).fill(0); a.source = list.source;
  if (key) idx = Math.max(0, a.items.findIndex(x => x.key === key));
  a.el = a.el || new Audio();
  for (const p of ['preservesPitch', 'webkitPreservesPitch', 'mozPreservesPitch']) { try { a.el[p] = true; } catch (e) { /* not supported */ } }   // the melody must not change with the speed
  a.el.playbackRate = a.rate;
  a.el.onended = () => { if (a.i + 1 < a.items.length) _tkPlayAt(a.i + 1, 0, true); else tikkunAudioStop(); };
  a.el.onerror = () => { if (a.state !== 'idle') { _tkSetMsg('קובץ ההקראה לא נטען'); tikkunAudioStop(true); } };
  a.el.ontimeupdate = _tkUpdateProgress;
  _tkInitScrollGuards();
  a.msg = `הקראה אנושית · ${a.source || 'ספריא'} · נוסח אשכנז` + (list.missing ? ` · חסרים ${list.missing} פסוקים` : '');
  await _tkPlayAt(idx, t, autoplay);
  return true;
}

async function _tkPlayAt(i, t, autoplay) {
  const a = TK_AUDIO; a.i = i;
  const token = ++_tkWarmToken;
  a.state = autoplay ? 'playing' : 'paused';
  _tikkunRenderOpts(); _tkHighlight(i);
  const src = await _tkClipSrc(a.items[i]);
  if (a.i !== i || a.state === 'idle') return;                       // stopped / jumped while the clip was being fetched
  a.el.onloadedmetadata = () => {
    if (isFinite(a.el.duration) && a.el.duration > 0) a.durs[i] = a.el.duration;
    if (t > 0) { try { a.el.currentTime = Math.min(t, Math.max(0, (a.durs[i] || t + 1) - 0.05)); } catch (e) { /* ignore */ } }
    _tkUpdateProgress();
  };
  a.el.src = src; a.el.playbackRate = a.rate;
  if (autoplay) { const p = a.el.play(); if (p && p.catch) p.catch(() => { a.state = 'paused'; _tikkunRenderOpts(); }); }
  _tkSyncStart();
  _tkWarm(i + 1, token);
}

function tikkunAudioPause() {
  const a = TK_AUDIO; if (!a.el) return;
  a.el.pause(); a.state = 'paused'; cancelAnimationFrame(_tkRaf); _tikkunRenderOpts();
}
function tikkunAudioResume() {
  const a = TK_AUDIO; if (!a.el) return;
  a.state = 'playing'; const p = a.el.play(); if (p && p.catch) p.catch(() => { a.state = 'paused'; _tikkunRenderOpts(); });
  _tikkunRenderOpts(); _tkSyncStart();
}
function tikkunAudioStop(keepMsg) {
  const a = TK_AUDIO;
  if (a.el) { a.el.onended = null; a.el.ontimeupdate = null; a.el.pause(); }
  a.state = 'idle'; a.i = -1; a.items = []; a.durs = []; a.ref = null; a.jumpOpen = false; _tkWarmToken++; cancelAnimationFrame(_tkRaf);
  Object.keys(_tkObjUrls).forEach(u => { URL.revokeObjectURL(_tkObjUrls[u]); delete _tkObjUrls[u]; });   // the bytes stay in IndexedDB
  if (!keepMsg) a.msg = '';
  _tkHighlight(-1); _tikkunRenderOpts();
}

function tikkunAudioSetRate(r) {
  const a = TK_AUDIO; r = parseFloat(r); if (!TK_RATES.includes(r)) return;
  a.rate = r; if (a.el) a.el.playbackRate = r; _tkSavePrefs();
}
function tikkunAudioToggleSync() {
  const a = TK_AUDIO; a.sync = !a.sync; _tkSavePrefs();
  if (a.sync) _tkSyncStart(); else cancelAnimationFrame(_tkRaf);
  tikkunAudioRenderPanel();
}

// ── Follow-along scrolling ──────────────────────────────────────────────
// The reading point (progress through the current verse) is kept at ~38% of the screen height, eased every frame, so
// the text moves exactly as fast as the reading does (a different playback speed = a different scroll speed).
let _tkRaf = 0, _tkHoldUntil = 0, _tkGuards = false;
function _tkSyncStart() {
  const a = TK_AUDIO; cancelAnimationFrame(_tkRaf);
  if (!a.sync || a.state !== 'playing') return;
  if (typeof autoScrollStop === 'function' && typeof _asState !== 'undefined' && _asState !== 'idle') autoScrollStop();   // two scrollers would fight
  _tkRaf = requestAnimationFrame(_tkSyncTick);
}
function _tkSyncTick() {
  const a = TK_AUDIO; if (!a.sync || a.state !== 'playing') return;
  const v = _tkVerseEl(_aliyaVerseNums.indexOf((a.items[a.i] || {}).key));
  if (v && performance.now() > _tkHoldUntil && !a.seeking) {
    const r = v.getBoundingClientRect();
    const dur = a.durs[a.i] || (a.el && a.el.duration) || 0;
    const p = dur > 0 ? Math.min(1, Math.max(0, (a.el.currentTime || 0) / dur)) : 0;
    const delta = r.top + p * r.height - window.innerHeight * 0.38;
    if (Math.abs(delta) > window.innerHeight * 1.5) window.scrollBy({ top: delta, behavior: 'instant' });      // far jump: no long slide
    else if (Math.abs(delta) > 1) window.scrollBy({ top: delta * 0.15, behavior: 'instant' });
  }
  _tkRaf = requestAnimationFrame(_tkSyncTick);
}
function tikkunAudioUserScrolled() { _tkHoldUntil = performance.now() + 4000; }     // the reader took over: let go for a moment
function _tkInitScrollGuards() {
  if (_tkGuards) return; _tkGuards = true;
  const guard = e => { if (TK_AUDIO.state === 'playing' && !(e.target && e.target.closest && e.target.closest('#tikkun-opts'))) tikkunAudioUserScrolled(); };
  window.addEventListener('wheel', guard, { passive: true });
  window.addEventListener('touchmove', guard, { passive: true });
  window.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) guard(e); });
}

// ── Progress bar ────────────────────────────────────────────────────────
function _tkPos() { const a = TK_AUDIO; return tikkunAbs(a.durs, Math.max(0, a.i), a.el ? a.el.currentTime || 0 : 0); }
function _tkUpdateProgress() {
  const a = TK_AUDIO; if (a.state === 'idle' || a.seeking) return;
  const n = a.items.length, total = tikkunTotal(a.durs, n), pos = _tkPos();
  const seek = document.getElementById('tk-seek'); if (seek) seek.value = total > 0 ? Math.round(pos / total * 1000) : 0;
  const tm = document.getElementById('tk-time'); if (tm) tm.textContent = tikkunFmtTime(pos) + ' / ' + tikkunFmtTime(total);
  const vl = document.getElementById('tk-vlabel'); if (vl) vl.textContent = _tkVerseLabel();
}
function _tkVerseLabel() {
  const a = TK_AUDIO, it = a.items[a.i]; if (!it) return '';
  const [c, v] = it.key.split(':').map(Number);
  return `פרק ${toGematria(c)} פסוק ${toGematria(v)} · ${a.i + 1}/${a.items.length}`;
}
function tikkunSeekPreview(val) {
  const a = TK_AUDIO; a.seeking = true;
  const n = a.items.length, total = tikkunTotal(a.durs, n), sec = val / 1000 * total;
  const tm = document.getElementById('tk-time'); if (tm) tm.textContent = tikkunFmtTime(sec) + ' / ' + tikkunFmtTime(total);
  const loc = tikkunLocate(a.durs, n, sec), it = a.items[loc.i];
  const vl = document.getElementById('tk-vlabel'); if (vl && it) { const [c, v] = it.key.split(':').map(Number); vl.textContent = `פרק ${toGematria(c)} פסוק ${toGematria(v)} · ${loc.i + 1}/${n}`; }
}
function tikkunSeekCommit(val) {
  const a = TK_AUDIO; a.seeking = false; if (a.state === 'idle' || !a.items.length) return;
  const n = a.items.length, loc = tikkunLocate(a.durs, n, val / 1000 * tikkunTotal(a.durs, n));
  const playing = a.state === 'playing';
  if (loc.i === a.i && a.el && a.el.src) { a.el.currentTime = loc.t; _tkUpdateProgress(); }
  else _tkPlayAt(loc.i, loc.t, playing);
  _tkHoldUntil = 0;
}

// ── Panel (shown while a reading is open, and for messages) ─────────────
function tikkunAudioRenderPanel() {
  const box = document.getElementById('tk-audio-panel'); if (!box) return;
  const a = TK_AUDIO, open = a.state === 'playing' || a.state === 'paused';
  let h = a.msg ? `<div class="tk-msg">${escapeHtml(a.msg)}</div>` : '';
  if (open) {
    const n = a.items.length, total = tikkunTotal(a.durs, n);
    h += `<div class="tk-aud">` +
      `<div class="tk-row">` +
        _tikkunChip('⏹ עצור', false, 'tikkunAudioStop()') +
        `<label class="tk-rate">מהירות <select id="tk-rate" onchange="tikkunAudioSetRate(this.value)" aria-label="מהירות ההקראה">` +
          TK_RATES.map(r => `<option value="${r}"${r === a.rate ? ' selected' : ''}>${r}×</option>`).join('') + `</select></label>` +
        _tikkunChip('↕ גלילה עם ההקראה: ' + (a.sync ? 'פועל' : 'כבוי'), a.sync, 'tikkunAudioToggleSync()') +
      `</div>` +
      `<input type="range" id="tk-seek" class="tk-seek" min="0" max="1000" step="1" value="${total > 0 ? Math.round(_tkPos() / total * 1000) : 0}" dir="ltr" aria-label="מיקום בהקראה" oninput="tikkunSeekPreview(this.value)" onchange="tikkunSeekCommit(this.value)">` +
      `<div class="tk-seekinfo"><span id="tk-vlabel">${escapeHtml(_tkVerseLabel())}</span><span id="tk-time" dir="ltr">${tikkunFmtTime(_tkPos())} / ${tikkunFmtTime(total)}</span></div>` +
      `<div class="tk-row">` + _tikkunChip(a.jumpOpen ? '▲ סגור' : '🔎 קפוץ לעליה / פסוק', a.jumpOpen, 'tikkunJumpToggle()') + `</div>` +
      (a.jumpOpen ? _tkJumpHtml() : '') +
    `</div>`;
  }
  box.innerHTML = h;
}

// ── Jump drop-down with search ──────────────────────────────────────────
function _tkJumpAll() {
  const a = TK_AUDIO, hasClip = {}; a.items.forEach(it => { hasClip[it.key] = true; });
  const o = getTikkunOpts();
  return tikkunJumpItems({ aliyot, currentAliya, verseKeys: _aliyaVerseNums, hasClip,
    texts: parashaVerses.map(v => tikkunTransform(v, {}).text.slice(0, 60)) });
}
function _tkJumpHtml() {
  const a = TK_AUDIO, norm = typeof srNormalize === 'function' ? srNormalize : undefined;
  const all = _tkJumpAll(), list = tikkunJumpFilter(all, a.jumpQ, norm);
  const shown = list.slice(0, 80);
  const row = it => it.kind === 'aliya'
    ? `<button type="button" class="tk-jrow tk-jaliya${it.current ? ' on' : ''}" onclick="tikkunJumpPick('aliya',${it.idx})">${escapeHtml(it.label)}</button>`
    : `<button type="button" class="tk-jrow${it.has ? '' : ' off'}" ${it.has ? '' : 'disabled'} onclick="tikkunJumpPick('verse',${it.i})"><b>${escapeHtml(it.label)}</b><span>${escapeHtml(it.text)}</span></button>`;
  return `<div class="tk-jump"><input id="tk-jq" class="tk-jq" type="search" autocomplete="off" placeholder="חפש: עליה ג · כו · 17:26 · מילים מהפסוק" value="${escapeHtml(a.jumpQ)}" oninput="tikkunJumpFilterInput(this.value)" aria-label="חיפוש עליה או פסוק">` +
    `<div class="tk-jlist" id="tk-jlist">${shown.length ? shown.map(row).join('') : '<div class="tk-jempty">לא נמצא</div>'}${list.length > shown.length ? `<div class="tk-jempty">… ועוד ${list.length - shown.length} – צמצם את החיפוש</div>` : ''}</div></div>`;
}
function tikkunJumpToggle() {
  const a = TK_AUDIO; a.jumpOpen = !a.jumpOpen; a.jumpQ = '';
  tikkunAudioRenderPanel();
  if (a.jumpOpen) setTimeout(() => { const q = document.getElementById('tk-jq'); if (q) q.focus(); }, 30);
}
function tikkunJumpFilterInput(q) {                       // only the list is redrawn: the input keeps focus
  const a = TK_AUDIO; a.jumpQ = q;
  const box = document.getElementById('tk-jlist'); if (!box) return;
  const tmp = document.createElement('div'); tmp.innerHTML = _tkJumpHtml();
  const nl = tmp.querySelector('#tk-jlist'); if (nl) box.innerHTML = nl.innerHTML;
}
async function tikkunJumpPick(kind, v) {
  const a = TK_AUDIO; a.jumpOpen = false;
  if (kind === 'verse') {
    const key = _aliyaVerseNums[v], idx = a.items.findIndex(x => x.key === key);
    if (idx < 0) { _tkSetMsg('אין הקראה מוקלטת לפסוק הזה'); return; }
    tikkunAudioRenderPanel(); await _tkPlayAt(idx, 0, true); return;
  }
  const tab = document.querySelectorAll('#aliya-tabs .aliya-tab')[v];
  if (!tab) return;
  if (v === currentAliya) { tikkunAudioRenderPanel(); await _tkPlayAt(0, 0, true); return; }
  tikkunAudioStop(); a.pendingStart = true;                // the reading starts by itself when that aliya has loaded
  await showAliya(v, tab);
}

// ── Hooks used by tikkun.js / bookmarks ─────────────────────────────────
function tikkunAudioBeforeRender() {
  const a = TK_AUDIO;
  if (a.ref && a.ref !== _currentAliyaRef) tikkunAudioStop(true);
}
function tikkunAudioAfterRender() {
  const a = TK_AUDIO;
  if (a.state === 'playing' || a.state === 'paused') _tkHighlight(a.i);
  if (a.pendingStart && _aliyaVerseNums.length) { a.pendingStart = false; setTimeout(() => tikkunAudioToggle(), 0); }
}
// the reading position, for a bookmark made while a reading is open
function tikkunAudioCapture() {
  const a = TK_AUDIO;
  if (!a.items.length || a.ref !== _currentAliyaRef || (a.state !== 'playing' && a.state !== 'paused') || !a.items[a.i]) return undefined;
  return { key: a.items[a.i].key, t: Math.round((a.el.currentTime || 0) * 10) / 10, rate: a.rate, sync: a.sync };
}
async function tikkunRestoreAudio(au) {
  if (!au || !au.key) return;
  const a = TK_AUDIO; _tkLoadPrefs();
  if (TK_RATES.includes(au.rate)) a.rate = au.rate;
  a.sync = au.sync !== false;
  tikkunAudioStop(true);
  const ok = await _tkStart({ key: au.key, t: au.t || 0, autoplay: false });
  if (ok) _tkSetMsg('הקראה מוכנה להמשך מהמקום שנשמר – לחץ ▶ (' + a.msg.replace(/^הקראה אנושית · /, '') + ')');
}
