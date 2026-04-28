// ═══════════════════════════════════════════════════════════════════════
// EMUNA.JS – טאב אמונה
// ספר הכוזרי – לימוד יומי מספריא
// 5 פסקאות ביום, שמירת מצב, ניווט קדימה/אחורה
// ═══════════════════════════════════════════════════════════════════════

// ── Kuzari structure: 5 mamarim ──────────────────────────────────────
// Mamaar 1: sections 1-115 (~115 sections)
// Mamaar 2: sections 1-82  (~82)
// Mamaar 3: sections 1-73  (~73)
// Mamaar 4: sections 1-31  (~31)
// Mamaar 5: sections 1-28  (~28)
// Total ~329 sections → 5/unit = ~66 learning units

const KUZARI_UNITS = _buildKuzariUnits();

function _buildKuzariUnits() {
  // Mamaar sizes based on Sefaria index
  const maamarim = [
    { num: 1, size: 115 },
    { num: 2, size: 82  },
    { num: 3, size: 73  },
    { num: 4, size: 31  },
    { num: 5, size: 28  },
  ];
  const units = [];
  for (const m of maamarim) {
    for (let sec = 1; sec <= m.size; sec++) {
      units.push({
        id:     `${m.num}_${sec}`,
        mamaar: m.num,
        start:  sec,
        end:    sec,
        label:  `מאמר ${_hebrewNumeral(m.num)}, סעיף ${sec}`,
        ref:    `Kuzari.${m.num}.${sec}`,
      });
    }
  }
  return units;
}

function _hebrewNumeral(n) {
  return ['א','ב','ג','ד','ה'][n-1] || String(n);
}

// ── State helpers ─────────────────────────────────────────────────────
function _getKuzariState() {
  if (!appState.kuzari) appState.kuzari = { currentUnit: 0, completedUnits: {} };
  return appState.kuzari;
}

function _saveKuzariState() { saveState(); }

// ── Render emuna tab ──────────────────────────────────────────────────
let _emunaBookOpen = false;
let _emunaLoading  = false;

function loadEmuna() {
  _emunaBookOpen = !!_getKuzariState().currentUnit || _getKuzariState().currentUnit === 0;
  _renderEmunaMenu();
}

function _renderEmunaMenu() {
  const el = document.getElementById('emuna-content');
  if (!el) return;
  const state = _getKuzariState();
  const total     = KUZARI_UNITS.length;
  const completed = Object.keys(state.completedUnits || {}).length;
  const pct       = Math.round(completed / total * 100);

  el.innerHTML = `
    <div style="padding:0 0 80px">
      <!-- Header card -->
      <div style="text-align:center;padding:20px 16px 16px">
        <div style="font-size:32px;margin-bottom:8px">📖</div>
        <div style="font-family:'Frank Ruhl Libre',serif;font-size:22px;font-weight:700;
                    color:var(--gold)">ספר הכוזרי</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">
          לרבי יהודה הלוי
        </div>
      </div>

      <!-- Progress -->
      ${completed > 0 ? `
      <div style="margin:0 16px 16px;background:var(--card);border-radius:12px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--muted)">התקדמות</span>
          <span style="font-size:12px;color:var(--gold)">${completed} / ${total} יחידות (${pct}%)</span>
        </div>
        <div style="background:var(--bg);border-radius:4px;height:6px;overflow:hidden">
          <div style="background:var(--gold);height:100%;width:${pct}%;border-radius:4px;transition:width .3s"></div>
        </div>
      </div>` : ''}

      <!-- Main button -->
      <div style="padding:0 16px">
        <button onclick="openKuzariLearning()"
          style="width:100%;padding:16px;background:var(--gold);color:#1a1108;border:none;
                 border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;
                 font-family:'Frank Ruhl Libre',serif;
                 box-shadow:0 4px 16px rgba(201,165,74,.3)">
          ${completed === 0 ? '🌟 פתח את ספר הכוזרי' : '📖 המשך לימוד'}
        </button>

        ${completed > 0 ? `
        <div style="display:flex;gap:8px;margin-top:10px">
          <button onclick="kuzariPrev()"
            style="flex:1;padding:10px;background:var(--card);color:var(--gold);
                   border:1px solid var(--gold-dim);border-radius:10px;
                   font-size:13px;cursor:pointer;font-family:'Heebo',sans-serif">
            ◀ הקודם
          </button>
          <button onclick="kuzariNext()"
            style="flex:1;padding:10px;background:var(--card);color:var(--gold);
                   border:1px solid var(--gold-dim);border-radius:10px;
                   font-size:13px;cursor:pointer;font-family:'Heebo',sans-serif">
            הבא ▶
          </button>
        </div>` : ''}

        <!-- Info -->
        <div style="margin-top:16px;padding:12px;background:var(--card);border-radius:10px;
                    border-right:3px solid var(--gold-dim)">
          <div style="font-size:11px;color:var(--muted);line-height:1.6">
            📚 ${total} יחידות לימוד · סעיף אחד כל יחידה<br>
            ✍️ נוסח: אבן תיבון (מתוך ספריא)<br>
            📅 כ-${Math.ceil(total/30)} חודשים ללימוד מלא
          </div>
        </div>
      </div>
    </div>`;
}

async function openKuzariLearning() {
  const state = _getKuzariState();
  const idx = state.currentUnit || 0;
  await _loadKuzariUnit(idx);
}

async function kuzariPrev() {
  const state = _getKuzariState();
  const idx = Math.max(0, (state.currentUnit || 0) - 1);
  await _loadKuzariUnit(idx);
}

async function kuzariNext() {
  const state = _getKuzariState();
  const idx = Math.min(KUZARI_UNITS.length - 1, (state.currentUnit || 0) + 1);
  await _loadKuzariUnit(idx);
}

async function kuzariMarkDone() {
  const state = _getKuzariState();
  const idx = state.currentUnit || 0;
  const unit = KUZARI_UNITS[idx];
  if (!unit) return;

  // Mark as completed
  if (!state.completedUnits) state.completedUnits = {};
  state.completedUnits[unit.id] = true;

  // Advance to next unit
  const nextIdx = Math.min(KUZARI_UNITS.length - 1, idx + 1);
  state.currentUnit = nextIdx;
  _saveKuzariState();

  if (nextIdx === idx) {
    // Finished the whole book!
    _renderKuzariFinished();
  } else {
    await _loadKuzariUnit(nextIdx);
  }
}

async function _loadKuzariUnit(idx) {
  if (_emunaLoading) return;
  _emunaLoading = true;

  const el = document.getElementById('emuna-content');
  if (!el) { _emunaLoading = false; return; }

  const state = _getKuzariState();
  state.currentUnit = idx;
  _saveKuzariState();

  const unit = KUZARI_UNITS[idx];
  if (!unit) { _emunaLoading = false; return; }

  const isCompleted = !!(state.completedUnits || {})[unit.id];
  const isLast      = idx === KUZARI_UNITS.length - 1;
  const isFirst     = idx === 0;

  // Show loading state
  el.innerHTML = `
    <div style="padding:16px 16px 80px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <button onclick="_renderEmunaMenu()"
          style="background:none;border:none;color:var(--muted);cursor:pointer;
                 font-size:13px;padding:4px 8px">← חזור</button>
        <div style="font-size:12px;color:var(--muted)">${idx+1} / ${KUZARI_UNITS.length}</div>
      </div>
      <div style="text-align:center;padding:40px;color:var(--muted)">
        <div style="font-size:28px;margin-bottom:12px">📖</div>
        טוען ${unit.label}...
      </div>
    </div>`;

  try {
    console.log('[Kuzari] loading unit', idx, 'ref:', unit.ref);
    const data = await sefariaText(unit.ref, 300);
    const flat = heFlat(data).map(cleanSefariaHtml).filter(Boolean);

    if (!flat.length) throw new Error('no text returned');

    const completedCount = Object.keys(state.completedUnits || {}).length;
    const totalUnits = KUZARI_UNITS.length;

    el.innerHTML = `
      <div style="padding:0 16px 100px">
        <!-- Nav header -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:12px 0;position:sticky;top:0;background:var(--bg);z-index:10">
          <button onclick="_renderEmunaMenu()"
            style="background:none;border:none;color:var(--muted);cursor:pointer;
                   font-size:13px;padding:6px 8px">← אמונה</button>
          <div style="font-size:11px;color:var(--muted)">${idx+1} / ${totalUnits}</div>
        </div>

        <!-- Title -->
        <div style="text-align:center;margin-bottom:16px;padding:12px;
                    background:rgba(201,165,74,.08);border-radius:12px">
          <div style="font-size:14px;font-weight:700;color:var(--gold);
                      font-family:'Frank Ruhl Libre',serif">ספר הכוזרי</div>
          <div style="font-size:13px;color:var(--cream);margin-top:3px">${unit.label}</div>
          ${isCompleted ? '<div style="font-size:11px;color:#7ed6a0;margin-top:4px">✅ נלמד</div>' : ''}
        </div>

        <!-- Text -->
        <div style="font-family:\'Frank Ruhl Libre\',serif;direction:rtl">
          ${flat.map((section, i) => `
            <div style="margin-bottom:16px;padding:12px 14px;background:var(--card);
                        border-radius:10px;border-right:3px solid ${i===0?'var(--gold)':'var(--border)'}">
              <div style="font-size:10px;color:var(--muted);margin-bottom:6px;
                          font-family:\'Heebo\',sans-serif">
                מאמר ${_hebrewNumeral(unit.mamaar)}, סעיף ${unit.start + i}
              </div>
              <div style="font-size:var(--font-size);line-height:1.9;color:var(--cream)">
                ${section}
              </div>
            </div>`).join('')}
        </div>

        <!-- Action buttons -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
          ${!isCompleted ? `
          <button onclick="kuzariMarkDone()"
            style="width:100%;padding:14px;background:var(--gold);color:#1a1108;
                   border:none;border-radius:12px;font-size:16px;font-weight:700;
                   cursor:pointer;font-family:\'Frank Ruhl Libre\',serif;
                   box-shadow:0 4px 12px rgba(201,165,74,.3)">
            ✅ סמן כנלמד${!isLast ? ' → הבא' : ' → סיום'}
          </button>` : `
          <button onclick="kuzariNext()" ${isLast ? 'disabled' : ''}
            style="width:100%;padding:14px;background:var(--card);color:var(--gold);
                   border:1px solid var(--gold-dim);border-radius:12px;font-size:15px;
                   font-weight:600;cursor:pointer;font-family:\'Heebo\',sans-serif;
                   ${isLast ? 'opacity:.5;cursor:default' : ''}">
            הלימוד הבא ▶
          </button>`}

          <div style="display:flex;gap:8px">
            <button onclick="kuzariPrev()" ${isFirst ? 'disabled' : ''}
              style="flex:1;padding:10px;background:var(--card);color:var(--muted);
                     border:1px solid var(--border);border-radius:10px;font-size:13px;
                     cursor:pointer;font-family:\'Heebo\',sans-serif;
                     ${isFirst ? 'opacity:.4;cursor:default' : ''}">
              ◀ הקודם
            </button>
            <button onclick="_renderEmunaMenu()"
              style="flex:1;padding:10px;background:var(--card);color:var(--muted);
                     border:1px solid var(--border);border-radius:10px;font-size:13px;
                     cursor:pointer;font-family:\'Heebo\',sans-serif">
              📋 תפריט
            </button>
            <button onclick="kuzariNext()" ${isLast ? 'disabled' : ''}
              style="flex:1;padding:10px;background:var(--card);color:var(--muted);
                     border:1px solid var(--border);border-radius:10px;font-size:13px;
                     cursor:pointer;font-family:\'Heebo\',sans-serif;
                     ${isLast ? 'opacity:.4;cursor:default' : ''}">
              הבא ▶
            </button>
          </div>
        </div>

        <!-- Progress bar -->
        <div style="margin-top:14px;background:var(--card);border-radius:8px;padding:8px 12px">
          <div style="display:flex;justify-content:space-between;
                      font-size:11px;color:var(--muted);margin-bottom:6px">
            <span>התקדמות</span>
            <span>${completedCount}/${totalUnits}</span>
          </div>
          <div style="background:var(--bg);border-radius:3px;height:4px">
            <div style="background:var(--gold);height:100%;
                        width:${Math.round(completedCount/totalUnits*100)}%;
                        border-radius:3px"></div>
          </div>
        </div>
      </div>`;

    console.log('[Kuzari] loaded', flat.length, 'sections for unit', idx);
  } catch(e) {
    console.error('[Kuzari] error:', e.message);
    el.innerHTML = `
      <div style="padding:16px">
        <button onclick="_renderEmunaMenu()"
          style="background:none;border:none;color:var(--muted);cursor:pointer;
                 font-size:13px;padding:4px 8px;margin-bottom:16px">← חזור</button>
        <div style="text-align:center;padding:30px;color:var(--muted)">
          <div style="font-size:28px;margin-bottom:12px">⚠️</div>
          <div style="margin-bottom:16px">לא ניתן לטעון את הכוזרי כעת</div>
          <button onclick="_loadKuzariUnit(${idx})"
            style="background:var(--gold);color:#000;border:none;border-radius:10px;
                   padding:10px 24px;font-size:14px;cursor:pointer">
            נסה שוב
          </button>
        </div>
      </div>`;
  }
  _emunaLoading = false;
}

function _renderKuzariFinished() {
  const el = document.getElementById('emuna-content');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:40px 24px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px">🏆</div>
      <div style="font-family:'Frank Ruhl Libre',serif;font-size:24px;font-weight:700;
                  color:var(--gold);margin-bottom:8px">
        סיימת את ספר הכוזרי!
      </div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.6">
        תזכו לחזור וללמוד שוב
      </div>
      <button onclick="_resetKuzari()"
        style="background:var(--card);color:var(--gold);border:1px solid var(--gold-dim);
               border-radius:12px;padding:12px 28px;font-size:14px;cursor:pointer;
               font-family:'Heebo',sans-serif">
        🔄 התחל מחדש
      </button>
    </div>`;
}

function _resetKuzari() {
  appState.kuzari = { currentUnit: 0, completedUnits: {} };
  _saveKuzariState();
  _renderEmunaMenu();
}
