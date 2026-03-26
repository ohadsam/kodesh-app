// ═══════════════════════════════════════════
// SIDDUR
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// SIDDUR – Live from Sefaria API
// ═══════════════════════════════════════════
let siddurNusach  = 'sfard';
let siddurPrayer  = 'shacharit';
let siddurSections = [];   // currently loaded sections
let siddurLoading  = false;

const NUSACH_NAMES = { ashkenaz: 'נוסח אשכנז', sfard: 'נוסח ספרד', mizrach: 'עדות המזרח' };
const PRAYER_NAMES = { shacharit: 'שחרית', mincha: 'מנחה', arvit: 'ערבית', birkat: 'ברכת המזון', layla: 'קריאת שמע על המיטה' };

// Section map: prayer → list of {label, ref, isAddition, condition}
// Refs from Weekday_Siddur_Sefard_Linear (works for ספרד/ספרד-אשכנז)
// For each ref we load the Hebrew text live from Sefaria
// ── Static texts ─────────────────────────────────────────
const YAALEH_VEYAVO = `יַעֲלֶה וְיָבֹא וְיַגִּיעַ, וְיֵרָאֶה וְיֵרָצֶה וְיִשָּׁמַע,
וְיִפָּקֵד וְיִזָּכֵר זִכְרוֹנֵנוּ וּפִקְדוֹנֵנוּ,
וְזִכְרוֹן אֲבוֹתֵינוּ, וְזִכְרוֹן מָשִׁיחַ בֶּן דָּוִד עַבְדֶּךָ,
וְזִכְרוֹן יְרוּשָׁלַיִם עִיר קָדְשֶׁךָ,
וְזִכְרוֹן כָּל עַמְּךָ בֵּית יִשְׂרָאֵל לְפָנֶיךָ,
לִפְלֵיטָה לְטוֹבָה, לְחֵן וּלְחֶסֶד וּלְרַחֲמִים,
לְחַיִּים וּלְשָׁלוֹם בְּיוֹם
<span id="yaaleh-occasion"></span>
הַזֶּה.
זָכְרֵנוּ יְיָ אֱלֹהֵינוּ בּוֹ לְטוֹבָה,
וּפָקְדֵנוּ בוֹ לִבְרָכָה,
וְהוֹשִׁיעֵנוּ בוֹ לְחַיִּים.
וּבִדְבַר יְשׁוּעָה וְרַחֲמִים
חוּס וְחָנֵּנוּ וְרַחֵם עָלֵינוּ וְהוֹשִׁיעֵנוּ,
כִּי אֵלֶיךָ עֵינֵינוּ, כִּי אֵל מֶלֶךְ חַנּוּן וְרַחוּם אָתָּה.`;

// קדיש יתום – static (Sefaria "Cannot pad schema node" for Mincha/Maariv refs)
// רצה – תוספת שבת בברכת המזון
const RATZE_SHABBAT = `רְצֵה וְהַחֲלִיצֵנוּ יְיָ אֱלֹהֵינוּ בְּמִצְווֹתֶיךָ וּבְמִצְוַת יוֹם הַשְּׁבִיעִי הַשַּׁבָּת הַגָּדוֹל וְהַקָּדוֹשׁ הַזֶּה.
כִּי יוֹם זֶה גָּדוֹל וְקָדוֹשׁ הוּא לְפָנֶיךָ לִשְׁבָּת בּוֹ וְלָנוּחַ בּוֹ בְּאַהֲבָה כְּמִצְוַת רְצוֹנֶךָ.
וּבִרְצוֹנְךָ הָנִיחַ לָנוּ יְיָ אֱלֹהֵינוּ שֶׁלֹּא תְהֵא צָרָה וְיָגוֹן וַאֲנָחָה בְּיוֹם מְנוּחָתֵנוּ.
וְהַרְאֵנוּ יְיָ אֱלֹהֵינוּ בְּנֶחָמַת צִיּוֹן עִירֶךָ וּבְבִנְיַן יְרוּשָׁלַיִם עִיר קָדְשֶׁךָ,
כִּי אַתָּה הוּא בַּעַל הַיְשׁוּעוֹת וּבַעַל הַנֶּחָמוֹת.`;

const KADDISH_YATOM = `יִתְגַּדַּל וְיִתְקַדַּשׁ שְׁמֵהּ רַבָּא. אָמֵן.
בְּעָלְמָא דִּי בְרָא כִרְעוּתֵהּ, וְיַמְלִיךְ מַלְכוּתֵהּ, וְיַצְמַח פֻּרְקָנֵהּ, וִיקָרֵב מְשִׁיחֵהּ.
בְּחַיֵּיכוֹן וּבְיוֹמֵיכוֹן וּבְחַיֵּי דְכָל בֵּית יִשְׂרָאֵל, בַּעֲגָלָא וּבִזְמַן קָרִיב. וְאִמְרוּ אָמֵן.

יְהֵא שְׁמֵהּ רַבָּא מְבָרַךְ לְעָלַם וּלְעָלְמֵי עָלְמַיָּא.

יִתְבָּרַךְ וְיִשְׁתַּבַּח וְיִתְפָּאַר וְיִתְרוֹמַם וְיִתְנַשֵּׂא וְיִתְהַדָּר וְיִתְעַלֶּה וְיִתְהַלָּל שְׁמֵהּ דְּקֻדְשָׁא, בְּרִיךְ הוּא.
לְעֵלָּא מִן כָּל בִּרְכָתָא וְשִׁירָתָא, תֻּשְׁבְּחָתָא וְנֶחֱמָתָא, דַּאֲמִירָן בְּעָלְמָא. וְאִמְרוּ אָמֵן.

יְהֵא שְׁלָמָא רַבָּא מִן שְׁמַיָּא, וְחַיִּים טוֹבִים עָלֵינוּ וְעַל כָּל יִשְׂרָאֵל. וְאִמְרוּ אָמֵן.

עוֹשֶׂה שָׁלוֹם בִּמְרוֹמָיו, הוּא יַעֲשֶׂה שָׁלוֹם עָלֵינוּ וְעַל כָּל יִשְׂרָאֵל, וְעַל כָּל יוֹשְׁבֵי תֵבֵל. וְאִמְרוּ אָמֵן.`;

// הלל = תהילים קיג–קיח מספריא
const HALLEL_REFS = ['Psalms.113', 'Psalms.114', 'Psalms.115', 'Psalms.116', 'Psalms.117', 'Psalms.118'];
// ── Section builder per nusach ─────────────────────────────────
// All refs verified via Sefaria API scanner
function getSiddurSections(nusach, prayer) {
  const SFARD   = 'Weekday_Siddur_Sefard_Linear';
  const ASHK    = 'Siddur_Ashkenaz';
  const MIZ     = 'Siddur_Edot_HaMizrach';
  const n = nusach || 'sfard';

  // r(sfardPath, ashkPath, mizrachPath)
  // null = no dedicated ref → fallback to sfard automatically
  const r = (s, a, m) => {
    if (n === 'ashkenaz' && a) return `${ASHK},_${a}`;
    if (n === 'mizrach'  && m) return `${MIZ},_${m}`;
    return `${SFARD},_${s}`;
  };

  // Shared additions (always sfard refs – same text everywhere)
  const yaaleh = { label:'יעלה ויבוא ✨', ref:null, staticText:YAALEH_VEYAVO, isAddition:true, condition:'isRoshChodeshOrMoed' };
  const yaalehYT = { label:'יעלה ויבוא (יו"ט) ✨', ref:null, staticText:YAALEH_VEYAVO, isAddition:true, condition:'isYomTov' };

  if (prayer === 'shacharit') return [
    { label:'מודה אני',
      ref: r('The_Morning_Prayers,_Upon_Arising_in_the_Morning',
             'Weekday,_Shacharit,_Preparatory_Prayers,_Modeh_Ani',
             'Preparatory_Prayers,_Modeh_Ani') },
    { label:'עטיפת טלית',
      ref: r('The_Morning_Prayers,_Putting_On_the_Tallis',
             'Weekday,_Shacharit,_Preparatory_Prayers,_Tallit', null) },
    { label:'הנחת תפילין',
      ref: r('The_Morning_Prayers,_Putting_on_the_Tefillin',
             'Weekday,_Shacharit,_Preparatory_Prayers,_Tefillin', null) },
    { label:'ברכות השחר',
      ref: r('The_Morning_Prayers,_Blessings_Upon_Arising',
             'Weekday,_Shacharit,_Preparatory_Prayers,_Morning_Blessings',
             'Preparatory_Prayers,_Morning_Blessings') },
    { label:'ברכות התורה',
      ref: r('The_Morning_Prayers,_Blessings_of_the_Torah',
             'Weekday,_Shacharit,_Preparatory_Prayers,_Torah_Blessings',
             'Preparatory_Prayers,_Torah_Blessings') },
    { label:'ברכות הבוקר',        ref: r('The_Morning_Prayers,_Morning_Blessings', null, null) },
    { label:'עקידה',              ref: r('The_Morning_Prayers,_Akeidah_(The_Binding_of_Isaac)', null, null) },
    { label:'תחנות הבוקר',        ref: r('The_Morning_Prayers,_Morning_Supplications', null, null) },
    { label:'קרבנות',             ref: r('The_Morning_Prayers,_Korbanos_(Sacrificial_Offerings)', null, null) },
    { label:'קרבן תמיד',          ref: r('The_Morning_Prayers,_Korban_Tamid_(Daily_Offering)', null, null) },
    { label:'קטורת',              ref: r('The_Morning_Prayers,_Ketores_(Incense_Offering)', null, null) },
    { label:"קדיש דרבנן",         ref: r("The_Morning_Prayers,_Kaddish_d'Rabanan",
                                          "Kaddish,_Kaddish_d'Rabbanan", null) },
    { label:'הודו',
      ref: r('The_Morning_Prayers,_Hodu', null, 'Weekday_Shacharit,_Hodu') },
    { label:'מזמור שיר',          ref: r('The_Morning_Prayers,_Mizmor_Shir', null, null) },
    { label:"ברוך שאמר",
      ref: r("The_Morning_Prayers,_Baruch_She'amar", null, null) },
    { label:'מזמור לתודה',        ref: r('The_Morning_Prayers,_Mizmor_Lesodah', null, null) },
    { label:'יהי כבוד',           ref: r('The_Morning_Prayers,_Yehi_Chevod', null, null) },
    { label:'אשרי',
      ref: r('The_Morning_Prayers,_Ashrei', null, 'Weekday_Shacharit,_Ashrei') },
    { label:'שירת הים',           ref: r('The_Morning_Prayers,_Shiras_Hayam', null, null) },
    { label:'ישתבח',              ref: r('The_Morning_Prayers,_Yishtabach', null, null) },
    { label:'ברכות קריאת שמע',
      ref: r('The_Morning_Prayers,_The_Blessings_of_Shema', null,
             'Weekday_Shacharit,_The_Shema') },
    { label:'קריאת שמע',
      ref: r('The_Morning_Prayers,_Recitation_of_Shema', null,
             'Weekday_Shacharit,_The_Shema') },
    { label:'שמונה עשרה',
      ref: r('The_Morning_Prayers,_Shemoneh_Esrei', null,
             'Weekday_Shacharit,_Amida') },
    yaaleh,
    { label:'תחנון',
      ref: r('The_Morning_Prayers,_Tachanun', null, null),
      condition:'noTachanun', conditionType:'skip' },
    { label:'אבינו מלכנו ✨',
      ref: r('The_Morning_Prayers,_Avinu_Malkeinu', null, null),
      isAddition:true, condition:'isAvinuMalkeinu' },
    { label:'והוא רחום',          ref: r('The_Morning_Prayers,_Vehu_Rachum', null, null) },
    { label:'הלל ✨',             ref: r('Hallel', null, null), isAddition:true, condition:'isHallelDay' },
    { label:'קריאת התורה ✨',
      ref: r('The_Morning_Prayers,_Reading_of_the_Torah', null,
             'Weekday_Shacharit,_Torah_Reading'),
      isAddition:true, condition:'isTorahReadingDay' },
    { label:'מוסף ר"ח ✨',        ref: r('Musaf_for_Rosh_Chodesh', null, null), isAddition:true, condition:'isRoshChodesh' },
    { label:'ספירת העומר ✨',     ref: r('Counting_the_Omer', null, null), isAddition:true, condition:'isOmer' },
    { label:'שירות חנוכה ✨',     ref: r('Chanukah_Service', null, null), isAddition:true, condition:'isChanuka' },
    { label:"אשרי / ובא לציון",
      ref: r("The_Morning_Prayers,_Ashrei_U'va_L'Tzion", null, null) },
    { label:'מזמור של יום',
      ref: r('The_Morning_Prayers,_Psalm_of_the_Day', null,
             'Weekday_Shacharit,_Song_of_the_Day') },
    { label:'ברכי נפשי',          ref: r('The_Morning_Prayers,_My_Soul_Bless', null, null) },
    { label:'עלינו',
      ref: r('The_Morning_Prayers,_Aleinu', null, 'Weekday_Shacharit,_Alenu') },
    { label:'קדיש יתום',
      ref: r("The_Morning_Prayers,_Mourner's_Kaddish",
             "Kaddish,_Mourner's_Kaddish", null) },
    { label:'שלש עשרה עיקרים',   ref: r('The_Morning_Prayers,_Thirteen_Principles_of_Faith', null, null) },
  ];

  if (prayer === 'mincha') return [
    { label:'אשרי',
      ref: r('Mincha,_Ashrei', 'Weekday,_Minchah,_Ashrei', null) },
    { label:'קריאת התורה ✨',
      ref: r('The_Morning_Prayers,_Reading_of_the_Torah', null, null),
      isAddition:true, condition:'isTorahReadingDay' },
    { label:'שמונה עשרה',
      ref: r('Mincha,_Shemoneh_Esrei', null, 'Weekday_Mincha,_Amida') },
    yaaleh,
    { label:'תחנון',
      ref: r('Mincha,_Tachanun', null, null),
      condition:'noTachanun', conditionType:'skip' },
    { label:'אבינו מלכנו ✨',
      ref: r('The_Morning_Prayers,_Avinu_Malkeinu', null, null),
      isAddition:true, condition:'isAvinuMalkeinu' },
    { label:'למנצח ✨',
      ref: 'Psalms.20',
      isAddition: false,
      // עדות המזרח: למנצח (תהלים כ') לפני עלינו במנחה בלבד
      // ספרד ואשכנז: לא נהוג
      condition: 'isMizrach', conditionType: 'show' },
    { label:'עלינו',
      ref: r('Mincha,_Aleinu', null, 'Weekday_Mincha,_Alenu') },
    { label:'קדיש יתום',          ref:null, staticText:KADDISH_YATOM },
  ];

  if (prayer === 'arvit') return [
    { label:'ברכות קריאת שמע',
      ref: r('Maariv,_Berachos_Preceding_Shema', null, 'Weekday_Arvit,_Barchu') },
    { label:'קריאת שמע',
      ref: r('Maariv,_Shema', null, 'Weekday_Arvit,_The_Shema') },
    { label:'ברכות לאחר שמע',
      ref: r('Maariv,_Berachos_Following_Shema', null, null) },
    { label:'שמונה עשרה',
      ref: r('Maariv,_Shemoneh_Esrei', null, null) },
    yaaleh,
    { label:'עלינו',
      ref: r('Maariv,_Aleinu', null, 'Weekday_Arvit,_Alenu') },
    { label:'קדיש יתום',          ref:null, staticText:KADDISH_YATOM },
  ];

  if (prayer === 'birkat') return [
    { label:'ברכת המזון',
      // Mizrach has no birkat hamazon section → fallback to sfard
      ref: n === 'ashkenaz'
             ? `${ASHK},_Berachot,_Birkat_HaMazon`
             : `${SFARD},_Birkas_Hamazon,_Birkas_Hamazon` },
    { label:'רצה (שבת) ✨',       ref:null, staticText:RATZE_SHABBAT, isAddition:true, condition:'isShabbat' },
    yaaleh, yaalehYT,
    { label:'על הנסים – חנוכה ✨', ref:`${SFARD},_Birkas_Hamazon,_Al_Hanissim_for_Chanukah`, isAddition:true, condition:'isChanuka' },
    { label:'על הנסים – פורים ✨', ref:`${SFARD},_Birkas_Hamazon,_Al_Hanissim_for_Purim`,   isAddition:true, condition:'isPurim' },
  ];

  if (prayer === 'layla') return [
    { label:'קריאת שמע על המיטה',
      ref: r('Prayer_Before_Retiring_at_Night', null, null) },
  ];

  return [];
}

// SIDDUR_SECTIONS reads siddurNusach directly (always current)
const SIDDUR_SECTIONS = {
  get shacharit() { return getSiddurSections(siddurNusach, 'shacharit'); },
  get mincha()    { return getSiddurSections(siddurNusach, 'mincha'); },
  get arvit()     { return getSiddurSections(siddurNusach, 'arvit'); },
  get birkat()    { return getSiddurSections(siddurNusach, 'birkat'); },
  get layla()     { return getSiddurSections(siddurNusach, 'layla'); },
};



// Labels describing when each addition is said (shown above the section)
const CONDITION_LABELS = {
  isRoshChodeshOrMoed:  'נאמר בראש חודש ובחול המועד',
  isRoshChodesh:        'נאמר בראש חודש',
  isCholHamoed:         'נאמר בחול המועד',
  isYomTov:             'נאמר ביום טוב',
  isHallelDay:          'נאמר בראש חודש, חנוכה וחול המועד',
  isTorahReadingDay:    'נאמר בשני, חמישי וראש חודש',
  isAvinuMalkeinu:      'נאמר בעשרת ימי תשובה ובתעניות',
  isOmer:               'נאמר בימי ספירת העומר',
  isChanuka:            'נאמר בחנוכה',
  isPurim:              'נאמר בפורים',
  isShabbat:            'נאמר בשבת',
};

const SIDDUR_CONDITIONS = {
  noTachanun:          () => (window._siddurCal||{}).skipTachanun,
  isRoshChodesh:       () => (window._siddurCal||{}).isRoshChodesh,
  isCholHamoed:        () => (window._siddurCal||{}).isCholHamoed,
  isRoshChodeshOrMoed: () => (window._siddurCal||{}).isRoshChodesh || (window._siddurCal||{}).isCholHamoed,
  isHallelDay:         () => (window._siddurCal||{}).isRoshChodesh || (window._siddurCal||{}).isChanuka || (window._siddurCal||{}).isCholHamoed,
  isTorahReadingDay:   () => (window._siddurCal||{}).isTorahReading || (window._siddurCal||{}).isRoshChodesh,
  isAvinuMalkeinu:     () => (window._siddurCal||{}).isAvinuMalkeinu,
  isOmer:              () => (window._siddurCal||{}).isOmer,
  isChanuka:           () => (window._siddurCal||{}).isChanuka,
  isPurim:             () => (window._siddurCal||{}).isPurim,
  isShabbat:           () => (window._siddurCal||{}).isShabbat,
  isYomTov:            () => (window._siddurCal||{}).isYomTov,
  isMizrach:           () => siddurNusach === 'mizrach',
};

function setSiddurNusach(n) {
  siddurNusach = n;
  window._currentNusach = n;  // used by SIDDUR_SECTIONS getter
  document.querySelectorAll('#nusach-buttons .aliya-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('sn-'+n)?.classList.add('active');
  appState.siddurNusach = n; saveState();
  console.log('[Siddur] nusach changed to', n, '– reloading');
  siddurLoading = false;
  loadSiddur();
}

function setSiddurPrayer(p) {
  siddurPrayer = p;
  document.querySelectorAll('#tefila-type-buttons .aliya-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('sp-'+p)?.classList.add('active');
  loadSiddur();
}

function shouldShowSection(s) {
  if (!s.condition) return true;
  // If calendar not initialized yet, hide all additions (isAddition=true)
  if (!window._siddurCal && s.isAddition) return false;
  const fn = SIDDUR_CONDITIONS[s.condition];
  if (!fn) return true;
  const result = fn();
  return s.conditionType === 'skip' ? !result : !!result;
}

function initSiddur() {
  const dbg = document.getElementById('siddur-debug');
  if (dbg) dbg.textContent = '🔄 initSiddur נקרא... ' + new Date().toLocaleTimeString();
  console.log('[Siddur] initSiddur called, siddurLoading=', siddurLoading);
  // Calendar context for additions
  const todayEvents = appState._todayEventTitles || [];
  const now = new Date();
  let dow = now.getDay(); // 0=Sun,1=Mon,...,6=Sat

  // הלכתי: אחרי השקיעה נכנסנו ליום הבא
  if (appState._lastZmanim && appState._lastZmanim.sunset) {
    const sunsetTime = new Date(appState._lastZmanim.sunset);
    if (now > sunsetTime) dow = (dow + 1) % 7;
  } else if (now.getHours() >= 18) {
    dow = (dow + 1) % 7;
  }
  window._siddurCal = {
    // ── ימים מיוחדים מ-Hebcal events ──
    isRoshChodesh:    todayEvents.some(t => /ראש חודש|Rosh Chodesh/i.test(t)),
    isCholHamoed:     todayEvents.some(t => /חול המועד|Chol HaMoed/i.test(t)),
    isChanuka:        todayEvents.some(t => /חנוכה|Chanukah/i.test(t)),
    isPurim:          todayEvents.some(t => /פורים|Purim/i.test(t)),
    isOmer:           todayEvents.some(t => /עומר|Omer/i.test(t)),
    // אבינו מלכנו: י' ימי תשובה, תעניות ציבור
    isAvinuMalkeinu:  todayEvents.some(t => /תשובה|Aseret Yemei|Yom Kippur|תענית|Ta.anit|Fast|ניסן/i.test(t)),
    // ── ימי שבוע ──
    isTorahReading:   dow === 1 || dow === 4, // ב' וה'
    isSunday:         dow === 0,
    isShabbat:        dow === 6,
    // ── computed ──
    isYomTov: todayEvents.some(t => /יום טוב|Yom Tov|Rosh Hashana|Yom Kippur|Sukkot|Pesach|Shavuot|שמחת|פסח|שבועות|ראש השנה|יום כיפור/i.test(t)),
    get skipTachanun() {
      return this.isRoshChodesh || this.isCholHamoed || this.isChanuka ||
             this.isPurim || this.isSunday || this.isShabbat ||
             todayEvents.some(t => /יום טוב|Yom Tov|Holiday/i.test(t));
    },
  };
  console.log('[Siddur] cal:', JSON.stringify({
    rc: window._siddurCal.isRoshChodesh, moed: window._siddurCal.isCholHamoed,
    chanuka: window._siddurCal.isChanuka, purim: window._siddurCal.isPurim,
    omer: window._siddurCal.isOmer, dow, skipTachanun: window._siddurCal.skipTachanun
  }));
  console.log('[Siddur] _siddurCal=', JSON.stringify(window._siddurCal));
  // Reset loading flag to allow fresh load each time tab is opened
  siddurLoading = false;
  initSiddurFloatBtn();
  // Restore saved nusach
  if (appState.siddurNusach) {
    siddurNusach = appState.siddurNusach;
    document.querySelectorAll('#nusach-buttons .aliya-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('sn-'+siddurNusach)?.classList.add('active');
  }
  window._currentNusach = siddurNusach;
  loadSiddur();
}

// ── Nusach → Sefaria book mapping ──────────────────────────────
// Nusach → Sefaria book + section path mapping
const NUSACH_BOOK = {
  sfard:    'Weekday_Siddur_Sefard_Linear',
  ashkenaz: 'Siddur_Ashkenaz',
  mizrach:  'Siddur_Edot_HaMizrach',
};

// ── No siddur cache - always fetch fresh from Sefaria ──────────
const _siddurCache = {};  // kept for compatibility but not used for caching

function _siddurCacheKey(ref) { return null; }
function _putCache(ref, html) { /* no cache */ }
function _getCache(ref) { return null; /* always fetch fresh */ }

// Render paragraphs array → HTML string for a siddur section
function _renderParagraphs(paragraphs, isAdd) {
  const pColor  = isAdd ? 'var(--addition)' : 'var(--cream)';
  const pStyle  = isAdd ? 'italic'          : 'normal';
  const pWeight = isAdd ? '600'             : '400';
  const baseStyle = `display:block;margin:0 0 8px 0;line-height:1.9;` +
                    `font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);` +
                    `color:${pColor};font-style:${pStyle};font-weight:${pWeight}`;

  return paragraphs.map(p => {
    if (p.startsWith('__HEADER__')) {
      const label = p.slice(10);
      return `<p style="display:block;margin:10px 0 3px 0;font-size:10px;font-weight:700;` +
             `font-style:normal;font-family:'Heebo',sans-serif;color:var(--gold-dim);` +
             `letter-spacing:.5px;border-bottom:1px solid var(--border);padding-bottom:2px">${label}</p>`;
    }
    return `<p style="${baseStyle}">${p}</p>`;
  }).join('');
}

// Convert static multiline text into flowing paragraphs.
function _staticTextToHtml(rawText, isAdd) {
  const pColor  = isAdd ? 'var(--addition)' : 'var(--cream)';
  const pStyle  = isAdd ? 'italic'          : 'normal';
  const pWeight = isAdd ? '600'             : '400';
  const baseStyle = `display:block;margin:0 0 8px 0;line-height:1.9;` +
                    `font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);` +
                    `color:${pColor};font-style:${pStyle};font-weight:${pWeight}`;

  const blocks = [];
  let buf = [];
  for (const raw of rawText.split('\n')) {
    const line = raw.trim();
    if (line) {
      buf.push(line);
    } else {
      if (buf.length) { blocks.push(buf.join(' ')); buf = []; }
    }
  }
  if (buf.length) blocks.push(buf.join(' '));

  return blocks.map(b => `<p style="${baseStyle}">${b}</p>`).join('');
}

// Fetch a single section and return rendered HTML
// Returns ONLY the inner text content (no wrapper div with condition label)
// The skeleton wrapper (with label) stays in place; we replace only the content placeholder
async function _fetchSectionHtml(s, _unused, yaalehOccasion) {
  if (s.staticText && !s.isHallel) {
    const txt = s.staticText.replace('<span id="yaaleh-occasion"></span>', yaalehOccasion);
    return _staticTextToHtml(txt, !!s.isAddition);
  }

  if (s.isHallel) {
    let hallelHtml = '';
    for (const psRef of HALLEL_REFS) {
      const pData = await sefariaText(psRef, 100);
      const flat  = heFlat(pData).map(cleanSefariaHtml).filter(Boolean);
      const psNum = psRef.split('.')[1];
      hallelHtml += `<div style="font-size:11px;font-weight:700;color:var(--addition);margin:10px 0 4px">תהילים פרק ${psNum}</div>`
                 + flat.map(v => `<div style="margin-bottom:2px;color:var(--addition);font-style:italic;font-weight:600">${v}</div>`).join('');
    }
    return hallelHtml;
  }

  const cached = _getCache(s.ref);
  if (cached) {
    console.log('[Siddur] 💾 from-memory-cache:', s.label);
    return cached;
  }

  const data = await sefariaText(s.ref, 0);
  const flat = heFlat(data).map(cleanSefariaHtml).filter(Boolean);
  if (!flat.length) return '<span style="color:var(--muted)">(אין טקסט זמין)</span>';

  const paragraphs = buildParagraphs(flat);
  if (typeof _logParagraphs === 'function') _logParagraphs(s.label, paragraphs);
  const html = _renderParagraphs(paragraphs, !!s.isAddition);
  _putCache(s.ref, html);
  console.log('[Siddur] 🌐 fetched-network:', s.label, '→', paragraphs.length, 'paragraphs,', flat.length, 'verses');
  return html;
}

async function loadSiddur() {
  const dbg2 = document.getElementById('siddur-debug');
  if (dbg2) dbg2.textContent = '⏳ loadSiddur נקרא... ' + new Date().toLocaleTimeString();
  console.log('[Siddur] loadSiddur called, siddurLoading=', siddurLoading, 'prayer=', siddurPrayer, 'nusach=', siddurNusach);
  if (siddurLoading) { console.log('[Siddur] already loading, skip'); if(dbg2) dbg2.textContent += ' (כבר טוען)'; return; }
  siddurLoading = true;

  // Log SW cache status so we can diagnose caching issues
  if ('caches' in window) {
    caches.keys().then(keys => console.log('[SW-Cache] active caches:', keys));
    caches.has(`kodesh-v${APP_VERSION}`).then(has => console.log(`[SW-Cache] kodesh-v${APP_VERSION}:`, has ? '✅ EXISTS' : '❌ NOT FOUND'));
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs =>
      console.log('[SW] registered:', regs.map(r => r.scope + ' state=' + (r.active?.state||'?')))
    );
  }
  if (dbg2) dbg2.textContent = '⏳ sections building... ' + new Date().toLocaleTimeString();

  const titleEl = document.getElementById('siddur-title');
  const subtitleEl = document.getElementById('siddur-subtitle');
  if (titleEl) titleEl.textContent = PRAYER_NAMES[siddurPrayer] || '';
  if (subtitleEl) subtitleEl.textContent = NUSACH_NAMES[siddurNusach] + ' • ספריא';

  const allSections = SIDDUR_SECTIONS[siddurPrayer] || [];
  console.log('[Siddur] allSections count=', allSections.length, 'for prayer=', siddurPrayer);
  const sections    = allSections.filter(s => shouldShowSection(s));
  const total       = sections.length;
  console.log('[Siddur] visible sections=', total, sections.map(s=>s.label));

  // ── Progress bar ──────────────────────────
  const progressWrap = document.getElementById('siddur-progress-wrap');
  const progressBar  = document.getElementById('siddur-progress-bar');
  const progressLbl  = document.getElementById('siddur-progress-lbl');
  console.log('[Siddur] progressWrap found=', !!progressWrap, 'progressBar=', !!progressBar);
  function setProgress(done, label) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (progressBar)  progressBar.style.width = pct + '%';
    if (progressLbl)  progressLbl.textContent = label || '';
    if (progressWrap) progressWrap.style.display = (done >= total) ? 'none' : 'block';
  }
  if (progressWrap) progressWrap.style.display = 'block';
  setProgress(0, sections[0]?.label || 'מכין...');
  try {

  // ── Section jump buttons ──────────────────
  const secNav = document.getElementById('siddur-sections');
  if (secNav) {
    secNav.innerHTML = sections.map(s => {
      const id = s.label.replace(/\s/g,'_');
      return `<button onclick="document.getElementById('ss-${id}')?.scrollIntoView({behavior:'smooth'})"
        style="font-size:10px;padding:3px 8px;border-radius:12px;border:1px solid var(--border);
        background:${s.isAddition?'rgba(126,214,160,.12)':'var(--surface)'};
        color:${s.isAddition?'var(--addition)':'var(--muted)'};cursor:pointer;font-family:'Heebo',sans-serif">
        ${s.label}</button>`;
    }).join('');
  }

  // ── Skeleton placeholders ─────────────────
  const el = document.getElementById('siddur-content');
  el.innerHTML = sections.map((s, idx) => {
    const id = s.label.replace(/\s/g,'_');
    const whenLabel = s.isAddition && s.condition ? (CONDITION_LABELS[s.condition] || '') : '';
    const prevIsAdd = idx > 0 && sections[idx-1].isAddition;

    if (s.isAddition) {
      // Addition block: green border, label stays visible permanently
      const whenHtml = whenLabel
        ? `<div style="font-size:10px;color:var(--addition);opacity:.8;margin-bottom:4px;
            font-style:normal;font-weight:500;font-family:'Heebo',sans-serif">
            📅 ${whenLabel}</div>`
        : '';
      const cleanLabel = s.label.replace(' ✨','');
      return `<div id="ss-${id}" style="margin:6px 0 8px;">
        <div class="siddur-addition-block">
          ${whenHtml}
          <div style="font-size:11px;font-weight:700;font-style:italic;color:var(--addition);
            letter-spacing:.3px;margin-bottom:5px;border-bottom:1px solid var(--addition-border);
            padding-bottom:4px">${cleanLabel}</div>
          <div id="sc-${id}">טוען...</div>
        </div>
      </div>`;
    }

    // Regular section: thin separator between sections, NO extra gap
    const sep = idx > 0 && !prevIsAdd
      ? '<hr style="border:none;border-top:1px solid var(--border);margin:4px 0 6px">' : '';
    return `${sep}<div id="ss-${id}" style="margin-bottom:2px;">
      <div style="font-size:10px;font-weight:700;color:var(--gold-dim);
        margin-bottom:2px;padding-top:2px;font-family:'Heebo',sans-serif">${s.label}</div>
      <div id="sc-${id}">טוען...</div>
    </div>`;
  }).join('');

  const cal = window._siddurCal || {};
  const yaalehOccasion = cal.isRoshChodesh ? 'רֹאשׁ הַחֹדֶשׁ' : cal.isCholHamoed ? 'חֹל הַמּוֹעֵד' : '';

  // ── Prefetch map: ref → Promise<html> ─────
  const prefetchMap = new Map();

  function startPrefetch(idx) {
    if (idx >= sections.length) return;
    const s = sections[idx];
    if (s.staticText || s.isHallel) return;
    if (_getCache(s.ref) || prefetchMap.has(s.ref)) return;
    prefetchMap.set(s.ref, _fetchSectionHtml(s, null, yaalehOccasion).catch(() => null));
  }

  startPrefetch(0);
  startPrefetch(1);

  for (let i = 0; i < sections.length; i++) {
    const s       = sections[i];
    const id      = s.label.replace(/\s/g,'_');
    const contentEl = document.getElementById('sc-' + id);
    if (!contentEl) { setProgress(i+1, ''); continue; }

    setProgress(i, s.label);

    try {
      let html;
      if (!s.staticText && !s.isHallel && prefetchMap.has(s.ref)) {
        html = await prefetchMap.get(s.ref);
        prefetchMap.delete(s.ref);
      }
      if (!html) {
        html = await _fetchSectionHtml(s, null, yaalehOccasion);
      }
      contentEl.innerHTML = html || '<span style="color:var(--muted)">(אין טקסט)</span>';
    } catch(e) {
      contentEl.innerHTML = `<span style="color:var(--muted)">⚠️ ${e.message}</span>`;
      console.warn('[Siddur] failed:', s.label, e.message);
    }

    startPrefetch(i + 2);
    setProgress(i + 1, i + 1 < sections.length ? sections[i+1].label : '');
  }

  setProgress(total, '');
  updateDoneButton('siddur', siddurPrayer);
  } catch(outerErr) {
    console.error('[Siddur] fatal error:', outerErr);
    const el2 = document.getElementById('siddur-content');
    if (el2) el2.innerHTML = `<div style="color:var(--muted);padding:20px;text-align:center">
      ⚠️ שגיאה בטעינת הסידור<br>
      <small style="font-size:11px">${outerErr.message}</small><br><br>
      <button onclick="loaded['siddur']=false;initSiddur()" 
        style="padding:8px 16px;border-radius:8px;border:1px solid var(--gold);background:transparent;color:var(--gold);cursor:pointer">
        נסה שוב
      </button></div>`;
  } finally {
    siddurLoading = false;
    console.log('[Siddur] done:', siddurPrayer, '| cache:', Object.keys(_siddurCache).length);
  }
}

// ── Sections quick-nav popup ──────────────
function openSiddurSectionsPopup() {
  const overlay = document.getElementById('siddur-sec-popup-overlay');
  const popup   = document.getElementById('siddur-sec-popup');
  const list    = document.getElementById('siddur-sec-popup-list');
  if (!popup || !list) return;

  // Rebuild list fresh each time (sections may have changed)
  const sections = document.querySelectorAll('#siddur-content [id^="ss-"]');
  if (!sections.length) return;

  list.innerHTML = '';
  sections.forEach(sec => {
    const id    = sec.id;                        // ss-שמונה_עשרה
    const label = id.slice(3).replace(/_/g,' '); // strip ss- prefix, restore spaces
    const isAdd = sec.querySelector('.siddur-addition-block') !== null;

    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      display:block;width:100%;text-align:right;padding:9px 14px;
      background:none;border:none;cursor:pointer;
      font-family:'Frank Ruhl Libre',serif;font-size:14px;
      color:${isAdd ? 'var(--addition)' : 'var(--cream)'};
      font-style:${isAdd ? 'italic' : 'normal'};
      border-bottom:1px solid rgba(255,255,255,.05);
      transition:background .15s;
    `;
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,.07)';
    btn.onmouseout  = () => btn.style.background = 'none';
    btn.onclick = () => {
      closeSiddurSectionsPopup();
      document.getElementById(id)?.scrollIntoView({behavior:'smooth', block:'start'});
    };
    list.appendChild(btn);
  });

  overlay.style.display = 'block';
  popup.style.display   = 'block';
  // scroll the popup to show current viewport's active section
  _scrollPopupToActive(list);
}

function _scrollPopupToActive(list) {
  // Find which section is currently near the top of the viewport
  const sections = document.querySelectorAll('#siddur-content [id^="ss-"]');
  let activeId = null;
  for (const sec of sections) {
    const rect = sec.getBoundingClientRect();
    if (rect.top >= 0 && rect.top < window.innerHeight * 0.5) {
      activeId = sec.id;
      break;
    }
  }
  if (!activeId) return;
  const label = activeId.slice(3).replace(/_/g,' ');
  const btns  = list.querySelectorAll('button');
  for (const btn of btns) {
    if (btn.textContent === label) {
      btn.style.background = 'rgba(201,165,74,.12)';
      btn.style.color      = 'var(--gold)';
      btn.scrollIntoView({block:'nearest'});
      break;
    }
  }
}

function closeSiddurSectionsPopup() {
  const overlay = document.getElementById('siddur-sec-popup-overlay');
  const popup   = document.getElementById('siddur-sec-popup');
  if (overlay) overlay.style.display = 'none';
  if (popup)   popup.style.display   = 'none';
}

// Show/hide floating nav button based on scroll position
function initSiddurFloatBtn() {
  const btn    = document.getElementById('siddur-float-btn');
  const secBtn = document.getElementById('siddur-sec-btn');
  if (!btn) return;
  const page      = document.getElementById('page-siddur');
  const topAnchor = document.getElementById('siddur-top');

  function updateBtn() {
    if (!page || !page.classList.contains('active')) return;
    const anchorY  = topAnchor ? topAnchor.getBoundingClientRect().top : -999;
    const scrolled = anchorY < -80 || (page.scrollTop || 0) > 150;
    btn.style.opacity       = scrolled ? '1' : '0';
    btn.style.pointerEvents = scrolled ? 'auto' : 'none';
    if (secBtn) {
      secBtn.style.opacity       = scrolled ? '1' : '0';
      secBtn.style.pointerEvents = scrolled ? 'auto' : 'none';
    }
  }

  page.addEventListener('scroll', updateBtn, { passive: true });
  window.addEventListener('scroll', updateBtn, { passive: true });
  document.addEventListener('scroll', updateBtn, { passive: true });
  btn._update = updateBtn;
}

function storeTodayEventsForSiddur(items) {
  appState._todayEventTitles = items.map(i => i.title || i.hebrew || '');
  saveState();
}

// ═══════════════════════════════════════════
function toggleZmanimReminder(type, enabled) {
  if (!appState.zmanimReminders) appState.zmanimReminders = {};
  appState.zmanimReminders[type] = enabled;
  saveState();
  console.log('[ZmanimRem]', type, enabled ? 'enabled' : 'disabled');
  if (enabled) scheduleZmanimRemindersForToday();
}

function scheduleZmanimRemindersForToday() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') _doScheduleZmanimReminders();
    });
  } else {
    _doScheduleZmanimReminders();
  }
}

function _doScheduleZmanimReminders() {
  const z = appState._lastZmanim;
  if (!z) { console.warn('[ZmanimRem] no zmanim cached yet'); return; }
  const rem = appState.zmanimReminders || {};
  const now = Date.now();
  const ADVANCE_MS = 15 * 60 * 1000;

  // sof zman shma: use the later of GRA (sofZmanShma) and MGA
  if (rem.shema) {
    const times = [z.sofZmanShma, z.sofZmanShmaMGA].filter(Boolean).map(t => new Date(t).getTime());
    const latest = Math.max(...times);
    const fireAt = latest - ADVANCE_MS;
    if (fireAt > now) {
      const delay = fireAt - now;
      console.log('[ZmanimRem] shema reminder in', Math.round(delay/60000), 'min');
      setTimeout(() => {
        new Notification('⏰ לימוד יומי', {
          body: 'עוד 15 דקות לסוף זמן קריאת שמע!',
          icon: 'icons/icon-192.png',
          tag: 'shema-reminder',
        });
      }, delay);
    }
  }

  // sof zman tefila
  if (rem.tefila) {
    const times = [z.sofZmanTfilla, z.sofZmanTfillaMGA].filter(Boolean).map(t => new Date(t).getTime());
    const latest = Math.max(...times);
    const fireAt = latest - ADVANCE_MS;
    if (fireAt > now) {
      const delay = fireAt - now;
      setTimeout(() => new Notification('⏰ לימוד יומי', {
        body: 'עוד 15 דקות לסוף זמן תפילה!',
        icon: 'icons/icon-192.png', tag: 'tefila-reminder',
      }), delay);
    }
  }

  // חצות היום
  if (rem.noon && z.chatzot) {
    const fireAt = new Date(z.chatzot).getTime() - ADVANCE_MS;
    if (fireAt > now) setTimeout(() => new Notification('⏰ לימוד יומי', {
      body: 'עוד 15 דקות לחצות היום!',
      icon: 'icons/icon-192.png', tag: 'noon-reminder',
    }), fireAt - now);
  }

  // שקיעה
  if (rem.sunset && z.sunset) {
    const fireAt = new Date(z.sunset).getTime() - ADVANCE_MS;
    if (fireAt > now) setTimeout(() => new Notification('⏰ לימוד יומי', {
      body: 'עוד 15 דקות לשקיעת החמה!',
      icon: 'icons/icon-192.png', tag: 'sunset-reminder',
    }), fireAt - now);
  }

  // צאת הכוכבים
  if (rem.tzeit) {
    const tzeitTime = z.sunset ? new Date(new Date(z.sunset).getTime() + 18*60000).toISOString() : z.tzeit7083deg || z.tzeit85deg;
    if (tzeitTime) {
      const fireAt = new Date(tzeitTime).getTime() - ADVANCE_MS;
      if (fireAt > now) setTimeout(() => new Notification('⏰ לימוד יומי', {
        body: 'עוד 15 דקות לצאת הכוכבים!',
        icon: 'icons/icon-192.png', tag: 'tzeit-reminder',
      }), fireAt - now);
    }
  }
}
