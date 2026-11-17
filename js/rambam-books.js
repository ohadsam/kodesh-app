// ═══════════════════════════════════════════════════════════════════════
// RAMBAM-BOOKS.JS – "ספרי הרמב"ם": all of Mishneh Torah (14 sefarim, 84 sets of hilchot,
// chapter by chapter) with the Steinsaltz commentary placed under the halacha it explains.
// A sub-mode of the רמב"ם tab (the other mode is the daily Rambam in js/content.js).
//
//   data            js/rambam-data.js (RAMBAM_SEFARIM / RAMBAM_HIL, rambamRef, rambamNeighbor …)
//   rambamAlignSteinsaltz(halachot, data)  pure: which halacha does each Steinsaltz entry belong to
//   rbOpen / rbGoto / rbStep               navigation (token-guarded: a newer navigation wins)
//   rbRender*                              chapter view (text / + Steinsaltz inline / Steinsaltz only)
//   setRambamMode('daily'|'books')         the mode switch; loadRambamTab() is the tab's entry point
//   rbFind                                 find-in-chapter with highlighting
// State: appState.rambamMode, appState.rambamBooks = { hil: <slug>, ch, view }; read-markers use
// updateDoneButton('rambam', rambamDoneKey(h, ch)).
// ═══════════════════════════════════════════════════════════════════════

let _rbMode = 'daily';
let _rbState = { hil: 0, ch: 1, view: 'text' };
let _rbToken = 0;
let _rbCurrent = null;            // { hil, ch, halachot[], st }  st: null = not loaded, else an alignment / status object

// ── Text helpers ────────────────────────────────────────────────────────
// Sefaria text is trusted but may carry attributes/other tags: keep only simple inline formatting.
function _rbCleanHtml(s) {
  return String(s == null ? '' : s)
    .replace(/<(\/?)(b|i|strong|em|br)\b[^>]*>/gi, '\u0001$1$2\u0002')
    .replace(/<[^>]*>/g, '')
    .replace(/&thinsp;/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/\u0001(\/?)(b|i|strong|em|br)\u0002/g, '<$1$2>')
    .trim();
}
// plain, nikud-less, punctuation-less text for keyword matching
function _rbStrip(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/[֑-ׇ]/g, '').replace(/[׳״"'`’‘“”\-־–—.,;:!?()\[\]{}…]/g, ' ')
    .replace(/[ךםןףץ]/g, c => ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }[c]))
    .replace(/\s+/g, ' ').trim();
}
const _rbFlat = a => (Array.isArray(a) ? (typeof deepFlat === 'function' ? deepFlat(a) : a.flat(Infinity)) : (a ? [a] : []));

// Sefaria's chapter text → one string per halacha (he may be a string, a flat list, or a list of paragraph lists)
function rambamHalachotFrom(data) {
  const he = data && data.he;
  const top = typeof he === 'string' ? [he] : (Array.isArray(he) ? he : []);
  return top.map(el => Array.isArray(el) ? _rbFlat(el).filter(Boolean).join(' ') : el)
    .map(_rbCleanHtml).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════
// STEINSALTZ PLACEMENT
// Steinsaltz on Mishneh Torah is addressed [chapter][halacha][comment]. A range ref
// "Steinsaltz on Mishneh Torah, X 4:1-N" therefore comes back as he[halacha][comment] and
// he[i] belongs to halacha start+i (start = data.sections' last number). That structural
// address is the exact placement. Each comment opens with a bold lemma (<b>…</b>) quoting
// the halacha, which lets us VERIFY the structure (and repair a constant shift) and place
// comments from a flat response by keyword when there is no structure to trust.
// ═══════════════════════════════════════════════════════════════════════
function _rbEntry(raw) {
  const s = String(raw);
  const m = s.match(/<b>([\s\S]*?)<\/b>/i);
  const lemma = m ? m[1].replace(/\.\.\.|…/g, ' ¦ ') : '';              // an ellipsis inside a lemma = a gap between two quoted pieces
  let html = _rbCleanHtml(s);
  html = html.replace(/<\/b>\s*/i, '</b> — ');                  // lemma — explanation
  return { kw: _rbStrip(lemma), html, approx: false };
}
function _rbKwHit(hs, kw) {
  if (!kw || kw.length < 2) return false;
  const seg = (kw.split(' ¦ ')[0] || kw).trim();                // use the first quoted piece
  if (hs.includes(seg)) return true;
  const words = seg.split(' ');
  return words.length > 2 && hs.includes(words.slice(0, 2).join(' '));
}

function rambamAlignSteinsaltz(halachot, data) {
  const n = halachot.length;
  const out = { by: Array.from({ length: n }, () => []), mode: 'none', total: 0, approx: 0, shift: 0 };
  const he = data && data.he;
  if (!n || !Array.isArray(he) || !he.length) return out;
  const hs = halachot.map(_rbStrip);
  const nested = he.some(Array.isArray);
  const place = (i, e) => { out.by[Math.min(Math.max(i, 0), n - 1)].push(e); out.total++; if (e.approx) out.approx++; };

  if (nested) {
    const secs = Array.isArray(data.sections) ? data.sections : [];
    const last = secs.length >= 2 ? Number(secs[secs.length - 1]) : 1;
    const start = last >= 1 ? last : 1;
    const groups = he.map(g => _rbFlat(Array.isArray(g) ? g : [g]).filter(Boolean).map(_rbEntry));
    // how well does "he[i] ↔ halacha start-1+i+shift" agree with the lemmata?
    const score = shift => {
      let withKw = 0, hit = 0;
      groups.forEach((g, i) => g.forEach(e => { if (!e.kw) return; withKw++; const h = hs[start - 1 + i + shift]; if (h !== undefined && _rbKwHit(h, e.kw)) hit++; }));
      return { withKw, ratio: withKw ? hit / withKw : 1 };
    };
    const base = score(0);
    let shift = 0, trusted = base.withKw === 0 || base.ratio >= 0.5;
    if (!trusted) {
      let best = { s: 0, ratio: base.ratio };
      for (const s of [-1, 1, -2, 2]) { const r = score(s).ratio; if (r > best.ratio) best = { s, ratio: r }; }
      if (best.s !== 0 && best.ratio >= 0.6 && best.ratio >= base.ratio + 0.2) { shift = best.s; trusted = true; }
    }
    if (trusted) {
      out.mode = shift ? 'structure-shifted' : 'structure'; out.shift = shift;
      groups.forEach((g, i) => g.forEach(e => {
        const idx = start - 1 + i + shift;
        if (idx < 0 || idx >= n) e.approx = true;                 // beyond the chapter we know: keep it, flagged
        place(idx, e);
      }));
      return out;
    }
  }
  // flat response, or a structure whose lemmata do not match: place by lemma, in order
  out.mode = 'keyword';
  const entries = he.flatMap(g => _rbFlat(Array.isArray(g) ? g : [g]).filter(Boolean).map(_rbEntry));
  let at = 0;
  entries.forEach(e => {
    let idx = -1;
    if (e.kw) { for (let i = at; i < n && idx < 0; i++) if (_rbKwHit(hs[i], e.kw)) idx = i; for (let i = 0; i < at && idx < 0; i++) if (_rbKwHit(hs[i], e.kw)) idx = i; }
    if (idx < 0) { e.approx = true; idx = at; } else at = idx;
    place(idx, e);
  });
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// STATE / PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════
function _rbSave() {
  appState.rambamBooks = { hil: RAMBAM_HIL[_rbState.hil].slug, ch: _rbState.ch, view: _rbState.view };
  appState.rambamMode = _rbMode;
  saveState();
}
function _rbLoadSaved() {
  const s = appState.rambamBooks;
  const h = s && RAMBAM_HIL.find(x => x.slug === s.hil);
  if (h) _rbState = { hil: h.idx, ch: Math.min(Math.max(parseInt(s.ch) || 1, 1), h.ch), view: ['text', 'steinsaltz', 'steinsaltz_only'].includes(s.view) ? s.view : 'text' };
  _rbMode = appState.rambamMode === 'books' ? 'books' : 'daily';
}
const _rbIsDone = (h, ch) => !!appState['done_rambam_' + rambamDoneKey(h, ch)];
function _rbDoneCount(h) { let c = 0; for (let i = 1; i <= h.ch; i++) if (_rbIsDone(h, i)) c++; return c; }

// ═══════════════════════════════════════════════════════════════════════
// MODE SWITCH + TAB ENTRY
// ═══════════════════════════════════════════════════════════════════════
const _rbEl = id => document.getElementById(id);

function _rbApplyModeUI() {
  const books = _rbMode === 'books';
  _rbEl('rb-mode-daily')?.classList.toggle('active', !books);
  _rbEl('rb-mode-books')?.classList.toggle('active', books);
  const ui = _rbEl('rambam-books-ui'), bot = _rbEl('rambam-books-bottom');
  if (ui) ui.style.display = books ? '' : 'none';
  if (bot) bot.style.display = books ? '' : 'none';
  const t = _rbEl('rambam-title'); if (t) t.textContent = books ? 'ספרי הרמב"ם' : 'רמב"ם יומי';
}

function setRambamMode(mode) {
  _rbMode = mode === 'books' ? 'books' : 'daily';
  appState.rambamMode = _rbMode; saveState();
  _rbApplyModeUI();
  _rbToken++;                                         // cancel whatever the other mode was loading
  if (_rbMode === 'books') { rbRenderNav(); return rbOpen(_rbState.hil, _rbState.ch, _rbState.view); }
  return loadRambamYomi();
}

// entry point of the tab (js/app.js loadTab)
function loadRambamTab() {
  _rbLoadSaved();
  _rbApplyModeUI();
  if (_rbMode === 'daily') return loadRambamYomi();
  rbRenderNav();
  // a date change re-runs loadTab(): keep the chapter the user is on
  if (_rbCurrent && _rbCurrent.hil === _rbState.hil && _rbCurrent.ch === _rbState.ch) { rbRender(); return Promise.resolve(); }
  return rbOpen(_rbState.hil, _rbState.ch, _rbState.view);
}

// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION + LOADING
// ═══════════════════════════════════════════════════════════════════════
async function rbOpen(hIdx, ch, view) {
  const h = rambamByIdx(hIdx); if (!h) return;
  ch = Math.min(Math.max(parseInt(ch) || 1, 1), h.ch);
  view = view || _rbState.view || 'text';
  const token = ++_rbToken;
  _rbState = { hil: h.idx, ch, view };
  _rbMode = 'books'; _rbSave(); _rbApplyModeUI();
  _rbCurrent = null;
  rbRenderNav(); rbRenderHeader();
  const el = _rbEl('rambam-content');
  el.className = 'content-text loading'; el.textContent = 'טוען ' + h.he + ' פרק ' + toGematria(ch) + '...';
  window.scrollTo({ top: 0, behavior: 'instant' });
  try {
    const ref = rambamRef(h, ch);
    const data = await sefariaText(ref, 120, 'rambam');
    if (token !== _rbToken) return;
    const halachot = rambamHalachotFrom(data);
    if (!halachot.length) throw new Error(`אין טקסט עברי לפרק זה בספריא (${ref})`);
    _rbCurrent = { hil: h.idx, ch, halachot, st: null };
    if (view !== 'text') await rbLoadSteinsaltz(token);
    if (token !== _rbToken) return;
    rbRender();
  } catch (e) {
    if (token !== _rbToken) return;
    console.warn('[RambamBooks] load failed:', e.message);
    el.className = 'content-text';
    el.innerHTML = `<div style="text-align:center;padding:26px 8px;color:var(--muted)"><div style="font-size:24px;margin-bottom:8px">⚠️</div>
      <div style="margin-bottom:14px">שגיאה בטעינה: ${escapeHtml(e.message)}</div>
      <button class="rb-btn" onclick="rbOpen(${h.idx}, ${ch})">נסה שוב</button></div>`;
    if (typeof offerCacheClearOnFailure === 'function') offerCacheClearOnFailure('rambam', () => rbOpen(h.idx, ch));
  }
  rbRenderBottom();
}

async function rbLoadSteinsaltz(token) {
  const cur = _rbCurrent; if (!cur || cur.st) return;
  const h = rambamByIdx(cur.hil), n = cur.halachot.length;
  try {
    let data = await sefariaText(rambamSteinsaltzRef(h, cur.ch, n), 120, 'rambam');
    if (token !== undefined && token !== _rbToken) return;
    if (!rambamHalachotFrom(data).length) {                              // the bare chapter ref, as the daily Rambam does
      data = await sefariaText(`Steinsaltz on Mishneh Torah, ${h.en} ${cur.ch}`, 120, 'rambam');
      if (token !== undefined && token !== _rbToken) return;
    }
    cur.st = rambamAlignSteinsaltz(cur.halachot, data);
    if (!cur.st.total) cur.st = { by: cur.st.by, mode: 'none', total: 0, approx: 0, none: true };
  } catch (e) {
    console.warn('[RambamBooks] Steinsaltz failed:', e.message);
    if (token === undefined || token === _rbToken) cur.st = { by: [], mode: 'error', total: 0, approx: 0, error: e.message };
  }
}

function rbGoto(ch) { return rbOpen(_rbState.hil, ch, _rbState.view); }
function rbPickHil(idx) { return rbOpen(parseInt(idx), 1, _rbState.view); }
function rbPickSefer(si) { const h = RAMBAM_HIL.find(x => x.sefer === parseInt(si)); return h && rbOpen(h.idx, 1, _rbState.view); }
function rbStep(delta) {
  const nb = rambamNeighbor(_rbState.hil, _rbState.ch, delta);
  return nb ? rbOpen(nb.hIdx, nb.ch, _rbState.view) : null;
}
async function rbSetView(view) {
  _rbState.view = view; _rbSave();
  const el = _rbEl('rambam-content');
  rbRenderViewButtons();
  if (!_rbCurrent) return;
  if (view !== 'text' && !_rbCurrent.st) {
    el.className = 'content-text loading'; el.textContent = '⏳ טוען פירוש שטיינזלץ...';
    const token = _rbToken;
    await rbLoadSteinsaltz(token);
    if (token !== _rbToken) return;
  }
  rbRender();
}
function rbDoneAndNext() {
  const h = rambamByIdx(_rbState.hil), k = rambamDoneKey(h, _rbState.ch);
  if (!appState['done_rambam_' + k]) toggleDone('rambam', k);
  return rbStep(1);
}
function rbRetrySteinsaltz() { if (_rbCurrent) { _rbCurrent.st = null; return rbSetView(_rbState.view); } }

// for the bookmark adapter / global search
function rbCapture() { return { mode: 'books', hil: RAMBAM_HIL[_rbState.hil].slug, ch: _rbState.ch, view: _rbState.view }; }
async function rbRestore(s) {
  const h = RAMBAM_HIL.find(x => x.slug === s.hil); if (!h) return;
  await rbOpen(h.idx, s.ch, s.view || 'text');
}

// ═══════════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════════
function rbRenderViewButtons() {
  const w = _rbEl('rambam-view-buttons'); if (!w) return;
  const v = _rbState.view;
  w.innerHTML = [['text', '📖 רמב"ם'], ['steinsaltz', '📚 רמב"ם + שטיינזלץ'], ['steinsaltz_only', '📋 שטיינזלץ בלבד']]
    .map(([k, l]) => `<div class="aliya-tab ${v === k ? 'active' : ''}" onclick="rbSetView('${k}')">${l}</div>`).join('');
}

function rbRenderHeader() {
  const h = rambamByIdx(_rbState.hil); if (!h) return;
  const sub = _rbEl('rambam-subtitle');
  if (sub) sub.textContent = `${h.seferHe} · ${h.he} · פרק ${toGematria(_rbState.ch)} (${_rbState.ch} מתוך ${h.ch})`;
  updateDoneButton('rambam', rambamDoneKey(h, _rbState.ch));
  rbRenderViewButtons();
}

function rbRenderNav() {
  const ui = _rbEl('rambam-books-ui'); if (!ui) return;
  const h = rambamByIdx(_rbState.hil), ch = _rbState.ch;
  const seferOpts = RAMBAM_SEFARIM.map((s, i) => `<option value="${i}" ${i === h.sefer ? 'selected' : ''}>${escapeHtml(s.he)}</option>`).join('');
  const hilOpts = RAMBAM_HIL.filter(x => x.sefer === h.sefer).map(x => {
    const d = _rbDoneCount(x);
    return `<option value="${x.idx}" ${x.idx === h.idx ? 'selected' : ''}>${escapeHtml(x.he)} (${x.ch}${d ? ' · ✓' + d : ''})</option>`;
  }).join('');
  const chips = Array.from({ length: h.ch }, (_, i) => {
    const c = i + 1, on = c === ch, done = _rbIsDone(h, c);
    return `<button type="button" class="rb-chip${on ? ' rb-chip-on' : ''}${done ? ' rb-chip-done' : ''}" data-ch="${c}" onclick="rbGoto(${c})" aria-label="פרק ${c}${done ? ' – נלמד' : ''}">${done ? '✓ ' : ''}${c}</button>`;
  }).join('');
  const prev = rambamNeighbor(h.idx, ch, -1), next = rambamNeighbor(h.idx, ch, 1);
  const lbl = nb => !nb ? '' : (nb.hIdx === h.idx ? `פרק ${nb.ch}` : `${rambamByIdx(nb.hIdx).he} פרק ${nb.ch}`);
  const dc = _rbDoneCount(h);
  ui.innerHTML = `
    <div class="rb-search">
      <input id="rb-q" class="rb-input" type="search" autocomplete="off" spellcheck="false" placeholder='חפש הלכות או קפוץ לפרק: "שבת", "שבת ה", "תפילה"' aria-label="חיפוש הלכות ברמב״ם" oninput="rbSearchInput(this.value)" onkeydown="rbSearchKey(event)">
      <div id="rb-q-res" class="rb-res" style="display:none"></div>
    </div>
    <div class="rb-selects">
      <select id="rb-sefer" class="rb-select" onchange="rbPickSefer(this.value)" aria-label="ספר">${seferOpts}</select>
      <select id="rb-hil" class="rb-select" onchange="rbPickHil(this.value)" aria-label="הלכות">${hilOpts}</select>
    </div>
    <div class="rb-progress">נלמדו ${dc} מתוך ${h.ch} פרקים ב${escapeHtml(h.he)}</div>
    <div class="rb-chips" id="rb-chips">${chips}</div>
    <div class="rb-navrow">
      <button class="rb-btn" ${prev ? '' : 'disabled'} onclick="rbStep(-1)">${prev ? '→ ' + escapeHtml(lbl(prev)) : ''}</button>
      <span class="rb-pos">פרק ${ch} מתוך ${h.ch}</span>
      <button class="rb-btn" ${next ? '' : 'disabled'} onclick="rbStep(1)">${next ? escapeHtml(lbl(next)) + ' ←' : ''}</button>
    </div>
    <div class="rb-findrow" id="rb-find-wrap">
      <input id="rb-find" class="rb-input" type="search" autocomplete="off" spellcheck="false" placeholder="🔎 חפש בפרק הזה" aria-label="חיפוש בפרק" oninput="rbFind(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();rbFindStep(event.shiftKey?-1:1)}">
      <span id="rb-find-n" class="rb-findn"></span>
      <button class="rb-btn rb-sq" onclick="rbFindStep(-1)" aria-label="תוצאה קודמת">▲</button>
      <button class="rb-btn rb-sq" onclick="rbFindStep(1)" aria-label="תוצאה הבאה">▼</button>
    </div>`;
  const on = ui.querySelector('.rb-chip-on'), row = _rbEl('rb-chips');
  if (on && row) { const r = row.getBoundingClientRect(), c = on.getBoundingClientRect(); row.scrollLeft += (c.left + c.width / 2) - (r.left + r.width / 2); }
}

function rbRenderBottom() {
  const b = _rbEl('rambam-books-bottom'); if (!b) return;
  const h = rambamByIdx(_rbState.hil), prev = rambamNeighbor(h.idx, _rbState.ch, -1), next = rambamNeighbor(h.idx, _rbState.ch, 1);
  const lbl = nb => (nb.hIdx === h.idx ? `פרק ${nb.ch}` : `${rambamByIdx(nb.hIdx).he} פרק ${nb.ch}`);
  b.innerHTML = `<div class="rb-navrow">
      <button class="rb-btn" ${prev ? '' : 'disabled'} onclick="rbStep(-1)">${prev ? '→ ' + escapeHtml(lbl(prev)) : ''}</button>
      <button class="rb-btn rb-btn-gold" onclick="rbDoneAndNext()">✓ סמן כנלמד והמשך</button>
      <button class="rb-btn" ${next ? '' : 'disabled'} onclick="rbStep(1)">${next ? escapeHtml(lbl(next)) + ' ←' : ''}</button>
    </div>`;
}

const _rbNum = i => `<span class="rb-num">${i}</span>`;
function _rbStHtml(entries) {
  return `<div class="rb-st"><span class="rb-st-lbl">📚 שטיינזלץ</span>${entries.map(e =>
    `<div class="rb-st-e">${e.html}${e.approx ? ' <span class="rb-approx" title="הפירוש לא הצליח להיות משויך בוודאות להלכה זו">(מיקום משוער)</span>' : ''}</div>`).join('')}</div>`;
}

function rbRender() {
  const cur = _rbCurrent, el = _rbEl('rambam-content'); if (!cur || !el) return;
  const view = _rbState.view, st = cur.st;
  rbRenderHeader(); rbRenderBottom();
  el.className = 'content-text';
  let note = '';
  if (view !== 'text') {
    if (!st) note = '';
    else if (st.error) note = `<div class="rb-note">⚠️ פירוש שטיינזלץ לא נטען (${escapeHtml(st.error)}) <button class="rb-btn" onclick="rbRetrySteinsaltz()">נסה שוב</button></div>`;
    else if (st.none) note = '<div class="rb-note">אין פירוש שטיינזלץ לפרק זה בספריא – מוצג הרמב"ם בלבד.</div>';
    else note = `<div class="rb-note rb-note-ok">📚 ${st.total} פירושי שטיינזלץ${st.mode === 'keyword' ? ' · השיוך להלכות לפי מילת הפתיחה' : ''}${st.approx ? ` · ${st.approx} במיקום משוער` : ''}</div>`;
  }
  let html;
  if (view === 'steinsaltz_only' && st && st.total) {
    html = cur.halachot.map((_, i) => (st.by[i] && st.by[i].length)
      ? `<div class="rb-hal" id="rb-h-${i + 1}"><div class="rb-hal-h">הלכה ${toGematria(i + 1)}</div>${_rbStHtml(st.by[i])}</div>` : '').join('');
  } else {
    html = cur.halachot.map((v, i) => `<div class="rb-hal" id="rb-h-${i + 1}"><div>${_rbNum(i + 1)}${v}</div>${view === 'steinsaltz' && st && st.by[i] && st.by[i].length ? _rbStHtml(st.by[i]) : ''}</div>`).join('');
  }
  el.innerHTML = note + html;
  const q = _rbEl('rb-find'); if (q && q.value) rbFind(q.value);
}

// ═══════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════
let _rbSearchRes = [];
function rbSearchInput(q) {
  const box = _rbEl('rb-q-res'); if (!box) return;
  if (!String(q).trim()) { box.style.display = 'none'; _rbSearchRes = []; return; }
  _rbSearchRes = (typeof srSearchRambam === 'function' ? srSearchRambam(q) : []).slice(0, 8);
  box.style.display = '';
  box.innerHTML = _rbSearchRes.length
    ? _rbSearchRes.map((r, i) => `<div class="rb-res-row" data-i="${i}" onclick="rbSearchPick(${i})"><span>${escapeHtml(r.title)}</span><span class="rb-res-sub">${escapeHtml(r.sub || '')}</span></div>`).join('')
    : '<div class="rb-res-empty">לא נמצאו הלכות מתאימות</div>';
}
function rbSearchKey(e) { if (e.key === 'Enter') { e.preventDefault(); rbSearchPick(0); } else if (e.key === 'Escape') { e.target.value = ''; rbSearchInput(''); } }
function rbSearchPick(i) {
  const r = _rbSearchRes[i]; if (!r) return;
  const q = _rbEl('rb-q'); if (q) q.value = '';
  const box = _rbEl('rb-q-res'); if (box) box.style.display = 'none';
  return rbOpen(r.go.hil, r.go.ch || 1, r.go.view || _rbState.view);
}

// ── find inside the chapter ─────────────────────────────────────────────
let _rbHits = [], _rbHitAt = -1;
function _rbClearMarks() {
  const root = _rbEl('rambam-content'); if (!root) return;
  root.querySelectorAll('mark.rb-hit').forEach(m => { const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
  _rbHits = []; _rbHitAt = -1;
}
function _rbFindRegex(q) {
  const toks = (typeof srNormalize === 'function' ? srNormalize(q) : String(q).trim()).split(' ').filter(t => t.length >= 2);
  if (!toks.length) return null;
  const src = toks.map(t => (typeof _srTokenRegex === 'function' ? _srTokenRegex(t).source : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('|');
  return new RegExp(src, 'g');
}
function rbFind(q) {
  _rbClearMarks();
  const n = _rbEl('rb-find-n'), root = _rbEl('rambam-content');
  const re = root && _rbFindRegex(q);
  if (!re) { if (n) n.textContent = ''; return; }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: t => (t.parentNode.closest && t.parentNode.closest('button')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(t => {
    const s = t.nodeValue; re.lastIndex = 0; let m, last = 0, frag = null;
    while ((m = re.exec(s))) {
      if (!m[0]) { re.lastIndex++; continue; }
      let end = m.index + m[0].length;
      while (end < s.length && /[א-ת֑-ׇ]/.test(s[end])) end++;               // the whole word
      frag = frag || document.createDocumentFragment();
      frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      const mk = document.createElement('mark'); mk.className = 'rb-hit'; mk.textContent = s.slice(m.index, end); frag.appendChild(mk);
      last = end; re.lastIndex = end;
    }
    if (frag) { frag.appendChild(document.createTextNode(s.slice(last))); t.parentNode.replaceChild(frag, t); }
  });
  _rbHits = Array.from(root.querySelectorAll('mark.rb-hit'));
  if (n) n.textContent = _rbHits.length ? `${_rbHits.length} תוצאות` : 'אין תוצאות';
  if (_rbHits.length) rbFindStep(1, true);
}
function rbFindStep(d, first) {
  if (!_rbHits.length) return;
  _rbHitAt = first ? 0 : (_rbHitAt + d + _rbHits.length) % _rbHits.length;
  _rbHits.forEach((m, i) => m.classList.toggle('rb-hit-on', i === _rbHitAt));
  _rbHits[_rbHitAt].scrollIntoView({ block: 'center', behavior: 'instant' });
  const n = _rbEl('rb-find-n'); if (n) n.textContent = `${_rbHitAt + 1} / ${_rbHits.length}`;
}
