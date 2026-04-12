// ═══════════════════════════════════════════
// TEHILIM – daily chapters by Hebrew day
// ═══════════════════════════════════════════
// Standard 30-day Tehilim schedule (Chabad / widely accepted)
// Day 29 = Psalms 140-144, Day 30 = Psalms 145-150
const TEHILIM_SCHEDULE = {
  1:  [1,2,3,4,5,6,7,8,9],
  2:  [10,11,12,13,14,15,16,17],
  3:  [18,19,20,21,22],
  4:  [23,24,25,26,27,28],
  5:  [29,30,31,32,33,34],
  6:  [35,36,37,38],
  7:  [39,40,41,42,43],
  8:  [44,45,46,47,48],
  9:  [49,50,51,52,53,54],
  10: [55,56,57,58,59],
  11: [60,61,62,63,64,65],
  12: [66,67,68],
  13: [69,70,71],
  14: [72,73,74,75,76],
  15: [77,78],
  16: [79,80,81,82],
  17: [83,84,85,86,87],
  18: [88,89],
  19: [90,91,92,93,94,95,96],
  20: [97,98,99,100,101,102,103],
  21: [104,105],
  22: [106,107],
  23: [108,109,110,111,112],
  24: [113,114,115,116,117,118],
  25: ['119:1-88'],   // First half of Psalm 119 (א–כ, stanzas 1-88)
  26: ['119:89-176'], // Second half of Psalm 119 (כ-ת, stanzas 89-176)
  27: [120,121,122,123,124,125,126,127,128,129,130,131,132,133,134],
  28: [135,136,137,138,139],
  29: [140,141,142,143,144],
  30: [145,146,147,148,149,150],
};

function getTehilimChapters(hebrewDay) {
  const day = parseInt(hebrewDay) || 1;
  const key = Math.min(day, 30);
  return TEHILIM_SCHEDULE[key] || TEHILIM_SCHEDULE[1];
}

let selectedTehilimHebrewDay = null; // tracks which day button is active

// Hebrew letter → gematria value map
const GEMATRIA_MAP = {
  'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
  'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,
  'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,'ק':100,
  'ר':200,'ש':300,'ת':400
};

function hebrewToNumber(str) {
  // Remove apostrophes, quotes, spaces
  const clean = str.replace(/['"״׳\s]/g,'');
  let sum = 0;
  for (const ch of clean) {
    const v = GEMATRIA_MAP[ch];
    if (!v) return null; // not a valid Hebrew number
    sum += v;
  }
  return sum || null;
}

function parseTehilimSearch(query) {
  const q = query.trim();
  if (!q) return null;
  // Try plain number first
  const num = parseInt(q);
  if (!isNaN(num) && String(num) === q) return num;
  // Try Hebrew prefix removal: "פרק קל" → "קל"
  const stripped = q.replace(/^פרק\s*/,'').trim();
  // Try gematria
  const gval = hebrewToNumber(stripped);
  if (gval) return gval;
  return null;
}

function searchTehilimChapter() {
  const input = document.getElementById('tehilim-search-input');
  if (!input) return;
  const chapter = parseTehilimSearch(input.value);
  const errEl = document.getElementById('tehilim-search-error');
  if (!chapter || chapter < 1 || chapter > 150) {
    if (errEl) errEl.textContent = 'פרק לא תקין (1-150)';
    return;
  }
  if (errEl) errEl.textContent = '';
  loadTehilim(chapter);
}

function initTehilim() {
  // Build chapter dropdown
  const sel = document.getElementById('tehilim-select');
  sel.innerHTML = '<option value="">-- בחר פרק ספציפי --</option>';
  for (let i = 1; i <= 150; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = `פרק ${i}`;
    sel.appendChild(opt);
  }

  // Build 30 day buttons
  const btnsEl = document.getElementById('tehilim-day-btns');
  if (btnsEl) {
    btnsEl.innerHTML = '';
    for (let day = 1; day <= 30; day++) {
      const btn = document.createElement('button');
      btn.textContent = day;
      btn.id = `tehilim-day-${day}`;
      btn.style.cssText = `
        min-width:32px; padding:5px 4px; font-size:12px; border-radius:8px; cursor:pointer;
        background:var(--surface); border:1px solid var(--border); color:var(--muted);
        font-family:'Heebo',sans-serif; transition:all .15s;
      `;
      btn.onclick = () => selectTehilimDay(day);
      btnsEl.appendChild(btn);
    }
  }

  loadTodayTehilim();
}

function selectTehilimDay(day) {
  day = parseInt(day) || 1;
  selectedTehilimHebrewDay = day;
  // Update button styles
  for (let d = 1; d <= 30; d++) {
    const btn = document.getElementById(`tehilim-day-${d}`);
    if (!btn) continue;
    if (d === day) {
      btn.style.background = 'rgba(201,165,74,.15)';
      btn.style.borderColor = 'var(--gold)';
      btn.style.color = 'var(--gold)';
      btn.style.fontWeight = '700';
    } else {
      btn.style.background = 'var(--surface)';
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--muted)';
      btn.style.fontWeight = '';
    }
  }
  const chapters = getTehilimChapters(day);
  const infoEl = document.getElementById('tehilim-day-info');
  if (infoEl) infoEl.textContent = `יום ${day} בחודש | פרקים: ${chapters.map(c => typeof c === 'string' ? `קיט (${c.split(':')[1]})` : c).join(', ')}`;
  loadTehilim(chapters[0]);
}

async function loadTodayTehilim() {
  const d = getTargetDate();
  const ds = formatDate(d);
  console.log('[Tehilim] fetching today Hebrew date:', ds);
  try {
    const data = await fetchWithDelay(`https://www.hebcal.com/converter?cfg=json&date=${ds}&g2h=1&strict=1`);
    console.log('[Tehilim] Hebrew date response:', JSON.stringify(data).slice(0,150));
    const hebrewDay = parseInt(data.hd) || 1;
    const heDateStr = data.hebrew || '';
    console.log('[Tehilim] Hebrew day:', hebrewDay, heDateStr);
    const infoEl = document.getElementById('tehilim-day-info');
    if (infoEl) infoEl.textContent = `${heDateStr} | פרקים להיום: ${getTehilimChapters(hebrewDay).join(', ')}`;
    selectTehilimDay(hebrewDay);
  } catch(e) {
    console.error('[Tehilim] failed to get Hebrew date:', e.message);
    // Fallback: use JS date to estimate Hebrew day
    const approxDay = new Date().getDate();
    console.log('[Tehilim] using approximate day:', approxDay);
    selectTehilimDay(approxDay);
  }
}

// Build a reverse map: chapter → [day, indexInDay]
// Now handles both numeric chapters and string ranges like '119:1-88'
const CHAPTER_TO_DAY = {};
for (let day = 1; day <= 30; day++) {
  const chapters = TEHILIM_SCHEDULE[day] || [];
  chapters.forEach((ch, idx) => {
    const key = String(ch); // use string key for ranges
    if (!CHAPTER_TO_DAY[key]) CHAPTER_TO_DAY[key] = { day, idx, total: chapters.length };
  });
}

// Helper: format a chapter entry for display
function _tehilimLabel(ch) {
  if (typeof ch === 'string' && ch.includes(':')) {
    const [chNum, vRange] = ch.split(':');
    return `פרק קי"ט (פס' ${vRange.replace('-','–')})`;
  }
  return `פרק ${ch}`;
}

// Helper: build loadTehilim action for a chapter entry
function _tehilimAction(ch) {
  if (typeof ch === 'string') return `loadTehilim('${ch}')`;
  return `loadTehilim(${ch})`;
}

function getTehilimNavInfo(chapterOrRange) {
  const key = String(chapterOrRange);
  // For plain chapter number, also try string range variants
  const info = CHAPTER_TO_DAY[key] || CHAPTER_TO_DAY[parseInt(chapterOrRange)];
  if (!info) return null;
  const { day, idx, total } = info;
  const dayChapters = TEHILIM_SCHEDULE[day] || [];

  const isLastInDay  = idx === total - 1;
  const isFirstInDay = idx === 0;

  let prevLabel = null, prevAction = null;
  if (!isFirstInDay) {
    prevLabel  = `→ ${_tehilimLabel(dayChapters[idx-1])}`;
    prevAction = _tehilimAction(dayChapters[idx-1]);
  } else {
    if (day === 1) {
      prevLabel  = `→ יום ל׳ (תחילת המחזור)`;
      prevAction = `selectTehilimDay(30); ${_tehilimAction(TEHILIM_SCHEDULE[30][0])}`;
    } else {
      prevLabel  = `→ יום ${day-1}`;
      prevAction = `selectTehilimDay(${day-1}); ${_tehilimAction(TEHILIM_SCHEDULE[day-1][0])}`;
    }
  }

  let nextLabel = null, nextAction = null;
  if (!isLastInDay) {
    nextLabel  = `${_tehilimLabel(dayChapters[idx+1])} ←`;
    nextAction = _tehilimAction(dayChapters[idx+1]);
  } else {
    if (day === 30) {
      nextLabel  = `יום א׳ (תחילת המחזור) ←`;
      nextAction = `selectTehilimDay(1); ${_tehilimAction(TEHILIM_SCHEDULE[1][0])}`;
    } else {
      nextLabel  = `יום ${day+1} ←`;
      nextAction = `selectTehilimDay(${day+1}); ${_tehilimAction(TEHILIM_SCHEDULE[day+1][0])}`;
    }
  }

  return { prevLabel, prevAction, nextLabel, nextAction, day, isLastInDay, isFirstInDay };
}

let currentTehilimChapter = 1;

function scrollTehilimTop() {
  setTimeout(() => {
    // Scroll to the chapter title (not page top — tehilim-select is above)
    const titleEl = document.getElementById('tehilim-num-title');
    if (titleEl) {
      titleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 80);
}

async function loadTehilim(chapterOrRange) {
  // chapterOrRange: number like 23, or string like '119:1-88'
  const isRange = typeof chapterOrRange === 'string' && chapterOrRange.includes(':');
  let chapter, verseFrom, verseTo, rangeLabel;
  if (isRange) {
    const [ch, vRange] = chapterOrRange.split(':');
    chapter = parseInt(ch);
    [verseFrom, verseTo] = vRange.split('-').map(Number);
    rangeLabel = `פסוקים ${verseFrom}–${verseTo}`;
  } else {
    chapter = parseInt(chapterOrRange);
  }
  if (!chapter || chapter < 1 || chapter > 150) return;
  currentTehilimChapter = chapter;
  const el = document.getElementById('tehilim-content');
  const title = document.getElementById('tehilim-num-title');
  const sub = document.getElementById('tehilim-subtitle');
  el.className = 'content-text loading';
  el.textContent = 'טוען...';
  title.textContent = isRange ? `פרק ${chapter} (${rangeLabel})` : `פרק ${chapter}`;
  sub.textContent = '';
  const sel = document.getElementById('tehilim-select');
  if (sel) sel.value = chapter;

  try {
    console.log(`[Tehilim] loading chapter ${chapter}${isRange ? ` verses ${verseFrom}-${verseTo}` : ''}`);
    const data = await sefariaText(`Psalms.${chapter}`);
    let flat = heFlat(data);
    if (!flat.length) throw new Error(`אין טקסט עברי לפרק ${chapter}`);

    // For verse ranges (Psalm 119 split), slice the verses
    if (isRange && verseFrom && verseTo) {
      flat = flat.slice(verseFrom - 1, verseTo); // 1-based
      console.log(`[Tehilim] sliced to verses ${verseFrom}-${verseTo}: ${flat.length} verses`);
    }

    // Build smart navigation buttons — pass full range string so CHAPTER_TO_DAY lookup works
    const nav = getTehilimNavInfo(isRange ? chapterOrRange : chapter);
    const btnStyle    = `background:var(--surface);border:1px solid var(--border);color:var(--gold);padding:6px 12px;border-radius:20px;font-size:12px;cursor:pointer;font-family:'Heebo',sans-serif;max-width:48%`;
    const dayBtnStyle = `background:rgba(201,165,74,.12);border:1px solid var(--gold-dim);color:var(--gold);padding:6px 12px;border-radius:20px;font-size:12px;cursor:pointer;font-family:'Heebo',sans-serif;max-width:48%`;

    const wrapAction = action => `scrollTehilimTop();${action}`;
    const prevBtn = nav ? `<button onclick="${wrapAction(nav.prevAction)}" style="${nav.isFirstInDay ? dayBtnStyle : btnStyle}">${nav.prevLabel}</button>` : '<span></span>';
    const nextBtn = nav ? `<button onclick="${wrapAction(nav.nextAction)}" style="${nav.isLastInDay  ? dayBtnStyle : btnStyle}">${nav.nextLabel}</button>` : '<span></span>';
    const navRow  = `<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:14px">${prevBtn}${nextBtn}</div>`;

    const dayInfo = nav ? `<div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:10px">יום ${nav.day} בחודש${isRange ? ` | ${rangeLabel}` : ''}</div>` : '';

    // Show verse numbers relative to the full chapter (offset by verseFrom)
    const offset = isRange ? (verseFrom - 1) : 0;
    el.className = 'content-text';
    el.innerHTML = navRow + dayInfo +
      flat.map((v,i) => `<div style="margin-bottom:6px"><span style="color:var(--gold-dim);font-size:11px">${i+1+offset} </span>${v}</div>`).join('') +
      `<div style="display:flex;justify-content:space-between;gap:8px;margin-top:16px">${prevBtn}${nextBtn}</div>`;

    sub.textContent = `${flat.length} פסוקים${isRange ? ` (${rangeLabel})` : ''}`;
    updateDoneButton('tehilim', chapter);
    const ttsWrap = document.getElementById('tehilim-tts-wrap');
    if (ttsWrap) ttsWrap.innerHTML = '';
    scrollTehilimTop();
    console.log(`[Tehilim] OK – ${flat.length} verses, day ${nav?.day}`);
  } catch(e) {
    console.error('[Tehilim] error:', e);
    el.textContent = 'שגיאה בטעינה: ' + e.message;
  }
}
