// ═══════════════════════════════════════════════════════════════════════
// SELICHOT.JS – סליחות
// Sefaria Sephardic selichot, shown in Elul + Aseret Yemei Teshuva
// ═══════════════════════════════════════════════════════════════════════

// ── Schedule ──────────────────────────────────────────────────────────
// Selichot are said:
//  • From 2 Saturdays before Rosh Hashana through Yom Kippur (10 Tishrei)
//  • In practice: days are labeled 1..N where 1 = first night of selichot
//
// Sephardim begin the 1st of Elul. Ashkenazim start 2 Saturdays before RH.
// We implement Sephardic: Elul 1 = day 1, Elul 29 = day 29,
// Tishrei 1 (RH) = יום כיפור selichot, Tishrei 3..9, Tishrei 10 = Yom Kippur.

// Sefaria selichot refs (Sephardic nusach) — using Seder HaSelichot
// These are the actual Sefaria index names for selichot
const SELICHOT_DAYS = [
  // Elul selichot (days 1-29)
  { day: 1,  label: 'א׳ אלול',     ref: 'Selichot_Sephardic,_Day_1' },
  { day: 2,  label: 'ב׳ אלול',     ref: 'Selichot_Sephardic,_Day_2' },
  { day: 3,  label: 'ג׳ אלול',     ref: 'Selichot_Sephardic,_Day_3' },
  { day: 4,  label: 'ד׳ אלול',     ref: 'Selichot_Sephardic,_Day_4' },
  { day: 5,  label: 'ה׳ אלול',     ref: 'Selichot_Sephardic,_Day_5' },
  { day: 6,  label: 'ו׳ אלול',     ref: 'Selichot_Sephardic,_Day_6' },
  { day: 7,  label: 'ז׳ אלול',     ref: 'Selichot_Sephardic,_Day_7' },
  { day: 8,  label: 'ח׳ אלול',     ref: 'Selichot_Sephardic,_Day_8' },
  { day: 9,  label: 'ט׳ אלול',     ref: 'Selichot_Sephardic,_Day_9' },
  { day: 10, label: 'י׳ אלול',     ref: 'Selichot_Sephardic,_Day_10' },
  { day: 11, label: 'י"א אלול',    ref: 'Selichot_Sephardic,_Day_11' },
  { day: 12, label: 'י"ב אלול',    ref: 'Selichot_Sephardic,_Day_12' },
  { day: 13, label: 'י"ג אלול',    ref: 'Selichot_Sephardic,_Day_13' },
  { day: 14, label: 'י"ד אלול',    ref: 'Selichot_Sephardic,_Day_14' },
  { day: 15, label: 'ט"ו אלול',    ref: 'Selichot_Sephardic,_Day_15' },
  { day: 16, label: 'ט"ז אלול',    ref: 'Selichot_Sephardic,_Day_16' },
  { day: 17, label: 'י"ז אלול',    ref: 'Selichot_Sephardic,_Day_17' },
  { day: 18, label: 'י"ח אלול',    ref: 'Selichot_Sephardic,_Day_18' },
  { day: 19, label: 'י"ט אלול',    ref: 'Selichot_Sephardic,_Day_19' },
  { day: 20, label: 'כ׳ אלול',     ref: 'Selichot_Sephardic,_Day_20' },
  { day: 21, label: 'כ"א אלול',    ref: 'Selichot_Sephardic,_Day_21' },
  { day: 22, label: 'כ"ב אלול',    ref: 'Selichot_Sephardic,_Day_22' },
  { day: 23, label: 'כ"ג אלול',    ref: 'Selichot_Sephardic,_Day_23' },
  { day: 24, label: 'כ"ד אלול',    ref: 'Selichot_Sephardic,_Day_24' },
  { day: 25, label: 'כ"ה אלול',    ref: 'Selichot_Sephardic,_Day_25' },
  { day: 26, label: 'כ"ו אלול',    ref: 'Selichot_Sephardic,_Day_26' },
  { day: 27, label: 'כ"ז אלול',    ref: 'Selichot_Sephardic,_Day_27' },
  { day: 28, label: 'כ"ח אלול',    ref: 'Selichot_Sephardic,_Day_28' },
  { day: 29, label: 'ערב ראש השנה', ref: 'Selichot_Sephardic,_Day_29' },
  // Aseret Yemei Teshuva (days 30-38)
  { day: 30, label: 'א׳ תשרי (ראש השנה)', ref: 'Selichot_Sephardic,_Rosh_Hashanah' },
  { day: 31, label: 'ג׳ תשרי',     ref: 'Selichot_Sephardic,_Day_31' },
  { day: 32, label: 'ד׳ תשרי',     ref: 'Selichot_Sephardic,_Day_32' },
  { day: 33, label: 'ה׳ תשרי',     ref: 'Selichot_Sephardic,_Day_33' },
  { day: 34, label: 'ו׳ תשרי',     ref: 'Selichot_Sephardic,_Day_34' },
  { day: 35, label: 'ז׳ תשרי',     ref: 'Selichot_Sephardic,_Day_35' },
  { day: 36, label: 'ח׳ תשרי',     ref: 'Selichot_Sephardic,_Day_36' },
  { day: 37, label: 'ט׳ תשרי (ערב יום כיפור)', ref: 'Selichot_Sephardic,_Erev_Yom_Kippur' },
  { day: 38, label: 'י׳ תשרי (יום כיפור)',      ref: 'Selichot_Sephardic,_Yom_Kippur' },
];

// Get the selichot day index from Hebrew date
function getSelichotDay(hm, hd) {
  if (hm === 'Elul') return hd;                         // 1-29
  if (hm === 'Tishrei' && hd === 1) return 30;          // Rosh Hashana
  if (hm === 'Tishrei' && hd === 2) return 30;          // RH day 2 → same selichot
  if (hm === 'Tishrei' && hd >= 3 && hd <= 9) return 28 + hd; // 3→31 .. 9→37
  if (hm === 'Tishrei' && hd === 10) return 38;         // Yom Kippur
  return null;
}

// Is it selichot season? (Elul or Tishrei 1-10)
function isSelichotSeason(hm, hd) {
  if (hm === 'Elul') return true;
  if (hm === 'Tishrei' && hd <= 10) return true;
  return false;
}

// Is it the "auto-show" window? (2 weeks before RH = Elul 15 through Tishrei 10)
function isSelichotAutoWindow(hm, hd) {
  if (hm === 'Elul' && hd >= 15) return true;
  if (hm === 'Tishrei' && hd <= 10) return true;
  return false;
}

let _selichotCurrentDay = null;
let _selichotLoading = false;

async function loadSelichot() {
  if (_selichotLoading) return;
  _selichotLoading = true;

  const el = document.getElementById('selichot-content');
  const titleEl = document.getElementById('selichot-title');
  const selectEl = document.getElementById('selichot-select');
  if (!el) return;

  // Determine current selichot day from Hebrew date
  const hd = appState?._lastHebrewDate;
  let dayEntry = null;

  if (hd) {
    const dayNum = getSelichotDay(hd.hm, hd.hd);
    if (dayNum !== null) {
      dayEntry = SELICHOT_DAYS.find(d => d.day === dayNum);
    }
  }

  // Fallback: first day
  if (!dayEntry) dayEntry = SELICHOT_DAYS[0];
  if (_selichotCurrentDay !== null) {
    dayEntry = SELICHOT_DAYS.find(d => d.day === _selichotCurrentDay) || dayEntry;
  }

  _selichotCurrentDay = dayEntry.day;
  if (titleEl) titleEl.textContent = `סליחות – ${dayEntry.label}`;
  if (selectEl) selectEl.value = String(dayEntry.day);

  el.className = 'content-text loading';
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">טוען סליחות...</div>';

  try {
    console.log('[Selichot] loading day', dayEntry.day, 'ref:', dayEntry.ref);
    const data = await sefariaText(dayEntry.ref, 200);
    const flat = heFlat(data).map(cleanSefariaHtml).filter(Boolean);

    if (!flat.length) {
      // Fallback: show static core selichot text
      el.className = 'content-text';
      el.innerHTML = _selichotFallback(dayEntry);
      _selichotLoading = false;
      return;
    }

    el.className = 'content-text';
    el.innerHTML = flat.map(v =>
      `<div style="margin-bottom:10px;line-height:1.85;font-family:'Frank Ruhl Libre',serif;
                   font-size:var(--font-size)">${v}</div>`
    ).join('');

    console.log('[Selichot] loaded', flat.length, 'verses for day', dayEntry.day);
  } catch(e) {
    console.warn('[Selichot] error loading ref, showing fallback:', e.message);
    el.className = 'content-text';
    el.innerHTML = _selichotFallback(dayEntry);
  }
  _selichotLoading = false;
}

function selectSelichotDay(day) {
  _selichotCurrentDay = parseInt(day);
  loaded['selichot'] = false;
  loadSelichot();
}

// Fallback: core selichot prayers that are said every day
function _selichotFallback(dayEntry) {
  return `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:13px;color:var(--gold);font-weight:700">${dayEntry.label}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">נוסח ספרד</div>
    </div>
    <div style="margin-bottom:16px;padding:12px;background:var(--card);border-radius:10px;
                border-right:3px solid var(--gold-dim)">
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">אשמנו</div>
      <div style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);line-height:1.9">
        אָשַׁמְנוּ, בָּגַדְנוּ, גָּזַלְנוּ, דִּבַּרְנוּ דֹּפִי,
        הֶעֱוִינוּ, וְהִרְשַׁעְנוּ, זַדְנוּ, חָמַסְנוּ, טָפַלְנוּ שֶׁקֶר,
        יָעַצְנוּ רָע, כִּזַּבְנוּ, לַצְנוּ, מָרַדְנוּ, נִאַצְנוּ,
        סָרַרְנוּ, עָוִינוּ, פָּשַׁעְנוּ, צָרַרְנוּ, קִשִּׁינוּ עֹרֶף,
        רָשַׁעְנוּ, שִׁחַתְנוּ, תִּעַבְנוּ, תָּעִינוּ, תִּעְתָּעְנוּ.
      </div>
    </div>
    <div style="margin-bottom:16px;padding:12px;background:var(--card);border-radius:10px;
                border-right:3px solid var(--gold-dim)">
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">סרנו ממצוותיך</div>
      <div style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);line-height:1.9">
        סַרְנוּ מִמִּצְוֹתֶיךָ וּמִמִּשְׁפָּטֶיךָ הַטּוֹבִים וְלֹא שָׁוָה לָנוּ.
        וְאַתָּה צַדִּיק עַל כָּל הַבָּא עָלֵינוּ, כִּי אֱמֶת עָשִׂיתָ
        וַאֲנַחְנוּ הִרְשַׁעְנוּ.
      </div>
    </div>
    <div style="margin-bottom:16px;padding:12px;background:var(--card);border-radius:10px;
                border-right:3px solid var(--gold-dim)">
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">יג מידות הרחמים</div>
      <div style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);line-height:1.9;
                  color:var(--gold)">
        יְהֹוָה יְהֹוָה, אֵל רַחוּם וְחַנּוּן, אֶרֶךְ אַפַּיִם וְרַב חֶסֶד
        וֶאֱמֶת. נֹצֵר חֶסֶד לָאֲלָפִים, נֹשֵׂא עָוֹן וָפֶשַׁע וְחַטָּאָה
        וְנַקֵּה.
      </div>
    </div>
    <div style="text-align:center;margin-top:20px;font-size:12px;color:var(--muted);
                padding:12px;background:rgba(201,165,74,.06);border-radius:10px">
      ⚠️ טקסט הסליחות המלא לא נמצא בספריא עבור יום זה.<br>
      מוצג נוסח בסיסי בלבד.
    </div>`;
}

// Populate the day selector dropdown
function _buildSelichotSelect() {
  const sel = document.getElementById('selichot-select');
  if (!sel) return;
  sel.innerHTML = SELICHOT_DAYS.map(d =>
    `<option value="${d.day}">${d.label}</option>`
  ).join('');
}

// Called by loadTab
function initSelichot() {
  _buildSelichotSelect();
  loadSelichot();
}
