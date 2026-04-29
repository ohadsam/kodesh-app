// ═══════════════════════════════════════════════════════════════════════
// EMUNA.JS – טאב אמונה – v5.79
// ספר הכוזרי, שמונה פרקים לרמב"ם, מסילת ישרים
// ═══════════════════════════════════════════════════════════════════════

// ── Book definitions ──────────────────────────────────────────────────
const EMUNA_BOOKS = {
  kuzari: {
    id: 'kuzari',
    title: 'ספר הכוזרי',
    author: 'רבי יהודה הלוי',
    icon: '📖',
    color: '#c9a54a',
    description: '5 מאמרים · לימוד דיאלוגי על עקרי האמונה',
    // Pre-built units: one section per unit
    buildUnits() {
      const maamarim = [{num:1,size:115},{num:2,size:82},{num:3,size:73},{num:4,size:31},{num:5,size:28}];
      const units = [];
      for (const m of maamarim) {
        for (let sec = 1; sec <= m.size; sec++) {
          units.push({ id:`${m.num}_${sec}`, ch:m.num, par:sec,
            label:`מאמר ${_heNum(m.num)}, סעיף ${sec}`,
            ref:`Kuzari.${m.num}.${sec}` });
        }
      }
      return units;
    },
    chapterLabel(u) { return `מאמר ${_heNum(u.ch)}`; },
    unitLabel(u)    { return `סעיף ${u.par}`; },
    // No commentary available via API
    commentaryRef: null,
  },
  perakim: {
    id: 'perakim',
    title: 'שמונה פרקים',
    author: 'הרמב"ם',
    icon: '🦅',
    color: '#7ab8d6',
    description: '8 פרקים · מבוא לפרקי אבות – פילוסופיה יהודית ומוסר',
    // Chapters fetched on demand, split into paragraphs
    buildUnits() { return _chaptersToUnits('perakim', 8, 'Eight_Chapters'); },
    chapterLabel(u) { return `פרק ${toGematria(u.ch)}`; },
    unitLabel(u)    { return `פסקה ${u.par}`; },
    commentaryRef: null, // No structured commentary in Sefaria API
  },
  mesilat: {
    id: 'mesilat',
    title: 'מסילת ישרים',
    author: 'רמח"ל',
    icon: '✨',
    color: '#7ed6a0',
    description: '26 פרקים + הקדמה · מדרגות עבודת ה\'',
    buildUnits() { return _chaptersToUnits('mesilat', 26, 'Mesillat_Yesharim', true); },
    chapterLabel(u) { return u.ch === 0 ? 'הקדמה' : `פרק ${toGematria(u.ch)}`; },
    unitLabel(u)    { return `פסקה ${u.par}`; },
    commentaryRef: null,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────
function _heNum(n) {
  return ['א','ב','ג','ד','ה'][n-1] || String(n);
}

// For chapter-based books: units are lazy-loaded
// We store {ch, par} and fetch chapter text on demand
function _chaptersToUnits(bookId, numChapters, baseRef, hasIntro) {
  const units = [];
  if (hasIntro) {
    units.push({ id:'intro_1', ch:0, par:1, label:'הקדמה',
      ref:`${baseRef},_Introduction`, isIntro:true });
  }
  // We don't know paragraph counts until we load the chapter
  // So we create placeholder units per chapter and expand lazily
  // Store: ch = chapter number, par = -1 means "whole chapter" until expanded
  for (let ch = 1; ch <= numChapters; ch++) {
    units.push({ id:`ch${ch}_1`, ch, par:1,
      label:`פרק ${toGematria(ch)}, פסקה א׳`,
      ref:`${baseRef}.${ch}`, baseRef });
  }
  return units;
}

// ── State ──────────────────────────────────────────────────────────────
function _getBookState(bookId) {
  if (!appState.emuna) appState.emuna = {};
  if (!appState.emuna[bookId]) appState.emuna[bookId] = { currentUnit:0, completed:{}, chapterCache:{} };
  return appState.emuna[bookId];
}
function _saveState() { saveState(); }

// In-memory chapter cache (survives within session only)
const _chapterCache = {};

// ── Main render ────────────────────────────────────────────────────────
let _currentBook = null;
let _currentUnits = [];
let _loading = false;

function loadEmuna() {
  _renderEmunaMenu();
}

function _renderEmunaMenu() {
  const el = document.getElementById('emuna-content');
  if (!el) return;
  _currentBook = null;

  el.innerHTML = `
    <div style="padding:0 16px 80px">
      <div style="text-align:center;padding:20px 0 16px">
        <div style="font-size:13px;color:var(--muted)">בחר ספר ללימוד</div>
      </div>
      ${Object.values(EMUNA_BOOKS).map(book => {
        const state = _getBookState(book.id);
        const total = _getBookUnits(book).length;
        const done  = Object.keys(state.completed || {}).length;
        const pct   = total ? Math.round(done/total*100) : 0;
        return `
          <div onclick="openBook('${book.id}')"
            style="margin-bottom:12px;padding:14px;background:var(--card);border-radius:14px;
                   cursor:pointer;border-right:4px solid ${book.color};
                   active:opacity:.8">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <span style="font-size:24px">${book.icon}</span>
              <div>
                <div style="font-family:'Frank Ruhl Libre',serif;font-size:16px;
                            font-weight:700;color:var(--cream)">${book.title}</div>
                <div style="font-size:11px;color:var(--muted)">${book.author}</div>
              </div>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${book.description}</div>
            ${done > 0 ? `
              <div style="display:flex;justify-content:space-between;
                          font-size:10px;color:var(--muted);margin-bottom:4px">
                <span>התקדמות</span><span>${done}/${total} (${pct}%)</span>
              </div>
              <div style="background:var(--bg);border-radius:3px;height:4px">
                <div style="background:${book.color};height:100%;width:${pct}%;border-radius:3px"></div>
              </div>` : `
              <div style="font-size:10px;color:${book.color}">לחץ להתחיל ▶</div>`}
          </div>`;
      }).join('')}
    </div>`;
}

function _getBookUnits(book) {
  if (!book._units) book._units = book.buildUnits();
  return book._units;
}

// Update book bar active state
function _updateEmunaBar(bookId) {
  ['kuzari','perakim','mesilat'].forEach(id => {
    const btn = document.getElementById('emuna-btn-' + id);
    if (btn) btn.classList.toggle('active', id === bookId);
  });
  // Show floating nav once a book is open
  const nav = document.getElementById('emuna-float-nav');
  if (nav) nav.style.display = bookId ? 'block' : 'none';
}

function openEmunaNav() {
  document.getElementById('emuna-nav-overlay').style.display = 'block';
  document.getElementById('emuna-nav-popup').style.display = 'block';
}
function closeEmunaNav() {
  document.getElementById('emuna-nav-overlay').style.display = 'none';
  document.getElementById('emuna-nav-popup').style.display = 'none';
}

async function openBook(bookId) {
  const book = EMUNA_BOOKS[bookId];
  if (!book) return;
  _currentBook = book;
  _currentUnits = _getBookUnits(book);
  _updateEmunaBar(bookId);
  const state = _getBookState(bookId);
  await _loadUnit(state.currentUnit || 0);
}

// ── Unit loading ───────────────────────────────────────────────────────
async function _loadUnit(idx) {
  if (_loading) return;
  _loading = true;
  const book  = _currentBook;
  const units = _currentUnits;
  const state = _getBookState(book.id);

  // Clamp index
  idx = Math.max(0, Math.min(units.length - 1, idx));
  state.currentUnit = idx;
  _saveState();

  const el = document.getElementById('emuna-content');
  if (!el) { _loading = false; return; }

  // Show loading
  el.innerHTML = _navHeader(book, idx, units.length) +
    `<div style="text-align:center;padding:40px;color:var(--muted)">טוען ${units[idx]?.label || ''}...</div>`;

  try {
    const unit = units[idx];
    const text = await _fetchUnitText(book, unit);
    if (!text) throw new Error('no text');
    _renderUnit(book, units, idx, text, state);
  } catch(e) {
    console.error('[Emuna] error loading unit', idx, ':', e.message);
    el.innerHTML = _navHeader(book, idx, units.length) +
      `<div style="text-align:center;padding:30px;color:var(--muted)">
        <div style="font-size:24px;margin-bottom:10px">⚠️</div>
        <div style="margin-bottom:14px">שגיאה בטעינה: ${e.message}</div>
        <button onclick="_loadUnit(${idx})"
          style="background:var(--gold);color:#000;border:none;border-radius:8px;
                 padding:8px 20px;font-size:13px;cursor:pointer">נסה שוב</button>
      </div>`;
  }
  _loading = false;
}

async function _fetchUnitText(book, unit) {
  const cacheKey = book.id + ':' + unit.ref;
  if (_chapterCache[cacheKey]) return _chapterCache[cacheKey];

  const url = 'https://www.sefaria.org/api/texts/' +
    encodeURIComponent(unit.ref) + '?lang=he&commentary=0&context=0';
  console.log('[Emuna] GET', url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();

  const he = data && data.he;
  const paragraphs = [];

  if (typeof he === 'string' && he.trim()) {
    paragraphs.push(he.trim());
  } else if (Array.isArray(he)) {
    const flat = he.flat ? he.flat(10) : he;
    flat.forEach(function(item) {
      if (typeof item === 'string' && item.trim()) paragraphs.push(item.trim());
    });
  }

  // Clean HTML
  const clean = paragraphs
    .map(s => { const d = document.createElement('div'); d.innerHTML = s; return (d.textContent || d.innerText || '').trim(); })
    .filter(Boolean);

  const result = { paragraphs: clean, unit };
  _chapterCache[cacheKey] = result;
  return result;
}

function _renderUnit(book, units, idx, textData, state) {
  const el = document.getElementById('emuna-content');
  if (!el) return;

  const unit      = units[idx];
  const paras     = textData.paragraphs;
  const isFirst   = idx === 0;
  const isLast    = idx === units.length - 1;
  const isDone    = !!(state.completed || {})[unit.id];
  const doneCount = Object.keys(state.completed || {}).length;
  const pct       = Math.round(doneCount / units.length * 100);

  // Check for chapter break (show chapter header if different from prev unit)
  const prevUnit  = idx > 0 ? units[idx - 1] : null;
  const showChHdr = !prevUnit || prevUnit.ch !== unit.ch;

  el.innerHTML = `
  <div style="padding:0 16px 100px">
    ${_navHeader(book, idx, units.length)}

    ${showChHdr ? `<div style="text-align:center;margin-bottom:12px;padding:10px;
      background:rgba(${_hexToRgb(book.color)},.08);border-radius:10px">
      <div style="font-family:'Frank Ruhl Libre',serif;font-size:16px;
                  font-weight:700;color:${book.color}">${book.title}</div>
      <div style="font-size:13px;color:var(--cream);margin-top:2px">${book.chapterLabel(unit)}</div>
      ${isDone ? '<div style="font-size:11px;color:#7ed6a0;margin-top:3px">✅ נלמד</div>' : ''}
    </div>` : `<div style="text-align:center;margin-bottom:8px;font-size:12px;color:var(--muted)">
      ${book.chapterLabel(unit)} · ${book.unitLabel(unit)}
      ${isDone ? '<span style="color:#7ed6a0;margin-right:4px">✅</span>' : ''}
    </div>`}

    <!-- Text -->
    <div style="font-family:'Frank Ruhl Libre',serif;direction:rtl">
      ${paras.length === 0 ?
        '<div style="color:var(--muted);padding:20px;text-align:center">אין טקסט זמין</div>' :
        paras.map((p, i) => `
          <div style="margin-bottom:14px;padding:12px 14px;background:var(--card);
                      border-radius:10px;border-right:3px solid ${i===0?book.color:'var(--border)'}">
            <div style="font-size:var(--font-size);line-height:1.9;color:var(--cream)">${p}</div>
          </div>`).join('')}
    </div>

    <!-- Actions -->
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      ${!isDone ? `
      <button onclick="markDone()"
        style="width:100%;padding:13px;background:${book.color};color:#1a1108;
               border:none;border-radius:12px;font-size:15px;font-weight:700;
               cursor:pointer;font-family:'Frank Ruhl Libre',serif;
               box-shadow:0 4px 12px rgba(201,165,74,.25)">
        ✅ סמן כנלמד${!isLast ? ' → הבא' : ''}
      </button>` : `
      <button onclick="${isLast ? '' : '_loadUnit(' + (idx+1) + ')'}" ${isLast ? 'disabled' : ''}
        style="width:100%;padding:13px;background:var(--card);color:${book.color};
               border:1px solid ${book.color}44;border-radius:12px;font-size:14px;
               font-weight:600;cursor:${isLast?'default':'pointer'};
               font-family:'Heebo',sans-serif;${isLast?'opacity:.5':''}">
        ${isLast ? '🏆 סיימת!' : 'הבא ▶'}
      </button>`}

      <div style="display:flex;gap:6px">
        <button onclick="_loadUnit(${idx-1})" ${isFirst ? 'disabled' : ''}
          style="flex:1;padding:9px;background:var(--card);color:var(--muted);
                 border:1px solid var(--border);border-radius:10px;font-size:12px;
                 cursor:pointer;${isFirst ? 'opacity:.4;cursor:default' : ''}">
          ◀ הקודם
        </button>
        <button onclick="_renderEmunaMenu()"
          style="flex:1;padding:9px;background:var(--card);color:var(--muted);
                 border:1px solid var(--border);border-radius:10px;font-size:12px;cursor:pointer">
          📚 ספרים
        </button>
        <button onclick="_loadUnit(${idx+1})" ${isLast ? 'disabled' : ''}
          style="flex:1;padding:9px;background:var(--card);color:var(--muted);
                 border:1px solid var(--border);border-radius:10px;font-size:12px;
                 cursor:pointer;${isLast ? 'opacity:.4;cursor:default' : ''}">
          הבא ▶
        </button>
      </div>
    </div>

    <!-- Progress -->
    <div style="margin-top:12px;background:var(--card);border-radius:8px;padding:8px 12px">
      <div style="display:flex;justify-content:space-between;font-size:10px;
                  color:var(--muted);margin-bottom:4px">
        <span>${book.title}</span>
        <span>${doneCount}/${units.length} (${pct}%)</span>
      </div>
      <div style="background:var(--bg);border-radius:3px;height:4px">
        <div style="background:${book.color};height:100%;width:${pct}%;border-radius:3px"></div>
      </div>
    </div>
  </div>`;
}

function _navHeader(book, idx, total) {
  return `<div style="display:flex;align-items:center;justify-content:flex-end;
    padding:8px 0 4px;margin-bottom:2px">
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:16px">${book?.icon || '📖'}</span>
      <span style="font-size:11px;color:var(--muted)">${idx+1} / ${total}</span>
    </div>
  </div>`;
}

function _hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ── Actions ────────────────────────────────────────────────────────────
function markDone() {
  if (!_currentBook) return;
  const state = _getBookState(_currentBook.id);
  const idx   = state.currentUnit || 0;
  const unit  = _currentUnits[idx];
  if (!unit) return;
  if (!state.completed) state.completed = {};
  state.completed[unit.id] = true;
  const nextIdx = Math.min(_currentUnits.length - 1, idx + 1);
  state.currentUnit = nextIdx;
  _saveState();
  if (nextIdx === idx) {
    _renderFinished();
  } else {
    _loadUnit(nextIdx);
  }
}

function _renderFinished() {
  const el = document.getElementById('emuna-content');
  if (!el || !_currentBook) return;
  const book = _currentBook;
  el.innerHTML = `
    <div style="padding:40px 24px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px">🏆</div>
      <div style="font-family:'Frank Ruhl Libre',serif;font-size:22px;font-weight:700;
                  color:${book.color};margin-bottom:8px">סיימת את ${book.title}!</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:24px">תזכו לחזור וללמוד שוב</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button onclick="_resetBook()"
          style="background:var(--card);color:${book.color};border:1px solid ${book.color}44;
                 border-radius:12px;padding:10px 20px;font-size:13px;cursor:pointer;
                 font-family:'Heebo',sans-serif">🔄 התחל מחדש</button>
        <button onclick="_renderEmunaMenu()"
          style="background:var(--card);color:var(--muted);border:1px solid var(--border);
                 border-radius:12px;padding:10px 20px;font-size:13px;cursor:pointer;
                 font-family:'Heebo',sans-serif">📚 ספרים</button>
      </div>
    </div>`;
}

function _resetBook() {
  if (!_currentBook) return;
  if (!appState.emuna) appState.emuna = {};
  appState.emuna[_currentBook.id] = { currentUnit:0, completed:{}, chapterCache:{} };
  _saveState();
  _renderEmunaMenu();
}

// Legacy: keep openKuzariLearning working if called from old cached HTML
function openKuzariLearning() { openBook('kuzari'); }
function kuzariPrev() { if(_currentBook) { const s=_getBookState(_currentBook.id); _loadUnit((s.currentUnit||0)-1); } }
function kuzariNext() { if(_currentBook) { const s=_getBookState(_currentBook.id); _loadUnit((s.currentUnit||0)+1); } }
function kuzariMarkDone() { markDone(); }
