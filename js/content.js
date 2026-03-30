// ═══════════════════════════════════════════
// HALACHA – Daily Halacha (Ashkenazi)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// HALACHA – קיצור שולחן ערוך יומי
// 221 chapters, 2 seifim per day
// ═══════════════════════════════════════════
function getKitzurRef(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - start) / 86400000) + 1;
  const chapterIdx = (dayOfYear - 1) % 221;
  const chapter = chapterIdx + 1;
  const seifPairIdx = Math.floor((dayOfYear - 1) / 221) % 5;
  const seif1 = seifPairIdx * 2 + 1;
  const seif2 = seif1 + 1;
  return { ref: `Kitzur_Shulchan_Arukh.${chapter}`, chapter, seif1, seif2 };
}

async function loadHalacha() {
  const el    = document.getElementById('halacha-content');
  const refEl = document.getElementById('halacha-ref');
  el.className = 'content-text loading';
  el.textContent = 'טוען הלכה יומית...';
  const d  = getTargetDate();
  const ds = formatDate(d);

  try {
    const { ref, chapter, seif1, seif2 } = getKitzurRef(d);
    refEl.textContent = `קיצור שולחן ערוך – פרק ${chapter}, סעיפים ${seif1}–${seif2}`;
    console.log('[Halacha] ref:', ref, 'seifim:', seif1, seif2);
    const data = await sefariaText(ref, 400);
    const flat = heFlat(data);
    if (!flat.length) throw new Error(`אין טקסט לפרק ${chapter}`);
    const idx1   = Math.min(seif1 - 1, flat.length - 1);
    const idx2   = Math.min(seif2 - 1, flat.length - 1);
    const toShow = idx1 === idx2 ? [flat[idx1]] : [flat[idx1], flat[idx2]].filter(Boolean);
    el.className = 'content-text';
    el.innerHTML = toShow.map((v, i) =>
      `<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border)">
         <div style="font-size:10px;color:var(--gold);margin-bottom:3px">סעיף ${seif1 + i}</div>
         <div style="line-height:1.8">${v}</div>
       </div>`
    ).join('');
    updateDoneButton('halacha', ds);
    console.log('[Halacha] OK –', toShow.length, 'seifim shown');
  } catch(e) {
    console.error('[Halacha] error:', e);
    el.textContent = 'שגיאה בטעינת ההלכה: ' + e.message;
  }
}

// ═══════════════════════════════════════════
// PARASHA
// ═══════════════════════════════════════════
let parashaVerses = [];   // current Torah verses
let rashiVerses   = [];   // current Rashi verses (parallel array)
let onkelosVerses = [];   // current Onkelos verses (parallel array)
let onkelosLoaded = false;
let parashaView   = 'text'; // 'text' | 'rashi' | 'onkelos'
let currentParashaRef = null;

function setParashaView(mode) {
  parashaView = mode;
  document.getElementById('view-text-btn').classList.toggle('active',    mode === 'text');
  document.getElementById('view-rashi-btn').classList.toggle('active',   mode === 'rashi');
  document.getElementById('view-onkelos-btn').classList.toggle('active', mode === 'onkelos');
  renderParasha();
}

function _updateAliyaNav() {
  const nav = document.getElementById('aliya-nav');
  if (!nav || !aliyot.length) return;
  const idx = typeof currentAliya === 'number' ? currentAliya : -1;
  const hasPrev = idx > 0;
  const hasNext = idx < aliyot.length - 1;
  const aliyaNames = ['א','ב','ג','ד','ה','ו','ז','מפטיר'];
  const btnStyle = (enabled) =>
    `background:var(--surface);border:1px solid ${enabled?'var(--gold-dim)':'var(--border)'};` +
    `color:${enabled?'var(--gold)':'var(--muted)'};padding:6px 14px;border-radius:20px;` +
    `font-size:12px;cursor:${enabled?'pointer':'default'};font-family:'Heebo',sans-serif`;
  nav.innerHTML = hasPrev
    ? `<button style="${btnStyle(true)}" onclick="navAliya(${idx-1})">→ עליה ${aliyaNames[idx-1]||''}</button>`
    : `<span></span>`;
  if (hasNext) {
    nav.innerHTML += `<button style="${btnStyle(true)}" onclick="navAliya(${idx+1})">עליה ${aliyaNames[idx+1]||''} ←</button>`;
  } else {
    nav.innerHTML += `<span></span>`;
  }
}

async function navAliya(idx) {
  const tab = document.querySelector(`#aliya-tabs .aliya-tab:nth-child(${idx+1})`);
  if (tab) await showAliya(idx, tab);
}

function renderParasha() {
  const el = document.getElementById('parasha-content');
  if (!parashaVerses.length) { el.innerHTML = ''; return; }

  if (parashaView === 'text') {
    el.innerHTML = parashaVerses.map((v,i) =>
      `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span><span style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);line-height:1.85">${v}</span></div>`
    ).join('');

  } else if (parashaView === 'rashi') {
    if (!rashiLoaded) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">⏳ טוען פירוש רש"י...</div>';
      return;
    }
    el.innerHTML = parashaVerses.map((v,i) => {
      const r = rashiVerses[i];
      return `<div style="margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
        <div style="margin-bottom:5px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>
        <span style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);color:var(--cream);line-height:1.85">${v}</span></div>
        ${r ? `<div style="padding:7px 10px;background:rgba(201,165,74,.06);border-right:2px solid var(--gold-dim);border-radius:0 6px 6px 0">
          <div style="font-size:10px;color:var(--gold);font-weight:600;margin-bottom:2px">רש"י</div>
          <span style="font-family:'Frank Ruhl Libre',serif;font-size:calc(var(--font-size)*.88);color:var(--text);line-height:1.7">${r}</span></div>` : ''}
      </div>`;
    }).join('');

  } else if (parashaView === 'onkelos') {
    if (!onkelosLoaded) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">⏳ טוען תרגום אונקלוס...</div>';
      return;
    }
    el.innerHTML = parashaVerses.map((v,i) => {
      const o = onkelosVerses[i];
      return `<div style="margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
        <div style="margin-bottom:5px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>
        <span style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);color:var(--cream);line-height:1.85">${v}</span></div>
        ${o ? `<div style="padding:7px 10px;background:rgba(42,120,140,.08);border-right:2px solid rgba(42,180,200,.4);border-radius:0 6px 6px 0">
          <div style="font-size:10px;color:rgba(100,200,220,.9);font-weight:600;margin-bottom:2px">אונקלוס</div>
          <span style="font-family:'Frank Ruhl Libre',serif;font-size:calc(var(--font-size)*.88);color:var(--text);line-height:1.7;font-style:italic">${o}</span></div>` : ''}
      </div>`;
    }).join('');
  }
}

// All 54 Torah portions with Sefaria refs
const ALL_PARASHIOT = [
  { he: 'בראשית', ref: 'Genesis 1:1-6:8' }, { he: 'נח', ref: 'Genesis 6:9-11:32' },
  { he: 'לך לך', ref: 'Genesis 12:1-17:27' }, { he: 'וירא', ref: 'Genesis 18:1-22:24' },
  { he: 'חיי שרה', ref: 'Genesis 23:1-25:18' }, { he: 'תולדות', ref: 'Genesis 25:19-28:9' },
  { he: 'ויצא', ref: 'Genesis 28:10-32:3' }, { he: 'וישלח', ref: 'Genesis 32:4-36:43' },
  { he: 'וישב', ref: 'Genesis 37:1-40:23' }, { he: 'מקץ', ref: 'Genesis 41:1-44:17' },
  { he: 'ויגש', ref: 'Genesis 44:18-47:27' }, { he: 'ויחי', ref: 'Genesis 47:28-50:26' },
  { he: 'שמות', ref: 'Exodus 1:1-6:1' }, { he: 'וארא', ref: 'Exodus 6:2-9:35' },
  { he: 'בא', ref: 'Exodus 10:1-13:16' }, { he: 'בשלח', ref: 'Exodus 13:17-17:16' },
  { he: 'יתרו', ref: 'Exodus 18:1-20:23' }, { he: 'משפטים', ref: 'Exodus 21:1-24:18' },
  { he: 'תרומה', ref: 'Exodus 25:1-27:19' }, { he: 'תצוה', ref: 'Exodus 27:20-30:10' },
  { he: 'כי תשא', ref: 'Exodus 30:11-34:35' }, { he: 'ויקהל', ref: 'Exodus 35:1-38:20' },
  { he: 'פקודי', ref: 'Exodus 38:21-40:38' }, { he: 'ויקרא', ref: 'Leviticus 1:1-5:26' },
  { he: 'צו', ref: 'Leviticus 6:1-8:36' }, { he: 'שמיני', ref: 'Leviticus 9:1-11:47' },
  { he: 'תזריע', ref: 'Leviticus 12:1-13:59' }, { he: 'מצורע', ref: 'Leviticus 14:1-15:33' },
  { he: 'אחרי מות', ref: 'Leviticus 16:1-18:30' }, { he: 'קדושים', ref: 'Leviticus 19:1-20:27' },
  { he: 'אמור', ref: 'Leviticus 21:1-24:23' }, { he: 'בהר', ref: 'Leviticus 25:1-26:2' },
  { he: 'בחוקותי', ref: 'Leviticus 26:3-27:34' }, { he: 'במדבר', ref: 'Numbers 1:1-4:20' },
  { he: 'נשא', ref: 'Numbers 4:21-7:89' }, { he: 'בהעלותך', ref: 'Numbers 8:1-12:16' },
  { he: 'שלח', ref: 'Numbers 13:1-15:41' }, { he: 'קורח', ref: 'Numbers 16:1-18:32' },
  { he: 'חקת', ref: 'Numbers 19:1-22:1' }, { he: 'בלק', ref: 'Numbers 22:2-25:9' },
  { he: 'פינחס', ref: 'Numbers 25:10-30:1' }, { he: 'מטות', ref: 'Numbers 30:2-32:42' },
  { he: 'מסעי', ref: 'Numbers 33:1-36:13' }, { he: 'דברים', ref: 'Deuteronomy 1:1-3:22' },
  { he: 'ואתחנן', ref: 'Deuteronomy 3:23-7:11' }, { he: 'עקב', ref: 'Deuteronomy 7:12-11:25' },
  { he: 'ראה', ref: 'Deuteronomy 11:26-16:17' }, { he: 'שופטים', ref: 'Deuteronomy 16:18-21:9' },
  { he: 'כי תצא', ref: 'Deuteronomy 21:10-25:19' }, { he: 'כי תבוא', ref: 'Deuteronomy 26:1-29:8' },
  { he: 'נצבים', ref: 'Deuteronomy 29:9-30:20' }, { he: 'וילך', ref: 'Deuteronomy 31:1-31:30' },
  { he: 'האזינו', ref: 'Deuteronomy 32:1-32:52' }, { he: 'וזאת הברכה', ref: 'Deuteronomy 33:1-34:12' },
];

function populateParashaDropdown(currentRef) {
  const sel = document.getElementById('parasha-select');
  if (!sel) return;
  sel.innerHTML = ALL_PARASHIOT.map(p =>
    `<option value="${p.ref}" ${p.ref === currentRef ? 'selected' : ''}>${p.he}</option>`
  ).join('');
}

async function loadSpecificParasha(ref) {
  if (!ref) return;
  const p = ALL_PARASHIOT.find(x => x.ref === ref);
  if (p) document.getElementById('parasha-name').textContent = p.he;
  const tabsEl = document.getElementById('aliya-tabs');

  // Fetch aliyot from Sefaria for the selected parasha
  try {
    const cal = await fetchWithDelay(`https://www.sefaria.org/api/calendars?diaspora=0&_=${Date.now()}`);
    const calItem = (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').toLowerCase().includes('parashat') &&
      (i.ref || '').includes(ref.split(' ')[0]) // rough book match
    ) || (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').toLowerCase().includes('parashat')
    );
    aliyot = calItem?.extraDetails?.aliyot || [];
  } catch(_) { aliyot = []; }

  currentParashaRef = ref;
  currentAliya = aliyot.length > 0 ? 0 : 'all';

  const aliyaNames = ['א','ב','ג','ד','ה','ו','ז','מפטיר'];
  tabsEl.innerHTML = aliyaNames.map((name, i) => {
    if (!aliyot[i]) return '';
    return `<div class="aliya-tab${i === 0 ? ' active' : ''}" onclick="showAliya(${i}, this)">${name}</div>`;
  }).join('') + `<div class="aliya-tab${aliyot.length === 0 ? ' active' : ''}" onclick="showAliya('all', this)">הכל</div>`;

  if (aliyot[0]) {
    await loadAliyaText(aliyot[0]);
  } else {
    await loadAliyaText(ref);
  }
}

let _parashaLoading = false;
async function loadParasha() {
  if (_parashaLoading) return;
  _parashaLoading = true;
  const loadingEl = document.getElementById('parasha-loading');
  const nameEl    = document.getElementById('parasha-name');
  const tabsEl    = document.getElementById('aliya-tabs');
  const noticeEl  = document.getElementById('parasha-notice');
  parashaVerses = []; rashiVerses = [];
  loadingEl.textContent = 'טוען פרשת השבוע...';
  loadingEl.style.display = 'block';
  document.getElementById('parasha-content').innerHTML = '';
  if (noticeEl) noticeEl.style.display = 'none';

  populateParashaDropdown(null);

  try {
    const ds  = formatDate(getTargetDate());
    // Search up to 21 days to find next parasha (handles Yom Tov + Chol HaMoed periods)
    const ds3w = formatDate(new Date(getTargetDate().getTime() + 21 * 86400000));
    const hbUrl  = `https://www.hebcal.com/hebcal?v=1&cfg=json&s=on&start=${ds}&end=${ds3w}`;
    const hbData = await fetchWithDelay(hbUrl);
    const items  = hbData?.items || [];

    const parashaEvent = items.find(i => i.category === 'parashat');

    // Detect if we're in a holiday period (Chol HaMoed, Yom Tov)
    const holidayThisWeek = items.find(i =>
      i.category === 'holiday' &&
      /Chol|Pesach|Passover|Sukkot|Shavuot|חג|חנוכה|פורים|ראש|יום טוב/i.test(i.title || '')
    );

    let isFutureParasha = false;
    if (!parashaEvent) throw new Error('לא נמצאה פרשה בלוח');

    // If parashaEvent is more than 8 days from now → it's the NEXT parasha after Yom Tov
    const parashaDate = new Date(parashaEvent.date);
    const today = getTargetDate();
    const daysAhead = Math.round((parashaDate - today) / 86400000);
    if (daysAhead > 8) {
      isFutureParasha = true;
      const holidayName = holidayThisWeek?.hebrew || holidayThisWeek?.title || 'יום טוב / חג';
      if (noticeEl) {
        noticeEl.textContent = `⚠️ שבת זו היא ${holidayName} – אין פרשת שבוע רגילה. מוצגת הפרשה הבאה (${parashaEvent.hebrew || parashaEvent.title}):`;
        noticeEl.style.display = 'block';
      }
      console.log('[Parasha] Holiday week detected:', holidayName, '→ next parasha in', daysAhead, 'days');
    }

    const heName = parashaEvent.hebrew || parashaEvent.title || '';
    console.log('[Parasha] Hebcal parasha:', heName, isFutureParasha ? '(next week)' : '');
    nameEl.textContent = heName + (isFutureParasha ? ' (שבוע הבא)' : '');

    // Match to our ALL_PARASHIOT list
    const clean = heName.replace(/פרשת\s*/,'').trim();
    const matchP = ALL_PARASHIOT.find(p => clean === p.he)
      || ALL_PARASHIOT.find(p => heName === p.he || heName === 'פרשת ' + p.he)
      || ALL_PARASHIOT.find(p => clean.length >= 3 && p.he.startsWith(clean) && p.he.length <= clean.length + 2);
    if (!matchP) throw new Error('לא נמצאה התאמה לפרשה: ' + heName);

    document.getElementById('parasha-select').value = matchP.ref;

    // Get aliyot: prefer Hebcal leyning data (reliable for current AND future parasha)
    // Hebcal leyning format: {"1":"Leviticus 9:1-9:16", "2":..., "M":...}
    const leyning = parashaEvent.leyning || {};
    const hebcalAliyot = ['1','2','3','4','5','6','7','M']
      .map(k => leyning[k])
      .filter(Boolean)
      .map(r => r.trim());  // just trim, preserve spaces (book name NEEDS space before chapter)

    if (hebcalAliyot.length >= 3) {
      aliyot = hebcalAliyot;
      console.log('[Parasha] using Hebcal aliyot:', aliyot.length, aliyot[0]);
    } else {
      // Fallback: Sefaria calendar (but only if NOT a holiday/future parasha)
      if (!isFutureParasha) {
        const cal = await fetchWithDelay(`https://www.sefaria.org/api/calendars?diaspora=0&_=${Date.now()}`);
        const calItem = (cal?.calendar_items || []).find(i =>
          (i.title?.en || '').toLowerCase().includes('parashat')
        );
        aliyot = calItem?.extraDetails?.aliyot || [];
      } else {
        aliyot = [];
      }
      console.log('[Parasha] using Sefaria aliyot:', aliyot.length);
    }
    console.log('[Parasha] found:', heName, 'ref:', matchP.ref, 'aliyot:', aliyot.length, aliyot[0] || '');

    const aliyaNames = ['א','ב','ג','ד','ה','ו','ז','מפטיר'];
    tabsEl.innerHTML = aliyaNames.map((name, i) => {
      if (!aliyot[i]) return '';
      return `<div class="aliya-tab${i === 0 ? ' active' : ''}" onclick="showAliya(${i}, this)">${name}</div>`;
    }).join('') + '<div class="aliya-tab" onclick="showAliya(\'all\', this)">הכל</div>';

    currentParashaRef = matchP.ref;
    // Default to first aliya for faster loading
    if (aliyot[0]) {
      currentAliya = 0;
      await loadAliyaText(aliyot[0]);
    } else {
      await loadAliyaText(currentParashaRef);
    }
    loadingEl.style.display = 'none';
    updateDoneButton('parasha', currentParashaRef);
  } catch(e) {
    console.error('[Parasha] error:', e);
    loadingEl.textContent = 'שגיאה בטעינה: ' + e.message;
  } finally {
    _parashaLoading = false;
  }
}

async function loadAliyaText(ref) {
  const loadingEl = document.getElementById('parasha-loading');
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'טוען...';
  document.getElementById('parasha-content').innerHTML = '';
  parashaVerses = []; rashiVerses = []; onkelosVerses = [];
  rashiLoaded = false; onkelosLoaded = false;

  try {
    console.log('[Parasha] loading text for ref:', ref);
    const data = await sefariaText(ref);
    parashaVerses = heFlat(data);
    console.log(`[Parasha] got ${parashaVerses.length} verses`);
    if (!parashaVerses.length) throw new Error('no Hebrew verses returned');

    // Pre-load Rashi and Onkelos in background
    loadRashiForRef(ref);
    loadOnkelosForRef(ref);

    loadingEl.style.display = 'none';
    _updateAliyaNav();
    renderParasha();
  } catch(e) {
    console.error('[Parasha] loadAliyaText error:', e);
    loadingEl.textContent = 'שגיאה בטעינת הפרשה: ' + e.message;
  } finally {
    _parashaLoading = false;
  }
}

let _rashiLoading = false;
async function loadRashiForRef(torahRef) {
  if (_rashiLoading) return;
  _rashiLoading = true;

  const m = torahRef.match(/^([^0-9]+)\s+(\d+):(\d+)(?:-(\d+):(\d+)|-(\d+))?$/);
  if (!m) { _rashiLoading = false; return; }

  const book    = m[1].trim();
  const startCh = parseInt(m[2]);
  const startV  = parseInt(m[3]);
  const endCh   = m[4] ? parseInt(m[4]) : startCh;
  const endV    = m[5] ? parseInt(m[5]) : (m[6] ? parseInt(m[6]) : startV);

  const totalCh = endCh - startCh + 1;
  console.log('[Rashi] loading:', book, startCh+':'+startV, '–', endCh+':'+endV);

  // Show Rashi progress bar
  const rashiProgressWrap = document.getElementById('rashi-progress-wrap');
  const rashiProgressBar  = document.getElementById('rashi-progress-bar');
  const rashiProgressLbl  = document.getElementById('rashi-progress-lbl');
  function setRashiProgress(done, label) {
    const pct = totalCh ? Math.round((done / totalCh) * 100) : 0;
    if (rashiProgressBar) rashiProgressBar.style.width = pct + '%';
    if (rashiProgressLbl) rashiProgressLbl.textContent = label || '';
    if (rashiProgressWrap) rashiProgressWrap.style.display = (done >= totalCh) ? 'none' : 'flex';
  }
  if (rashiProgressWrap) rashiProgressWrap.style.display = 'flex';
  setRashiProgress(0, 'טוען רש"י...');

  const verseMap     = new Map();
  const chapterLengths = {};   // actual verse count per chapter

  for (let ch = startCh; ch <= endCh; ch++) {
    setRashiProgress(ch - startCh, `רש"י פרק ${ch}...`);
    let success = false;
    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt)); // backoff on retry
        else await new Promise(r => setTimeout(r, 300));
        const url = `https://www.sefaria.org/api/texts/${encodeURI(book + ' ' + ch)}?lang=he&commentary=1&context=0`;
        const resp = await fetch(url);
        if (!resp.ok) {
          console.warn('[Rashi] ch', ch, 'attempt', attempt+1, 'HTTP', resp.status);
          continue;
        }
        const data = await resp.json();

        // Record real chapter length to prevent index drift
        chapterLengths[ch] = Array.isArray(data.he) ? data.he.length : 999;
        const chapLen = chapterLengths[ch];

        (data?.commentary || [])
          .filter(c => c.collectiveTitle?.en === 'Rashi' || (c.ref||'').startsWith('Rashi on'))
          .forEach(c => {
            const vm = (c.ref||'').match(/(\d+):(\d+)/);
            if (!vm) return;
            const cCh = parseInt(vm[1]), cV = parseInt(vm[2]);
            // Strict range check: must be exactly the chapter we fetched
            if (cCh !== ch) return;                     // ignore commentary that bled in from other chapters
            if (cV < 1 || cV > chapLen) return;         // ignore out-of-range verses
            if (cCh === startCh && cV < startV) return;
            if (cCh === endCh   && cV > endV)   return;
            const key = `${cCh}:${cV}`;
            let txt = Array.isArray(c.he) ? c.he.flat().filter(Boolean).join(' ') : (c.he||'');
            txt = txt.replace(/<(?!\/?(?:b|i|strong)\b)[^>]+>/gi,'').trim();
            if (!verseMap.has(key)) verseMap.set(key, []);
            if (txt) verseMap.get(key).push(txt);
          });
        const chEntries = [...verseMap.keys()].filter(k => k.startsWith(ch+':')).length;
        console.log('[Rashi] ch', ch, 'len:', chapLen, '| entries this ch:', chEntries, '| total:', verseMap.size);
        success = true;
      } catch(e) {
        console.warn('[Rashi] ch', ch, 'attempt', attempt+1, e.message);
      }
    }
    if (!success) console.warn('[Rashi] ch', ch, 'failed after 3 attempts, skipping');
  }

  setRashiProgress(totalCh, '');

  // Map Rashi to verse indices using exact chapter lengths
  rashiVerses = new Array(parashaVerses.length).fill('');
  let idx = 0;
  for (let ch = startCh; ch <= endCh; ch++) {
    const firstV   = (ch === startCh) ? startV : 1;
    const actualLast = (ch === endCh)
      ? Math.min(endV, chapterLengths[ch] || 999)
      : (chapterLengths[ch] || 999);
    for (let v = firstV; v <= actualLast; v++) {
      if (idx >= parashaVerses.length) break;
      const key = `${ch}:${v}`;
      if (verseMap.has(key)) rashiVerses[idx] = verseMap.get(key).join('<br><br>');
      idx++;
    }
  }

  rashiLoaded    = true;
  _rashiLoading  = false;
  const cnt = rashiVerses.filter(Boolean).length;
  console.log('[Rashi] ✅', cnt, '/', parashaVerses.length, 'verses with Rashi');
  if (parashaView === 'rashi') renderParasha();
}

let _onkelosLoading = false;
async function loadOnkelosForRef(torahRef) {
  if (_onkelosLoading) return;
  _onkelosLoading = true;
  onkelosVerses = new Array(parashaVerses.length).fill('');

  const m = torahRef.match(/^([^0-9]+)\s+(\d+):(\d+)(?:-(\d+):(\d+)|-(\d+))?$/);
  if (!m) { _onkelosLoading = false; return; }

  const book    = m[1].trim();
  const startCh = parseInt(m[2]), startV = parseInt(m[3]);
  const endCh   = m[4] ? parseInt(m[4]) : startCh;
  const endV    = m[5] ? parseInt(m[5]) : (m[6] ? parseInt(m[6]) : startV);

  // Map Sefaria book names to Onkelos refs
  const ONKELOS_BOOK = {
    'Genesis': 'Onkelos_Genesis', 'Exodus': 'Onkelos_Exodus',
    'Leviticus': 'Onkelos_Leviticus', 'Numbers': 'Onkelos_Numbers',
    'Deuteronomy': 'Onkelos_Deuteronomy',
  };
  const onkelosBook = ONKELOS_BOOK[book];
  if (!onkelosBook) { _onkelosLoading = false; return; }

  console.log('[Onkelos] loading:', onkelosBook, startCh+':'+startV, '–', endCh+':'+endV);

  let idx = 0;
  for (let ch = startCh; ch <= endCh; ch++) {
    try {
      await new Promise(r => setTimeout(r, 200));
      const ref = `${onkelosBook}.${ch}`;
      const url = `https://www.sefaria.org/api/texts/${encodeURI(ref)}?lang=he&commentary=0&context=0`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const verses = heFlat(data);
      const firstV = ch === startCh ? startV : 1;
      const lastV  = ch === endCh ? Math.min(endV, verses.length) : verses.length;
      for (let v = firstV; v <= lastV; v++) {
        if (idx >= parashaVerses.length) break;
        onkelosVerses[idx++] = verses[v - 1] || '';
      }
    } catch(e) {
      console.warn('[Onkelos] ch', ch, e.message);
    }
  }

  onkelosLoaded = true;
  _onkelosLoading = false;
  console.log('[Onkelos] ✅ loaded', onkelosVerses.filter(Boolean).length, 'verses');
  if (parashaView === 'onkelos') renderParasha();
}

async function showAliya(index, btn) {
  document.querySelectorAll('#aliya-tabs .aliya-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentAliya = index;
  console.log('[Parasha] showAliya:', index);
  if (index === 'all') {
    if (currentParashaRef) await loadAliyaText(currentParashaRef);
  } else {
    const ref = aliyot[index];
    console.log('[Parasha] aliya ref:', ref);
    if (ref) await loadAliyaText(ref);
  }
}

// ═══════════════════════════════════════════
// LASHON HARA – Chofetz Chaim
// ═══════════════════════════════════════════
async function loadLashon() {
  const el = document.getElementById('lashon-content');
  const secEl = document.getElementById('lashon-section');
  el.className = 'content-text loading'; el.textContent = 'טוען...';

  // Correct Sefaria refs (verified from sefaria.org URLs)
  const CC1 = 'Chafetz_Chaim,_Part_One,_The_Prohibition_Against_Lashon_Hara,_Principle_';
  const CC2 = 'Chafetz_Chaim,_Part_Two,_The_Prohibition_Against_Rechilut,_Principle_';
  const LASHON_SCHEDULE = [
    { ref: 'Chafetz_Chaim,_Part_One,_The_Prohibition_Against_Lashon_Hara,_Principle_1', label: 'חלק א – כלל א (ראשון)' },
    { ref: CC1+'1',  label: 'חלק א – כלל א (איסור לשון הרע)' },
    { ref: CC1+'2',  label: 'חלק א – כלל ב' },
    { ref: CC1+'3',  label: 'חלק א – כלל ג' },
    { ref: CC1+'4',  label: 'חלק א – כלל ד' },
    { ref: CC1+'5',  label: 'חלק א – כלל ה' },
    { ref: CC1+'6',  label: 'חלק א – כלל ו' },
    { ref: CC1+'7',  label: 'חלק א – כלל ז' },
    { ref: CC1+'8',  label: 'חלק א – כלל ח' },
    { ref: CC1+'9',  label: 'חלק א – כלל ט' },
    { ref: CC1+'10', label: 'חלק א – כלל י' },
    { ref: CC2+'1',  label: 'חלק ב – כלל א (איסור רכילות)' },
    { ref: CC2+'2',  label: 'חלק ב – כלל ב' },
    { ref: CC2+'3',  label: 'חלק ב – כלל ג' },
    { ref: CC2+'4',  label: 'חלק ב – כלל ד' },
    { ref: CC2+'5',  label: 'חלק ב – כלל ה' },
    { ref: CC2+'6',  label: 'חלק ב – כלל ו' },
    { ref: CC2+'7',  label: 'חלק ב – כלל ז' },
    { ref: CC2+'8',  label: 'חלק ב – כלל ח' },
    { ref: CC2+'9',  label: 'חלק ב – כלל ט' },
  ];

  const dayOfYear = getDayOfYear(getTargetDate());
  const idx = (dayOfYear - 1) % LASHON_SCHEDULE.length;
  const entry = LASHON_SCHEDULE[idx];
  console.log('[Lashon] dayOfYear:', dayOfYear, '→ idx:', idx, '→ ref:', entry.ref);
  secEl.textContent = entry.label;

  try {
    const data = await sefariaText(entry.ref);
    const flat = heFlat(data);
    if (!flat.length) throw new Error(`אין טקסט עברי עבור ${entry.ref}`);
    el.className = 'content-text';
    el.innerHTML = flat.map((v,i) => `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>`).join('');
    updateDoneButton('lashon', entry.ref);
    console.log(`[Lashon] OK – ${flat.length} sections`);
  } catch(e) {
    console.error('[Lashon] FAILED:', e.message, '| ref:', entry.ref);
    el.textContent = 'שגיאה בטעינה: ' + e.message;
  }
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000*60*60*24));
}

// ═══════════════════════════════════════════
// IGERET HARAMBAN
// ═══════════════════════════════════════════
async function loadIgeret() {
  const el = document.getElementById('igeret-content');
  el.className = 'content-text loading'; el.textContent = 'טוען...';
  try {
    console.log('[Igeret] loading Iggeret_HaRamban...');
    const data = await sefariaText('Iggeret_HaRamban');
    const flat = heFlat(data);
    if (!flat.length) throw new Error('אין טקסט עברי לאגרת הרמב"ן');
    el.className = 'content-text igeret-text';
    el.innerHTML = flat.map((v,i) =>
      `<div class="igeret-section"><div class="sec-num">פסקה ${i+1}</div>${v}</div>`
    ).join('');
    updateDoneButton('igeret', 'igeret');
    console.log(`[Igeret] OK – ${flat.length} sections`);
  } catch(e) {
    console.error('[Igeret] error:', e);
    el.textContent = 'שגיאה בטעינת האגרת: ' + e.message;
  }
}

// ═══════════════════════════════════════════
// DAF YOMI (Babylonian Talmud)
// ═══════════════════════════════════════════
async function loadDafYomi() {
  const el     = document.getElementById('daf-content');
  const subEl  = document.getElementById('daf-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען דף יומי...';
  try {
    console.log('[DafYomi] fetching calendar...');
    const cal  = await fetchWithDelay('https://www.sefaria.org/api/calendars?diaspora=0');
    const item = (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').toLowerCase().includes('daf yomi') ||
      (i.title?.he || '').includes('דף')
    );
    if (!item) throw new Error('לא נמצא דף יומי בלוח');
    console.log('[DafYomi] ref:', item.ref, 'he:', item.heRef);
    subEl.textContent = item.heRef || item.ref;

    const data = await sefariaText(item.ref, 400);
    const flat = heFlat(data);
    if (!flat.length) throw new Error('אין טקסט עברי');
    el.className = 'content-text';
    el.innerHTML = flat.map((v,i) =>
      `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>`
    ).join('');
    updateDoneButton('daf', item.ref);
    console.log(`[DafYomi] OK – ${flat.length} sections`);
  } catch(e) {
    console.error('[DafYomi] error:', e);
    el.textContent = 'שגיאה בטעינת הדף: ' + e.message;
  }
}

// ═══════════════════════════════════════════
// MISHNA YOMI
// ═══════════════════════════════════════════
async function loadMishnaYomi() {
  const el    = document.getElementById('mishna-content');
  const subEl = document.getElementById('mishna-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען משנה יומי...';
  try {
    console.log('[MishnaYomi] fetching calendar...');
    const cal  = await fetchWithDelay('https://www.sefaria.org/api/calendars?diaspora=0');
    const item = (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').toLowerCase().includes('mishnah yomi') ||
      (i.title?.en || '').toLowerCase().includes('mishna yomi') ||
      (i.title?.he || '').includes('משנה יומי')
    );
    if (!item) throw new Error('לא נמצאה משנה יומי בלוח');
    console.log('[MishnaYomi] ref:', item.ref, 'he:', item.heRef);
    subEl.textContent = item.heRef || item.ref;

    const data = await sefariaText(item.ref, 400);
    const flat = heFlat(data);
    if (!flat.length) throw new Error('אין טקסט עברי');
    el.className = 'content-text';
    el.innerHTML = flat.map((v,i) =>
      `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>`
    ).join('');
    updateDoneButton('mishna', item.ref);
    console.log(`[MishnaYomi] OK – ${flat.length} mishnayot`);
  } catch(e) {
    console.error('[MishnaYomi] error:', e);
    el.textContent = 'שגיאה בטעינה: ' + e.message;
  }
}

// ═══════════════════════════════════════════
// 929 – TANACH YOMI
// ═══════════════════════════════════════════
async function loadTanach929() {
  const el    = document.getElementById('tanach-content');
  const subEl = document.getElementById('tanach-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען פרק תנ"ך...';
  try {
    console.log('[929] fetching calendar...');
    const cal  = await fetchWithDelay('https://www.sefaria.org/api/calendars?diaspora=0');
    const item = (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').includes('929') ||
      (i.title?.he || '').includes('929') ||
      (i.title?.en || '').toLowerCase().includes('tanakh')
    );
    if (!item) throw new Error('לא נמצא 929 בלוח');
    console.log('[929] ref:', item.ref, 'he:', item.heRef);
    subEl.textContent = item.heRef || item.ref;

    const data = await sefariaText(item.ref, 400);
    const flat = heFlat(data);
    if (!flat.length) throw new Error('אין טקסט עברי');
    el.className = 'content-text';
    el.innerHTML = flat.map((v,i) =>
      `<div style="margin-bottom:6px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>`
    ).join('');
    updateDoneButton('929', item.ref);
    console.log(`[929] OK – ${flat.length} verses`);
  } catch(e) {
    console.error('[929] error:', e);
    el.textContent = 'שגיאה בטעינה: ' + e.message;
  }
}
