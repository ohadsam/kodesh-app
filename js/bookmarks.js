// ═══════════════════════════════════════════
// BOOKMARKS — סימניה לכל טאב
// ═══════════════════════════════════════════
// One bookmark per tab, saved in localStorage (appState.bookmarks[tab]).
//  • Long-press (≈0.55s) on a spot in a tab's text → saves the tab's FULL state
//    (e.g. parasha ref + aliya + Rashi/Onkelos/haftara view; psalm + context; daf +
//    view; …) plus a precise anchor inside the rendered text.
//  • A bar at the top of the tab ("🔖 …  [עבור לסימניה] [✕]") jumps back: it
//    restores the state through the tab's own loaders, waits for the content, then
//    scrolls so the SAME element sits at the SAME height on screen as when it was
//    pressed, and keeps correcting for ~2.5s (late layout / loaders that scroll to
//    top themselves) unless the user touches the screen.
//  • While the tab shows the bookmarked state, a 🔖 flag + highlight mark the spot.
//    Long-pressing the flag deletes the bookmark (toast with "בטל").
// Anchor = child-index path from the tab's content root + a text snippet used to
// verify (and, if the structure shifted, to re-find) the element + the fractional
// position inside it. Per-tab knowledge lives in BM_ADAPTERS below.

const BM_LONGPRESS_MS = 500;
const BM_MOVE_TOLERANCE_PX = 10;
const BM_EXCLUDED_TABS = ['qibla', 'logs', 'network'];

// ── Storage ─────────────────────────────────────────────────────────────
function getBookmark(tab) { return (appState.bookmarks || {})[tab] || null; }
function _bmSave(tab, bm) {
  appState.bookmarks = { ...(appState.bookmarks || {}) };
  if (bm) appState.bookmarks[tab] = bm; else delete appState.bookmarks[tab];
  saveState();
}

// ── Small helpers ───────────────────────────────────────────────────────
const _bmEl = id => document.getElementById(id);
const _bmSleep = ms => new Promise(r => setTimeout(r, ms));
const _bmNorm = s => (s || '').replace(/\s+/g, ' ').trim();
const _bmChildren = el => Array.from(el.children).filter(c => !c.hasAttribute('data-bm-ui'));
const _bmDateStr = () => formatDate(getTargetDate());

function _bmTabLabel(tab) {
  const t = _bmEl('t-' + tab);
  return t ? t.textContent.replace(/^[^֐-׿A-Za-z0-9]+/, '').replace(/BETA/g, '').trim() : tab;
}

// Moves the app's global date-nav to `dateStr` (the daily tabs are date-driven).
function _bmGoDate(dateStr) {
  if (!dateStr || dateStr === _bmDateStr()) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  currentOffset = Math.round((new Date(y, m - 1, d) - today) / 86400000);
  loaded = {};
  updateAllDates();
  updateTodayButtons();
  return true;
}

// Polls until fn() is truthy; false on timeout or when a newer navigation superseded this one.
let _bmGoToken = 0;
async function _bmWait(fn, timeoutMs, token) {
  const end = Date.now() + (timeoutMs || 20000);
  while (Date.now() < end) {
    if (token !== undefined && token !== _bmGoToken) return false;
    try { if (fn()) return true; } catch (e) { /* not ready yet */ }
    await _bmSleep(120);
  }
  return false;
}

// ── Per-tab adapters ────────────────────────────────────────────────────
// capture() → state object (or null = nothing bookmarkable yet); same(a,b) → is the
// tab already showing b; idle() → loaders finished; restore(s) → bring the tab to s;
// root() → content element whose descendants may be bookmarked; describe(s) → label.
const _bmNotLoading = id => () => {
  const el = _bmEl(id);
  return !!el && !el.classList.contains('loading') && !_bmNorm(el.textContent).startsWith('⏳');
};

function _bmDateAdapter(rootId, loaderName, tabName) {
  return {
    root: () => rootId ? _bmEl(rootId) : _bmEl('page-' + tabName),
    capture: () => ({ date: _bmDateStr() }),
    same: (a, b) => !!a && !!b && a.date === b.date,
    idle: rootId ? _bmNotLoading(rootId) : () => true,
    async restore(s) { _bmGoDate(s.date); loaded[tabName] = true; if (typeof window[loaderName] === 'function') window[loaderName](); },
    describe: () => `${_bmTabLabel(tabName)} · ${formatDisplayDate(getTargetDate())}`,
  };
}

const _BM_PARASHA_VIEWS = { text: '', rashi: 'רש"י', onkelos: 'אונקלוס', haftara: 'הפטרה', sacks: 'הרב זקס' };
const _BM_ALIYA_NAMES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'מפטיר'];

const BM_ADAPTERS = {
  parasha: {
    root: () => _bmEl('parasha-content'),
    capture() {
      if (!currentParashaRef && !_currentAliyaRef) return null;
      return { ref: currentParashaRef, name: (_bmEl('parasha-name') || {}).textContent || '',
        aliyot: aliyot.slice(), aliya: currentAliya, aliyaRef: _currentAliyaRef, view: parashaView, haftara: _haftaraRef };
    },
    same: (a, b) => !!a && !!b && a.ref === b.ref && a.aliya === b.aliya && a.aliyaRef === b.aliyaRef && a.view === b.view,
    idle() {
      const ld = _bmEl('parasha-loading');
      const err = ld && _bmNorm(ld.textContent).startsWith('שגיאה');
      if (_parashaLoading || (ld && ld.style.display !== 'none' && !err)) return false;
      if (parashaView === 'rashi') return rashiLoaded || !!err;
      if (parashaView === 'onkelos') return onkelosLoaded || !!err;
      if (parashaView === 'haftara') return haftaraLoaded || !!err;
      if (parashaView === 'sacks') return _sacksLoaded || !!err;
      return true;
    },
    async restore(s) {
      loaded['parasha'] = true;
      const tabsEl = _bmEl('aliya-tabs'), sel = _bmEl('parasha-select'), notice = _bmEl('parasha-notice');
      if (notice) notice.style.display = 'none';
      populateParashaDropdown(s.ref);
      if (sel) {
        if (![...sel.options].some(o => o.value === s.ref)) {      // a combined parasha is not in the static list
          const opt = document.createElement('option'); opt.value = s.ref; opt.textContent = s.name;
          sel.insertBefore(opt, sel.firstChild);
        }
        sel.value = s.ref;
      }
      _bmEl('parasha-name').textContent = s.name;
      haftaraLoaded = false; haftaraVerses = []; _haftaraRef = null; _sacksLoaded = false; _sacksContent = '';
      aliyot = (s.aliyot || []).slice();
      currentParashaRef = s.ref; currentAliya = s.aliya;
      _buildAliyaTabs(tabsEl, aliyot);
      tabsEl.querySelectorAll('.aliya-tab').forEach(t => {
        const on = (t.getAttribute('onclick') || '').includes(s.aliya === 'all' ? "showAliya('all'" : `showAliya(${s.aliya},`);
        t.classList.toggle('active', on);
      });
      if (s.haftara) _kickoffHaftara(s.haftara); else if (HAFTARA_REFS[s.ref]) _kickoffHaftara(HAFTARA_REFS[s.ref]);
      await loadAliyaText(s.aliyaRef || s.ref);
      setParashaView(s.view || 'text');
    },
    describe(s) {
      const al = s.aliya === 'all' ? 'כל העליות' : `עליה ${_BM_ALIYA_NAMES[s.aliya] || (Number(s.aliya) + 1)}`;
      return [s.name, al, _BM_PARASHA_VIEWS[s.view]].filter(Boolean).join(' · ');
    },
  },

  tehilim: {
    root: () => _bmEl('tehilim-content'),
    capture() {
      if (window._lastTehilimArg == null) return null;
      return { arg: String(window._lastTehilimArg), ctx: { type: tehilimContext.type, id: tehilimContext.id || null } };
    },
    same: (a, b) => !!a && !!b && a.arg === b.arg && a.ctx.type === b.ctx.type && a.ctx.id === b.ctx.id,
    idle: _bmNotLoading('tehilim-content'),
    async restore(s) {
      let ctx = s.ctx || { type: 'day' };
      if (ctx.type === 'favorite' && !getTehilimFavorites().some(f => f.id === ctx.id)) ctx = { type: 'manual' };
      tehilimContext = ctx.type === 'favorite' ? { type: 'favorite', id: ctx.id } : { type: ctx.type };
      await loadTehilim(/^\d+$/.test(s.arg) ? parseInt(s.arg) : s.arg);
    },
    describe: () => `תהילים · ${_bmNorm((_bmEl('tehilim-num-title') || {}).textContent)}`,
  },

  daf: {
    root: () => _bmEl('daf-content'),
    capture() {
      if (!_dafRef) return null;
      return { date: _bmDateStr(), mode: _dafMode, ref: _dafRef, view: _dafView, pick: { t: _pickDafTractate, n: _pickDafNum, a: _pickDafAmud } };
    },
    same: (a, b) => !!a && !!b && a.mode === b.mode && a.ref === b.ref && a.view === b.view,
    idle: _bmNotLoading('daf-content'),
    async restore(s) {
      if (s.mode === 'pick' && s.pick && s.pick.t) {
        setDafMode('pick');
        const t = BAVLI_TRACTATES.find(x => x.name === s.pick.t);
        selectDafTractate(s.pick.t, (t && t.he) || s.pick.t);
        _pickDafTractate = s.pick.t; _pickDafNum = s.pick.n; _pickDafAmud = s.pick.a;
        await _loadPickedDaf();
      } else {
        _bmGoDate(s.date);
        setDafMode('daily');
        await _bmWait(this.idle, 20000);
      }
      if (s.view && s.view !== 'text') { await _bmWait(this.idle, 20000); await switchDafView(s.view); }
    },
    describe: s => [_bmNorm((_bmEl('daf-subtitle') || {}).textContent), ({ rashi: 'רש"י', tosafot: 'תוספות', rashi_tosafot: 'רש"י ותוס\'', steinsaltz: 'שטיינזלץ' })[s.view]].filter(Boolean).join(' · '),
  },

  mishna: {
    root: () => _bmEl('mishna-content'),
    capture() {
      if (!_mishnaRef) return null;
      return { date: _bmDateStr(), mode: _mishnaMode, ref: _mishnaRef, view: _mishnaView, pick: { t: _pickMishnaTractate, c: _pickMishnaChapter, n: _pickMishnaNum } };
    },
    same: (a, b) => !!a && !!b && a.mode === b.mode && a.ref === b.ref && a.view === b.view,
    idle: _bmNotLoading('mishna-content'),
    async restore(s) {
      if (s.mode === 'pick' && s.pick && s.pick.t) {
        setMishnaMode('pick');
        const t = MISHNA_TRACTATES.find(x => x.name === s.pick.t);
        selectMishnaTractate(s.pick.t, (t && t.he) || s.pick.t);
        const chSel = _bmEl('mishna-chapter-sel'); if (chSel) chSel.value = s.pick.c;
        await onMishnaChapterChange();
        _pickMishnaTractate = s.pick.t; _pickMishnaChapter = s.pick.c; _pickMishnaNum = s.pick.n;
        await _loadPickedMishna();
      } else {
        _bmGoDate(s.date);
        setMishnaMode('daily');
        await _bmWait(this.idle, 20000);
      }
      if (s.view && s.view !== 'text') { await _bmWait(this.idle, 20000); await switchMishnaView(s.view); }
    },
    describe: s => [_bmNorm((_bmEl('mishna-subtitle') || {}).textContent), ({ bartenura: 'ברטנורא', steinsaltz: 'שטיינזלץ' })[s.view]].filter(Boolean).join(' · '),
  },

  rambam: {
    root: () => _bmEl('rambam-content'),
    capture() { return _rambamRef ? { date: _bmDateStr(), ref: _rambamRef, view: _rambamView } : null; },
    same: (a, b) => !!a && !!b && a.ref === b.ref && a.view === b.view,
    idle: _bmNotLoading('rambam-content'),
    async restore(s) {
      _bmGoDate(s.date);
      loaded['rambam'] = true;
      loadRambamYomi();
      await _bmWait(this.idle, 20000);
      if (s.view && s.view !== 'text') await switchRambamView(s.view);
    },
    describe: s => [_bmNorm((_bmEl('rambam-subtitle') || {}).textContent), s.view !== 'text' ? 'עם פירוש' : ''].filter(Boolean).join(' · '),
  },

  tefilot: {
    root: () => _bmEl('tefila-content'),
    capture: () => ({ key: currentTefila }),
    same: (a, b) => !!a && !!b && a.key === b.key,
    idle: () => true,
    async restore(s) { showTefila(s.key); },
    describe: () => _bmNorm((_bmEl('tefila-title') || {}).textContent) || 'תפילות',
  },

  brachot: {
    root: () => _bmEl('bracha-content'),
    // ushpizin's "show all 7 nights" toggle changes which elements exist, so it is part of the state
    capture: () => currentBracha ? { key: currentBracha, nusach: brachotNusach, showAll: currentBracha === 'ushpizin' ? !!_ushpizinShowAll : false } : null,
    same: (a, b) => !!a && !!b && a.key === b.key && a.nusach === b.nusach && !!a.showAll === !!b.showAll,
    idle: _bmNotLoading('bracha-content'),
    async restore(s) {
      if (brachotNusach !== s.nusach) { appState.brachaNusach = s.nusach; setBrachotNusach(s.nusach); }
      await showBracha(s.key);
      // showBracha resets the toggle when entering ushpizin from another bracha — set it after, then re-render
      if (s.key === 'ushpizin' && !!s.showAll !== !!_ushpizinShowAll) { _ushpizinShowAll = !!s.showAll; await showBracha('ushpizin'); }
    },
    describe: () => _bmNorm((_bmEl('bracha-title') || {}).textContent) || 'ברכות',
  },

  emuna: {
    root: () => _bmEl('emuna-content'),
    capture() {
      if (!_currentBook) return null;
      const st = _getBookState(_currentBook.id);
      const u = _currentUnits[st.currentUnit || 0];
      return { book: _currentBook.id, unit: st.currentUnit || 0, label: (u && u.label) || '' };
    },
    same: (a, b) => !!a && !!b && a.book === b.book && a.unit === b.unit,
    idle: () => !_loading && !_bmNorm((_bmEl('emuna-content') || {}).textContent).includes('טוען'),
    async restore(s) {
      const book = EMUNA_BOOKS[s.book]; if (!book) return;
      await _bmWait(() => !_loading, 15000);
      _currentBook = book; _currentUnits = _getBookUnits(book); _updateEmunaBar(s.book);
      await _loadUnit(s.unit);
    },
    describe: s => `${(EMUNA_BOOKS[s.book] || {}).title || 'אמונה'}${s.label ? ' · ' + s.label : ''}`,
  },

  siddur: {
    root: () => _bmEl('siddur-content'),
    capture: () => ({ nusach: siddurNusach, prayer: siddurPrayer }),
    same: (a, b) => !!a && !!b && a.nusach === b.nusach && a.prayer === b.prayer,
    idle: () => !siddurLoading && !_siddurPendingReload,
    async restore(s) {
      if (siddurNusach !== s.nusach) setSiddurNusach(s.nusach);
      if (siddurPrayer !== s.prayer) setSiddurPrayer(s.prayer);
    },
    describe: s => `סידור · ${s.prayer} · ${s.nusach}`,
  },

  halacha:  _bmDateAdapter('halacha-content', 'loadHalacha', 'halacha'),
  lashon:   _bmDateAdapter('lashon-content', 'loadLashon', 'lashon'),
  igeret:   _bmDateAdapter('igeret-content', 'loadIgeret', 'igeret'),
  '929':    _bmDateAdapter('tanach-content', 'loadTanach929', '929'),
  calendar: _bmDateAdapter(null, 'loadCalendar', 'calendar'),
};

function _bmAdapter(tab) { return BM_ADAPTERS[tab] || null; }
function _bmEligible(tab) { return !BM_EXCLUDED_TABS.includes(tab) && !!_bmAdapter(tab); }

// ── Anchor: capture & locate ────────────────────────────────────────────
function _bmIsBlock(el) {
  const d = getComputedStyle(el).display;
  return d !== 'inline' && d !== 'contents';
}

function _bmPath(root, el) {
  const path = [];
  while (el && el !== root) { const p = el.parentElement; path.unshift(_bmChildren(p).indexOf(el)); el = p; }
  return path;
}

function _bmByPath(root, path) {
  let el = root;
  for (const i of path) { el = _bmChildren(el)[i]; if (!el) return null; }
  return el;
}

// Nearest child of root that has text — for presses on blank space between paragraphs.
function _bmNearestChild(root, y) {
  let best = null, bd = Infinity;
  _bmChildren(root).filter(k => _bmNorm(k.textContent)).forEach(k => {
    const r = k.getBoundingClientRect();
    const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}

// The element to bookmark for a press at (x,y), or null when the press shouldn't count.
function _bmPickElement(root, x, y) {
  const t = document.elementFromPoint(x, y);
  if (!t || !root.contains(t)) return null;
  if (t.closest('button, a, input, select, textarea, label, [onclick], [data-bm-ui]')) return null;
  let el = t;
  while (el !== root && !(_bmIsBlock(el) && _bmNorm(el.textContent))) el = el.parentElement;
  return el === root ? _bmNearestChild(root, y) : el;     // root itself / an empty spacer → nearest paragraph
}

function _bmCaptureAnchor(root, el, x, y) {
  const r = el.getBoundingClientRect();
  return {
    path: _bmPath(root, el),
    snip: _bmNorm(el.textContent).slice(0, 80),
    tag: el.tagName,
    frac: r.height ? Math.min(1, Math.max(0, (y - r.top) / r.height)) : 0,
    vy: Math.round(y),
  };
}

function _bmSnipOk(el, snip) {
  const t = _bmNorm(el.textContent);
  return t.startsWith(snip) || (t.length < snip.length && snip.startsWith(t) && t.length > 0);
}

// Path first (exact), verified by the snippet; otherwise search by snippet.
function _bmLocate(root, anchor) {
  if (!root || !anchor) return null;
  const byPath = _bmByPath(root, anchor.path);
  if (byPath && _bmSnipOk(byPath, anchor.snip)) return byPath;
  const all = root.querySelectorAll(anchor.tag || '*');
  for (const el of all) if (!el.closest('[data-bm-ui]') && _bmSnipOk(el, anchor.snip)) return el;
  return null;
}

// Document-space Y of the bookmarked point inside el.
function _bmPointY(el, anchor) {
  const r = el.getBoundingClientRect();
  return r.top + window.scrollY + anchor.frac * r.height;
}

// ── Long-press capture ──────────────────────────────────────────────────
let _bmPress = null;          // { timer, x, y, mode: 'add' | 'delete' }
let _bmRecentPress = 0;       // swallow the context menu a long-press may raise
let _bmLastUserInput = 0;

function _bmCancelPress() {
  if (_bmPress) { clearTimeout(_bmPress.timer); _bmPress = null; }
  document.body.classList.remove('bm-pressing');
}

function _bmOnPointerDown(e) {
  _bmLastUserInput = performance.now();
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.isPrimary === false) { _bmCancelPress(); return; }
  _bmCancelPress();
  const flag = e.target.closest && e.target.closest('#bm-flag');
  let mode = null;
  if (flag) mode = 'delete';
  else if (_bmEligible(currentTab)) {
    const page = _bmEl('page-' + currentTab);
    const ad = _bmAdapter(currentTab), root = ad.root();
    if (page && page.classList.contains('active') && root && root.contains(e.target) && _bmPickElement(root, e.clientX, e.clientY)) mode = 'add';
  }
  if (!mode) return;
  document.body.classList.add('bm-pressing');            // no text selection / callout while the finger is down
  const x = e.clientX, y = e.clientY;
  _bmPress = { x, y, mode, timer: setTimeout(() => { const m = _bmPress && _bmPress.mode; _bmCancelPress(); _bmRecentPress = performance.now(); if (m === 'delete') bookmarkDelete(currentTab); else if (m === 'add') bookmarkAddAt(x, y); }, BM_LONGPRESS_MS) };
}

function _bmOnPointerMove(e) {
  if (_bmPress && Math.hypot(e.clientX - _bmPress.x, e.clientY - _bmPress.y) > BM_MOVE_TOLERANCE_PX) _bmCancelPress();
}

function bookmarkAddAt(x, y) {
  const tab = currentTab, ad = _bmAdapter(tab);
  if (!ad) return false;
  const root = ad.root(), el = root && _bmPickElement(root, x, y);
  const state = ad.capture();
  if (!el || !state) { _bmToast('אי אפשר לשמור סימניה כאן'); return false; }
  const had = !!getBookmark(tab);
  const anchor = _bmCaptureAnchor(root, el, x, y);
  _bmSave(tab, { v: 1, ts: Date.now(), tab, state, anchor, label: ad.describe(state), snip: anchor.snip });
  if (navigator.vibrate) { try { navigator.vibrate(35); } catch (e) {} }
  try { window.getSelection().removeAllRanges(); } catch (e) {}
  _bmToast(had ? '🔖 הסימניה עודכנה למקום החדש' : '🔖 הסימניה נשמרה');
  bookmarksRefresh();
  return true;
}

function bookmarkDelete(tab) {
  const prev = getBookmark(tab);
  if (!prev) return;
  _bmSave(tab, null);
  bookmarksRefresh();
  _bmToast('הסימניה נמחקה', { label: 'בטל', fn: () => { _bmSave(tab, prev); bookmarksRefresh(); } });
}

// ── Go to bookmark ──────────────────────────────────────────────────────
function _bmInteractedSince(t) { return _bmLastUserInput > t; }

async function bookmarkGo(tab) {
  tab = tab || currentTab;
  const bm = getBookmark(tab), ad = _bmAdapter(tab);
  if (!bm || !ad) return false;
  const token = ++_bmGoToken;
  if (typeof autoScrollStop === 'function' && typeof _asState !== 'undefined' && _asState !== 'idle') autoScrollStop();
  _bmToast('⏳ טוען את הסימניה…', null, 20000);

  if (currentTab !== tab) showTab(tab);
  await _bmWait(() => ad.idle(), 20000, token);
  if (token !== _bmGoToken) return false;

  const cur = ad.capture();
  if (!ad.same(cur, bm.state)) {
    try { await ad.restore(bm.state); } catch (e) { console.warn('[Bookmark] restore failed:', e); }
    await _bmWait(() => ad.idle(), 25000, token);
    if (token !== _bmGoToken) return false;
  }

  const found = await _bmWait(() => _bmLocate(ad.root(), bm.anchor), 15000, token);
  if (token !== _bmGoToken) return false;
  const root = ad.root();
  const el = found ? _bmLocate(root, bm.anchor) : null;
  _bmHideToast();
  if (!el) {
    _bmToast('הסימניה נפתחה, אך לא נמצא המקום המדויק בטקסט');
    if (root) window.scrollTo({ top: Math.max(0, root.getBoundingClientRect().top + window.scrollY - 70), behavior: 'instant' });
    bookmarksRefresh();
    return false;
  }
  const started = performance.now();
  _bmScrollToAnchor(el, bm.anchor);
  bookmarksRefresh();
  el.classList.remove('bm-pulse'); void el.offsetWidth; el.classList.add('bm-pulse');
  // Loaders (and Rashi arriving late) may scroll or re-layout after we did — correct for a moment,
  // but never fight the user.
  for (let i = 0; i < 18; i++) {
    await _bmSleep(140);
    if (token !== _bmGoToken || _bmInteractedSince(started)) break;
    const e2 = _bmLocate(ad.root(), bm.anchor);
    if (e2 && Math.abs(window.scrollY - _bmDesiredScroll(e2, bm.anchor)) > 6) _bmScrollToAnchor(e2, bm.anchor);
  }
  bookmarksRefresh();
  return true;
}

function _bmDesiredScroll(el, anchor) {
  const vy = Math.min(Math.max(anchor.vy, 90), window.innerHeight - 90);   // keep it comfortably on screen
  return Math.max(0, _bmPointY(el, anchor) - vy);
}
function _bmScrollToAnchor(el, anchor) {
  window.scrollTo({ top: _bmDesiredScroll(el, anchor), behavior: 'instant' });
}

// ── UI: bar, flag, toast ────────────────────────────────────────────────
const _BM_SVG_FLAG = '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M4 2h16v26l-8-6-8 6z"/></svg>';
let _bmToastTimer = 0;

function _bmEnsureUI() {
  if (_bmEl('bm-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'bm-bar'; bar.className = 'bm-bar'; bar.setAttribute('data-bm-ui', '');
  bar.style.display = 'none';
  bar.innerHTML = `
    <span class="bm-bar-icon" aria-hidden="true">${_BM_SVG_FLAG}</span>
    <div class="bm-bar-text"><div id="bm-bar-label" class="bm-bar-label"></div><div id="bm-bar-snip" class="bm-bar-snip"></div></div>
    <button id="bm-bar-go" type="button" class="bm-btn bm-btn-go">עבור לסימניה</button>
    <button id="bm-bar-clear" type="button" class="bm-btn bm-btn-clear" aria-label="נקה סימניה" title="נקה סימניה">✕</button>`;
  document.body.appendChild(bar);
  _bmEl('bm-bar-go').addEventListener('click', () => bookmarkGo(currentTab));
  _bmEl('bm-bar-clear').addEventListener('click', () => bookmarkDelete(currentTab));

  const flag = document.createElement('button');
  flag.id = 'bm-flag'; flag.type = 'button'; flag.className = 'bm-flag'; flag.setAttribute('data-bm-ui', '');
  flag.setAttribute('aria-label', 'סימניה — לחיצה ארוכה למחיקה'); flag.title = 'לחיצה ארוכה למחיקת הסימניה';
  flag.innerHTML = _BM_SVG_FLAG;
  flag.style.display = 'none';
  flag.addEventListener('click', () => _bmToast('🔖 לחיצה ארוכה על הסימניה מוחקת אותה'));
  document.body.appendChild(flag);

  const toast = document.createElement('div');
  toast.id = 'bm-toast'; toast.className = 'bm-toast'; toast.setAttribute('data-bm-ui', ''); toast.setAttribute('role', 'status');
  toast.style.display = 'none';
  document.body.appendChild(toast);
}

function _bmToast(text, action, ms) {
  _bmEnsureUI();
  const t = _bmEl('bm-toast');
  t.textContent = text;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bm-toast-btn'; b.textContent = action.label;
    b.addEventListener('click', () => { action.fn(); _bmHideToast(); });
    t.appendChild(b);
  }
  t.style.display = 'flex';
  clearTimeout(_bmToastTimer);
  _bmToastTimer = setTimeout(_bmHideToast, ms || (action ? 6000 : 2600));
}
function _bmHideToast() { const t = _bmEl('bm-toast'); if (t) t.style.display = 'none'; }

// Showing/hiding the bar changes the page height above the reader. Keep whatever is in the
// middle of the screen where it was: measure it before and after and scroll by the
// difference. (Measuring beats assuming — Chrome's scroll anchoring already compensates by
// itself, Safari does not; a fixed correction would double-shift in one of them.)
function _bmShowBar(show) {
  const bar = _bmEl('bm-bar');
  if (show === (bar.style.display === 'flex')) return;
  let ref = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (ref && ref.closest('[data-bm-ui]')) ref = null;
  const before = ref ? ref.getBoundingClientRect().top : 0;
  bar.style.display = show ? 'flex' : 'none';
  if (!ref || !ref.isConnected) return;
  const delta = ref.getBoundingClientRect().top - before;
  if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
}

// Renders the bar for the current tab, and shows the flag + highlight when the tab is
// displaying the bookmarked state.
function bookmarksRefresh() {
  _bmEnsureUI();
  const tab = currentTab, bar = _bmEl('bm-bar'), flag = _bmEl('bm-flag');
  document.querySelectorAll('.bm-target').forEach(n => n.classList.remove('bm-target'));
  const bm = _bmEligible(tab) ? getBookmark(tab) : null;
  const page = _bmEl('page-' + tab);
  if (!bm || !page) { _bmShowBar(false); flag.style.display = 'none'; return; }

  if (bar.parentElement !== page || page.firstElementChild !== bar) page.insertBefore(bar, page.firstChild);
  _bmEl('bm-bar-label').textContent = '🔖 ' + (bm.label || _bmTabLabel(tab));
  _bmEl('bm-bar-snip').textContent = bm.snip ? '«' + bm.snip.slice(0, 48) + (bm.snip.length > 48 ? '…' : '') + '»' : '';
  _bmShowBar(true);

  const ad = _bmAdapter(tab);
  let el = null;
  try {
    const cur = ad.capture();
    if (cur && ad.same(cur, bm.state)) el = _bmLocate(ad.root(), bm.anchor);
  } catch (e) { el = null; }
  if (!el) { flag.style.display = 'none'; return; }
  el.classList.add('bm-target');
  flag.style.display = 'block';
  flag.style.top = Math.max(0, _bmPointY(el, bm.anchor) - 14) + 'px';
}

function bookmarksOnTabChange() {
  _bmCancelPress();
  bookmarksRefresh();
  _bmObserveRoot();
  setTimeout(bookmarksRefresh, 400);
  setTimeout(bookmarksRefresh, 1500);
}

let _bmObserver = null, _bmRefreshTimer = 0;
function _bmScheduleRefresh() { clearTimeout(_bmRefreshTimer); _bmRefreshTimer = setTimeout(bookmarksRefresh, 150); }
function _bmObserveRoot() {
  if (_bmObserver) _bmObserver.disconnect();
  if (!_bmEligible(currentTab) || typeof MutationObserver === 'undefined') return;
  const root = _bmAdapter(currentTab).root();
  if (!root) return;
  _bmObserver = new MutationObserver(recs => {
    if (recs.every(r => r.target.closest && r.target.closest('[data-bm-ui]'))) return;   // our own bar
    _bmScheduleRefresh();
  });
  _bmObserver.observe(root, { childList: true, subtree: true, characterData: true });
}

function initBookmarks() {
  _bmEnsureUI();
  document.addEventListener('pointerdown', _bmOnPointerDown, { passive: true });
  document.addEventListener('pointermove', _bmOnPointerMove, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, () => { _bmCancelPress(); }, { passive: true }));
  window.addEventListener('scroll', () => { if (_bmPress) _bmCancelPress(); }, { passive: true });
  ['wheel', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, () => { _bmLastUserInput = performance.now(); }, { passive: true }));
  document.addEventListener('contextmenu', e => {
    if (_bmPress || performance.now() - _bmRecentPress < 900) e.preventDefault();       // long-press raised the browser menu
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => { const f = _bmEl('bm-flag'); if (f && f.style.display !== 'none') _bmScheduleRefresh(); }).observe(document.body);
  bookmarksOnTabChange();
}
