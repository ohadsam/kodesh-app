// ═══════════════════════════════════════════════════════════════════════
// SELICHOT.JS – סליחות נוסח ספרד
// 
// Schedule: Up to 10 days before Rosh Hashana + Aseret Yemei Teshuva
// (through Yom Kippur). Exact start depends on when RH falls:
//  - RH on Mon/Tue: start ~10 days before
//  - Other days: start the Saturday night before the week of RH
//
// Since we don't know the exact RH day here, we use:
// A practical window of Elul 20 → Tishrei 10 (Yom Kippur)
// and offer the full 20-day range in the dropdown.
//
// Text: Core selichot prayers (said every day) are embedded.
// Day-specific piyutim are labeled but not available from Sefaria.
// ═══════════════════════════════════════════════════════════════════════

// ── Day schedule ─────────────────────────────────────────────────────
// Maps Hebrew date → selichot day number (1-based)
// Elul 20 = day 1, Elul 29 = day 10, Tishrei 1-2 = day 11-12,
// Tishrei 3 = day 13 ... Tishrei 10 = day 20

function getSelichotDay(hm, hd) {
  if (hm === 'Elul' && hd >= 20) return hd - 19;           // Elul 20=1 .. 29=10
  if (hm === 'Tishrei' && hd === 1) return 11;              // ראש השנה
  if (hm === 'Tishrei' && hd === 2) return 12;              // ב׳ ר"ה
  if (hm === 'Tishrei' && hd >= 3 && hd <= 9) return hd + 10; // ג׳=13 .. ט׳=19
  if (hm === 'Tishrei' && hd === 10) return 20;             // יום כיפור
  return null;
}

// Is it selichot season?
function isSelichotSeason(hm, hd) {
  if (hm === 'Elul' && hd >= 20) return true;
  if (hm === 'Tishrei' && hd <= 10) return true;
  return false;
}

// Auto-show window: Elul 20 → Tishrei 10
function isSelichotAutoWindow(hm, hd) {
  return isSelichotSeason(hm, hd);
}

const SELICHOT_DAYS = [
  { day: 1,  label: 'כ׳ אלול – יום א׳' },
  { day: 2,  label: 'כ"א אלול – יום ב׳' },
  { day: 3,  label: 'כ"ב אלול – יום ג׳' },
  { day: 4,  label: 'כ"ג אלול – יום ד׳' },
  { day: 5,  label: 'כ"ד אלול – יום ה׳' },
  { day: 6,  label: 'כ"ה אלול – יום ו׳' },
  { day: 7,  label: 'כ"ו אלול – יום ז׳' },
  { day: 8,  label: 'כ"ז אלול – יום ח׳' },
  { day: 9,  label: 'כ"ח אלול – יום ט׳' },
  { day: 10, label: 'כ"ט אלול – ערב ראש השנה' },
  { day: 11, label: 'א׳ תשרי – ראש השנה' },
  { day: 12, label: 'ב׳ תשרי – ב׳ ר"ה' },
  { day: 13, label: 'ג׳ תשרי – צום גדליה' },
  { day: 14, label: 'ד׳ תשרי' },
  { day: 15, label: 'ה׳ תשרי' },
  { day: 16, label: 'ו׳ תשרי' },
  { day: 17, label: 'ז׳ תשרי' },
  { day: 18, label: 'ח׳ תשרי' },
  { day: 19, label: 'ט׳ תשרי – ערב יום כיפור' },
  { day: 20, label: 'י׳ תשרי – יום כיפור' },
];

// ── Core selichot text (said every day, Sephardic nusach) ─────────────
function _selichotCoreText(dayEntry) {
  return `
<div style="text-align:center;margin-bottom:20px;padding:12px;
            background:rgba(201,165,74,.08);border-radius:12px">
  <div style="font-size:15px;font-weight:700;color:var(--gold);font-family:'Frank Ruhl Libre',serif">
    סליחות
  </div>
  <div style="font-size:13px;color:var(--cream);margin-top:4px">${dayEntry.label}</div>
  <div style="font-size:11px;color:var(--muted);margin-top:2px">נוסח ספרד</div>
</div>

${_prayer('אל מלך', `אֵל מֶֽלֶךְ יוֹשֵׁב עַל כִּסֵּא רַחֲמִים, מִתְנַהֵג בַּחֲסִידוּת, מוֹחֵל עֲוֹנוֹת עַמּוֹ, מַעֲבִיר רִאשׁוֹן רִאשׁוֹן, מַרְבֶּה מְחִילָה לְחַטָּאִים וּסְלִיחָה לְפוֹשְׁעִים, עוֹשֶׂה צְדָקוֹת עִם כָּל בָּשָׂר וָרֽוּחַ, לֹא כְרָעָתָם תִּגְמוֹל.`)}

${_prayer('אֵל, אֶרֶךְ אַפַּיִם', `אֵל אֶרֶךְ אַפַּיִם אַתָּה, וּבַעַל הָרַחֲמִים נִקְרֵאתָ, וְדֶֽרֶךְ תְּשׁוּבָה הוֹרֵיתָ. גְּדֻלַּת רַחֲמֶיךָ וַחֲסָדֶיךָ, תִּזְכּוֹר הַיּוֹם וּבְכָל יוֹם לְזֶֽרַע יְדִידֶיךָ. תֵּפֶן אֵלֵינוּ בְּרַחֲמִים, כִּי אַתָּה הוּא בַּעַל הָרַחֲמִים. בְּתַחֲנוּן וּבִתְפִלָּה פָּנֶיךָ נְקַדֵּם, כְּהוֹדַעְתָּ לֶעָנָו מִקֶּדֶם. מֵחֲרוֹן אַפְּךָ שׁוּב, כְּמוֹ בְּתוֹרָתְךָ כָּתוּב. וּבְצֵל כְּנָפֶיךָ נֶחֱסֶה וְנִתְלוֹנָן, כְּיוֹם וַיֵּרֶד יְהֹוָה בֶּעָנָן. תַּעֲבוֹר עַל פֶּשַׁע וְתִמְחֶה אָשָׁם, כְּיוֹם וַיִּתְיַצֵּב עִמּוֹ שָׁם. תַּאֲזִין שַׁוְעָתֵנוּ וְתִקְשֶׁב מֶנּוּ מַמָּר, כְּיוֹם וַיִּקְרָא בְשֵׁם יְהֹוָה שָׁם.`)}

<div style="text-align:center;margin:16px 0 8px;font-size:11px;color:var(--muted)">
  י"ג מידות הרחמים (×ג)
</div>
${_prayer('י"ג מידות', `יְהֹוָה יְהֹוָה, אֵל רַחוּם וְחַנּוּן, אֶֽרֶךְ אַפַּיִם וְרַב חֶֽסֶד וֶאֱמֶת. נֹצֵר חֶסֶד לָאֲלָפִים, נֹשֵׂא עָוֹן וָפֶשַׁע וְחַטָּאָה וְנַקֵּה.`, true)}

${_prayer('סלח לנו', `סְלַח לָנוּ אָבִינוּ כִּי חָטָאנוּ, מְחַל לָנוּ מַלְכֵּנוּ כִּי פָשָׁעְנוּ. כִּי אַתָּה אֲדֹנָי טוֹב וְסַלָּח, וְרַב חֶֽסֶד לְכָל קֹרְאֶֽיךָ.`)}

<div style="text-align:center;margin:16px 0 8px;font-size:11px;color:var(--muted)">וידוי</div>
${_prayer('אשמנו', `אָשַׁמְנוּ, בָּגַדְנוּ, גָּזַלְנוּ, דִּבַּרְנוּ דֹּפִי, הֶעֱוִינוּ, וְהִרְשַׁעְנוּ, זַדְנוּ, חָמַסְנוּ, טָפַלְנוּ שֶׁקֶר, יָעַצְנוּ רָע, כִּזַּבְנוּ, לַצְנוּ, מָרַדְנוּ, נִאַצְנוּ, סָרַרְנוּ, עָוִינוּ, פָּשַׁעְנוּ, צָרַרְנוּ, קִשִּׁינוּ עֹרֶף, רָשַׁעְנוּ, שִׁחַתְנוּ, תִּעַבְנוּ, תָּעִינוּ, תִּעְתָּעְנוּ.`)}

${_prayer('על חטא', `עַל חֵטְא שֶׁחָטָאנוּ לְפָנֶיךָ בְּאֹנֶס וּבְרָצוֹן. וְעַל חֵטְא שֶׁחָטָאנוּ לְפָנֶיךָ בְּאִמּוּץ הַלֵּב. עַל חֵטְא שֶׁחָטָאנוּ לְפָנֶיךָ בִּבְלִי דָעַת. וְעַל חֵטְא שֶׁחָטָאנוּ לְפָנֶיךָ בְּבִטּוּי שְׂפָתַיִם. עַל חֵטְא שֶׁחָטָאנוּ לְפָנֶיךָ בְּגִלּוּי עֲרָיוֹת. וְעַל חֵטְא שֶׁחָטָאנוּ לְפָנֶיךָ בְּגָלוּי וּבַסָּתֶר.<br><br>
וְעַל כֻּלָּם אֱלֽוֹהַּ סְלִיחוֹת, סְלַח לָנוּ, מְחַל לָנוּ, כַּפֶּר לָנוּ.`)}

${_prayer('שמע קולנו', `שְׁמַע קוֹלֵנוּ יְהֹוָה אֱלֹהֵינוּ, חוּס וְרַחֵם עָלֵינוּ, וְקַבֵּל בְּרַחֲמִים וּבְרָצוֹן אֶת תְּפִלָּתֵנוּ. הֲשִׁיבֵנוּ יְהֹוָה אֵלֶיךָ וְנָשׁוּבָה, חַדֵּשׁ יָמֵינוּ כְּקֶדֶם. אַל תַּשְׁלִיכֵנוּ מִלְּפָנֶיךָ, וְרוּחַ קָדְשְׁךָ אַל תִּקַּח מִמֶּנּוּ. אַל תַּשְׁלִיכֵנוּ לְעֵת זִקְנָה, כִּכְלוֹת כֹּחֵנוּ אַל תַּעַזְבֵנוּ. אַל תַּעַזְבֵנוּ יְהֹוָה אֱלֹהֵינוּ, אַל תִּרְחַק מִמֶּנּוּ. עֲשֵׂה עִמָּנוּ אוֹת לְטוֹבָה, וְיִרְאוּ שׂוֹנְאֵינוּ וְיֵבֹשׁוּ, כִּי אַתָּה יְהֹוָה עֲזַרְתָּנוּ וְנִחַמְתָּנוּ.`)}

${_prayer('אל אדון', `אָבִינוּ מַלְכֵּנוּ, חָנֵּנוּ וַעֲנֵנוּ כִּי אֵין בָּנוּ מַעֲשִׂים, עֲשֵׂה עִמָּנוּ צְדָקָה וָחֶסֶד וְהוֹשִׁיעֵנוּ. אָבִינוּ מַלְכֵּנוּ, זָכְרֵנוּ בְּזִכָּרוֹן טוֹב לְפָנֶיךָ. אָבִינוּ מַלְכֵּנוּ, כָּתְבֵנוּ בְּסֵפֶר חַיִּים טוֹבִים. אָבִינוּ מַלְכֵּנוּ, כָּתְבֵנוּ בְּסֵפֶר גְּאֻלָּה וִישׁוּעָה. אָבִינוּ מַלְכֵּנוּ, כָּתְבֵנוּ בְּסֵפֶר פַּרְנָסָה וְכַלְכָּלָה. אָבִינוּ מַלְכֵּנוּ, הַחֲזִירֵנוּ בִּתְשׁוּבָה שְׁלֵמָה לְפָנֶיךָ.`)}
`;
}

function _prayer(title, text, highlight = false) {
  const borderColor = highlight ? 'var(--gold)' : 'var(--border)';
  const bg = highlight ? 'rgba(201,165,74,.07)' : 'var(--card)';
  const textColor = highlight ? 'var(--gold)' : 'var(--cream)';
  return `<div style="margin-bottom:16px;padding:12px 14px;background:${bg};
               border-radius:10px;border-right:3px solid ${borderColor}">
    <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-family:'Heebo',sans-serif">
      ${title}
    </div>
    <div style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);
                line-height:1.9;color:${textColor}">${text}</div>
  </div>`;
}

// ── State ────────────────────────────────────────────────────────────
let _selichotCurrentDay = null;

async function loadSelichot() {
  const el = document.getElementById('selichot-content');
  const titleEl = document.getElementById('selichot-title');
  const selectEl = document.getElementById('selichot-select');
  if (!el) return;

  // Determine day from Hebrew date or user selection
  const hd = appState?._lastHebrewDate;
  let dayEntry = null;

  if (_selichotCurrentDay !== null) {
    dayEntry = SELICHOT_DAYS.find(d => d.day === _selichotCurrentDay);
  }
  if (!dayEntry && hd) {
    const dayNum = getSelichotDay(hd.hm, hd.hd);
    if (dayNum !== null) dayEntry = SELICHOT_DAYS.find(d => d.day === dayNum);
  }
  if (!dayEntry) dayEntry = SELICHOT_DAYS[0];

  _selichotCurrentDay = dayEntry.day;
  if (titleEl) titleEl.textContent = `סליחות – ${dayEntry.label}`;
  if (selectEl) selectEl.value = String(dayEntry.day);

  el.className = 'content-text';
  el.innerHTML = _selichotCoreText(dayEntry);
  console.log('[Selichot] rendered day', dayEntry.day, dayEntry.label);
}

function selectSelichotDay(day) {
  _selichotCurrentDay = parseInt(day);
  loaded['selichot'] = false;
  loadSelichot();
}

function _buildSelichotSelect() {
  const sel = document.getElementById('selichot-select');
  if (!sel) return;
  sel.innerHTML = SELICHOT_DAYS.map(d =>
    `<option value="${d.day}">${d.label}</option>`
  ).join('');
}

function initSelichot() {
  _buildSelichotSelect();
  loadSelichot();
}
