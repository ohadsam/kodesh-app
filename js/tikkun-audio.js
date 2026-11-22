// ═══════════════════════════════════════════════════════════════════════
// TIKKUN-AUDIO.JS – the recorded reading of the current aliya (תיקון קוראים view)
//
// Sefaria shows "Torah Readings" in a verse's resource panel: human recordings from the PocketTorah app (Avery-Binder
// style Ashkenazi trope, CC-BY-SA; the ONLY audio source Sefaria has – 40 Tanakh refs scanned, Nov 2026).
// VERIFIED LIVE (GitHub Actions probe, Nov 22 2026): GET /api/related/<ref> returns `media: [{media_url, source:
// "PocketTorah", start_time, end_time, anchorRef, license:"CC-BY-SA", source_site, description…}]`, one entry per
// verse. A "clip" is NOT a file: media_url is the recording of a whole ALIYA (…/data/audio/Lech-Lecha-7.mp3, ~1 MB,
// raw.githubusercontent.com, `access-control-allow-origin: *`) and start_time/end_time (seconds) are the verse's
// slice of it; consecutive verses are contiguous (end of one = start of the next). So an aliya plays gaplessly from
// ONE file and the verse boundaries are known exactly. /api/related is slow for big ranges (an aliya-sized range
// can 504), so the aliya is asked for in chunks of ≤5 verses, 4 at a time, each retried; the result is cached.
// No synthesized speech is ever used.
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

// (speed note) currentTime/duration are in media time, so the progress inside a verse does not depend on the speed;
// what depends on it is how fast it changes – see tikkunFollowDelta.
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
    const num = x => { const n = parseFloat(x); return isFinite(n) ? n : null; };
    let start = num(m.start_time), end = num(m.end_time);
    if (start == null || end == null || end <= start) { start = null; end = null; }          // no usable slice: the file is the clip
    if (!byKey[key]) byKey[key] = { key, url, start, end, source: String(m.source || m.source_site || '') };
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

// verse keys of the aliya → [{ref:'Genesis 1:6-1:10', keys:[...]}]: consecutive verses of one chapter, at most `size` each
function tikkunChunkRefs(verseKeys, book, size) {
  size = size || 5; const out = []; let cur = null;
  verseKeys.forEach(k => {
    const [c, v] = k.split(':').map(Number); if (!c) return;
    if (!cur || cur.c !== c || cur.keys.length >= size || v !== cur.lastV + 1) { cur = { c, lastV: v, keys: [], first: v }; out.push(cur); }
    cur.keys.push(k); cur.lastV = v;
  });
  return out.map(g => ({ ref: g.keys.length === 1 ? `${book} ${g.c}:${g.first}` : `${book} ${g.c}:${g.first}-${g.c}:${g.lastV}`, keys: g.keys }));
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
const _tkSleep = ms => new Promise(r => setTimeout(r, ms));
async function _tkFetchRelated(ref) {           // /api/related answers 504 now and then: retry
  for (let k = 0; ; k++) {
    try { return await fetchWithDelay('https://www.sefaria.org/api/related/' + encodeURI(ref), 0); }
    catch (e) { if (k >= 2) throw e; await _tkSleep(700 * (k + 1)); }
  }
}
async function _tkClipList(ref) {
  const key = 'tikkun-audio-list:' + ref;
  if (_tkListMem[ref]) return _tkListMem[ref];
  if (typeof cacheGetJson === 'function') {
    const hit = await cacheGetJson(key, 'tikkun');
    if (hit && Array.isArray(hit.audioItems)) { console.log('[Cache] HIT tikkun clip list', ref); return (_tkListMem[ref] = hit); }
  }
  const keys = _aliyaVerseNums.filter(Boolean), book = (String(ref).match(/^(.+?)\s+\d+:/) || [])[1] || String(ref);
  const chunks = tikkunChunkRefs(keys, book, 5), byKey = {};
  let done = 0, errors = 0, next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const ch = chunks[next++];
      try { tikkunParseMedia(await _tkFetchRelated(ch.ref), ch.keys).items.forEach(it => { byKey[it.key] = it; }); }
      catch (e) { errors++; console.warn('[Tikkun] related failed for', ch.ref, e.message); }
      done++; if (chunks.length > 2 && TK_AUDIO.state === 'loading') _tkSetMsg(`מחפש הקראה… ${done}/${chunks.length}`);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const items = keys.map(k => byKey[k]).filter(Boolean);
  const list = { audioItems: items, missing: keys.length - items.length, source: (items[0] && items[0].source) || '', errors };
  if (items.length && !errors) { _tkListMem[ref] = list; if (typeof cachePutJson === 'function') cachePutJson(key, list, 'tikkun'); }   // an incomplete list is not kept: the next try asks again
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
    const src = await _tkClipSrc(a.items[j]);            // one file per aliya: fetched (and cached) once, then it is a lookup
    if (!(a.durs[j] > 0) && a.items[j].start == null) { await _tkMeasure(j, src); if (token === _tkWarmToken) _tkUpdateProgress(); }
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
  a.items = list.audioItems; a.source = list.source; a.curUrl = null;
  a.durs = a.items.map(it => (it.start != null && it.end != null) ? it.end - it.start : 0);      // exact: start/end_time of each verse
  if (key) idx = Math.max(0, a.items.findIndex(x => x.key === key));
  a.el = a.el || new Audio();
  for (const p of ['preservesPitch', 'webkitPreservesPitch', 'mozPreservesPitch']) { try { a.el[p] = true; } catch (e) { /* not supported */ } }   // the melody must not change with the speed
  _tkApplyRate();
  a.el.onratechange = _tkApplyRate;                                   // something reset it (new clip, OS media keys…): put the chosen speed back
  a.el.onended = () => { if (a.i + 1 < a.items.length) _tkPlayAt(a.i + 1, 0, true); else tikkunAudioStop(); };      // end of a FILE
  a.el.onerror = () => { if (a.state !== 'idle') { _tkSetMsg('קובץ ההקראה לא נטען'); tikkunAudioStop(true); } };
  a.el.ontimeupdate = _tkUpdateProgress;
  _tkInitScrollGuards();
  a.msg = `הקראה אנושית · ${a.source || 'PocketTorah'} (CC-BY-SA, בסגנון אברי-בינדר) · נוסח אשכנז` + (list.missing ? ` · חסרים ${list.missing} פסוקים` + (list.errors ? ' (שגיאת רשת בחלק מהבקשות – נסה שוב)' : '') : '');
  await _tkPlayAt(idx, t, autoplay);
  return true;
}

// go to verse i (+ t seconds into it) and play / stay paused. Verses of one aliya are slices of ONE file: when it is
// already loaded this is just a seek (gapless); otherwise the file is loaded (from IndexedDB or the network) first.
let _tkBound = 0;
async function _tkPlayAt(i, t, autoplay) {
  const a = TK_AUDIO, it = a.items[i]; if (!it) return;
  a.i = i;
  const token = ++_tkWarmToken;
  a.state = autoplay ? 'playing' : 'paused';
  _tikkunRenderOpts(); _tkHighlight(i);
  const at = (it.start || 0) + (t || 0);
  if (a.curUrl === it.url && a.el.src) {
    try { a.el.currentTime = at; } catch (e) { /* ignore */ }
    _tkApplyRate(); if (autoplay) { const p = a.el.play(); if (p && p.catch) p.catch(() => { a.state = 'paused'; _tikkunRenderOpts(); }); } else a.el.pause();
  } else {
    const src = await _tkClipSrc(it);
    if (a.i !== i || a.state === 'idle') return;                     // stopped / jumped while the file was being fetched
    a.curUrl = it.url;
    a.el.onloadedmetadata = () => {
      _tkApplyRate();
      if (it.start == null && isFinite(a.el.duration) && a.el.duration > 0) a.durs[a.i] = a.el.duration;      // whole-file clip: measure
      if (at > 0) { try { a.el.currentTime = at; } catch (e) { /* ignore */ } }
      _tkUpdateProgress();
    };
    _tkApplyRate(); a.el.src = src; _tkApplyRate();
    if (autoplay) { _tkApplyRate(); const p = a.el.play(); if (p && p.catch) p.catch(() => { a.state = 'paused'; _tikkunRenderOpts(); }); }
  }
  clearInterval(_tkBound); _tkBound = setInterval(_tkBoundary, 40);
  _tkSyncStart(); _tkUpdateProgress();
  _tkWarm(i + 1, token);
}

// verse boundaries inside the file (checked every 40 ms: timeupdate alone is too coarse – ~250 ms)
function _tkBoundary() {
  const a = TK_AUDIO; if (a.state !== 'playing' || !a.el || a.i < 0) return;
  const cur = a.el.currentTime || 0; let it = a.items[a.i]; if (!it) return;
  let moved = false;
  for (;;) {                                                           // reached the next verse of the same file?
    const nx = a.items[a.i + 1];
    if (nx && nx.url === it.url && nx.start != null && cur >= nx.start - 0.02) { a.i++; it = nx; moved = true; } else break;
  }
  if (it.end != null && cur >= it.end - 0.02) {                        // end of this verse's slice
    const nx = a.items[a.i + 1];
    if (!nx) { tikkunAudioStop(); return; }
    if (nx.url !== it.url || nx.start == null) { _tkPlayAt(a.i + 1, 0, true); return; }
    a.el.currentTime = nx.start; a.i++; moved = true;                  // same file, a gap between the slices: skip it
  }
  if (moved) { _tkHighlight(a.i); _tkUpdateProgress(); }
}

function tikkunAudioPause() {
  const a = TK_AUDIO; if (!a.el) return;
  a.el.pause(); a.state = 'paused'; cancelAnimationFrame(_tkRaf); _tikkunRenderOpts();
}
function tikkunAudioResume() {
  const a = TK_AUDIO; if (!a.el) return;
  a.state = 'playing'; _tkApplyRate(); const p = a.el.play(); if (p && p.catch) p.catch(() => { a.state = 'paused'; _tikkunRenderOpts(); });
  _tikkunRenderOpts(); _tkSyncStart();
}
function tikkunAudioStop(keepMsg) {
  const a = TK_AUDIO;
  clearInterval(_tkBound);
  if (a.el) { a.el.onended = null; a.el.ontimeupdate = null; a.el.pause(); }
  a.curUrl = null;
  a.state = 'idle'; a.i = -1; a.items = []; a.durs = []; a.ref = null; a.jumpOpen = false; _tkWarmToken++; cancelAnimationFrame(_tkRaf);
  Object.keys(_tkObjUrls).forEach(u => { URL.revokeObjectURL(_tkObjUrls[u]); delete _tkObjUrls[u]; });   // the bytes stay in IndexedDB
  if (!keepMsg) a.msg = '';
  _tkHighlight(-1); _tikkunRenderOpts();
}

// A new `src` resets playbackRate to defaultPlaybackRate (browsers do this when the element loads a clip), so the chosen
// speed must be set as the default too and re-applied whenever the element loads, plays or reports a rate change.
function _tkApplyRate() {
  const a = TK_AUDIO, el = a.el; if (!el) return;
  try { el.defaultPlaybackRate = a.rate; if (el.playbackRate !== a.rate) el.playbackRate = a.rate; } catch (e) { /* ignore */ }
}
function tikkunAudioSetRate(r) {
  const a = TK_AUDIO; r = parseFloat(r); if (!TK_RATES.includes(r)) return;
  a.rate = r; _tkApplyRate(); _tkSavePrefs();
  _tkLastTs = 0; _tkHoldUntil = 0;                         // the follow-along re-locks onto the reading point at once
  if (a.state === 'playing') _tkSyncStart();
}
function tikkunAudioToggleSync() {
  const a = TK_AUDIO; a.sync = !a.sync; _tkSavePrefs();
  if (a.sync) _tkSyncStart(); else cancelAnimationFrame(_tkRaf);
  tikkunAudioRenderPanel();
}

// ── Follow-along scrolling ──────────────────────────────────────────────
// The reading point (progress through the current verse) is kept at ~38% of the screen height, eased every frame, so
// the text moves exactly as fast as the reading does (a different playback speed = a different scroll speed).
let _tkRaf = 0, _tkHoldUntil = 0, _tkGuards = false, _tkLastTs = 0;
const TK_FOLLOW_TAU = 0.18;        // s – how quickly the text catches up with the reading point
function _tkSyncStart() {
  const a = TK_AUDIO; cancelAnimationFrame(_tkRaf); _tkLastTs = 0;
  if (!a.sync || a.state !== 'playing') return;
  if (typeof autoScrollStop === 'function' && typeof _asState !== 'undefined' && _asState !== 'idle') autoScrollStop();   // two scrollers would fight
  _tkRaf = requestAnimationFrame(_tkSyncTick);
}
// Where (in px, relative to the target line) is the reading point of the verse being read? `lead` = how far ahead in
// MEDIA time to look: the smoothing makes the text trail the target by TAU seconds of real time, which is
// rate × TAU of media time – looking that far ahead cancels the trail at every speed (0.5× … 2×), so the text is
// not behind the voice when it is fast, nor ahead of it when it is slow.
function tikkunFollowDelta(rectTop, rectH, vh, cur, dur, rate, tau) {
  const lead = (rate || 1) * (tau == null ? TK_FOLLOW_TAU : tau);
  const p = dur > 0 ? Math.min(1, Math.max(0, (cur + lead) / dur)) : 0;
  return rectTop + p * rectH - vh * 0.38;
}
function _tkSyncTick(ts) {
  const a = TK_AUDIO; if (!a.sync || a.state !== 'playing') return;
  const dt = _tkLastTs ? Math.min(0.1, (ts - _tkLastTs) / 1000) : 1 / 60; _tkLastTs = ts;
  const v = _tkVerseEl(_aliyaVerseNums.indexOf((a.items[a.i] || {}).key));
  if (v && performance.now() > _tkHoldUntil && !a.seeking) {
    const r = v.getBoundingClientRect();
    const dur = a.durs[a.i] || (a.el && a.el.duration) || 0;
    const delta = tikkunFollowDelta(r.top, r.height, window.innerHeight, _tkInVerse(), dur, a.el.playbackRate || a.rate);
    if (Math.abs(delta) > window.innerHeight * 1.5) window.scrollBy({ top: delta, behavior: 'instant' });      // far jump: no long slide
    else if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta * (1 - Math.exp(-dt / TK_FOLLOW_TAU)), behavior: 'instant' });   // frame-rate independent easing
  }
  _tkRaf = requestAnimationFrame(_tkSyncTick);
}
// true while a reading is open (playing or paused) and the follow-along is on
function tikkunAudioOwnsScroll() { const a = TK_AUDIO; return a.sync && (a.state === 'playing' || a.state === 'paused'); }
function tikkunAudioUserScrolled() { _tkHoldUntil = performance.now() + 4000; }     // the reader took over: let go for a moment
function _tkInitScrollGuards() {
  if (_tkGuards) return; _tkGuards = true;
  const guard = e => { if (TK_AUDIO.state === 'playing' && !(e.target && e.target.closest && e.target.closest('#tikkun-opts'))) tikkunAudioUserScrolled(); };
  window.addEventListener('wheel', guard, { passive: true });
  window.addEventListener('touchmove', guard, { passive: true });
  window.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) guard(e); });
}

// ── Progress bar ────────────────────────────────────────────────────────
// seconds into the CURRENT verse (the file's currentTime minus where this verse starts in it)
function _tkInVerse() { const a = TK_AUDIO, it = a.items[a.i]; return Math.max(0, (a.el ? a.el.currentTime || 0 : 0) - ((it && it.start) || 0)); }
function _tkPos() { const a = TK_AUDIO; return tikkunAbs(a.durs, Math.max(0, a.i), _tkInVerse()); }
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
  _tkPlayAt(loc.i, loc.t, playing);                                   // same file → just a seek
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
  return { key: a.items[a.i].key, t: Math.round(_tkInVerse() * 10) / 10, rate: a.rate, sync: a.sync };
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
