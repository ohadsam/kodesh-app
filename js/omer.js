// ═══════════════════════════════════════════
// OMER – ספירת העומר
// Nusach Sfard, full text with daily addition in יהי רצון
// After tzet hakochavim → show next day's count
// ═══════════════════════════════════════════

// Hebrew number words for omer counting
const _OMER_ONES = ['','אֶחָד','שְׁנַיִם','שְׁלֹשָׁה','אַרְבָּעָה','חֲמִשָּׁה','שִׁשָּׁה','שִׁבְעָה','שְׁמוֹנָה','תִּשְׁעָה','עֲשָׂרָה'];
const _OMER_TENS = ['','','עֶשְׂרִים','שְׁלֹשִׁים','אַרְבָּעִים'];
const _OMER_WEEKS = ['','שָׁבוּעַ אֶחָד','שְׁנֵי שָׁבוּעוֹת','שְׁלֹשָׁה שָׁבוּעוֹת','אַרְבָּעָה שָׁבוּעוֹת','חֲמִשָּׁה שָׁבוּעוֹת','שִׁשָּׁה שָׁבוּעוֹת'];
const _OMER_DAYS_IN_WEEK = ['','יוֹם אֶחָד','שְׁנֵי יָמִים','שְׁלֹשָׁה יָמִים','אַרְבָּעָה יָמִים','חֲמִשָּׁה יָמִים','שִׁשָּׁה יָמִים'];

// Total days in words (1–49)
function _omerDayHe(n) {
  if (n <= 10) return _OMER_ONES[n];
  if (n < 20) return [
    'אַחַד עָשָׂר','שְׁנֵים עָשָׂר','שְׁלֹשָׁה עָשָׂר','אַרְבָּעָה עָשָׂר',
    'חֲמִשָּׁה עָשָׂר','שִׁשָּׁה עָשָׂר','שִׁבְעָה עָשָׂר','שְׁמוֹנָה עָשָׂר','תִּשְׁעָה עָשָׂר'
  ][n - 11];
  const tens = Math.floor(n/10), ones = n%10;
  return ones ? `${_OMER_ONES[ones]} וְ${_OMER_TENS[tens]}` : _OMER_TENS[tens];
}

// Build the full day string per halacha:
// Days 1-6: "יוֹם אֶחָד", "שְׁנֵי יָמִים" ... "שִׁשָּׁה יָמִים"
// Days 7,14,21...: "שִׁבְעָה יָמִים שֶׁהֵם שָׁבוּעַ אֶחָד"
// Days 8+: "אַחַד עָשָׂר יוֹם שֶׁהֵם שָׁבוּעַ אֶחָד וְאַרְבָּעָה יָמִים"
function _omerCountStr(day) {
  const total = _omerDayHe(day);
  const weeks = Math.floor(day / 7);
  const rem   = day % 7;

  // Special construct: "שְׁנֵי יָמִים" (not שְׁנַיִם יָמִים) for day 2
  const totalForPlural = day === 2 ? 'שְׁנֵי' : total;

  // days without weeks: "יוֹם אֶחָד" / "שְׁנֵי יָמִים" / "X יָמִים"
  const dayWordPlural = day === 1 ? 'יוֹם אֶחָד' : `${totalForPlural} יָמִים`;
  // days with weeks + remainder: "X יוֹם" (singular, per halacha)
  const dayWordSingular = `${total} יוֹם`;

  if (weeks === 0) return `${dayWordPlural} לָעֹמֶר`;
  const weekStr = _OMER_WEEKS[weeks];
  if (rem === 0)  return `${dayWordPlural} שֶׁהֵם ${weekStr} לָעֹמֶר`;
  return `${dayWordSingular} שֶׁהֵם ${weekStr} וְ${_OMER_DAYS_IN_WEEK[rem]} לָעֹמֶר`;
}

// Kabbalistic attribute for each week/day (for יהי רצון)
const _SEFIROT = ['חֶסֶד','גְּבוּרָה','תִּפְאֶרֶת','נֶצַח','הוֹד','יְסוֹד','מַלְכוּת'];
function _omerSefira(day) {
  const week = Math.floor((day-1)/7); // 0-indexed week
  const d    = (day-1) % 7;           // 0-indexed day in week
  return `${_SEFIROT[d]} שֶׁבְּ${_SEFIROT[week]}`;
}

// Full omer text for a given day number
function buildOmerText(day) {
  if (day < 1 || day > 49) return '';
  const count = _omerCountStr(day);
  const sefira = _omerSefira(day);

  return [
    // לשם יחוד
    { type: 'muted', text: 'לְשֵׁם יִחוּד קוּדְשָׁא בְּרִיךְ הוּא וּשְׁכִינְתֵּיהּ, בִּדְחִילוּ וּרְחִימוּ וּרְחִימוּ וּדְחִילוּ, לְיַחֲדָא שֵׁם יוּ"ד הֵ"א בְּוָ"ו הֵ"א בְּיִחוּדָא שְׁלִים בְּשֵׁם כָּל יִשְׂרָאֵל.' },
    { type: 'muted', text: 'הִנְנִי מוּכָן וּמְזֻמָּן לְקַיֵּם מִצְוַת עֲשֵׂה שֶׁל סְפִירַת הָעֹמֶר, כְּמוֹ שֶׁכָּתוּב בַּתּוֹרָה: וּסְפַרְתֶּם לָכֶם מִמָּחֳרַת הַשַּׁבָּת מִיּוֹם הֲבִיאֲכֶם אֶת עֹמֶר הַתְּנוּפָה, שֶׁבַע שַׁבָּתוֹת תְּמִימֹת תִּהְיֶינָה. עַד מִמָּחֳרַת הַשַּׁבָּת הַשְּׁבִיעִת תִּסְפְּרוּ חֲמִשִּׁים יוֹם.' },
    { type: 'spacer' },

    // ברכה
    { type: 'bracha', text: 'בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו וְצִוָּנוּ עַל סְפִירַת הָעֹמֶר.' },
    { type: 'spacer' },

    // הספירה
    { type: 'count', text: `הַיּוֹם ${count}.` },
    { type: 'spacer' },

    // רחמנא
    { type: 'text', text: 'הָרַחֲמָן הוּא יַחֲזִיר לָנוּ עֲבוֹדַת בֵּית הַמִּקְדָּשׁ לִמְקוֹמָהּ, בִּמְהֵרָה בְיָמֵינוּ אָמֵן סֶלָה.' },
    { type: 'spacer' },

    // למנצח
    { type: 'text', text: 'לַמְנַצֵּחַ בִּנְגִינֹת מִזְמוֹר שִׁיר. אֱלֹהִים יְחָנֵּנוּ וִיבָרְכֵנוּ, יָאֵר פָּנָיו אִתָּנוּ סֶלָה. לָדַעַת בָּאָרֶץ דַּרְכֶּךָ בְּכָל גּוֹיִם יְשׁוּעָתֶךָ. יוֹדוּךָ עַמִּים אֱלֹהִים יוֹדוּךָ עַמִּים כֻּלָּם. יִשְׂמְחוּ וִירַנְּנוּ לְאֻמִּים כִּי תִשְׁפֹּט עַמִּים מִישׁוֹר וּלְאֻמִּים בָּאָרֶץ תַּנְחֵם סֶלָה. יוֹדוּךָ עַמִּים אֱלֹהִים יוֹדוּךָ עַמִּים כֻּלָּם. אֶרֶץ נָתְנָה יְבוּלָהּ יְבָרְכֵנוּ אֱלֹהִים אֱלֹהֵינוּ. יְבָרְכֵנוּ אֱלֹהִים וְיִירְאוּ אוֹתוֹ כָּל אַפְסֵי אָרֶץ.' },
    { type: 'spacer' },

    // אנא בכח
    { type: 'text', text: 'אָנָּא בְּכֹחַ גְּדֻלַּת יְמִינְךָ תַּתִּיר צְרוּרָה. קַבֵּל רִנַּת עַמְּךָ שַׂגְּבֵנוּ טַהֲרֵנוּ נוֹרָא. נָא גִבּוֹר דּוֹרְשֵׁי יִחוּדְךָ כְּבָבַת שָׁמְרֵם. בָּרְכֵם טַהֲרֵם רַחֲמֵי צִדְקָתְךָ תָּמִיד גָּמְלֵם. חֲסִין קָדוֹשׁ בְּרֹב טוּבְךָ נַהֵל עֲדָתֶךָ. יָחִיד גֵּאֶה לְעַמְּךָ פְּנֵה זוֹכְרֵי קְדֻשָּׁתֶךָ. שַׁוְעָתֵנוּ קַבֵּל וּשְׁמַע צַעֲקָתֵנוּ יוֹדֵעַ תַּעֲלוּמוֹת.' },
    { type: 'spacer' },

    // יהי רצון – תיקון הספירה
    { type: 'text', text: `יְהִי רָצוֹן מִלְּפָנֶיךָ יְהֹוָה אֱלֹהֵינוּ וֵאלֹהֵי אֲבוֹתֵינוּ, שֶׁבִּזְכוּת סְפִירַת הָעֹמֶר שֶׁסָּפַרְתִּי הַיּוֹם, יְתֻקַּן מַה שֶּׁפָּגַמְתִּי בִּסְפִירַת ${sefira}, וְאֶטָּהֵר וְאֶתְקַדֵּשׁ בִּקְדֻשָּׁה שֶׁל מַעְלָה, וְעַל יְדֵי זֶה יוּשְׁפַּע שֶׁפַע רַב בְּכָל הָעוֹלָמוֹת, וּלְתַקֵּן אֶת נַפְשׁוֹתֵינוּ וְרוּחוֹתֵינוּ וְנִשְׁמוֹתֵינוּ מִכָּל סִיג וּפְגָם, וּלְטַהֲרֵנוּ וּלְקַדְּשֵׁנוּ בִּקְדֻשָּׁתְךָ הָעֶלְיוֹנָה, אָמֵן סֶלָה.` },
    { type: 'spacer' },

    // עלינו לשבח
    { type: 'text', text: 'עָלֵינוּ לְשַׁבֵּחַ לַאֲדוֹן הַכֹּל, לָתֵת גְּדֻלָּה לְיוֹצֵר בְּרֵאשִׁית, שֶׁלֹּא עָשָׂנוּ כְּגוֹיֵי הָאֲרָצוֹת, וְלֹא שָׂמָנוּ כְּמִשְׁפְּחוֹת הָאֲדָמָה. שֶׁלֹּא שָׂם חֶלְקֵנוּ כָּהֶם, וְגוֹרָלֵנוּ כְּכָל הֲמוֹנָם.' },
    { type: 'text', text: 'וַאֲנַחְנוּ כּוֹרְעִים וּמִשְׁתַּחֲוִים וּמוֹדִים, לִפְנֵי מֶלֶךְ מַלְכֵי הַמְּלָכִים הַקָּדוֹשׁ בָּרוּךְ הוּא. שֶׁהוּא נוֹטֶה שָׁמַיִם וְיוֹסֵד אָרֶץ, וּמוֹשַׁב יְקָרוֹ בַּשָּׁמַיִם מִמַּעַל, וּשְׁכִינַת עֻזּוֹ בְּגָבְהֵי מְרוֹמִים. הוּא אֱלֹהֵינוּ אֵין עוֹד, אֱמֶת מַלְכֵּנוּ אֶפֶס זוּלָתוֹ, כַּכָּתוּב בְּתוֹרָתוֹ: וְיָדַעְתָּ הַיּוֹם וַהֲשֵׁבֹתָ אֶל לְבָבֶךָ, כִּי יְהֹוָה הוּא הָאֱלֹהִים בַּשָּׁמַיִם מִמַּעַל וְעַל הָאָרֶץ מִתָּחַת אֵין עוֹד.' },
    { type: 'spacer' },
    { type: 'text', text: 'עַל כֵּן נְקַוֶּה לְּךָ יְהֹוָה אֱלֹהֵינוּ לִרְאוֹת מְהֵרָה בְּתִפְאֶרֶת עֻזֶּךָ, לְהַעֲבִיר גִּלּוּלִים מִן הָאָרֶץ, וְהָאֱלִילִים כָּרוֹת יִכָּרֵתוּן, לְתַקֵּן עוֹלָם בְּמַלְכוּת שַׁדַּי. וְכָל בְּנֵי בָשָׂר יִקְרְאוּ בִשְׁמֶךָ, לְהַפְנוֹת אֵלֶיךָ כָּל רִשְׁעֵי אָרֶץ. יַכִּירוּ וְיֵדְעוּ כָּל יוֹשְׁבֵי תֵבֵל, כִּי לְךָ תִּכְרַע כָּל בֶּרֶךְ, תִּשָּׁבַע כָּל לָשׁוֹן. לְפָנֶיךָ יְהֹוָה אֱלֹהֵינוּ יִכְרְעוּ וְיִפֹּלוּ, וְלִכְבוֹד שִׁמְךָ יְקָר יִתֵּנוּ, וִיקַבְּלוּ כֻלָּם אֶת עֹל מַלְכוּתֶךָ, וְתִמְלֹךְ עֲלֵיהֶם מְהֵרָה לְעוֹלָם וָעֶד. כִּי הַמַּלְכוּת שֶׁלְּךָ הִיא, וּלְעוֹלְמֵי עַד תִּמְלוֹךְ בְּכָבוֹד, כַּכָּתוּב בְּתוֹרָתֶךָ: יְהֹוָה יִמְלֹךְ לְעֹלָם וָעֶד. וְנֶאֱמַר: וְהָיָה יְהֹוָה לְמֶלֶךְ עַל כָּל הָאָרֶץ, בַּיּוֹם הַהוּא יִהְיֶה יְהֹוָה אֶחָד וּשְׁמוֹ אֶחָד.' },
  ];
}

// ── Calculate today's omer day ──────────────────────────────────────
function getOmerDay() {
  // Pesach = 15 Nisan. Count starts 16 Nisan (day 1).
  // Use the Hebrew date from appState if available
  const hDate = appState?._lastHebrewDate;
  if (!hDate) return null;

  let month = hDate.hm; // "Nisan", "Iyar", "Sivan"
  let day   = hDate.hd;

  // IMPORTANT: Hebcal converter returns the DAYTIME Hebrew date.
  // After sunset, the Hebrew date has already advanced.
  // But getOmerDayForDisplay() handles the +1 advancement after tzet.
  // So here we just compute based on the raw Hebrew date.

  let omerDay = null;
  if (month === 'Nisan' && day >= 16) omerDay = day - 15;
  else if (month === 'Iyar')           omerDay = day + 15;
  else if (month === 'Sivan' && day <= 5) omerDay = day + 44;

  return omerDay; // 1..49 or null
}

// ── Determine whether to show today or tomorrow ─────────────────────
function getOmerDayForDisplay() {
  const tzet = appState?._lastZmanim?.sunset
    ? new Date(new Date(appState._lastZmanim.sunset).getTime() + 18*60000)
    : null;
  const now = new Date();

  let day = getOmerDay();

  // After tzet → advance to next day's count
  if (tzet && now >= tzet) {
    if (day === null) {
      // We might be on Nisan 15 evening → first night of omer = day 1
      const hDate = appState?._lastHebrewDate;
      if (hDate && hDate.hm === 'Nisan' && hDate.hd === 15) {
        return 1;
      }
      return null;
    }
    day = day + 1;
    if (day > 49) return null;
  }

  // During the day: if we're in the omer period, show today's count
  // (counted previous evening, displayed during the day)
  return day;
}

// ── Render omer modal ───────────────────────────────────────────────
async function showOmerNow() {
  closeSettings();
  // Ensure Hebrew date is available
  if (!appState?._lastHebrewDate) {
    try {
      const ds = formatDate(getTargetDate());
      const data = await fetchWithDelay(`https://www.hebcal.com/converter?cfg=json&date=${ds}&g2h=1&strict=1`, 100);
      if (data) {
        appState._lastHebrewDate = { hm: data.hm, hd: data.hd, hy: data.hy };
        saveState();
      }
    } catch(e) { console.warn('[Omer] failed to fetch Hebrew date:', e.message); }
  }

  const day = getOmerDayForDisplay();
  const modal = document.getElementById('omer-modal');
  const titleEl = document.getElementById('omer-day-title');
  const contentEl = document.getElementById('omer-content');
  const doneBtn = document.getElementById('omer-done-btn');

  if (!day) {
    // Not omer period – still allow viewing (compute from current date)
    titleEl.textContent = 'אין ספירת עומר היום';
    contentEl.innerHTML = '<div style="color:var(--muted);padding:30px;text-align:center">ספירת העומר מסיום פסח עד חג השבועות (49 ימים)</div>';
    modal.style.display = 'flex';
    return;
  }

  titleEl.textContent = `יום ${day} לעומר`;

  // Check if already counted today
  const todayKey = `omer_done_${formatDate(new Date())}`;
  const alreadyDone = localStorage.getItem(todayKey) === '1';
  if (alreadyDone) {
    doneBtn.textContent = '✅ כבר ספרת היום';
    doneBtn.style.opacity = '0.6';
    doneBtn.style.cursor = 'default';
  } else {
    doneBtn.textContent = '✅ ספרתי היום';
    doneBtn.style.opacity = '1';
    doneBtn.style.cursor = 'pointer';
  }

  // Render text
  const sections = buildOmerText(day);
  contentEl.innerHTML = sections.map(s => {
    if (s.type === 'spacer') return '<div style="height:12px"></div>';
    const baseStyle = 'text-align:right;direction:rtl;margin-bottom:4px';
    if (s.type === 'muted')  return `<p style="${baseStyle};color:var(--muted);font-size:calc(var(--font-size)*.88);font-style:italic;line-height:1.85">${s.text}</p>`;
    if (s.type === 'bracha') return `<p style="${baseStyle};color:var(--gold);font-weight:600;line-height:1.9;font-size:var(--font-size)">${s.text}</p>`;
    if (s.type === 'count')  return `<p style="${baseStyle};color:var(--cream);font-size:calc(var(--font-size)*1.1);font-weight:700;line-height:1.9">${s.text}</p>`;
    return `<p style="${baseStyle};color:var(--cream);line-height:1.9">${s.text}</p>`;
  }).join('');

  modal.style.display = 'flex';
}

function closeOmerModal() {
  document.getElementById('omer-modal').style.display = 'none';
}

function markOmerDone() {
  const todayKey = `omer_done_${formatDate(new Date())}`;
  localStorage.setItem(todayKey, '1');
  const btn = document.getElementById('omer-done-btn');
  btn.textContent = '✅ כבר ספרת היום';
  btn.style.opacity = '0.6';
  btn.style.cursor = 'default';
  console.log('[Omer] marked done for', formatDate(new Date()));
}

// ── Schedule omer reminder ───────────────────────────────────────────
// Called from scheduleZmanimRemindersForToday (or on its own)
function scheduleOmerReminder() {
  const r = appState?.reminders?.omer;
  if (!r?.enabled) return;
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm !== 'granted') return;
    const day = getOmerDayForDisplay();
    if (!day) return; // not omer period

    const [h,m] = (r.time || '21:30').split(':').map(Number);
    const now    = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    console.log(`[Omer] reminder scheduled in ${Math.round(delay/60000)} min for day ${day}`);
    setTimeout(() => {
      const body = `היום ${day} לעומר`;
      new Notification('🌾 ספירת העומר', { body, icon: 'icons/icon-192.png' });
    }, delay);
  });
}

// Hook into settings restore
function restoreOmerSettings() {
  const r = appState?.reminders?.omer || {};
  const tog = document.getElementById('tog-omer');
  const inp = document.getElementById('rem-omer');
  if (tog) tog.checked = !!r.enabled;
  if (inp && r.time) inp.value = r.time;
}
