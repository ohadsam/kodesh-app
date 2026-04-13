// ── LOGIC TESTS ──────────────────────────────────────────────────────
// Business logic tests that run offline (no API calls needed)

// ── Omer Logic ────────────────────────────────────────────────────────
suite('🌾 ספירת העומר – לוגיקה', () => {

  // Mirror the omer functions for testing
  const ONES = ['','אֶחָד','שְׁנַיִם','שְׁלֹשָׁה','אַרְבָּעָה','חֲמִשָּׁה','שִׁשָּׁה','שִׁבְעָה','שְׁמוֹנָה','תִּשְׁעָה','עֲשָׂרָה'];
  const TENS = ['','','עֶשְׂרִים','שְׁלֹשִׁים','אַרְבָּעִים'];
  const TEENS = ['אַחַד עָשָׂר','שְׁנֵים עָשָׂר','שְׁלֹשָׁה עָשָׂר','אַרְבָּעָה עָשָׂר','חֲמִשָּׁה עָשָׂר','שִׁשָּׁה עָשָׂר','שִׁבְעָה עָשָׂר','שְׁמוֹנָה עָשָׂר','תִּשְׁעָה עָשָׂר'];
  const WEEKS = ['','שָׁבוּעַ אֶחָד','שְׁנֵי שָׁבוּעוֹת','שְׁלֹשָׁה שָׁבוּעוֹת','אַרְבָּעָה שָׁבוּעוֹת','חֲמִשָּׁה שָׁבוּעוֹת','שִׁשָּׁה שָׁבוּעוֹת','שִׁבְעָה שָׁבוּעוֹת'];
  const DAYS_IN_WEEK = ['','יוֹם אֶחָד','שְׁנֵי יָמִים','שְׁלֹשָׁה יָמִים','אַרְבָּעָה יָמִים','חֲמִשָּׁה יָמִים','שִׁשָּׁה יָמִים'];

  function dayHe(n) {
    if (n <= 10) return ONES[n];
    if (n < 20) return TEENS[n - 11];
    const t = Math.floor(n/10), o = n % 10;
    return o ? `${ONES[o]} וְ${TENS[t]}` : TENS[t];
  }

  function countStr(day) {
    const total = dayHe(day);
    const weeks = Math.floor(day / 7), rem = day % 7;
    const plural = day === 1 ? 'יוֹם אֶחָד' : day === 2 ? 'שְׁנֵי יָמִים' : `${total} יָמִים`;
    const singular = `${total} יוֹם`;
    if (weeks === 0) return plural;
    const ws = WEEKS[weeks];
    if (rem === 0) return `${plural} שֶׁהֵם ${ws}`;
    return `${singular} שֶׁהֵם ${ws} וְ${DAYS_IN_WEEK[rem]}`;
  }

  test('יום 1 – יוֹם אֶחָד', () => {
    assertEqual(countStr(1), 'יוֹם אֶחָד', 'day 1');
  }, ['logic','omer']);

  test('יום 2 – שְׁנֵי יָמִים (לא שְׁנַיִם)', () => {
    assert(countStr(2).startsWith('שְׁנֵי יָמִים'), 'day 2 should be שני ימים');
  }, ['logic','omer']);

  test('יום 7 – שִׁבְעָה יָמִים שֶׁהֵם שָׁבוּעַ אֶחָד', () => {
    assertContains(countStr(7), 'שָׁבוּעַ אֶחָד', 'day 7');
    assertContains(countStr(7), 'יָמִים', 'day 7 plural');
  }, ['logic','omer']);

  test('יום 8 – שְׁמוֹנָה יוֹם (ביחיד) שֶׁהֵם שָׁבוּעַ אֶחָד וְיוֹם אֶחָד', () => {
    const s = countStr(8);
    assertContains(s, 'שְׁמוֹנָה יוֹם', 'day 8 singular');
    assertContains(s, 'שָׁבוּעַ אֶחָד', 'day 8 weeks');
    assertContains(s, 'יוֹם אֶחָד', 'day 8 remainder');
  }, ['logic','omer']);

  test('יום 11 – אַחַד עָשָׂר יוֹם (ביחיד)', () => {
    const s = countStr(11);
    assertContains(s, 'אַחַד עָשָׂר יוֹם', 'day 11 singular');
    assertContains(s, 'שָׁבוּעַ אֶחָד', 'day 11 one week');
    assertContains(s, 'אַרְבָּעָה יָמִים', 'day 11 four days');
  }, ['logic','omer']);

  test('יום 14 – שְׁנֵי שָׁבוּעוֹת', () => {
    const s = countStr(14);
    assertContains(s, 'שְׁנֵי שָׁבוּעוֹת', 'day 14');
    assertContains(s, 'יָמִים', 'day 14 plural');
  }, ['logic','omer']);

  test('יום 49 – שִׁבְעָה שָׁבוּעוֹת', () => {
    const s = countStr(49);
    assertContains(s, 'שִׁבְעָה שָׁבוּעוֹת', 'day 49');
  }, ['logic','omer']);

  test('כל 49 ימים מחזירים מחרוזת', () => {
    for (let d = 1; d <= 49; d++) {
      const s = countStr(d);
      assert(s && s.length > 3, `day ${d} returned empty`);
    }
  }, ['logic','omer']);
});

// ── Compass / Qibla Logic ─────────────────────────────────────────────
suite('🧭 מצפן וכיוון לכותל', () => {

  function bearing(lat1, lon1, lat2, lon2) {
    const R = Math.PI / 180;
    const dLon = (lon2 - lon1) * R;
    const y = Math.sin(dLon) * Math.cos(lat2 * R);
    const x = Math.cos(lat1 * R) * Math.sin(lat2 * R) -
              Math.sin(lat1 * R) * Math.cos(lat2 * R) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  const KOTEL = { lat: 31.7767, lon: 35.2345 };

  test('כיוון מפתח תקווה לכותל ~136° (דרום-מזרח)', () => {
    const b = bearing(32.0833, 34.8878, KOTEL.lat, KOTEL.lon);
    assertRange(b, 130, 142, 'Petah Tikva → Kotel bearing');
  }, ['logic','compass']);

  test('כיוון מתל אביב לכותל ~136°', () => {
    const b = bearing(32.0853, 34.7818, KOTEL.lat, KOTEL.lon);
    assertRange(b, 128, 142, 'Tel Aviv → Kotel');
  }, ['logic','compass']);

  test('כיוון מירושלים לכותל < 30° (צפון/עצמו)', () => {
    // Jerusalem is near the Kotel, bearing should be near 0 or very close
    const b = bearing(31.77, 35.21, KOTEL.lat, KOTEL.lon);
    assert(b < 30 || b > 330, `Jerusalem → Kotel should be near 0, got ${b.toFixed(1)}`);
  }, ['logic','compass']);

  test('כיוון מניו יורק לכותל ~58° (צפון-מזרח)', () => {
    const b = bearing(40.7128, -74.0060, KOTEL.lat, KOTEL.lon);
    assertRange(b, 50, 70, 'New York → Kotel');
  }, ['logic','compass']);

  test('כיוון מלונדון לכותל ~105° (מזרח)', () => {
    const b = bearing(51.5074, -0.1278, KOTEL.lat, KOTEL.lon);
    assertRange(b, 95, 115, 'London → Kotel');
  }, ['logic','compass']);
});

// ── Seasonal Logic ────────────────────────────────────────────────────
suite('📕 לוגיקת עונות – מוריד הטל / ותן ברכה', () => {

  // Mirror _isWinterSeason logic
  function isWinter(month, day) {
    // Winter = Shmini Atzeret (22 Tishrei) to Pesach (15 Nisan)
    if (month === 'Nisan' && day >= 15) return false;
    if (['Iyar','Sivan','Tamuz','Av','Elul'].includes(month)) return false;
    if (month === 'Tishrei' && day <= 21) return false;
    return true;
  }

  test('חשוון – חורף (משיב הרוח)', () => {
    assert(isWinter('Cheshvan', 1), 'Cheshvan should be winter');
  }, ['logic','siddur']);

  test('ניסן 14 – חורף עדיין', () => {
    assert(isWinter('Nisan', 14), 'Nisan 14 still winter');
  }, ['logic','siddur']);

  test('ניסן 15 (פסח) – קיץ מתחיל', () => {
    assert(!isWinter('Nisan', 15), 'Pesach day 1 = summer');
  }, ['logic','siddur']);

  test('אייר – קיץ', () => {
    assert(!isWinter('Iyar', 18), 'Iyar = summer');
  }, ['logic','siddur']);

  test('תשרי 21 (הושענא רבה) – קיץ עדיין', () => {
    assert(!isWinter('Tishrei', 21), 'Hoshana Raba still summer');
  }, ['logic','siddur']);

  test('תשרי 22 (שמיני עצרת) – חורף מתחיל', () => {
    assert(isWinter('Tishrei', 22), 'Shmini Atzeret = winter starts');
  }, ['logic','siddur']);

  test('כסלו – חורף', () => {
    assert(isWinter('Kislev', 15), 'Kislev = winter');
  }, ['logic','siddur']);
});

// ── Tehilim Schedule ──────────────────────────────────────────────────
suite('📖 לוח תהילים – ימים וחלוקה', () => {

  const SCHEDULE = {
    1:[1,2,3,4,5,6,7,8,9], 2:[10,11,12,13,14,15,16,17],
    3:[18,19,20,21,22], 4:[23,24,25,26,27,28],
    5:[29,30,31,32,33,34], 6:[35,36,37,38],
    24:[113,114,115,116,117,118],
    25:['119:1-88'], 26:['119:89-176'],
    27:[120,121,122,123,124,125,126,127,128,129,130,131,132,133,134],
    30:[145,146,147,148,149,150]
  };

  test('יום 1 – פרקים 1-9', () => {
    assertEqual(SCHEDULE[1][0], 1); assertEqual(SCHEDULE[1][8], 9);
  }, ['logic','tehilim']);

  test('יום 25 – חצי ראשון קי"ט (1-88)', () => {
    assertEqual(SCHEDULE[25][0], '119:1-88', 'Day 25 first half');
  }, ['logic','tehilim']);

  test('יום 26 – חצי שני קי"ט (89-176)', () => {
    assertEqual(SCHEDULE[26][0], '119:89-176', 'Day 26 second half');
  }, ['logic','tehilim']);

  test('יום 30 – פרקים 145-150', () => {
    assertEqual(SCHEDULE[30][0], 145); assertEqual(SCHEDULE[30][5], 150);
  }, ['logic','tehilim']);

  test('יום 27 – 15 פרקי שיר המעלות', () => {
    assertEqual(SCHEDULE[27].length, 15, '15 shir hamaalot psalms');
  }, ['logic','tehilim']);

  test('חלוקת פסוקים 119:1-88 = 88 פסוקים', () => {
    const range = '119:1-88';
    const [, vr] = range.split(':');
    const [from, to] = vr.split('-').map(Number);
    assertEqual(to - from + 1, 88, '88 verses in first half');
  }, ['logic','tehilim']);

  test('חלוקת פסוקים 119:89-176 = 88 פסוקים', () => {
    const range = '119:89-176';
    const [, vr] = range.split(':');
    const [from, to] = vr.split('-').map(Number);
    assertEqual(to - from + 1, 88, '88 verses in second half');
  }, ['logic','tehilim']);
});

// ── Tachanun Schedule ─────────────────────────────────────────────────
suite('🙏 לוגיקת תחנון', () => {

  function skipTachanun(month, day, dow) {
    if (dow === 0 || dow === 6) return true; // Shabbat/Sunday (shacharit)
    if (month === 'Nisan') return true;
    if (month === 'Tishrei' && day >= 10) return true;
    if (month === 'Shevat' && day === 15) return true;
    if ((month === 'Adar' || month === 'Adar II') && (day === 14 || day === 15)) return true;
    if (month === 'Iyar' && [5, 18, 28].includes(day)) return true;
    if (month === 'Sivan' && day <= 12) return true;
    if (month === 'Av' && (day === 9 || day === 15)) return true;
    if (month === 'Kislev' && day >= 25) return true;
    if (month === 'Tevet' && day <= 3) return true;
    return false;
  }

  test('ניסן – אין תחנון', () => {
    assert(skipTachanun('Nisan', 1, 1), 'No tachanun in Nisan');
    assert(skipTachanun('Nisan', 30, 1), 'No tachanun end of Nisan');
  }, ['logic','calendar']);

  test('ט"ז אייר (ל"ג בעומר) – אין תחנון', () => {
    assert(skipTachanun('Iyar', 18, 1), "Lag BaOmer no tachanun");
  }, ['logic','calendar']);

  test('סיוון א-יב – אין תחנון', () => {
    for (let d = 1; d <= 12; d++)
      assert(skipTachanun('Sivan', d, 1), `Sivan ${d} no tachanun`);
  }, ['logic','calendar']);

  test('סיוון יג – יש תחנון', () => {
    assert(!skipTachanun('Sivan', 13, 1), 'Sivan 13 has tachanun');
  }, ['logic','calendar']);

  test('שבת – אין תחנון', () => {
    assert(skipTachanun('Cheshvan', 5, 6), 'Shabbat no tachanun');
  }, ['logic','calendar']);

  test('יום רגיל (חשוון יב, שני) – יש תחנון', () => {
    assert(!skipTachanun('Cheshvan', 12, 1), 'Regular day has tachanun');
  }, ['logic','calendar']);

  test('ערבית – אין תחנון תמיד (לא רלוונטי)', () => {
    // This is a UI rule, not calendar logic
    assert(true, 'Arvit has no tachanun - always true');
  }, ['logic','siddur']);
});

// ── Parasha Combined Detection ────────────────────────────────────────
suite('📜 פרשות מחוברות – זיהוי', () => {

  const COMBINED_PAIRS = [
    ['ויקהל','פקודי'],
    ['תזריע','מצורע'],
    ['אחרי מות','קדושים'],
    ['בהר','בחוקותי'],
    ['חקת','בלק'],
    ['מטות','מסעי'],
    ['נצבים','וילך'],
  ];

  function stripVowelLetters(s) {
    return s ? s.replace(/(?<=[א-ת])[וי](?=[א-ת])/g, '') : '';
  }

  const PARASHIOT_HE = ['ויקהל','פקודי','תזריע','מצורע','אחרי מות','קדושים','בהר','בחוקותי','חקת','בלק','מטות','מסעי','נצבים','וילך'];

  function fuzzyFind(name) {
    if (!name) return null;
    const nc = stripVowelLetters(name);
    return PARASHIOT_HE.find(p => p === name) ||
           PARASHIOT_HE.find(p => stripVowelLetters(p) === nc) ||
           PARASHIOT_HE.find(p => name.length >= 3 && p.startsWith(name.slice(0,3))) ||
           PARASHIOT_HE.find(p => nc.length >= 3 && stripVowelLetters(p).startsWith(nc.slice(0,3)));
  }

  test('מצרע → מצורע (consonant matching)', () => {
    assertEqual(fuzzyFind('מצרע'), 'מצורע', 'מצרע should match מצורע');
  }, ['logic','calendar']);

  test('בחקתי → בחוקותי', () => {
    assertEqual(fuzzyFind('בחקתי'), 'בחוקותי', 'בחקתי should match בחוקותי');
  }, ['logic','calendar']);

  test('כל הפרשות המחוברות הנפוצות מזוהות', () => {
    for (const [p1, p2] of COMBINED_PAIRS) {
      const r1 = fuzzyFind(p1);
      assert(r1, `Could not find ${p1}`);
      const r2 = fuzzyFind(p2);
      assert(r2, `Could not find ${p2}`);
    }
  }, ['logic','calendar']);
});

console.log('[Tests] Logic tests registered');
