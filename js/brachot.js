// ═══════════════════════════════════════════
// BRACHOT – ברכות
// Three nusachim: sfard (default), ashkenaz, mizrach
// ═══════════════════════════════════════════

let brachotNusach = 'sfard'; // default
let currentBracha = null;

// ── Bracha definitions ───────────────────────────────────────────────
// Each bracha has: title, variants per nusach (or shared), paragraphs[]
const BRACHOT = {

  // ── ברכת המזון ──────────────────────────────────────────────────────
  birkat_hamazon: {
    title: 'ברכת המזון',
    useSiddur: true,    // loaded from Sefaria via siddur engine
    source: 'אחרי אכילת לחם',
  },

  // ── ברכות אחרונות ────────────────────────────────────────────────────
  mezonot: {
    title: 'ברכה אחרונה – מזונות (על המחיה)',
    source: 'אחרי מזונות, עוגה, פירות משבעת המינים',
    nusach: {
      sfard: [
        'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
        'עַל הַמִּחְיָה וְעַל הַכַּלְכָּלָה,',
        'וְעַל תְּנוּבַת הַשָּׂדֶה,',
        'וְעַל אֶרֶץ חֶמְדָּה טוֹבָה וּרְחָבָה',
        'שֶׁרָצִיתָ וְהִנְחַלְתָּ לַאֲבוֹתֵינוּ',
        'לֶאֱכֹל מִפִּרְיָהּ וְלִשְׂבֹּעַ מִטּוּבָהּ.',
        '',
        'רַחֵם נָא יְהֹוָה אֱלֹהֵינוּ',
        'עַל יִשְׂרָאֵל עַמֶּךָ,',
        'וְעַל יְרוּשָׁלַיִם עִירֶךָ,',
        'וְעַל צִיּוֹן מִשְׁכַּן כְּבוֹדֶךָ,',
        'וְעַל מִזְבַּחֶךָ וְעַל הֵיכָלֶךָ.',
        '',
        'וּבְנֵה יְרוּשָׁלַיִם עִיר הַקֹּדֶשׁ',
        'בִּמְהֵרָה בְיָמֵינוּ,',
        'וְהַעֲלֵנוּ לְתוֹכָהּ וְשַׂמְּחֵנוּ בְּבִנְיָנָהּ,',
        'וְנֹאכַל מִפִּרְיָהּ וְנִשְׂבַּע מִטּוּבָהּ,',
        'וּנְבָרֶכְךָ עָלֶיהָ בִּקְדֻשָּׁה וּבְטָהֳרָה,',
        '',
        'כִּי אַתָּה יְהֹוָה טוֹב וּמֵטִיב לַכֹּל,',
        'וְנוֹדֶה לְּךָ עַל הָאָרֶץ',
        'וְעַל הַמִּחְיָה.',
        '',
        'בָּרוּךְ אַתָּה יְהֹוָה,',
        'עַל הָאָרֶץ וְעַל הַמִּחְיָה.',
      ],
    },
  },

  shehakol: {
    title: 'ברכה ראשונה – שהכל',
    source: 'לפני שתייה, ממתקים, בשר, דגים, ביצים, פטריות',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'שֶׁהַכֹּל נִהְיָה בִּדְבָרוֹ.',
    ],
    afterText: [
      '',
      'ברכה אחרונה: בּוֹרֵא נְפָשׁוֹת',
    ],
  },

  borei_nefashot: {
    title: 'ברכה אחרונה – בורא נפשות',
    source: 'אחרי שתייה (חוץ מיין), פירות שאינם משבעת המינים, ירקות',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'בּוֹרֵא נְפָשׁוֹת רַבּוֹת וְחֶסְרוֹנָן,',
      'עַל כָּל מַה שֶּׁבָּרָאתָ',
      'לְהַחֲיוֹת בָּהֶם נֶפֶשׁ כָּל חָי.',
      '',
      'בָּרוּךְ חֵי הָעוֹלָמִים.',
    ],
  },

  // ── ברכות הלבנה, האילנות, ותופעות טבע ──────────────────────────────
  kiddush_levana: {
    title: 'ברכת הלבנה (קידוש לבנה)',
    source: 'בין ג׳ לט״ו בחודש, במוצאי שבת בחוץ',
    shared: [
      'הַלְלוּיָהּ. הַלְלוּ אֶת יְהֹוָה מִן הַשָּׁמַיִם',
      'הַלְלוּהוּ בַּמְּרוֹמִים.',
      '',
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'אֲשֶׁר בְּמַאֲמָרוֹ בָּרָא שְׁחָקִים,',
      'וּבְרוּחַ פִּיו כָּל צְבָאָם.',
      'חֹק וּזְמַן נָתַן לָהֶם שֶׁלֹּא יְשַׁנּוּ אֶת תַּפְקִידָם.',
      'שָׂשִׂים וּשְׂמֵחִים לַעֲשׂוֹת רְצוֹן קוֹנָם.',
      'פּוֹעֵל אֱמֶת שֶׁפְּעֻלָּתוֹ אֱמֶת.',
      '',
      'וְלַלְּבָנָה אָמַר שֶׁתִּתְחַדֵּשׁ',
      'עֲטֶרֶת תִּפְאֶרֶת לַעֲמוּסֵי בָטֶן',
      'שֶׁהֵם עֲתִידִים לְהִתְחַדֵּשׁ כְּמוֹתָהּ,',
      'וּלְפָאֵר לְיוֹצְרָם עַל שֵׁם כְּבוֹד מַלְכוּתוֹ.',
      '',
      'בָּרוּךְ אַתָּה יְהֹוָה, מְחַדֵּשׁ חֳדָשִׁים.',
      '',
      'שָׁלוֹם עֲלֵיכֶם (×3)',
      'עֲלֵיכֶם שָׁלוֹם (×3)',
      '',
      'דָּוִד מֶלֶךְ יִשְׂרָאֵל חַי וְקַיָּם.',
    ],
  },

  birkat_ilanot: {
    title: 'ברכת האילנות',
    source: 'פעם אחת בשנה בניסן, בראיית עצי פרי בפריחתם',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'שֶׁלֹּא חִסַּר בְּעוֹלָמוֹ כְּלוּם,',
      'וּבָרָא בוֹ בְּרִיּוֹת טוֹבוֹת וְאִילָנוֹת טוֹבוֹת',
      'לֵהָנוֹת בָּהֶם בְּנֵי אָדָם.',
    ],
  },

  // ── ברכות על תופעות טבע ────────────────────────────────────────────
  raam: {
    title: 'ברכה על רעם',
    source: 'בשמיעת רעם',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'שֶׁכֹּחוֹ וּגְבוּרָתוֹ מָלֵא עוֹלָם.',
    ],
  },

  barak: {
    title: 'ברכה על ברק',
    source: 'בראיית ברק',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'עוֹשֵׂה מַעֲשֵׂה בְרֵאשִׁית.',
    ],
  },

  keshet: {
    title: 'ברכה על קשת',
    source: 'בראיית קשת בענן',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'זוֹכֵר הַבְּרִית וְנֶאֱמָן בִּבְרִיתוֹ',
      'וְקַיָּם בְּמַאֲמָרוֹ.',
    ],
  },

  nof: {
    title: 'ברכה על נופים מיוחדים',
    source: 'בראיית ים, הרים, מדבריות, נחלים גדולים',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'עוֹשֵׂה מַעֲשֵׂה בְרֵאשִׁית.',
    ],
  },

  // ── ברכות על אנשים ─────────────────────────────────────────────────
  chacham: {
    title: 'ברכה על חכמה (חכמי ישראל)',
    source: 'בפגישה עם תלמיד חכם גדול',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'שֶׁחָלַק מֵחָכְמָתוֹ לִירֵאָיו.',
    ],
  },

  chacham_umot: {
    title: 'ברכה על חכמה (חכמי אומות העולם)',
    source: 'בפגישה עם מדען, פילוסוף, חכם אומות העולם',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'שֶׁנָּתַן מֵחָכְמָתוֹ לְבָשָׂר וָדָם.',
    ],
  },

  melachim: {
    title: 'ברכה על אנשים מכובדים',
    source: 'בראיית מלך, נשיא, ראש ממשלה (לפחות פעם בשנה)',
    shared: [
      'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם,',
      'שֶׁנָּתַן מִכְּבוֹדוֹ לְבָשָׂר וָדָם.',
    ],
  },
};

// ── Nusach button state ──────────────────────────────────────────────
function setBrachotNusach(n) {
  brachotNusach = n;
  document.querySelectorAll('#brachot-nusach-buttons .aliya-tab').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('bn2-' + n);
  if (btn) btn.classList.add('active');
  if (currentBracha) showBracha(currentBracha);
}

// ── Display a bracha ─────────────────────────────────────────────────
async function showBracha(key) {
  currentBracha = key;
  const b = BRACHOT[key];
  if (!b) return;

  document.querySelectorAll('#bracha-buttons .bracha-btn').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('bb-' + key);
  if (btn) btn.classList.add('active');

  const titleEl   = document.getElementById('bracha-title');
  const sourceEl  = document.getElementById('bracha-source');
  const contentEl = document.getElementById('bracha-content');

  if (titleEl)  titleEl.textContent  = b.title;
  if (sourceEl) sourceEl.textContent = b.source || '';

  // ── Birkat HaMazon: load from Sefaria via siddur engine ───────────
  if (b.useSiddur) {
    contentEl.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">⏳ טוען...</div>';
    try {
      const SFARD = 'Weekday_Siddur_Sefard_Linear';
      const ASHK  = 'Ashkenaz_Siddur_Sefard';
      const refs = {
        sfard:    `${SFARD},_Berachot,_Birkat_HaMazon`,
        ashkenaz: `${ASHK},_Berachot,_Birkat_HaMazon`,
        mizrach:  `${SFARD},_Berachot,_Birkat_HaMazon`,
      };
      const ref  = refs[brachotNusach] || refs.sfard;
      const data = await sefariaText(ref, 200);
      const flat = heFlat(data).map(cleanSefariaHtml).filter(Boolean);
      if (!flat.length) throw new Error('empty');
      const paragraphs = buildParagraphs(flat);
      contentEl.innerHTML = _renderBrachaText(paragraphs.map(p => {
        if (p.startsWith('\uE002') || p.startsWith('__HEADER__')) return p;
        return p;
      }));
    } catch(e) {
      contentEl.innerHTML = `<div style="color:var(--muted)">⚠️ שגיאה בטעינה: ${e.message}</div>`;
    }
    return;
  }

  // ── Static text ────────────────────────────────────────────────────
  const lines = b.shared || b.nusach?.[brachotNusach] || b.nusach?.sfard || [];
  contentEl.innerHTML = _renderBrachaLines(lines);

  // Append afterText if exists
  if (b.afterText) {
    contentEl.innerHTML += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">'
      + _renderBrachaLines(b.afterText) + '</div>';
  }
}

function _renderBrachaLines(lines) {
  const style = `font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);` +
    `color:var(--cream);line-height:1.9;display:block;margin-bottom:8px`;
  return lines.map(l =>
    l === '' ? '<div style="margin:10px 0"></div>'
             : `<p style="${style}">${l}</p>`
  ).join('');
}

function _renderBrachaText(paragraphs) {
  return paragraphs.map(p => {
    if (p.startsWith('__HEADER__')) {
      return `<p style="font-size:10px;font-weight:700;color:var(--gold-dim);
        margin:10px 0 3px;font-family:'Heebo',sans-serif;border-bottom:1px solid var(--border);padding-bottom:2px">
        ${p.slice(10)}</p>`;
    }
    if (p.startsWith('\uE002')) {
      const le = p.indexOf('\uE003'), ce = p.indexOf('\uE004');
      const label   = le > 0 ? p.slice(1, le) : '';
      const content = ce > 0 ? p.slice(le+1, ce) : p.slice(le+1);
      return `<p style="margin:4px 0 8px;padding:6px 10px;background:var(--addition-bg);
        border-right:3px solid var(--addition);border-radius:0 6px 6px 0;
        font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);
        color:var(--addition);font-style:italic;font-weight:600;line-height:1.85">
        ${label ? `<span style="display:block;font-size:9px;color:var(--addition);font-weight:700;margin-bottom:2px">${label}</span>` : ''}${content}</p>`;
    }
    return `<p style="font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);
      color:var(--cream);line-height:1.9;display:block;margin-bottom:8px">${p}</p>`;
  }).join('');
}

function loadBrachot() {
  // Restore saved nusach
  const saved = appState?.brachaNusach || 'sfard';
  brachotNusach = saved;
  document.querySelectorAll('#brachot-nusach-buttons .aliya-tab').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('bn2-' + saved);
  if (btn) btn.classList.add('active');
  // Show first bracha by default
  if (!currentBracha) showBracha('birkat_hamazon');
}
