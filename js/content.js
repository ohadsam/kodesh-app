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
let haftaraLoaded = false;
let haftaraVerses = [];  // haftara verses
let _haftaraRef   = null; // Sefaria ref for haftara
let parashaView   = 'text'; // 'text' | 'rashi' | 'onkelos' | 'haftara' | 'sacks'
let currentParashaRef = null;
let _sacksLoaded = false;
let _sacksContent = '';

function setParashaView(mode) {
  parashaView = mode;
  document.getElementById('view-text-btn').classList.toggle('active',    mode === 'text');
  document.getElementById('view-rashi-btn').classList.toggle('active',   mode === 'rashi');
  document.getElementById('view-onkelos-btn').classList.toggle('active', mode === 'onkelos');
  document.getElementById('view-haftara-btn').classList.toggle('active', mode === 'haftara');
  const sacksBtn = document.getElementById('view-sacks-btn');
  if (sacksBtn) sacksBtn.classList.toggle('active', mode === 'sacks');
  renderParasha();
}

function _updateAliyaNav() {
  _renderAliyaNav(document.getElementById('aliya-nav'));
}

function _updateAliyaNavBottom() {
  _renderAliyaNav(document.getElementById('aliya-nav-bottom'));
}

function _renderAliyaNav(nav) {
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

  // Helper: parse verse ref from _aliyaVerseNums[i] → {ch, v}
  const parseRef = (i) => {
    const key = (_aliyaVerseNums && _aliyaVerseNums[i]) || '';
    const m = key.match(/^(\d+):(\d+)$/);
    return m ? { ch: parseInt(m[1]), v: parseInt(m[2]) } : null;
  };
  // Verse label as gematria (verse number within chapter)
  const verseLabel = (i) => {
    const ref = parseRef(i);
    return toGematria(ref ? ref.v : i + 1);
  };
  // Rashi label: "(פרק X פסוק Y)" in gematria
  const rashiLabel = (i) => {
    const ref = parseRef(i);
    if (!ref) return '';
    return `(פרק ${toGematria(ref.ch)} פסוק ${toGematria(ref.v)})`;
  };
  // Chapter header when chapter changes
  const chapterHeader = (i) => {
    const ref = parseRef(i);
    if (!ref) return '';
    const prev = parseRef(i - 1);
    if (i === 0 || (prev && prev.ch !== ref.ch)) {
      return `<div style="text-align:center;margin:14px 0 8px;font-size:11px;` +
        `font-family:'Heebo',sans-serif;color:var(--gold-dim);font-weight:600;` +
        `letter-spacing:1px">— פרק ${toGematria(ref.ch)} —</div>`;
    }
    return '';
  };

  if (parashaView === 'text') {
    el.innerHTML = parashaVerses.map((v,i) =>
      chapterHeader(i) +
      `<div style="margin-bottom:8px">` +
      `<span style="color:var(--gold-dim);font-size:11px">${verseLabel(i)} </span>` +
      `<span style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);line-height:1.85">${v}</span>` +
      `</div>`
    ).join('');

  } else if (parashaView === 'rashi') {
    if (!rashiLoaded) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">⏳ טוען פירוש רש"י...</div>';
      return;
    }
    el.innerHTML = parashaVerses.map((v,i) => {
      const r = rashiVerses[i];
      return chapterHeader(i) +
        `<div style="margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">` +
        `<div style="margin-bottom:5px">` +
        `<span style="color:var(--gold-dim);font-size:11px">${verseLabel(i)} </span>` +
        `<span style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);color:var(--cream);line-height:1.85">${v}</span>` +
        `</div>` +
        (r ? `<div style="padding:7px 10px;background:rgba(201,165,74,.06);border-right:2px solid var(--gold-dim);border-radius:0 6px 6px 0">` +
          `<div style="font-size:10px;color:var(--gold);font-weight:600;margin-bottom:2px">רש"י ` +
          `<span style="color:var(--muted);font-weight:400">${rashiLabel(i)}</span></div>` +
          `<span style="font-family:'Frank Ruhl Libre',serif;font-size:calc(var(--font-size)*.88);color:var(--text);line-height:1.7">${r}</span>` +
          `</div>` : '') +
        `</div>`;
    }).join('');

  } else if (parashaView === 'onkelos') {
    if (!onkelosLoaded) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">⏳ טוען תרגום אונקלוס...</div>';
      return;
    }
    el.innerHTML = parashaVerses.map((v,i) => {
      const o = onkelosVerses[i];
      return chapterHeader(i) +
        `<div style="margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">` +
        `<div style="margin-bottom:5px">` +
        `<span style="color:var(--gold-dim);font-size:11px">${verseLabel(i)} </span>` +
        `<span style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);color:var(--cream);line-height:1.85">${v}</span>` +
        `</div>` +
        (o ? `<div style="padding:7px 10px;background:rgba(42,120,140,.08);border-right:2px solid rgba(42,180,200,.4);border-radius:0 6px 6px 0">` +
          `<div style="font-size:10px;color:rgba(100,200,220,.9);font-weight:600;margin-bottom:2px">אונקלוס</div>` +
          `<span style="font-family:'Frank Ruhl Libre',serif;font-size:calc(var(--font-size)*.88);color:var(--text);line-height:1.7;font-style:italic">${o}</span>` +
          `</div>` : '') +
        `</div>`;
    }).join('');

  } else if (parashaView === 'haftara') {
    if (!haftaraLoaded) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">⏳ טוען הפטרה...</div>';
      return;
    }
    if (!haftaraVerses.length) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">אין נתוני הפטרה</div>';
      return;
    }
    el.innerHTML = `<div style="font-size:11px;color:var(--gold);margin-bottom:10px;font-family:'Heebo',sans-serif">` +
      `📜 הפטרה – ${_haftaraRef || ''}</div>` +
      haftaraVerses.map((v,i) =>
        `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${toGematria(i+1)} </span>` +
        `<span style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);line-height:1.85">${v}</span></div>`
      ).join('');

  } else if (parashaView === 'sacks') {
    if (!_sacksLoaded) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">⏳ טוען מאמר הרב זקס...</div>';
      _loadSacksArticle();
      return;
    }
    if (!_sacksContent) {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">לא נמצא מאמר הרב זקס לפרשה זו</div>';
      return;
    }
    el.innerHTML = `<div style="font-size:12px;color:var(--gold);margin-bottom:10px;font-family:'Heebo',sans-serif;font-weight:700">
      📝 הרב יונתן זקס – שיג ושיח</div>` + _sacksContent;
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

// Rabbi Sacks "Covenant and Conversation" Hebrew – parasha → Sefaria ref component
const SACKS_REFS = {
  'בראשית':'Bereshit','נח':'Noach','לך לך':'Lech_Lecha','וירא':'Vayera',
  'חיי שרה':'Chayei_Sarah','תולדות':'Toldot','ויצא':'Vayeitze','וישלח':'Vayishlach',
  'וישב':'Vayeshev','מקץ':'Miketz','ויגש':'Vayigash','ויחי':'Vayechi',
  'שמות':'Shemot','וארא':'Vaera','בא':'Bo','בשלח':'Beshalach',
  'יתרו':'Yitro','משפטים':'Mishpatim','תרומה':'Terumah','תצוה':'Tetzaveh',
  'כי תשא':'Ki_Tisa','ויקהל':'Vayakhel','פקודי':'Pekudei','ויקרא':'Vayikra',
  'צו':'Tzav','שמיני':'Shmini','תזריע':'Tazria','מצורע':'Metzora',
  'אחרי מות':'Achrei_Mot','קדושים':'Kedoshim','אמור':'Emor','בהר':'Behar',
  'בחוקותי':'Bechukotai','במדבר':'Bamidbar','נשא':'Nasso','בהעלותך':"Beha'alotcha",
  'שלח':"Sh'lach",'קורח':'Korach','חקת':'Chukat','בלק':'Balak',
  'פינחס':'Pinchas','מטות':'Matot','מסעי':'Masei','דברים':'Devarim',
  'ואתחנן':'Vaetchanan','עקב':'Eikev','ראה':'Re_eh','שופטים':'Shoftim',
  'כי תצא':'Ki_Teitzei','כי תבוא':'Ki_Tavo','נצבים':'Nitzavim','וילך':'Vayelech',
  'האזינו':'Haazinu','וזאת הברכה':'Vezot_Habracha',
};

function _getSacksBook(ref) {
  if (ref.startsWith('Genesis'))     return 'Genesis';
  if (ref.startsWith('Exodus'))      return 'Exodus';
  if (ref.startsWith('Leviticus'))   return 'Leviticus';
  if (ref.startsWith('Numbers'))     return 'Numbers';
  if (ref.startsWith('Deuteronomy')) return 'Deuteronomy';
  return '';
}

async function _loadSacksArticle() {
  if (!currentParashaRef) return;
  const parasha = ALL_PARASHIOT.find(p => p.ref === currentParashaRef);
  if (!parasha) { _sacksLoaded = true; _sacksContent = ''; renderParasha(); return; }
  const sacksName = SACKS_REFS[parasha.he];
  if (!sacksName) { _sacksLoaded = true; _sacksContent = ''; renderParasha(); return; }
  
  // Try fetching articles 1, 2, 3 (Sefaria structures each parasha with numbered articles)
  console.log('[Sacks] loading for parasha:', sacksName);
  let allContent = [];
  for (let article = 1; article <= 3; article++) {
    const sacksRef = `Covenant_and_Conversation;_Hebrew_Edition,_${sacksName},_${article}`;
    try {
      const data = await sefariaText(sacksRef, 200);
      const flat = heFlat(data).filter(Boolean);
      if (flat.length) {
        allContent.push(...flat);
        console.log(`[Sacks] article ${article}: ${flat.length} paragraphs`);
      }
    } catch(e) {
      console.log(`[Sacks] article ${article}: not found (${e.message})`);
    }
  }
  
  if (allContent.length) {
    _sacksContent = allContent.map(v =>
      `<p style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);line-height:2;color:var(--cream);margin-bottom:12px;text-align:justify">${v}</p>`
    ).join('');
    console.log('[Sacks] ✅ total', allContent.length, 'paragraphs');
  } else {
    _sacksContent = '';
  }
  _sacksLoaded = true;
  if (parashaView === 'sacks') renderParasha();
}

// ── Static aliyot table for all 54 parshiot ─────────────────────────────────
// Format: [aliya1..7, maftir] – used when Hebcal doesn't have upcoming data
const PARASHA_ALIYOT = {
  'Genesis 1:1-6:8':['Genesis 1:1-2:3','Genesis 2:4-2:19','Genesis 2:20-3:21','Genesis 3:22-4:18','Genesis 4:19-4:22','Genesis 4:23-5:24','Genesis 5:25-6:8','Genesis 6:1-6:8'],
  'Genesis 6:9-11:32':['Genesis 6:9-6:22','Genesis 7:1-7:16','Genesis 7:17-8:14','Genesis 8:15-9:7','Genesis 9:8-9:17','Genesis 9:18-10:32','Genesis 11:1-11:32','Genesis 11:29-11:32'],
  'Genesis 12:1-17:27':['Genesis 12:1-12:13','Genesis 12:14-13:4','Genesis 13:5-13:18','Genesis 14:1-14:20','Genesis 14:21-15:6','Genesis 15:7-17:6','Genesis 17:7-17:27','Genesis 17:24-17:27'],
  'Genesis 18:1-22:24':['Genesis 18:1-18:14','Genesis 18:15-18:33','Genesis 19:1-19:20','Genesis 19:21-21:4','Genesis 21:5-21:21','Genesis 21:22-21:34','Genesis 22:1-22:24','Genesis 22:20-22:24'],
  'Genesis 23:1-25:18':['Genesis 23:1-23:16','Genesis 23:17-24:9','Genesis 24:10-24:26','Genesis 24:27-24:52','Genesis 24:53-24:67','Genesis 25:1-25:11','Genesis 25:12-25:18','Genesis 25:12-25:18'],
  'Genesis 25:19-28:9':['Genesis 25:19-26:5','Genesis 26:6-26:12','Genesis 26:13-26:22','Genesis 26:23-26:29','Genesis 26:30-27:27','Genesis 27:28-28:4','Genesis 28:5-28:9','Genesis 28:5-28:9'],
  'Genesis 28:10-32:3':['Genesis 28:10-28:22','Genesis 29:1-29:17','Genesis 29:18-30:13','Genesis 30:14-30:27','Genesis 30:28-31:16','Genesis 31:17-31:42','Genesis 31:43-32:3','Genesis 31:43-32:3'],
  'Genesis 32:4-36:43':['Genesis 32:4-32:13','Genesis 32:14-32:30','Genesis 32:31-33:5','Genesis 33:6-33:20','Genesis 34:1-35:11','Genesis 35:12-36:19','Genesis 36:20-36:43','Genesis 36:40-36:43'],
  'Genesis 37:1-40:23':['Genesis 37:1-37:11','Genesis 37:12-37:22','Genesis 37:23-37:36','Genesis 38:1-38:30','Genesis 39:1-39:6','Genesis 39:7-40:23','Genesis 39:7-40:23','Genesis 40:20-40:23'],
  'Genesis 41:1-44:17':['Genesis 41:1-41:14','Genesis 41:15-41:38','Genesis 41:39-41:52','Genesis 41:53-42:18','Genesis 42:19-43:15','Genesis 43:16-43:29','Genesis 43:30-44:17','Genesis 44:14-44:17'],
  'Genesis 44:18-47:27':['Genesis 44:18-44:30','Genesis 44:31-45:7','Genesis 45:8-45:18','Genesis 45:19-45:27','Genesis 45:28-46:27','Genesis 46:28-47:10','Genesis 47:11-47:27','Genesis 47:25-47:27'],
  'Genesis 47:28-50:26':['Genesis 47:28-48:9','Genesis 48:10-48:16','Genesis 48:17-48:22','Genesis 49:1-49:18','Genesis 49:19-49:26','Genesis 49:27-50:20','Genesis 50:21-50:26','Genesis 50:23-50:26'],
  'Exodus 1:1-6:1':['Exodus 1:1-1:17','Exodus 1:18-2:10','Exodus 2:11-2:25','Exodus 3:1-3:15','Exodus 3:16-4:17','Exodus 4:18-4:31','Exodus 5:1-6:1','Exodus 5:22-6:1'],
  'Exodus 6:2-9:35':['Exodus 6:2-6:13','Exodus 6:14-6:28','Exodus 6:29-7:7','Exodus 7:8-8:6','Exodus 8:7-8:18','Exodus 8:19-9:16','Exodus 9:17-9:35','Exodus 9:33-9:35'],
  'Exodus 10:1-13:16':['Exodus 10:1-10:11','Exodus 10:12-10:23','Exodus 10:24-11:3','Exodus 11:4-12:20','Exodus 12:21-12:28','Exodus 12:29-12:51','Exodus 13:1-13:16','Exodus 13:14-13:16'],
  'Exodus 13:17-17:16':['Exodus 13:17-14:8','Exodus 14:9-14:14','Exodus 14:15-14:25','Exodus 14:26-15:26','Exodus 15:27-16:10','Exodus 16:11-16:36','Exodus 17:1-17:16','Exodus 17:14-17:16'],
  'Exodus 18:1-20:23':['Exodus 18:1-18:12','Exodus 18:13-18:23','Exodus 18:24-18:27','Exodus 19:1-19:6','Exodus 19:7-19:19','Exodus 19:20-20:14','Exodus 20:15-20:23','Exodus 20:21-20:23'],
  'Exodus 21:1-24:18':['Exodus 21:1-21:19','Exodus 21:20-22:3','Exodus 22:4-22:26','Exodus 22:27-23:5','Exodus 23:6-23:19','Exodus 23:20-24:1','Exodus 24:2-24:18','Exodus 24:15-24:18'],
  'Exodus 25:1-27:19':['Exodus 25:1-25:16','Exodus 25:17-25:30','Exodus 25:31-26:14','Exodus 26:15-26:30','Exodus 26:31-26:37','Exodus 27:1-27:8','Exodus 27:9-27:19','Exodus 27:17-27:19'],
  'Exodus 27:20-30:10':['Exodus 27:20-28:12','Exodus 28:13-28:30','Exodus 28:31-28:43','Exodus 29:1-29:18','Exodus 29:19-29:37','Exodus 29:38-29:46','Exodus 30:1-30:10','Exodus 30:8-30:10'],
  'Exodus 30:11-34:35':['Exodus 30:11-31:17','Exodus 31:18-33:11','Exodus 33:12-33:16','Exodus 33:17-33:23','Exodus 34:1-34:9','Exodus 34:10-34:26','Exodus 34:27-34:35','Exodus 34:33-34:35'],
  'Exodus 35:1-38:20':['Exodus 35:1-35:20','Exodus 35:21-35:29','Exodus 35:30-36:7','Exodus 36:8-36:19','Exodus 36:20-37:16','Exodus 37:17-37:29','Exodus 38:1-38:20','Exodus 38:18-38:20'],
  'Exodus 38:21-40:38':['Exodus 38:21-39:1','Exodus 39:2-39:21','Exodus 39:22-39:32','Exodus 39:33-39:43','Exodus 40:1-40:16','Exodus 40:17-40:27','Exodus 40:28-40:38','Exodus 40:36-40:38'],
  'Leviticus 1:1-5:26':['Leviticus 1:1-1:13','Leviticus 1:14-2:6','Leviticus 2:7-2:16','Leviticus 3:1-3:17','Leviticus 4:1-4:26','Leviticus 4:27-5:10','Leviticus 5:11-5:26','Leviticus 5:24-5:26'],
  'Leviticus 6:1-8:36':['Leviticus 6:1-6:11','Leviticus 6:12-6:23','Leviticus 6:24-7:10','Leviticus 7:11-7:38','Leviticus 8:1-8:13','Leviticus 8:14-8:21','Leviticus 8:22-8:36','Leviticus 8:33-8:36'],
  'Leviticus 9:1-11:47':['Leviticus 9:1-9:16','Leviticus 9:17-9:23','Leviticus 9:24-10:11','Leviticus 10:12-10:15','Leviticus 10:16-10:20','Leviticus 11:1-11:32','Leviticus 11:33-11:47','Leviticus 11:44-11:47'],
  'Leviticus 12:1-13:59':['Leviticus 12:1-12:8','Leviticus 13:1-13:17','Leviticus 13:18-13:28','Leviticus 13:29-13:37','Leviticus 13:38-13:54','Leviticus 13:55-13:59','Leviticus 13:55-13:59','Leviticus 13:55-13:59'],
  'Leviticus 14:1-15:33':['Leviticus 14:1-14:12','Leviticus 14:13-14:20','Leviticus 14:21-14:32','Leviticus 14:33-14:53','Leviticus 14:54-15:15','Leviticus 15:16-15:28','Leviticus 15:29-15:33','Leviticus 15:31-15:33'],
  'Leviticus 16:1-18:30':['Leviticus 16:1-16:17','Leviticus 16:18-16:24','Leviticus 16:25-16:34','Leviticus 17:1-17:7','Leviticus 17:8-17:16','Leviticus 18:1-18:21','Leviticus 18:22-18:30','Leviticus 18:28-18:30'],
  'Leviticus 19:1-20:27':['Leviticus 19:1-19:14','Leviticus 19:15-19:22','Leviticus 19:23-19:32','Leviticus 19:33-19:37','Leviticus 20:1-20:7','Leviticus 20:8-20:22','Leviticus 20:23-20:27','Leviticus 20:25-20:27'],
  'Leviticus 21:1-24:23':['Leviticus 21:1-21:15','Leviticus 21:16-22:16','Leviticus 22:17-22:33','Leviticus 23:1-23:22','Leviticus 23:23-23:32','Leviticus 23:33-24:9','Leviticus 24:10-24:23','Leviticus 24:21-24:23'],
  'Leviticus 25:1-26:2':['Leviticus 25:1-25:13','Leviticus 25:14-25:18','Leviticus 25:19-25:24','Leviticus 25:25-25:28','Leviticus 25:29-25:38','Leviticus 25:39-25:46','Leviticus 25:47-26:2','Leviticus 26:1-26:2'],
  'Leviticus 26:3-27:34':['Leviticus 26:3-26:5','Leviticus 26:6-26:9','Leviticus 26:10-26:46','Leviticus 27:1-27:15','Leviticus 27:16-27:21','Leviticus 27:22-27:28','Leviticus 27:29-27:34','Leviticus 27:32-27:34'],
  'Numbers 1:1-4:20':['Numbers 1:1-1:19','Numbers 1:20-1:54','Numbers 2:1-2:34','Numbers 3:1-3:13','Numbers 3:14-3:39','Numbers 3:40-3:51','Numbers 4:1-4:20','Numbers 4:17-4:20'],
  'Numbers 4:21-7:89':['Numbers 4:21-4:37','Numbers 4:38-4:49','Numbers 5:1-5:10','Numbers 5:11-5:31','Numbers 6:1-6:21','Numbers 6:22-7:11','Numbers 7:12-7:89','Numbers 7:87-7:89'],
  'Numbers 8:1-12:16':['Numbers 8:1-8:14','Numbers 8:15-8:26','Numbers 9:1-9:14','Numbers 9:15-10:10','Numbers 10:11-10:34','Numbers 10:35-11:29','Numbers 11:30-12:16','Numbers 12:14-12:16'],
  'Numbers 13:1-15:41':['Numbers 13:1-13:20','Numbers 13:21-14:7','Numbers 14:8-14:25','Numbers 14:26-15:7','Numbers 15:8-15:16','Numbers 15:17-15:26','Numbers 15:27-15:41','Numbers 15:38-15:41'],
  'Numbers 16:1-18:32':['Numbers 16:1-16:13','Numbers 16:14-16:19','Numbers 16:20-17:8','Numbers 17:9-17:15','Numbers 17:16-17:24','Numbers 17:25-18:20','Numbers 18:21-18:32','Numbers 18:30-18:32'],
  'Numbers 19:1-22:1':['Numbers 19:1-19:17','Numbers 19:18-20:6','Numbers 20:7-20:13','Numbers 20:14-20:21','Numbers 20:22-21:9','Numbers 21:10-21:20','Numbers 21:21-22:1','Numbers 21:34-22:1'],
  'Numbers 22:2-25:9':['Numbers 22:2-22:12','Numbers 22:13-22:20','Numbers 22:21-22:38','Numbers 22:39-23:12','Numbers 23:13-23:26','Numbers 23:27-24:13','Numbers 24:14-25:9','Numbers 25:7-25:9'],
  'Numbers 25:10-30:1':['Numbers 25:10-25:17','Numbers 26:1-26:24','Numbers 26:25-26:51','Numbers 26:52-27:5','Numbers 27:6-27:23','Numbers 28:1-28:15','Numbers 28:16-30:1','Numbers 29:35-30:1'],
  'Numbers 30:2-32:42':['Numbers 30:2-30:17','Numbers 31:1-31:12','Numbers 31:13-31:24','Numbers 31:25-31:41','Numbers 31:42-31:54','Numbers 32:1-32:19','Numbers 32:20-32:42','Numbers 32:39-32:42'],
  'Numbers 33:1-36:13':['Numbers 33:1-33:10','Numbers 33:11-33:49','Numbers 33:50-34:15','Numbers 34:16-34:29','Numbers 35:1-35:8','Numbers 35:9-35:34','Numbers 36:1-36:13','Numbers 36:10-36:13'],
  'Deuteronomy 1:1-3:22':['Deuteronomy 1:1-1:10','Deuteronomy 1:11-1:21','Deuteronomy 1:22-1:38','Deuteronomy 1:39-2:1','Deuteronomy 2:2-2:30','Deuteronomy 2:31-3:14','Deuteronomy 3:15-3:22','Deuteronomy 3:21-3:22'],
  'Deuteronomy 3:23-7:11':['Deuteronomy 3:23-4:4','Deuteronomy 4:5-4:40','Deuteronomy 4:41-4:49','Deuteronomy 5:1-5:18','Deuteronomy 5:19-6:3','Deuteronomy 6:4-6:25','Deuteronomy 7:1-7:11','Deuteronomy 7:9-7:11'],
  'Deuteronomy 7:12-11:25':['Deuteronomy 7:12-7:21','Deuteronomy 7:22-8:10','Deuteronomy 8:11-9:3','Deuteronomy 9:4-9:29','Deuteronomy 10:1-10:11','Deuteronomy 10:12-11:9','Deuteronomy 11:10-11:25','Deuteronomy 11:22-11:25'],
  'Deuteronomy 11:26-16:17':['Deuteronomy 11:26-12:10','Deuteronomy 12:11-12:28','Deuteronomy 12:29-13:19','Deuteronomy 14:1-14:21','Deuteronomy 14:22-14:29','Deuteronomy 15:1-15:18','Deuteronomy 15:19-16:17','Deuteronomy 16:15-16:17'],
  'Deuteronomy 16:18-21:9':['Deuteronomy 16:18-17:13','Deuteronomy 17:14-17:20','Deuteronomy 18:1-18:5','Deuteronomy 18:6-18:13','Deuteronomy 18:14-19:13','Deuteronomy 19:14-20:9','Deuteronomy 20:10-21:9','Deuteronomy 21:7-21:9'],
  'Deuteronomy 21:10-25:19':['Deuteronomy 21:10-21:21','Deuteronomy 21:22-22:7','Deuteronomy 22:8-22:29','Deuteronomy 23:1-23:9','Deuteronomy 23:10-23:26','Deuteronomy 24:1-24:13','Deuteronomy 24:14-25:19','Deuteronomy 25:17-25:19'],
  'Deuteronomy 26:1-29:8':['Deuteronomy 26:1-26:11','Deuteronomy 26:12-26:15','Deuteronomy 26:16-26:19','Deuteronomy 27:1-27:10','Deuteronomy 27:11-28:6','Deuteronomy 28:7-28:69','Deuteronomy 29:1-29:8','Deuteronomy 29:6-29:8'],
  'Deuteronomy 29:9-30:20':['Deuteronomy 29:9-29:11','Deuteronomy 29:12-29:14','Deuteronomy 29:15-29:28','Deuteronomy 30:1-30:6','Deuteronomy 30:7-30:10','Deuteronomy 30:11-30:14','Deuteronomy 30:15-30:20','Deuteronomy 30:18-30:20'],
  'Deuteronomy 31:1-31:30':['Deuteronomy 31:1-31:3','Deuteronomy 31:4-31:6','Deuteronomy 31:7-31:9','Deuteronomy 31:10-31:13','Deuteronomy 31:14-31:19','Deuteronomy 31:20-31:24','Deuteronomy 31:25-31:30','Deuteronomy 31:28-31:30'],
  'Deuteronomy 32:1-32:52':['Deuteronomy 32:1-32:6','Deuteronomy 32:7-32:12','Deuteronomy 32:13-32:18','Deuteronomy 32:19-32:28','Deuteronomy 32:29-32:39','Deuteronomy 32:40-32:43','Deuteronomy 32:44-32:52','Deuteronomy 32:48-32:52'],
  'Deuteronomy 33:1-34:12':['Deuteronomy 33:1-33:7','Deuteronomy 33:8-33:12','Deuteronomy 33:13-33:17','Deuteronomy 33:18-33:21','Deuteronomy 33:22-33:26','Deuteronomy 33:27-33:29','Deuteronomy 34:1-34:12','Deuteronomy 34:10-34:12'],
};

function populateParashaDropdown(currentRef) {
  const sel = document.getElementById('parasha-select');
  if (!sel) return;
  sel.innerHTML = ALL_PARASHIOT.map(p =>
    `<option value="${p.ref}" ${p.ref === currentRef ? 'selected' : ''}>${p.he}</option>`
  ).join('');
}

// ── Helper: build aliya tabs from an aliyot array ─────────────────────────────
function _buildAliyaTabs(tabsEl, aliyotArr) {
  const aliyaNames = ['א','ב','ג','ד','ה','ו','ז','מפטיר'];
  tabsEl.innerHTML = aliyotArr.map((ref, i) =>
    `<div class="aliya-tab${i === 0 ? ' active' : ''}" onclick="showAliya(${i}, this)">${aliyaNames[i] || String(i+1)}</div>`
  ).filter((_, i) => aliyotArr[i]).join('') +
  `<div class="aliya-tab" onclick="showAliya('all', this)">הכל</div>`;
}

async function loadSpecificParasha(ref) {
  if (!ref) return;
  const p = ALL_PARASHIOT.find(x => x.ref === ref);
  if (p) document.getElementById('parasha-name').textContent = p.he;
  const tabsEl   = document.getElementById('aliya-tabs');
  // Hide holiday notice when user manually selects a different parasha
  const noticeEl = document.getElementById('parasha-notice');
  if (noticeEl) noticeEl.style.display = 'none';
  haftaraLoaded = false; haftaraVerses = []; _haftaraRef = null; _sacksLoaded = false; _sacksContent = "";

  // 1. Try static lookup first (instant, always works)
  const staticAliyot = PARASHA_ALIYOT[ref];
  if (staticAliyot) {
    aliyot = staticAliyot.slice(0, 7);
    console.log('[Parasha] static aliyot for', ref, '→', aliyot.length);
  } else {
    // 2. Fallback: try Hebcal 60-day window
    aliyot = [];
    try {
      const ds  = formatDate(getTargetDate());
      const ds2 = formatDate(new Date(getTargetDate().getTime() + 60 * 86400000));
      const hbData = await fetchWithDelay(`https://www.hebcal.com/hebcal?v=1&cfg=json&s=on&start=${ds}&end=${ds2}`);
      const heParasha = p?.he || '';
      const matchEvent = (hbData?.items || []).find(i =>
        i.category === 'parashat' && (
          (i.hebrew || '').includes(heParasha) || heParasha.includes((i.hebrew||'').replace(/פרשת\s*/,''))
        )
      );
      if (matchEvent?.leyning) {
        aliyot = ['1','2','3','4','5','6','7'].map(k => matchEvent.leyning[k]).filter(Boolean).map(r => r.trim());
        // Load haftara from Hebcal
        if (matchEvent.leyning.haftara) _kickoffHaftara(matchEvent.leyning.haftara);
      }
    } catch(e) { console.warn('[Parasha] Hebcal fallback failed:', e.message); }
  }

  // Always try to load haftara (static table fallback if Hebcal didn't provide one)
  if (!_haftaraRef && HAFTARA_REFS[ref]) {
    _kickoffHaftara(HAFTARA_REFS[ref]);
  }

  currentParashaRef = ref;
  currentAliya = 0;
  _buildAliyaTabs(tabsEl, aliyot);

  await loadAliyaText(aliyot[0] || ref);
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
    // Handle combined parshiot like "תזריע-מצורע" / "תזריע-מצרע" (Hebcal spelling varies)
    const clean = heName.replace(/־/g, '-').replace(/פרשת\s*/,'').trim();
    let matchP = ALL_PARASHIOT.find(p => clean === p.he)
      || ALL_PARASHIOT.find(p => heName === p.he || heName === 'פרשת ' + p.he)
      || ALL_PARASHIOT.find(p => clean.length >= 3 && p.he.startsWith(clean) && p.he.length <= clean.length + 2);

    // Combined parsha fallback: "תזריע-מצרע" → match each part with fuzzy matching
    // Normalize Hebrew maqaf (U+05BE ־) to regular hyphen before splitting
    const cleanNorm = clean.replace(/־/g, '-');
    let combinedSecond = null;
    if (!matchP && (cleanNorm.includes('-'))) {
      const parts = cleanNorm.split('-');
      const first  = parts[0].trim();
      const second = parts[1]?.trim();

      // Strip medial vav/yod (matres lectionis) for consonant-based fuzzy match
      // e.g. "מצרע" matches "מצורע", "בחקתי" matches "בחוקותי"
      const stripVowelLetters = s => s ? s.replace(/(?<=[א-ת])[וי](?=[א-ת])/g, '') : '';

      const fuzzyFind = name => {
        if (!name) return null;
        const nc = stripVowelLetters(name);
        return ALL_PARASHIOT.find(p => p.he === name) ||
               ALL_PARASHIOT.find(p => stripVowelLetters(p.he) === nc) ||
               ALL_PARASHIOT.find(p => name.length >= 3 && p.he.startsWith(name.slice(0,3))) ||
               ALL_PARASHIOT.find(p => nc.length >= 3 && stripVowelLetters(p.he).startsWith(nc.slice(0,3)));
      };

      matchP = fuzzyFind(first);
      combinedSecond = fuzzyFind(second);
      console.log('[Parasha] Combined: matched', matchP?.he, '+', combinedSecond?.he);
    }

    if (!matchP) throw new Error('לא נמצאה התאמה לפרשה: ' + heName);

    // For combined parshiot: build combined ref spanning both parshiot
    if (combinedSecond && matchP) {
      const startRef = matchP.ref.split('-')[0]; // e.g. "Leviticus 12:1"
      const endRef   = combinedSecond.ref.split('-')[1]; // e.g. "15:33"
      matchP = { ...matchP, ref: `${startRef}-${endRef}`, he: clean };
      console.log('[Parasha] Combined ref:', matchP.ref);
    }

    document.getElementById('parasha-select').value = matchP.ref;
    // If combined parasha ref isn't in dropdown, add it
    const sel = document.getElementById('parasha-select');
    if (sel && combinedSecond && !Array.from(sel.options).find(o => o.value === matchP.ref)) {
      const opt = document.createElement('option');
      opt.value = matchP.ref;
      opt.textContent = clean; // "תזריע-מצורע"
      opt.selected = true;
      sel.insertBefore(opt, sel.firstChild);
    }

    // Detect combined parshiot (e.g. "Parashat Vayakhel-Pekudei")
    // Hebcal title: "Parashat Vayakhel-Pekudei" / Hebrew: "פרשת ויקהל-פקודי"
    const isCombined = (parashaEvent.title || '').replace(/־/g,'-').includes('-') || (heName || '').replace(/־/g,'-').includes('-');
    if (isCombined) {
      console.log('[Parasha] Combined parsha detected:', heName);
      // nameEl already has the full combined name from Hebcal
    }

    // Handle combined parshiot: Hebcal returns correct aliyot for the combined reading
    // Hebcal leyning format: {"1":"Leviticus 9:1-9:16", "2":..., "M":..., "haftara":"..."}
    const leyning = parashaEvent.leyning || {};
    const hebcalAliyot = ['1','2','3','4','5','6','7','M']
      .map(k => leyning[k])
      .filter(Boolean)
      .map(r => r.trim());

    if (hebcalAliyot.length >= 3) {
      aliyot = hebcalAliyot;
      console.log('[Parasha] using Hebcal aliyot:', aliyot.length, aliyot[0]);
    } else {
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

    // Fallback to static table if nothing found
    if (!aliyot.length && PARASHA_ALIYOT[matchP.ref]) {
      aliyot = PARASHA_ALIYOT[matchP.ref].slice(0, 7);
      console.log('[Parasha] static aliyot fallback:', aliyot.length);
    }

    // Start haftara loading in background
    haftaraLoaded = false; haftaraVerses = []; _haftaraRef = null; _sacksLoaded = false; _sacksContent = "";
    if (leyning.haftara) {
      _kickoffHaftara(leyning.haftara);
    } else if (HAFTARA_REFS[matchP.ref]) {
      _kickoffHaftara(HAFTARA_REFS[matchP.ref]);
    }

    _buildAliyaTabs(tabsEl, aliyot);

    currentParashaRef = matchP.ref;
    currentAliya = 0;
    await loadAliyaText(aliyot[0] || currentParashaRef);
    loadingEl.style.display = 'none';
    updateDoneButton('parasha', currentParashaRef);
  } catch(e) {
    console.error('[Parasha] error:', e?.message || e, e?.stack);
    loadingEl.textContent = 'שגיאה בטעינה: ' + e.message;
  } finally {
    _parashaLoading = false;
  }
}

let _currentAliyaRef = null;  // tracks which ref Rashi/Onkelos are loading for
let _aliyaVerseNums  = [];    // absolute verse numbers (e.g. "21:3") for each parashaVerses index

// ── Haftara loading ─────────────────────────────────────────────────────────
// haftaraRef from Hebcal is like "I Kings 18:46-19:21"
// Sefaria ref uses same format, so we can fetch directly

// Static haftara refs for all 54 parshiot (Ashkenaz minhag, Israel)
const HAFTARA_REFS = {
  'Genesis 1:1-6:8':       'Isaiah 42:5-43:10',
  'Genesis 6:9-11:32':     'Isaiah 54:1-55:5',
  'Genesis 12:1-17:27':    'Isaiah 40:27-41:16',
  'Genesis 18:1-22:24':    'II Kings 4:1-4:37',
  'Genesis 23:1-25:18':    'I Kings 1:1-1:31',
  'Genesis 25:19-28:9':    'Malachi 1:1-2:7',
  'Genesis 28:10-32:3':    'Hosea 12:13-14:10',
  'Genesis 32:4-36:43':    'Obadiah 1:1-1:21',
  'Genesis 37:1-40:23':    'Amos 2:6-3:8',
  'Genesis 41:1-44:17':    'I Kings 3:15-4:1',
  'Genesis 44:18-47:27':   'Ezekiel 37:15-37:28',
  'Genesis 47:28-50:26':   'I Kings 2:1-2:12',
  'Exodus 1:1-6:1':        'Isaiah 27:6-28:13',
  'Exodus 6:2-9:35':       'Ezekiel 28:25-29:21',
  'Exodus 10:1-13:16':     'Jeremiah 46:13-46:28',
  'Exodus 13:17-17:16':    'Judges 4:4-5:31',
  'Exodus 18:1-20:23':     'Isaiah 6:1-7:6',
  'Exodus 21:1-24:18':     'Jeremiah 34:8-34:22',
  'Exodus 25:1-27:19':     'I Kings 5:26-6:13',
  'Exodus 27:20-30:10':    'Ezekiel 43:10-43:27',
  'Exodus 30:11-34:35':    'I Kings 18:1-18:39',
  'Exodus 35:1-38:20':     'I Kings 7:40-7:50',
  'Exodus 38:21-40:38':    'I Kings 7:51-8:21',
  'Leviticus 1:1-5:26':    'Isaiah 43:21-44:23',
  'Leviticus 6:1-8:36':    'Jeremiah 7:21-8:3',
  'Leviticus 9:1-11:47':   'II Samuel 6:1-7:17',
  'Leviticus 12:1-13:59':  'II Kings 4:42-5:19',
  'Leviticus 14:1-15:33':  'II Kings 7:3-7:20',
  'Leviticus 16:1-18:30':  'Ezekiel 22:1-22:19',
  'Leviticus 19:1-20:27':  'Amos 9:7-9:15',
  'Leviticus 21:1-24:23':  'Ezekiel 44:15-44:31',
  'Leviticus 25:1-26:2':   'Jeremiah 32:6-32:27',
  'Leviticus 26:3-27:34':  'Jeremiah 16:19-17:14',
  'Numbers 1:1-4:20':      'Hosea 2:1-2:22',
  'Numbers 4:21-7:89':     'Judges 13:2-13:25',
  'Numbers 8:1-12:16':     'Zechariah 2:14-4:7',
  'Numbers 13:1-15:41':    'Joshua 2:1-2:24',
  'Numbers 16:1-18:32':    'I Samuel 11:14-12:22',
  'Numbers 19:1-22:1':     'Judges 11:1-11:33',
  'Numbers 22:2-25:9':     'Micah 5:6-6:8',
  'Numbers 25:10-30:1':    'I Kings 18:46-19:21',
  'Numbers 30:2-32:42':    'Jeremiah 1:1-2:3',
  'Numbers 33:1-36:13':    'Jeremiah 2:4-2:28',
  'Deuteronomy 1:1-3:22':  'Isaiah 1:1-1:27',
  'Deuteronomy 3:23-7:11': 'Isaiah 40:1-40:26',
  'Deuteronomy 7:12-11:25':'Isaiah 49:14-51:3',
  'Deuteronomy 11:26-16:17':'Isaiah 54:11-55:5',
  'Deuteronomy 16:18-21:9':'Isaiah 51:12-52:12',
  'Deuteronomy 21:10-25:19':'Isaiah 54:1-54:10',
  'Deuteronomy 26:1-29:8': 'Isaiah 60:1-60:22',
  'Deuteronomy 29:9-30:20':'Isaiah 61:10-63:9',
  'Deuteronomy 31:1-31:30':'Hosea 14:2-14:10',
  'Deuteronomy 32:1-32:52':'II Samuel 22:1-22:51',
  'Deuteronomy 33:1-34:12':'Joshua 1:1-1:18',
};

async function _kickoffHaftara(haftaraRef) {
  if (!haftaraRef) return;
  // Normalize: Hebcal may return "I Kings 18:46 - 19:21" with spaces around dash
  const normalRef = haftaraRef.replace(/\s*-\s*/g, '-').trim();
  _haftaraRef = normalRef;
  haftaraLoaded = false;
  haftaraVerses = [];
  console.log('[Haftara] loading:', normalRef);
  try {
    const data = await sefariaText(normalRef, 200);
    const flat = heFlat(data);
    if (flat.length) {
      haftaraVerses = flat;
      console.log('[Haftara] ✅', flat.length, 'verses');
    } else {
      // Try splitting multi-chapter refs: "I Kings 18:46-19:21" → fetch each chapter
      const multiMatch = normalRef.match(/^(.+?)\s+(\d+):(\d+)-(\d+):(\d+)$/);
      if (multiMatch) {
        const [, book, ch1, v1, ch2, v2] = multiMatch;
        console.log('[Haftara] trying split chapters:', book, ch1, v1, ch2, v2);
        const allVerses = [];
        for (let ch = parseInt(ch1); ch <= parseInt(ch2); ch++) {
          const startV = ch === parseInt(ch1) ? parseInt(v1) : 1;
          const endV   = ch === parseInt(ch2) ? parseInt(v2) : 999;
          const chRef  = `${book} ${ch}`;
          try {
            const chData = await sefariaText(chRef, 100);
            const chFlat = heFlat(chData);
            // Slice to requested verses (1-indexed)
            const sliced = chFlat.slice(startV - 1, endV === 999 ? chFlat.length : endV);
            allVerses.push(...sliced);
          } catch(e2) { console.warn('[Haftara] chapter fetch failed:', chRef, e2.message); }
        }
        if (allVerses.length) {
          haftaraVerses = allVerses;
          console.log('[Haftara] ✅ multi-chapter fallback:', allVerses.length, 'verses');
        }
      }
      if (!haftaraVerses.length) {
        // Last resort: try the first chapter ref only
        const bookOnly = normalRef.replace(/\s+\d+:.*$/, '');
        const chMatch = normalRef.match(/(\d+):/);
        if (chMatch) {
          const singleChRef = `${bookOnly} ${chMatch[1]}`;
          console.warn('[Haftara] trying single chapter:', singleChRef);
          const data2 = await sefariaText(singleChRef, 200);
          haftaraVerses = heFlat(data2);
          if (haftaraVerses.length) console.log('[Haftara] ✅ single chapter fallback:', haftaraVerses.length);
        }
      }
    }
  } catch(e) {
    console.warn('[Haftara] failed:', e.message);
  }
  haftaraLoaded = true;
  if (parashaView === 'haftara') renderParasha();
}


// Compute absolute verse numbers from a Sefaria ref like "Leviticus 21:1-21:15"
// Returns array like ["21:1","21:2",...] matching parashaVerses length
function _computeVerseNums(ref, count) {
  const nums = new Array(count).fill('');
  // Match ref like "Book CH:V-CH2:V2" or "Book CH:V"
  const m = ref.match(/([A-Za-z\s]+)\s+(\d+):(\d+)(?:-(\d+):(\d+))?/);
  if (!m) return nums;
  const startCh = parseInt(m[2]), startV = parseInt(m[3]);
  // For single-chapter refs (no second ch:v): just number from startV
  if (!m[4]) {
    for (let i = 0; i < count; i++) nums[i] = `${startCh}:${startV + i}`;
    return nums;
  }
  // Multi-chapter: we don't know exact chapter lengths without API data
  // Use a best-effort sequential fill starting at startCh:startV
  // This will be overwritten with accurate data when Rashi loads
  let ch = startCh, v = startV, idx = 0;
  while (idx < count) {
    nums[idx] = `${ch}:${v}`;
    v++; idx++;
    // Rough chapter size estimate - will be corrected by Rashi loader
    // Most Torah chapters: 20-60 verses
  }
  return nums;
}

async function loadAliyaText(ref) {
  const loadingEl = document.getElementById('parasha-loading');
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'טוען...';
  document.getElementById('parasha-content').innerHTML = '';
  // Scroll to top when changing aliya
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const page = document.getElementById('page-parasha');
  if (page) page.scrollTop = 0;
  parashaVerses = []; rashiVerses = []; onkelosVerses = []; _aliyaVerseNums = [];
  rashiLoaded = false; onkelosLoaded = false;
  _rashiLoading = false;   // cancel any in-progress Rashi load
  _onkelosLoading = false; // cancel any in-progress Onkelos load
  _currentAliyaRef = ref;  // track so callbacks can check if still relevant

  try {
    console.log('[Parasha] loading text for ref:', ref);
    const data = await sefariaText(ref);
    if (_currentAliyaRef !== ref) return; // aliya changed while loading
    parashaVerses = heFlat(data);
    console.log(`[Parasha] got ${parashaVerses.length} verses`);
    if (!parashaVerses.length) throw new Error('no Hebrew verses returned');

    // Populate _aliyaVerseNums immediately from the ref string
    // so chapter headers show in text view before Rashi loads
    _aliyaVerseNums = _computeVerseNums(ref, parashaVerses.length);

    // Pre-load Rashi and Onkelos in background (they check _currentAliyaRef)
    loadRashiForRef(ref);
    loadOnkelosForRef(ref);

    loadingEl.style.display = 'none';
    _updateAliyaNav();
    _updateAliyaNavBottom(); // update bottom nav too
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
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
        else await new Promise(r => setTimeout(r, 300));

        // Strategy 1: Try Rashi-specific endpoint (much smaller response)
        // Sefaria: "Rashi on Genesis 1" returns just Rashi, not all commentaries
        const rashiRef = `Rashi on ${book} ${ch}`;
        let rashiData = null;
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 20000); // 20s timeout
          const rashiUrl = `https://www.sefaria.org/api/texts/${encodeURI(rashiRef)}?lang=he&commentary=0&context=0`;
          console.log('[Rashi] trying direct:', rashiRef);
          const rashiResp = await fetch(rashiUrl, { signal: ctrl.signal });
          clearTimeout(timer);
          if (rashiResp.ok) {
            rashiData = await rashiResp.json();
          }
        } catch(e2) {
          console.warn('[Rashi] direct endpoint failed for ch', ch, ':', e2.message);
        }

        if (rashiData && rashiData.he) {
          // Direct Rashi endpoint: data.he structure varies:
          // Simple: data.he[verseIdx] = [comment1, comment2, ...]
          // Nested: data.he = [[verse1_comments], [verse2_comments], ...] (extra nesting)
          // Deep:   data.he = [[[comments]], [[comments]], ...] (double-nested per verse)
          let heArr = rashiData.he;
          
          // Detect extra nesting: if heArr[0] is an array of arrays, we may need to unwrap
          // The correct structure should be: heArr[verseIdx] = array of strings/HTML
          // If heArr[0][0] is also an array, we have double nesting
          if (Array.isArray(heArr) && heArr.length > 0) {
            // Check if it's doubly nested (heArr is [[verse_comments...], ...] where verse_comments are arrays)
            const sample = heArr[0];
            if (Array.isArray(sample) && sample.length > 0 && Array.isArray(sample[0]) && 
                typeof sample[0][0] !== 'string') {
              // Triple nested - flatten one level
              console.log('[Rashi] detected triple-nested structure, flattening');
              heArr = deepFlat(heArr);
            }
          }
          
          chapterLengths[ch] = Array.isArray(heArr) ? heArr.length : 0;
          const chapLen = chapterLengths[ch];
          // Check if structure is per-verse (each element should be array of strings, not a single string)
          const firstElem = heArr[0];
          const isPerVerse = chapLen >= 2 && (Array.isArray(firstElem) || typeof firstElem !== 'string');
          console.log('[Rashi] ch', ch, 'heArr structure: length=', chapLen, 'sample type:', typeof firstElem, Array.isArray(firstElem) ? 'array('+firstElem.length+')' : '');
          
          // If structure is not per-verse (too short or single string), fall to strategy 2
          if (!isPerVerse) {
            console.warn('[Rashi] ch', ch, 'chapLen too low (', chapLen, '), trying commentary=1 fallback');
            // Don't set success - fall through to strategy 2
          } else {
            let chEntries = 0;
            for (let v = 0; v < chapLen; v++) {
              const vNum = v + 1;
              if (ch === startCh && vNum < startV) continue;
              if (ch === endCh   && vNum > endV)   continue;
              const key = `${ch}:${vNum}`;
              let verseRashi = heArr[v];
              if (!verseRashi) continue;
              const rawTexts = Array.isArray(verseRashi) ? deepFlat(verseRashi).filter(Boolean) : [verseRashi];
              if (!rawTexts.length) continue;
              const cleaned = rawTexts.map(t => 
                typeof t === 'string' ? t.replace(/<(?!\/?(?:b|i|strong)\b)[^>]+>/gi,'').trim() : ''
              ).filter(Boolean);
              if (cleaned.length) {
                if (!verseMap.has(key)) verseMap.set(key, []);
                verseMap.get(key).push(cleaned.join('<br><br>'));
                chEntries++;
              }
            }
            console.log('[Rashi] ch', ch, 'direct OK, chapLen:', chapLen, '| entries:', chEntries, '| total:', verseMap.size);
            success = true;
            continue;
          }
        }

        // Strategy 2: "Rashi on Book Chapter:1-N" range ref — returns per-verse structure
        // Use a chapter length estimate (Torah chapters rarely exceed 60 verses)
        const chEnd = ch === endCh ? endV : 60;
        const chStart = ch === startCh ? startV : 1;
        const rangeRef = `Rashi on ${book} ${ch}:${chStart}-${ch}:${chEnd}`;
        try {
          const ctrl2 = new AbortController();
          const timer2 = setTimeout(() => ctrl2.abort(), 20000);
          const url2 = `https://www.sefaria.org/api/texts/${encodeURI(rangeRef)}?lang=he&commentary=0&context=0`;
          console.log('[Rashi] trying range ref:', rangeRef);
          const resp2 = await fetch(url2, { signal: ctrl2.signal });
          clearTimeout(timer2);
          if (resp2.ok) {
            const data2 = await resp2.json();
            let heArr2 = data2.he;
            if (heArr2 && Array.isArray(heArr2) && heArr2.length >= 2) {
              // Range ref returns array indexed from chStart
              heArr2.forEach((verseRashi, idx) => {
                const vNum = chStart + idx;
                if (vNum > chEnd) return;
                if (ch === endCh && vNum > endV) return;
                const key = `${ch}:${vNum}`;
                const rawTexts = Array.isArray(verseRashi)
                  ? deepFlat(verseRashi).filter(Boolean)
                  : (verseRashi ? [verseRashi] : []);
                const cleaned = rawTexts.map(t =>
                  typeof t === 'string' ? t.replace(/<(?!\/?(?:b|i|strong)\b)[^>]+>/gi,'').trim() : ''
                ).filter(Boolean);
                if (cleaned.length) {
                  if (!verseMap.has(key)) verseMap.set(key, []);
                  verseMap.get(key).push(cleaned.join('<br><br>'));
                }
              });
              const chEntries = [...verseMap.keys()].filter(k => k.startsWith(ch+':')).length;
              console.log('[Rashi] range ref OK, ch', ch, '| entries:', chEntries);
              // Fix: update chapterLengths so the final mapping loop uses correct lastV
              // Use the max verse number found, or chEnd (whichever is larger)
              const maxVerseFound = heArr2.length > 0 ? chStart + heArr2.length - 1 : chEnd;
              chapterLengths[ch] = Math.max(chapterLengths[ch] || 0, maxVerseFound, chEnd);
              success = true;
            }
          }
        } catch(e2) {
          console.warn('[Rashi] range ref failed for ch', ch, ':', e2.message);
        }
        if (success) continue;

        // Strategy 3 fallback: commentary=1 (large response, last resort)
        const ctrl3 = new AbortController();
        const timer3 = setTimeout(() => ctrl3.abort(), 35000);
        const url = `https://www.sefaria.org/api/texts/${encodeURI(book + ' ' + ch)}?lang=he&commentary=1&context=0`;
        const resp = await fetch(url, { signal: ctrl3.signal });
        clearTimeout(timer3);
        if (!resp.ok) {
          console.warn('[Rashi] ch', ch, 'attempt', attempt+1, 'HTTP', resp.status);
          continue;
        }
        const data = await resp.json();

        chapterLengths[ch] = Array.isArray(data.he) ? data.he.length : 999;
        const chapLen = chapterLengths[ch];

        (data?.commentary || [])
          .filter(c => c.collectiveTitle?.en === 'Rashi' || (c.ref||'').startsWith('Rashi on'))
          .forEach(c => {
            const vm = (c.ref||'').match(/(\d+):(\d+)/);
            if (!vm) return;
            const cCh = parseInt(vm[1]), cV = parseInt(vm[2]);
            if (cCh !== ch) return;
            if (cV < 1 || cV > chapLen) return;
            if (cCh === startCh && cV < startV) return;
            if (cCh === endCh   && cV > endV)   return;
            const key = `${cCh}:${cV}`;
            let txt = Array.isArray(c.he) ? deepFlat(c.he).filter(Boolean).join(' ') : (c.he||'');
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

  // Map Rashi to verse indices
  // Don't rely on chapterLengths from Rashi endpoint (can differ from Torah)
  // Instead, iterate exactly the verse range we need
  rashiVerses      = new Array(parashaVerses.length).fill('');
  _aliyaVerseNums  = new Array(parashaVerses.length).fill('');
  let idx = 0;
  for (let ch = startCh; ch <= endCh; ch++) {
    const firstV   = (ch === startCh) ? startV : 1;
    const lastV    = (ch === endCh) ? endV : (chapterLengths[ch] || 200);
    for (let v = firstV; v <= lastV; v++) {
      if (idx >= parashaVerses.length) break;
      const key = `${ch}:${v}`;
      _aliyaVerseNums[idx] = key;   // store absolute verse ref
      if (verseMap.has(key)) {
        rashiVerses[idx] = verseMap.get(key).join('<br><br>');
      }
      idx++;
    }
  }
  console.log('[Rashi] mapping done: idx reached', idx, '| parashaVerses:', parashaVerses.length, '| verseMap keys:', [...verseMap.keys()].join(','));

  rashiLoaded    = true;
  _rashiLoading  = false;
  if (_currentAliyaRef !== torahRef) {
    console.log('[Rashi] discarding - aliya changed while loading');
    return;
  }
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
  if (_currentAliyaRef !== torahRef) {
    console.log('[Onkelos] discarding - aliya changed while loading');
    return;
  }
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
let _dafRef = null;
let _dafView = 'text'; // 'text' | 'rashi' | 'tosafot' | 'rashi_tosafot' | 'steinsaltz'
let _dafFlat  = [];
let _dafRashiFlat   = null; // cached per daf
let _dafTosafotFlat = null;

// Build Sefaria Calendars API URL with the current target date for day navigation support
function _sefariaCalendarUrl() {
  const d = getTargetDate();
  return `https://www.sefaria.org/api/calendars?diaspora=0&year=${d.getFullYear()}&month=${d.getMonth()+1}&day=${d.getDate()}`;
}

async function loadDafYomi() {
  const el     = document.getElementById('daf-content');
  const subEl  = document.getElementById('daf-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען דף יומי...';
  _dafView = 'text';
  _dafRashiFlat   = null;  // reset cache for new daf
  _dafTosafotFlat = null;
  try {
    console.log('[DafYomi] fetching calendar...');
    const cal  = await fetchWithDelay(_sefariaCalendarUrl());
    const item = (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').toLowerCase().includes('daf yomi') ||
      (i.title?.he || '').includes('דף')
    );
    if (!item) throw new Error('לא נמצא דף יומי בלוח');
    _dafRef = item.ref;
    console.log('[DafYomi] ref:', item.ref, 'he:', item.heRef);
    subEl.textContent = item.heRef || item.ref;

    const data = await sefariaText(item.ref, 400);
    _dafFlat = heFlat(data);
    if (!_dafFlat.length) throw new Error('אין טקסט עברי');

    // Add commentary buttons
    _renderDafButtons();
    _renderDafContent();
    updateDoneButton('daf', item.ref);
    console.log(`[DafYomi] OK – ${_dafFlat.length} sections`);
  } catch(e) {
    console.error('[DafYomi] error:', e);
    el.textContent = 'שגיאה בטעינת הדף: ' + e.message;
  }
}

function _renderDafButtons() {
  const btnWrap = document.getElementById('daf-view-buttons');
  if (!btnWrap) return;
  btnWrap.innerHTML = `
    <div class="aliya-tab ${_dafView==='text'?'active':''}" onclick="switchDafView('text')">📖 גמרא</div>
    <div class="aliya-tab ${_dafView==='rashi'?'active':''}" onclick="switchDafView('rashi')">📝 + רש"י</div>
    <div class="aliya-tab ${_dafView==='tosafot'?'active':''}" onclick="switchDafView('tosafot')">📋 + תוספות</div>
    <div class="aliya-tab ${_dafView==='rashi_tosafot'?'active':''}" onclick="switchDafView('rashi_tosafot')">📝📋 רש"י + תוס'</div>
    <div class="aliya-tab ${_dafView==='steinsaltz'?'active':''}" onclick="switchDafView('steinsaltz')">📚 שטיינזלץ</div>
  `;
}

// Fetch and cache a Daf commentary type
const _dafLinksCache = {}; // cache links per daf ref

async function _fetchDafCommentary(type) {
  const cached = type === 'rashi' ? _dafRashiFlat : _dafTosafotFlat;
  if (cached) return cached;

  // Use /api/links/ to get ALL Rashi/Tosafot for the daf at once
  // This is the only reliable way - text API returns only line 1
  const linkRef = _dafRef.trim();
  const collectiveTitle = type === 'rashi' ? 'Rashi' : 'Tosafot';

  // Cache links per daf (shared between rashi + tosafot calls)
  if (!_dafLinksCache[linkRef]) {
    const url = 'https://www.sefaria.org/api/links/' + encodeURI(linkRef) + '?with_text=1&lang=he';
    console.log('[DafComm] fetching links:', url);
    await new Promise(function(r){ setTimeout(r, 200); });
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _dafLinksCache[linkRef] = await resp.json();
    console.log('[DafComm] total links:', _dafLinksCache[linkRef].length);
  }
  const links = _dafLinksCache[linkRef];

  // Filter to this commentary type
  const items = links.filter(function(l) {
    const ct = l.collectiveTitle && (l.collectiveTitle.en || '');
    return ct === collectiveTitle && l.category === 'Commentary';
  });
  console.log('[DafComm]', type, '| items:', items.length);

  // Determine which amud we're viewing:
  // _dafRef can be "Chullin 2" (daily, defaults to 2a)
  //                "Chullin.2a" or "Chullin.2b" (pick mode)
  //                "Berakhot.5a" etc.
  const amudMatch = _dafRef.match(/(\d+)([ab])$/i);
  const currentAmud = amudMatch ? amudMatch[2].toLowerCase() : 'a'; // default to 'a'
  const dafNum = amudMatch ? amudMatch[1] : (_dafRef.match(/(\d+)$/) || [])[1] || '';
  console.log('[DafComm] currentAmud:', currentAmud, '| dafNum:', dafNum);

  const totalLines = _dafFlat ? _dafFlat.length : 100;
  const perLine = new Array(totalLines).fill(null);

  items.forEach(function(item) {
    const anchorRef = item.anchorRef || '';
    // anchorRef format: "Tractate DAFa:LINE" e.g. "Chullin 2a:3"
    // Extract amud and line: match "Na:N" or "Nb:N" at end
    const am = anchorRef.match(/(\d+)([ab]):(\d+)(?:-\d+)?$/i);
    if (!am) return;
    const itemAmud = am[2].toLowerCase();
    const lineNum  = parseInt(am[3]); // 1-based line within this amud

    // Only process links matching our current amud
    if (itemAmud !== currentAmud) return;

    const idx = lineNum - 1; // 0-based
    if (idx < 0 || idx >= totalLines) return;

    const he = item.he;
    var text = '';
    if (typeof he === 'string') {
      text = he;
    } else if (Array.isArray(he)) {
      text = deepFlat(he).filter(Boolean).join('<br>');
    }
    text = text.replace(/<[^>]+>/g, '').trim();
    if (!text) return;

    if (!perLine[idx]) perLine[idx] = [];
    perLine[idx].push(text);
  });

  const withComment = perLine.filter(function(x){ return x && x.length; }).length;
  console.log('[DafComm]', type, '| lines with comment:', withComment, '/ ', totalLines);

  if (type === 'rashi') _dafRashiFlat = perLine;
  else _dafTosafotFlat = perLine;
  return perLine;
}

// Render gemara with optional rashi (green) and tosafot (blue) inline
function _renderDafInline(rashiFlat, tosafotFlat) {
  return _dafFlat.map((v, i) => {
    let extras = '';
    if (rashiFlat && rashiFlat[i] &&
        (Array.isArray(rashiFlat[i]) ? rashiFlat[i].length : rashiFlat[i])) {
      const raw = rashiFlat[i];
      const t = typeof raw === 'string' ? raw
        : (Array.isArray(raw) ? deepFlat(raw).filter(Boolean)
            .map(function(s){ return s.replace(/<(?!\/?(b|i|strong))[^>]+>/gi,'').trim(); })
            .filter(Boolean).join('<br>') : '');
      if (t) extras += `<div style="margin-top:5px;padding:4px 9px;
        background:rgba(126,214,160,.08);border-right:2px solid var(--addition);
        border-radius:0 4px 4px 0;color:var(--addition);
        font-size:calc(var(--font-size)*0.83);font-style:italic;line-height:1.75">
        <span style="font-size:9px;font-weight:700;margin-left:5px;opacity:.85">📝 רש"י</span>${t.replace(/<[^>]+>/g,'')}</div>`;
    }
    if (tosafotFlat && tosafotFlat[i] &&
        (Array.isArray(tosafotFlat[i]) ? tosafotFlat[i].length : tosafotFlat[i])) {
      const raw = tosafotFlat[i];
      const t = typeof raw === 'string' ? raw
        : (Array.isArray(raw) ? deepFlat(raw).filter(Boolean)
            .map(function(s){ return s.replace(/<(?!\/?(b|i|strong))[^>]+>/gi,'').trim(); })
            .filter(Boolean).join('<br>') : '');
      if (t) extras += `<div style="margin-top:5px;padding:4px 9px;
        background:rgba(122,184,214,.08);border-right:2px solid #7ab8d6;
        border-radius:0 4px 4px 0;color:#7ab8d6;
        font-size:calc(var(--font-size)*0.83);font-style:italic;line-height:1.75">
        <span style="font-size:9px;font-weight:700;margin-left:5px;opacity:.85">📋 תוספות</span>${t.replace(/<[^>]+>/g,'')}</div>`;
    }
    return `<div style="margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.04)">
      <span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}${extras}
    </div>`;
  }).join('');
}

async function switchDafView(view) {
  _dafView = view;
  _renderDafButtons();
  const el = document.getElementById('daf-content');
  if (view === 'text') { _renderDafContent(); return; }
  if (!_dafRef) return;
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">⏳ טוען פירוש...</div>';
  try {
    el.className = 'content-text';
    if (view === 'rashi') {
      const flat = await _fetchDafCommentary('rashi');
      if (!flat.length) throw new Error('אין רש"י זמין');
      el.innerHTML = _renderDafInline(flat, null);
    } else if (view === 'tosafot') {
      const flat = await _fetchDafCommentary('tosafot');
      if (!flat.length) throw new Error('אין תוספות זמין');
      el.innerHTML = _renderDafInline(null, flat);
    } else if (view === 'rashi_tosafot') {
      const [r, t] = await Promise.all([
        _fetchDafCommentary('rashi').catch(() => []),
        _fetchDafCommentary('tosafot').catch(() => []),
      ]);
      if (!r.length && !t.length) throw new Error('אין רש"י ותוספות זמין');
      el.innerHTML = _renderDafInline(r, t);
    } else if (view === 'steinsaltz') {
      // Convert ref format for commentary: "Bava_Metzia.4b" → "Bava Metzia 4b"
      const steinsaltzCommentRef = _dafRef.replace(/_/g, ' ').replace(/\.(?=[0-9])/, ' ');
      const data = await sefariaText(`Steinsaltz on ${steinsaltzCommentRef}`, 300);
      const flat = heFlat(data).filter(Boolean);
      if (!flat.length) throw new Error('אין שטיינזלץ זמין');
      el.innerHTML = flat.map((v,i) =>
        `<div style="margin-bottom:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:var(--gold-dim);font-size:11px">${i+1} </span><span style="line-height:1.85">${v}</span>
        </div>`
      ).join('');
    }
    console.log(`[DafYomi] ${view} rendered`);
  } catch(e) {
    console.warn('[DafYomi] commentary error:', e.message);
    el.innerHTML = `<div style="color:var(--muted);text-align:center;padding:20px">⚠️ ${e.message}</div>`;
  }
}

function _renderDafContent() {
  const el = document.getElementById('daf-content');
  el.className = 'content-text';
  el.innerHTML = _dafFlat.map((v,i) =>
    `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>`
  ).join('');
}

// ═══════════════════════════════════════════
// MISHNA YOMI
// ═══════════════════════════════════════════
let _mishnaRef = null;
let _mishnaView = 'text'; // 'text' | 'bartenura' | 'steinsaltz'
let _mishnaFlat = [];

async function loadMishnaYomi() {
  const el    = document.getElementById('mishna-content');
  const subEl = document.getElementById('mishna-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען משנה יומי...';
  _mishnaView = 'text';
  try {
    console.log('[MishnaYomi] fetching calendar...');
    const cal  = await fetchWithDelay(_sefariaCalendarUrl());
    const item = (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').toLowerCase().includes('mishnah yomi') ||
      (i.title?.en || '').toLowerCase().includes('mishna yomi') ||
      (i.title?.he || '').includes('משנה יומי')
    );
    if (!item) throw new Error('לא נמצאה משנה יומי בלוח');
    _mishnaRef = item.ref;
    console.log('[MishnaYomi] ref:', item.ref, 'he:', item.heRef);
    subEl.textContent = item.heRef || item.ref;

    const data = await sefariaText(item.ref, 400);
    _mishnaFlat = heFlat(data);
    if (!_mishnaFlat.length) throw new Error('אין טקסט עברי');

    _renderMishnaButtons();
    _renderMishnaContent();
    updateDoneButton('mishna', item.ref);
    console.log(`[MishnaYomi] OK – ${_mishnaFlat.length} mishnayot`);
  } catch(e) {
    console.error('[MishnaYomi] error:', e);
    el.textContent = 'שגיאה בטעינה: ' + e.message;
  }
}

function _renderMishnaButtons() {
  const btnWrap = document.getElementById('mishna-view-buttons');
  if (!btnWrap) return;
  btnWrap.innerHTML = `
    <div class="aliya-tab ${_mishnaView==='text'?'active':''}" onclick="switchMishnaView('text')">📖 משנה</div>
    <div class="aliya-tab ${_mishnaView==='bartenura'?'active':''}" onclick="switchMishnaView('bartenura')">📝 משנה + ברטנורא</div>
  `;
}

async function switchMishnaView(view) {
  _mishnaView = view;
  _renderMishnaButtons();
  const el = document.getElementById('mishna-content');
  if (view === 'text') { _renderMishnaContent(); return; }

  if (!_mishnaRef) return;
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">⏳ טוען פירוש...</div>';

  try {
    const commentaryRef = `Bartenura on ${_mishnaRef}`;
    console.log(`[MishnaYomi] loading commentary: ${commentaryRef}`);
    const data = await sefariaText(commentaryRef, 300);
    const he = data?.he;

    console.log('[MishnaYomi] Bartenura he type:', Array.isArray(he)?'array':typeof he,
                '| length:', Array.isArray(he)?he.length:'N/A',
                '| _mishnaFlat:', _mishnaFlat.length);

    if (!Array.isArray(he) || !he.length) throw new Error('אין פירוש ברטנורא זמין');

    // Parse Bartenura entries: each has bold keyword + explanation
    const btEntries = he.map((entry, i) => {
      if (!entry) return null;
      const raw = Array.isArray(entry)
        ? deepFlat(entry).filter(Boolean).join(' ')
        : String(entry);
      const kwMatch = raw.match(/<b>([\s\S]*?)<\/b>/);
      const keyword = kwMatch ? kwMatch[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim() : '';
      const text = raw.replace(/<b>/g,'**').replace(/<\/b>/g,'**').replace(/<[^>]+>/g,'').trim();
      console.log(`[MishnaYomi] bt[${i}] keyword="${keyword.slice(0,30)}" text="${text.slice(0,60)}"`);
      return { keyword, text };
    }).filter(Boolean);

    // Match each Bartenura entry to the mishna segment containing its keyword
    const stripN = s => s.replace(/[\u0591-\u05C7]/g,'').replace(/\s+/g,' ').trim();
    const mishnaStripped = _mishnaFlat.map(v => stripN(v.replace(/<[^>]+>/g,'')));

    const segTobt = {};
    btEntries.forEach(bt => {
      const kw = stripN(bt.keyword);
      if (!kw) return;
      let bestIdx = -1;
      for (let i = 0; i < mishnaStripped.length; i++) {
        if (mishnaStripped[i].includes(kw)) { bestIdx = i; break; }
      }
      if (bestIdx < 0 && kw.length >= 3) {
        const partial = kw.slice(0,4);
        for (let i = 0; i < mishnaStripped.length; i++) {
          if (mishnaStripped[i].includes(partial)) { bestIdx = i; break; }
        }
      }
      if (bestIdx >= 0) {
        if (!segTobt[bestIdx]) segTobt[bestIdx] = [];
        segTobt[bestIdx].push(bt.text);
      }
    });

    el.className = 'content-text';
    el.innerHTML = _mishnaFlat.map((v, i) => {
      const matched = segTobt[i] || [];
      const bartHtml = matched.length
        ? `<div style="margin-top:6px;padding:5px 10px;
            background:rgba(122,184,214,.07);
            border-right:2px solid #7ab8d6;border-radius:0 5px 5px 0;
            color:#7ab8d6;font-size:calc(var(--font-size)*0.84);
            font-style:italic;line-height:1.8">
            <span style="font-size:9px;font-weight:700;display:block;margin-bottom:2px;opacity:.8">📝 ברטנורא</span>
            ${matched.map(t => t.replace(/\*\*([^*]+)\*\*/g,'<strong style="color:var(--cream);font-style:normal">$1</strong> —')).join('<br>')}
          </div>`
        : '';
      return `<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}${bartHtml}
      </div>`;
    }).join('');
    console.log(`[MishnaYomi] bartenura matched: ${Object.keys(segTobt).length} of ${_mishnaFlat.length} segments`);
  } catch(e) {
    console.warn('[MishnaYomi] commentary error:', e.message);
    el.innerHTML = `<div style="color:var(--muted);text-align:center;padding:20px">⚠️ ${e.message}</div>`;
  }
}

function _renderMishnaContent() {
  const el = document.getElementById('mishna-content');
  console.log('[renderMishna] _mishnaFlat:', typeof _mishnaFlat, Array.isArray(_mishnaFlat), _mishnaFlat?.length);
  el.className = 'content-text';
  el.innerHTML = _mishnaFlat.map((v,i) =>
    `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>`
  ).join('');
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
    const cal  = await fetchWithDelay(_sefariaCalendarUrl());
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

// ═══════════════════════════════════════════
// RAMBAM YOMI
// ═══════════════════════════════════════════
let _rambamRef = null;
let _rambamView = 'text';
let _rambamFlat = [];

async function loadRambamYomi() {
  const el    = document.getElementById('rambam-content');
  const subEl = document.getElementById('rambam-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען רמב"ם יומי...';
  _rambamView = 'text';
  // Store all chapter refs for Steinsaltz fetching
  window._rambamChapterRefs = [];
  try {
    console.log('[RambamYomi] fetching calendar...');
    const cal = await fetchWithDelay(_sefariaCalendarUrl());
    const item = (cal?.calendar_items || []).find(i =>
      (i.title?.en || '').toLowerCase().includes('daily rambam') ||
      (i.title?.he || '').includes('רמב"ם') ||
      (i.title?.en || '').toLowerCase().includes('rambam')
    );
    if (!item) throw new Error('לא נמצא רמב"ם יומי בלוח');
    _rambamRef = item.ref;
    console.log('[RambamYomi] FULL item:', JSON.stringify(item, null, 2).slice(0, 800));
    subEl.textContent = item.heRef || item.ref;

    // The daily Rambam may span multiple chapters.
    // Sefaria ref may be "Book Chapter" or "Book Chapter-Chapter2".
    // Parse all chapter refs from the item.
    const refs = _parseRambamDailyRefs(item);
    console.log('[RambamYomi] chapter refs:', refs);
    window._rambamChapterRefs = refs;

    // Fetch all chapters and combine
    _rambamFlat = [];
    for (const ref of refs) {
      const data = await sefariaText(ref, 200);
      const rawHe = data?.he;
      const is2D = Array.isArray(rawHe) && rawHe.length > 0 && Array.isArray(rawHe[0]);
      console.log('[RambamYomi] ref', ref, 'shape:', is2D?'2D':'1D', 'length:', Array.isArray(rawHe)?rawHe.length:'N/A');
      let chapterHalachot;
      if (is2D) {
        chapterHalachot = rawHe.map(h =>
          (Array.isArray(h) ? h : [h]).filter(Boolean).join(' ')
        ).filter(Boolean);
      } else {
        chapterHalachot = (Array.isArray(rawHe) ? rawHe : []).filter(Boolean);
      }
      _rambamFlat.push(...chapterHalachot);
    }

    if (!_rambamFlat.length) throw new Error('אין טקסט עברי');
    _renderRambamButtons();
    _renderRambamContent();
    updateDoneButton('rambam', item.ref);
    console.log(`[RambamYomi] OK – ${_rambamFlat.length} sections from ${refs.length} chapters`);
  } catch(e) {
    console.error('[RambamYomi] error:', e);
    el.textContent = 'שגיאה בטעינה: ' + e.message;
  }
}

// Parse the daily Rambam ref(s) — handles single chapter and ranges like "Chapter 5-6"
function _parseRambamDailyRefs(item) {
  const ref = item.ref || '';
  // Check if it's a range: "Mishneh Torah, Book Chapter-Chapter2"
  // e.g. "Mishneh Torah, Prayer and the Priestly Blessing 5-6"
  const rangeMatch = ref.match(/^(.+?)\s+(\d+)-(\d+)$/);
  if (rangeMatch) {
    const base = rangeMatch[1];
    const from = parseInt(rangeMatch[2]);
    const to   = parseInt(rangeMatch[3]);
    const refs = [];
    for (let i = from; i <= to; i++) refs.push(`${base} ${i}`);
    return refs;
  }
  // Single chapter
  return [ref];
}

function _renderRambamButtons() {
  const btnWrap = document.getElementById('rambam-view-buttons');
  if (!btnWrap) return;
  btnWrap.innerHTML = `
    <div class="aliya-tab ${_rambamView==='text'?'active':''}" onclick="switchRambamView('text')">📖 רמב"ם</div>
    <div class="aliya-tab ${_rambamView==='steinsaltz'?'active':''}" onclick="switchRambamView('steinsaltz')">📚 רמב"ם + שטיינזלץ</div>
    <div class="aliya-tab ${_rambamView==='steinsaltz_only'?'active':''}" onclick="switchRambamView('steinsaltz_only')">📋 שטיינזלץ בלבד</div>
  `;
}

async function switchRambamView(view) {
  _rambamView = view;
  _renderRambamButtons();
  const el = document.getElementById('rambam-content');
  if (view === 'text') { _renderRambamContent(); return; }
  if (!_rambamRef) return;
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">⏳ טוען פירוש שטיינזלץ...</div>';
  try {
    const commentaryRef = `Steinsaltz on ${_rambamRef}`;
    console.log('[RambamYomi] loading:', view, '| base ref:', _rambamRef);
    console.log('[RambamYomi] all chapter refs:', window._rambamChapterRefs);

    // Fetch Steinsaltz for ALL chapters in the daily portion
    // KEY FIX: Sefaria treats "Steinsaltz on Book Chapter" as halacha ref, not chapter.
    // We must use "Steinsaltz on Book Chapter:1-N" to get all halachot in chapter.
    const allChapterRefs = (window._rambamChapterRefs && window._rambamChapterRefs.length)
      ? window._rambamChapterRefs : [_rambamRef];

    const allStEntries = [];
    for (const chRef of allChapterRefs) {
      // Use range ref to get all halachot: "Steinsaltz on Book Chapter:1-30"
      const halachaCount = _rambamFlat.length || 25;
      const rangeRef = `Steinsaltz on ${chRef}:1-${halachaCount}`;
      console.log('[RambamYomi] fetching Steinsaltz range:', rangeRef);
      try {
        const data = await sefariaText(rangeRef, 100);
        let he = data?.he;

        // Fallback: if range returns nothing, try without range
        if (!Array.isArray(he) || !he.length) {
          console.log('[RambamYomi] range empty, trying plain ref:', `Steinsaltz on ${chRef}`);
          const d2 = await sefariaText(`Steinsaltz on ${chRef}`, 100);
          he = d2?.he;
        }
        if (!Array.isArray(he) || !he.length) {
          console.log('[RambamYomi] no Steinsaltz for', chRef);
          continue;
        }

        const is2D = Array.isArray(he[0]);
        console.log('[RambamYomi]', chRef, 'shape:', is2D ? '2D halachaXentry' : '1D flat', 'len:', he.length);

        if (is2D) {
          // 2D: he[halachaIdx] = [entry1, entry2, ...] for that halacha
          he.forEach((halachaArr, halachaIdx) => {
            if (!Array.isArray(halachaArr)) return;
            halachaArr.filter(Boolean).forEach(entry => {
              const raw = String(entry);
              const kwMatch = raw.match(/<b>([\s\S]*?)<\/b>/);
              const keyword = kwMatch ? kwMatch[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim() : '';
              const text = raw.replace(/<b>/g,'**').replace(/<\/b>/g,'**').replace(/<[^>]+>/g,'').trim();
              allStEntries.push({ keyword, text, chRef, halachaIdx });
            });
          });
        } else {
          // 1D: flat list — each entry is one keyword-comment
          he.filter(Boolean).forEach((entry, i) => {
            const raw = Array.isArray(entry) ? deepFlat(entry).join(' ') : String(entry);
            const kwMatch = raw.match(/<b>([\s\S]*?)<\/b>/);
            const keyword = kwMatch ? kwMatch[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim() : '';
            const text = raw.replace(/<b>/g,'**').replace(/<\/b>/g,'**').replace(/<[^>]+>/g,'').trim();
            console.log(`[RambamYomi] ${chRef} st[${i}] kw="${keyword.slice(0,30)}" txt="${text.slice(0,60)}"`);
            allStEntries.push({ keyword, text, chRef });
          });
        }
      } catch(e) {
        console.warn('[RambamYomi] Steinsaltz error for', chRef, ':', e.message);
      }
    }

    if (!allStEntries.length) throw new Error('אין פירוש שטיינזלץ זמין');
    const stEntries = allStEntries;

    console.log('[RambamYomi] stEntries count:', stEntries.length);

    // Strip nikud for comparison
    const stripN = s => s.replace(/[\u0591-\u05C7]/g,'').replace(/\s+/g,' ').trim();
    const rambamStripped = _rambamFlat.map(v => stripN(v.replace(/<[^>]+>/g,'')));
    // Also build a combined full-text for fallback searching
    const fullRambamText = rambamStripped.join(' ');

    // For each Steinsaltz entry, find which Rambam halacha contains its keyword
    const halachaToSt = {};
    let lastMatchIdx = 0; // for sequential fallback
    stEntries.forEach(st => {
      const kw = stripN(st.keyword);
      if (!kw) return;
      let bestIdx = -1;
      // Search all halachot (start from lastMatchIdx to maintain order)
      for (let i = lastMatchIdx; i < rambamStripped.length; i++) {
        if (rambamStripped[i].includes(kw)) { bestIdx = i; break; }
      }
      // If not found from lastMatch, search from beginning
      if (bestIdx < 0) {
        for (let i = 0; i < rambamStripped.length; i++) {
          if (rambamStripped[i].includes(kw)) { bestIdx = i; break; }
        }
      }
      // Partial match: first 4 chars of each word in keyword
      if (bestIdx < 0 && kw.length >= 3) {
        const firstWord = kw.split(' ')[0].slice(0, 4);
        for (let i = lastMatchIdx; i < rambamStripped.length; i++) {
          if (rambamStripped[i].includes(firstWord)) { bestIdx = i; break; }
        }
      }
      // Final fallback: use lastMatchIdx (sequential assignment)
      if (bestIdx < 0) {
        bestIdx = Math.min(lastMatchIdx, rambamStripped.length - 1);
        console.log(`[RambamYomi] keyword="${kw.slice(0,20)}" → FALLBACK halacha[${bestIdx}]`);
      } else {
        lastMatchIdx = bestIdx;
        console.log(`[RambamYomi] keyword="${kw.slice(0,20)}" → halacha[${bestIdx}]`);
      }
      if (!halachaToSt[bestIdx]) halachaToSt[bestIdx] = [];
      halachaToSt[bestIdx].push(st.text);
    });

    el.className = 'content-text';

    if (view === 'steinsaltz_only') {
      // Standalone: show ALL Steinsaltz entries sequentially
      el.innerHTML = `
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px;padding:8px;
          background:rgba(126,214,160,.05);border-radius:8px;border-right:3px solid var(--addition)">
          📚 פירוש שטיינזלץ – ${stEntries.length} פירושים על ${_rambamRef}
        </div>` +
        stEntries.map((st, i) => {
          const formatted = st.text.replace(/\*\*([^*]+)\*\*/g,
            '<strong style="color:var(--cream);font-style:normal;font-size:1.05em">$1</strong> —');
          return `<div style="margin-bottom:14px;padding:8px 12px;
            background:rgba(126,214,160,.06);
            border-right:2px solid var(--addition);border-radius:0 6px 6px 0">
            <span style="font-size:10px;color:var(--gold-dim);display:block;margin-bottom:4px">${i+1}</span>
            <span style="color:var(--addition);font-style:italic;line-height:1.85;
              font-size:var(--font-size)">${formatted}</span>
          </div>`;
        }).join('');

    } else {
      // Inline: show Rambam + matched Steinsaltz under each halacha
      el.innerHTML = _rambamFlat.map((v, i) => {
        const matched = halachaToSt[i] || [];
        const stHtml = matched.length
          ? `<div style="margin-top:6px;padding:6px 10px;
              background:rgba(126,214,160,.07);
              border-right:2px solid var(--addition);border-radius:0 5px 5px 0;
              color:var(--addition);font-size:calc(var(--font-size)*0.84);
              font-style:italic;line-height:1.85">
              <span style="font-size:9px;font-weight:700;display:block;margin-bottom:2px;opacity:.8">📚 שטיינזלץ</span>
              ${matched.map(t => t.replace(/\*\*([^*]+)\*\*/g,
                '<strong style="color:var(--cream);font-style:normal">$1</strong> —')).join('<br>')}
            </div>`
          : '';
        return `<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.05)">
          <div><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>
          ${stHtml}
        </div>`;
      }).join('');
    }

    console.log('[RambamYomi] rendered view=', view, '| matched halachot:', Object.keys(halachaToSt).length, 'of', _rambamFlat.length);
  } catch(e) {
    console.warn('[RambamYomi] commentary error:', e.message);
    el.innerHTML = `<div style="color:var(--muted);text-align:center;padding:20px">⚠️ ${e.message}</div>`;
  }
}
function _renderRambamContent() {
  const el = document.getElementById('rambam-content');
  el.className = 'content-text';
  el.innerHTML = _rambamFlat.map((v,i) =>
    `<div style="margin-bottom:8px"><span style="color:var(--gold-dim);font-size:11px">${i+1} </span>${v}</div>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════════════════
// DAF YOMI PICKER – בחר דף
// ═══════════════════════════════════════════════════════════════════════

const BAVLI_TRACTATES = [
  {name:'Berakhot',he:'ברכות',dafim:64},{name:'Shabbat',he:'שבת',dafim:157},
  {name:'Eruvin',he:'עירובין',dafim:105},{name:'Pesachim',he:'פסחים',dafim:121},
  {name:'Rosh_Hashanah',he:'ראש השנה',dafim:35},{name:'Yoma',he:'יומא',dafim:88},
  {name:'Sukkah',he:'סוכה',dafim:56},{name:'Beitzah',he:'ביצה',dafim:40},
  {name:'Taanit',he:'תענית',dafim:31},{name:'Megillah',he:'מגילה',dafim:32},
  {name:'Moed_Katan',he:'מועד קטן',dafim:29},{name:'Chagigah',he:'חגיגה',dafim:27},
  {name:'Yevamot',he:'יבמות',dafim:122},{name:'Ketubot',he:'כתובות',dafim:112},
  {name:'Nedarim',he:'נדרים',dafim:91},{name:'Nazir',he:'נזיר',dafim:66},
  {name:'Sotah',he:'סוטה',dafim:49},{name:'Gittin',he:'גיטין',dafim:90},
  {name:'Kiddushin',he:'קידושין',dafim:82},{name:'Bava_Kamma',he:'בבא קמא',dafim:119},
  {name:'Bava_Metzia',he:'בבא מציעא',dafim:119},{name:'Bava_Batra',he:'בבא בתרא',dafim:176},
  {name:'Sanhedrin',he:'סנהדרין',dafim:113},{name:'Makkot',he:'מכות',dafim:24},
  {name:'Shevuot',he:'שבועות',dafim:49},{name:'Avodah_Zarah',he:'עבודה זרה',dafim:76},
  {name:'Horayot',he:'הוריות',dafim:14},{name:'Zevachim',he:'זבחים',dafim:120},
  {name:'Menachot',he:'מנחות',dafim:110},{name:'Chullin',he:'חולין',dafim:142},
  {name:'Bekhorot',he:'בכורות',dafim:61},{name:'Arakhin',he:'ערכין',dafim:34},
  {name:'Temurah',he:'תמורה',dafim:34},{name:'Keritot',he:'כריתות',dafim:28},
  {name:'Meilah',he:'מעילה',dafim:22},{name:'Niddah',he:'נדה',dafim:73},
];

let _dafMode = 'daily'; // 'daily' | 'pick'

function setDafMode(mode) {
  _dafMode = mode;
  // Update toggle buttons
  document.getElementById('daf-mode-daily')?.classList.toggle('active', mode === 'daily');
  document.getElementById('daf-mode-pick')?.classList.toggle('active', mode === 'pick');
  // Show/hide picker
  const picker = document.getElementById('daf-picker');
  if (picker) picker.style.display = mode === 'pick' ? 'block' : 'none';

  if (mode === 'daily') {
    // Reload daily daf
    _dafFlat = null; _dafRashiFlat = null; _dafTosafotFlat = null;
    loaded['daf'] = false;
    loadDafYomi();
  } else {
    // Populate tractate selector
    // Searchable list - populate on first use
    _initDafTractateSearch();
    // Clear content
    const el = document.getElementById('daf-content');
    if (el) { el.className = 'content-text'; el.innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:20px">בחר מסכת ודף</div>'; }
    const subEl = document.getElementById('daf-subtitle');
    if (subEl) subEl.textContent = 'בחר דף';
  }
}

function onDafTractateChange(tractate) {
  tractate = tractate || document.getElementById('daf-tractate-sel')?.value;
  const dafSel  = document.getElementById('daf-daf-sel');
  const amudSel = document.getElementById('daf-amud-sel');
  if (!dafSel || !amudSel) return;

  if (!tractate) { dafSel.style.display = 'none'; amudSel.style.display = 'none'; return; }

  const t = BAVLI_TRACTATES.find(x => x.name === tractate);
  if (!t) return;

  dafSel.innerHTML = '<option value="">דף...</option>';
  // Dafim start at 2 (daf 2a is the first daf)
  for (let d = 2; d <= t.dafim; d++) {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = toGematria(d);
    dafSel.appendChild(opt);
  }
  dafSel.style.display = 'block';
  amudSel.style.display = 'block';
  amudSel.value = 'a';
}

// Current daf pick state for navigation
let _pickDafTractate = null, _pickDafNum = 2, _pickDafAmud = 'a';

async function loadDafByPick() {
  const tractate = document.getElementById('daf-tractate-sel')?.value;
  const daf      = document.getElementById('daf-daf-sel')?.value;
  const amud     = document.getElementById('daf-amud-sel')?.value || 'a';
  if (!tractate || !daf) return;

  _pickDafTractate = tractate;
  _pickDafNum      = parseInt(daf);
  _pickDafAmud     = amud;
  await _loadPickedDaf();
}

async function _loadPickedDaf() {
  const tractate = _pickDafTractate;
  if (!tractate) return;
  const daf  = _pickDafNum;
  const amud = _pickDafAmud;
  const t    = BAVLI_TRACTATES.find(x => x.name === tractate);
  const maxDaf = t?.dafim || 64;

  const ref     = `${tractate}.${daf}${amud}`;
  const amudHe  = amud === 'a' ? 'ע"א' : 'ע"ב';
  const subtitle = `${t?.he || tractate} דף ${toGematria(daf)} ${amudHe}`;

  const el    = document.getElementById('daf-content');
  const subEl = document.getElementById('daf-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען...';
  if (subEl) subEl.textContent = subtitle;
  _dafView = 'text'; _dafRashiFlat = null; _dafTosafotFlat = null;

  // Sync selectors
  const dafSel  = document.getElementById('daf-daf-sel');
  const amudSel = document.getElementById('daf-amud-sel');
  if (dafSel)  dafSel.value  = daf;
  if (amudSel) amudSel.value = amud;

  // Compute prev/next
  let prevDaf = daf, prevAmud = amud, nextDaf = daf, nextAmud = amud;
  if (amud === 'b') { prevAmud = 'a'; nextDaf = daf + 1; nextAmud = 'a'; }
  else              { prevDaf  = daf - 1; prevAmud = 'b'; nextAmud = 'b'; }
  const hasPrev = prevDaf >= 2;
  const hasNext = nextDaf <= maxDaf;

  try {
    _dafRef = ref;
    const data = await sefariaText(ref, 200);
    _dafFlat = heFlat(data);
    if (!_dafFlat.length) throw new Error('אין טקסט');
    _renderDafButtons();
    _renderDafContent();
    _renderDafPickNav(hasPrev, hasNext, prevDaf, prevAmud, nextDaf, nextAmud, t?.he || tractate, maxDaf);
    updateDoneButton('daf', ref);
  } catch(e) {
    el.className = 'content-text';
    el.textContent = 'שגיאה: ' + e.message;
  }
}

function _renderDafPickNav(hasPrev, hasNext, prevDaf, prevAmud, nextDaf, nextAmud, tractateHe, maxDaf) {
  // Remove old nav if exists
  document.getElementById('daf-pick-nav')?.remove();
  const page = document.getElementById('page-daf');
  if (!page) return;
  const nav = document.createElement('div');
  nav.id = 'daf-pick-nav';
  nav.style.cssText = 'display:flex;gap:8px;padding:10px 16px 4px;position:sticky;bottom:60px;' +
    'background:var(--bg);border-top:1px solid var(--border);z-index:10;margin-top:8px';
  nav.innerHTML =
    `<button onclick="dafPickPrev()" ${hasPrev?'':'disabled'}
      style="flex:1;padding:9px;background:var(--card);color:${hasPrev?'var(--gold)':'var(--muted)'};
             border:1px solid ${hasPrev?'var(--gold-dim)':'var(--border)'};border-radius:10px;
             font-size:13px;cursor:${hasPrev?'pointer':'default'};font-family:'Heebo',sans-serif">
      ◀ הדף הקודם
    </button>
    <button onclick="dafPickNext()" ${hasNext?'':'disabled'}
      style="flex:1;padding:9px;background:var(--card);color:${hasNext?'var(--gold)':'var(--muted)'};
             border:1px solid ${hasNext?'var(--gold-dim)':'var(--border)'};border-radius:10px;
             font-size:13px;cursor:${hasNext?'pointer':'default'};font-family:'Heebo',sans-serif">
      הדף הבא ▶
    </button>`;
  // Append after daf-content
  const content = document.getElementById('daf-content');
  content?.parentNode?.insertBefore(nav, content.nextSibling);
}

function dafPickPrev() {
  if (_pickDafAmud === 'b') { _pickDafAmud = 'a'; }
  else { _pickDafNum--; _pickDafAmud = 'b'; }
  _loadPickedDaf();
}
function dafPickNext() {
  if (_pickDafAmud === 'a') { _pickDafAmud = 'b'; }
  else { _pickDafNum++; _pickDafAmud = 'a'; }
  _loadPickedDaf();
}

// ═══════════════════════════════════════════════════════════════════════
// MISHNA PICKER – בחר משנה
// ═══════════════════════════════════════════════════════════════════════

// Helper: get Sefaria ref for Mishnah tractate (always Mishnah_ prefix)
function mishnaRef(tractate) {
  // Special Sefaria ref names (don't use Mishnah_ prefix)
  const special = {
    'Avot':       'Pirkei_Avot',
    'Rosh_Hashanah': 'Mishnah_Rosh_Hashanah',
  };
  return special[tractate] || ('Mishnah_' + tractate);
}

const MISHNA_TRACTATES = [
  {name:'Berakhot',he:'ברכות',chapters:9},{name:'Peah',he:'פאה',chapters:8},
  {name:'Demai',he:'דמאי',chapters:7},{name:'Kilayim',he:'כלאים',chapters:9},
  {name:'Sheviit',he:'שביעית',chapters:10},{name:'Terumot',he:'תרומות',chapters:11},
  {name:'Maasrot',he:'מעשרות',chapters:5},{name:'Maaser_Sheni',he:'מעשר שני',chapters:5},
  {name:'Challah',he:'חלה',chapters:4},{name:'Orlah',he:'ערלה',chapters:3},
  {name:'Bikkurim',he:'ביכורים',chapters:4},{name:'Shabbat',he:'שבת',chapters:24},
  {name:'Eruvin',he:'עירובין',chapters:10},{name:'Pesachim',he:'פסחים',chapters:10},
  {name:'Shekalim',he:'שקלים',chapters:8},{name:'Yoma',he:'יומא',chapters:8},
  {name:'Sukkah',he:'סוכה',chapters:5},{name:'Beitzah',he:'ביצה',chapters:5},
  {name:'Rosh_Hashanah',he:'ראש השנה',chapters:4},{name:'Taanit',he:'תענית',chapters:4},
  {name:'Megillah',he:'מגילה',chapters:4},{name:'Moed_Katan',he:'מועד קטן',chapters:3},
  {name:'Chagigah',he:'חגיגה',chapters:3},{name:'Yevamot',he:'יבמות',chapters:16},
  {name:'Ketubot',he:'כתובות',chapters:13},{name:'Nedarim',he:'נדרים',chapters:11},
  {name:'Nazir',he:'נזיר',chapters:9},{name:'Sotah',he:'סוטה',chapters:9},
  {name:'Gittin',he:'גיטין',chapters:9},{name:'Kiddushin',he:'קידושין',chapters:4},
  {name:'Bava_Kamma',he:'בבא קמא',chapters:10},{name:'Bava_Metzia',he:'בבא מציעא',chapters:10},
  {name:'Bava_Batra',he:'בבא בתרא',chapters:10},{name:'Sanhedrin',he:'סנהדרין',chapters:11},
  {name:'Makkot',he:'מכות',chapters:3},{name:'Shevuot',he:'שבועות',chapters:8},
  {name:'Avodah_Zarah',he:'עבודה זרה',chapters:5},{name:'Avot',he:'פרקי אבות',chapters:5},
  {name:'Horayot',he:'הוריות',chapters:3},
];

// Approximate mishna counts per chapter (fallback: load and count dynamically)
let _mishnaMode = 'daily';

function setMishnaMode(mode) {
  _mishnaMode = mode;
  document.getElementById('mishna-mode-daily')?.classList.toggle('active', mode === 'daily');
  document.getElementById('mishna-mode-pick')?.classList.toggle('active', mode === 'pick');
  const picker = document.getElementById('mishna-picker');
  if (picker) picker.style.display = mode === 'pick' ? 'block' : 'none';

  if (mode === 'daily') {
    _mishnaFlat = null;
    loaded['mishna'] = false;
    loadMishnaYomi();
  } else {
    _initMishnaTractateSearch();
    const el = document.getElementById('mishna-content');
    if (el) { el.className = 'content-text'; el.innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:20px">בחר מסכת ופרק</div>'; }
    const subEl = document.getElementById('mishna-subtitle');
    if (subEl) subEl.textContent = 'בחר משנה';
  }
}

function onMishnaTractateChange(tractate) {
  tractate = tractate || document.getElementById('mishna-tractate-sel')?.value;
  const chSel    = document.getElementById('mishna-chapter-sel');
  const mSel     = document.getElementById('mishna-mishna-sel');
  if (!chSel || !mSel) return;
  if (!tractate) { chSel.style.display = 'none'; mSel.style.display = 'none'; return; }

  const t = MISHNA_TRACTATES.find(x => x.name === tractate);
  if (!t) return;

  chSel.innerHTML = '<option value="">פרק...</option>';
  for (let ch = 1; ch <= t.chapters; ch++) {
    const opt = document.createElement('option');
    opt.value = ch; opt.textContent = `פרק ${toGematria(ch)}`;
    chSel.appendChild(opt);
  }
  chSel.style.display = 'block';
  mSel.style.display = 'none';
}

async function onMishnaChapterChange() {
  const tractate = document.getElementById('mishna-tractate-sel')?.value;
  const chapter  = document.getElementById('mishna-chapter-sel')?.value;
  const mSel     = document.getElementById('mishna-mishna-sel');
  if (!tractate || !chapter || !mSel) return;

  // Fetch chapter to find mishna count
  try {
    const ref  = `${mishnaRef(tractate)}.${chapter}`;
    const data = await sefariaText(ref, 100);
    const he   = data?.he;
    let count = 5; // fallback
    if (Array.isArray(he)) {
      count = Math.max(1, deepFlat(he).filter(Boolean).length);
    } else if (typeof he === 'string' && he.trim()) {
      count = 1; // single-mishna chapter
    }

    mSel.innerHTML = '<option value="">משנה...</option>';
    for (let m = 1; m <= count; m++) {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = `משנה ${toGematria(m)}`;
      mSel.appendChild(opt);
    }
    mSel.style.display = 'block';
  } catch(e) {
    console.warn('[MishnaPicker] chapter fetch error:', e.message);
    // Fallback: show 10 mishnayot
    mSel.innerHTML = '<option value="">משנה...</option>';
    for (let m = 1; m <= 10; m++) {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = `משנה ${toGematria(m)}`;
      mSel.appendChild(opt);
    }
    mSel.style.display = 'block';
  }
}

// Current mishna pick state for navigation
let _pickMishnaTractate = null, _pickMishnaChapter = 1, _pickMishnaNum = 1;
// Chapter sizes cache: {tractate: {chapter: count}}
const _mishnaChapterSizes = {};

async function loadMishnaByPick() {
  const tractate  = document.getElementById('mishna-tractate-sel')?.value;
  const chapter   = document.getElementById('mishna-chapter-sel')?.value;
  const mishnaNum = document.getElementById('mishna-mishna-sel')?.value;
  if (!tractate || !chapter || !mishnaNum) return;

  _pickMishnaTractate = tractate;
  _pickMishnaChapter  = parseInt(chapter);
  _pickMishnaNum      = parseInt(mishnaNum);
  await _loadPickedMishna();
}

async function _loadPickedMishna() {
  const tractate = _pickMishnaTractate;
  if (!tractate) return;
  const ch  = _pickMishnaChapter;
  const num = _pickMishnaNum;
  const t   = MISHNA_TRACTATES.find(x => x.name === tractate);
  const maxChapter = t?.chapters || 1;

  const ref = `${mishnaRef(tractate)}.${ch}.${num}`;
  const subtitle = `${t?.he || tractate} פרק ${toGematria(ch)} משנה ${toGematria(num)}`;

  const el    = document.getElementById('mishna-content');
  const subEl = document.getElementById('mishna-subtitle');
  el.className = 'content-text loading'; el.textContent = 'טוען...';
  if (subEl) subEl.textContent = subtitle;
  _mishnaView = 'text';

  // Sync selectors
  const chSel = document.getElementById('mishna-chapter-sel');
  const mSel  = document.getElementById('mishna-mishna-sel');
  if (chSel) chSel.value = ch;
  if (mSel)  mSel.value  = num;

  try {
    _mishnaRef = ref;
    console.log('[MishnaPick] fetching ref:', ref);
    const data = await sefariaText(ref, 200);
    console.log('[MishnaPick] he type:', typeof data?.he, '| isArray:', Array.isArray(data?.he));
    const rawFlat = heFlat(data);
    console.log('[MishnaPick] rawFlat type:', typeof rawFlat, '| isArray:', Array.isArray(rawFlat), '| len:', rawFlat?.length);
    _mishnaFlat = Array.isArray(rawFlat) ? rawFlat : (rawFlat ? [rawFlat] : []);
    console.log('[MishnaPick] _mishnaFlat len:', _mishnaFlat.length);
    if (!_mishnaFlat.length) throw new Error('אין טקסט');

    // Cache mishna count for current chapter if unknown
    if (!_mishnaChapterSizes[tractate]) _mishnaChapterSizes[tractate] = {};
    const mSelOpts = document.getElementById('mishna-mishna-sel');
    if (mSelOpts && mSelOpts.options.length > 1) {
      _mishnaChapterSizes[tractate][ch] = mSelOpts.options.length - 1;
    }

    console.log('[MishnaPick] calling _renderMishnaButtons...');
    _renderMishnaButtons();
    console.log('[MishnaPick] calling _renderMishnaContent...');
    _renderMishnaContent();
    console.log('[MishnaPick] calling _renderMishnaPickNav...');
    await _renderMishnaPickNav(tractate, ch, num, maxChapter, t);
    updateDoneButton('mishna', ref);
    console.log('[MishnaPick] done ✅');
  } catch(e) {
    console.error('[MishnaPick] ERROR:', e.message, e.stack);
    el.className = 'content-text';
    el.textContent = 'שגיאה: ' + e.message;
  }
}

async function _renderMishnaPickNav(tractate, ch, num, maxChapter, t) {
  console.log('[renderMishnaNav] start, tractate:', tractate, 'ch:', ch, 'num:', num);
  document.getElementById('mishna-pick-nav')?.remove();

  // Get mishna count for current chapter (from cache or selector)
  let maxMishna = _mishnaChapterSizes[tractate]?.[ch] || 99;
  const mSel = document.getElementById('mishna-mishna-sel');
  if (mSel && mSel.options.length > 1) maxMishna = mSel.options.length - 1;

  // Compute prev/next
  let prevCh = ch, prevNum = num - 1;
  let nextCh = ch, nextNum = num + 1;

  if (prevNum < 1) {
    prevCh = ch - 1;
    // Get last mishna of prev chapter — use cached or fallback 10
    prevNum = _mishnaChapterSizes[tractate]?.[prevCh] || 10;
  }
  if (nextNum > maxMishna) { nextCh = ch + 1; nextNum = 1; }

  const hasPrev = prevCh >= 1;
  const hasNext = nextCh <= maxChapter;

  const page = document.getElementById('page-mishna');
  if (!page) return;
  const nav = document.createElement('div');
  nav.id = 'mishna-pick-nav';
  nav.style.cssText = 'display:flex;gap:8px;padding:10px 16px 4px;' +
    'background:var(--bg);border-top:1px solid var(--border);z-index:10;margin-top:8px';
  nav.innerHTML =
    `<button onclick="mishnaPickPrev()" ${hasPrev?'':'disabled'}
      style="flex:1;padding:9px;background:var(--card);color:${hasPrev?'var(--gold)':'var(--muted)'};
             border:1px solid ${hasPrev?'var(--gold-dim)':'var(--border)'};border-radius:10px;
             font-size:13px;cursor:${hasPrev?'pointer':'default'};font-family:'Heebo',sans-serif">
      ◀ המשנה הקודמת
    </button>
    <button onclick="mishnaPickNext()" ${hasNext?'':'disabled'}
      style="flex:1;padding:9px;background:var(--card);color:${hasNext?'var(--gold)':'var(--muted)'};
             border:1px solid ${hasNext?'var(--gold-dim)':'var(--border)'};border-radius:10px;
             font-size:13px;cursor:${hasNext?'pointer':'default'};font-family:'Heebo',sans-serif">
      המשנה הבאה ▶
    </button>`;
  const content = document.getElementById('mishna-content');
  content?.parentNode?.insertBefore(nav, content.nextSibling);
}

async function mishnaPickPrev() {
  _pickMishnaNum--;
  if (_pickMishnaNum < 1) {
    _pickMishnaChapter--;
    if (_pickMishnaChapter < 1) return;
    // Get last mishna of prev chapter
    const cached = _mishnaChapterSizes[_pickMishnaTractate]?.[_pickMishnaChapter];
    if (cached) {
      _pickMishnaNum = cached;
    } else {
      // Fetch to find count
      try {
        const ref = `${mishnaRef(_pickMishnaTractate)}.${_pickMishnaChapter}`;
        const data = await sefariaText(ref, 100);
        const he = data?.he;
        const count = Array.isArray(he) ? Math.max(1, deepFlat(he).filter(Boolean).length)
                                            : (typeof he === 'string' && he.trim() ? 1 : 5);
        if (!_mishnaChapterSizes[_pickMishnaTractate]) _mishnaChapterSizes[_pickMishnaTractate] = {};
        _mishnaChapterSizes[_pickMishnaTractate][_pickMishnaChapter] = count;
        _pickMishnaNum = count;
      } catch(e) { _pickMishnaNum = 5; }
    }
  }
  _loadPickedMishna();
}
async function mishnaPickNext() {
  const t = MISHNA_TRACTATES.find(x => x.name === _pickMishnaTractate);
  const maxCh = t?.chapters || 1;
  const cached = _mishnaChapterSizes[_pickMishnaTractate]?.[_pickMishnaChapter];
  const mSel = document.getElementById('mishna-mishna-sel');
  const maxM = cached || (mSel && mSel.options.length > 1 ? mSel.options.length - 1 : 99);
  _pickMishnaNum++;
  if (_pickMishnaNum > maxM) {
    _pickMishnaChapter++;
    if (_pickMishnaChapter > maxCh) return;
    _pickMishnaNum = 1;
  }
  _loadPickedMishna();
}

// ═══════════════════════════════════════════════════════════════════════
// SEARCHABLE TRACTATE PICKERS
// ═══════════════════════════════════════════════════════════════════════

function _tractateListItem(he, name, onClickFn) {
  const div = document.createElement('div');
  div.textContent = he;
  div.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:14px;' +
    'font-family:"Frank Ruhl Libre",serif;color:var(--cream);' +
    'border-bottom:1px solid var(--border);text-align:right;direction:rtl';
  div.onmouseenter = () => div.style.background = 'rgba(201,165,74,.12)';
  div.onmouseleave = () => div.style.background = '';
  div.onclick = () => onClickFn(name, he);
  return div;
}

// ── DAF tractate search ──────────────────────────────────────────────
let _dafSearchInit = false;
function _initDafTractateSearch() {
  if (_dafSearchInit) return;
  _dafSearchInit = true;
  // Close list when clicking outside
  document.addEventListener('click', function(e) {
    if (!document.getElementById('daf-tractate-wrap')?.contains(e.target)) {
      const list = document.getElementById('daf-tractate-list');
      if (list) list.style.display = 'none';
    }
  });
}

function showDafTractateList() {
  _initDafTractateSearch();
  filterDafTractates(document.getElementById('daf-tractate-search')?.value || '');
}

function filterDafTractates(query) {
  const list = document.getElementById('daf-tractate-list');
  if (!list) return;
  list.innerHTML = '';
  const q = query.trim();
  const filtered = q
    ? BAVLI_TRACTATES.filter(t => t.he.includes(q) || t.name.toLowerCase().includes(q.toLowerCase()))
    : BAVLI_TRACTATES;
  if (!filtered.length) {
    list.innerHTML = '<div style="padding:10px;color:var(--muted);text-align:center">לא נמצאה מסכת</div>';
  } else {
    filtered.forEach(t => list.appendChild(_tractateListItem(t.he, t.name, selectDafTractate)));
  }
  list.style.display = 'block';
}

function selectDafTractate(name, he) {
  const hiddenSel = document.getElementById('daf-tractate-sel');
  const searchInput = document.getElementById('daf-tractate-search');
  const list = document.getElementById('daf-tractate-list');
  if (hiddenSel) hiddenSel.value = name;
  if (searchInput) searchInput.value = he;
  if (list) list.style.display = 'none';
  onDafTractateChange(name);
}

// ── MISHNA tractate search ────────────────────────────────────────────
let _mishnaSearchInit = false;
function _initMishnaTractateSearch() {
  if (_mishnaSearchInit) return;
  _mishnaSearchInit = true;
  document.addEventListener('click', function(e) {
    if (!document.getElementById('mishna-tractate-wrap')?.contains(e.target)) {
      const list = document.getElementById('mishna-tractate-list');
      if (list) list.style.display = 'none';
    }
  });
}

function showMishnaTractateList() {
  _initMishnaTractateSearch();
  filterMishnaTractates(document.getElementById('mishna-tractate-search')?.value || '');
}

function filterMishnaTractates(query) {
  const list = document.getElementById('mishna-tractate-list');
  if (!list) return;
  list.innerHTML = '';
  const q = query.trim();
  const filtered = q
    ? MISHNA_TRACTATES.filter(t => t.he.includes(q) || t.name.toLowerCase().includes(q.toLowerCase()))
    : MISHNA_TRACTATES;
  if (!filtered.length) {
    list.innerHTML = '<div style="padding:10px;color:var(--muted);text-align:center">לא נמצאה מסכת</div>';
  } else {
    filtered.forEach(t => list.appendChild(_tractateListItem(t.he, t.name, selectMishnaTractate)));
  }
  list.style.display = 'block';
}

function selectMishnaTractate(name, he) {
  const hiddenSel = document.getElementById('mishna-tractate-sel');
  const searchInput = document.getElementById('mishna-tractate-search');
  const list = document.getElementById('mishna-tractate-list');
  if (hiddenSel) hiddenSel.value = name;
  if (searchInput) searchInput.value = he;
  if (list) list.style.display = 'none';
  onMishnaTractateChange(name);
}
