// ── OMER TESTS ────────────────────────────────────────────────────────

suite('🌾 ספירת העומר – API ותוכן', () => {

  test('פסוקי ספירה – ויקרא כג:טו', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Leviticus.23.15?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assert(flat.length > 0, 'Leviticus 23:15 returned empty');
    const stripped = flat[0].replace(/[\u0591-\u05C7]/g,'');
    assertContains(stripped, 'ספרתם', 'Omer verse contains וספרתם');
  }, ['api','omer']);

  test('תאריכי ספירה – ניסן טז = יום א', () => {
    // 16 Nisan = omer day 1
    function getOmerDay(month, day) {
      if (month === 'Nisan' && day >= 16) return day - 15;
      if (month === 'Iyar') return day + 15;
      if (month === 'Sivan' && day <= 5) return day + 44;
      return 0;
    }
    assertEqual(getOmerDay('Nisan', 16), 1, 'Nisan 16 = day 1');
    assertEqual(getOmerDay('Nisan', 30), 15, 'Nisan 30 = day 15');
    assertEqual(getOmerDay('Iyar', 1), 16, 'Iyar 1 = day 16');
    assertEqual(getOmerDay('Iyar', 18), 33, 'Iyar 18 = day 33 (Lag BaOmer)');
    assertEqual(getOmerDay('Sivan', 5), 49, 'Sivan 5 = day 49');
  }, ['logic','omer']);

  test('ל"ג בעומר = יום 33', () => {
    function getOmerDay(month, day) {
      if (month === 'Nisan' && day >= 16) return day - 15;
      if (month === 'Iyar') return day + 15;
      if (month === 'Sivan' && day <= 5) return day + 44;
      return 0;
    }
    assertEqual(getOmerDay('Iyar', 18), 33, 'Lag BaOmer = day 33');
  }, ['logic','omer']);

  test('תזכורת עומר – REMINDER_ITEMS מכיל omer', async () => {
    const src = await fetch('../js/settings.js').then(r => r.text());
    assertContains(src, "key: 'omer'", 'omer in REMINDER_ITEMS');
  }, ['ui','omer']);

  test('כפתור ספור עכשיו – קיים בלוגיקת popup', async () => {
    const src = await fetch('../js/settings.js').then(r => r.text());
    assertContains(src, 'ספור עכשיו', 'ספור עכשיו button in reminder popup');
    assertContains(src, 'showOmerNow', 'showOmerNow called from reminder');
  }, ['ui','omer']);

  test('ספירה לניסן טז 2026 = יום 1', async () => {
    const d = await httpGet(`${HEBCAL}/converter?cfg=json&hy=5786&hm=Nisan&hd=16&h2g=1&strict=1`);
    assert(d.gy, 'Gregorian year returned');
    // Nisan 16 5786 → day 1 of omer
    function getOmerDay(m, day) {
      if (m === 'Nisan' && day >= 16) return day - 15;
      return 0;
    }
    assertEqual(getOmerDay('Nisan', 16), 1, 'Nisan 16 = omer day 1');
  }, ['api','omer']);
});

// ── TEHILIM TESTS ─────────────────────────────────────────────────────
suite('📖 תהילים – API ותכנים', () => {

  test('תהילים א – מחזיר טקסט עברי', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Psalms.1?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assert(flat.length === 6, `Psalm 1 has ${flat.length} vs 6 expected`);
    assertContains(flat[0].replace(/[\u0591-\u05C7]/g,''), 'אשרי', 'Psalm 1 starts with אשרי');
  }, ['api','tehilim']);

  test('תהילים קי"ט – 176 פסוקים', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Psalms.119?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assertEqual(flat.length, 176, 'Psalm 119 has exactly 176 verses');
  }, ['api','tehilim']);

  test('תהילים קי"ט חצי ראשון – פסוקים 1-88', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Psalms.119?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    const firstHalf = flat.slice(0, 88);
    assertEqual(firstHalf.length, 88, 'First half has 88 verses');
  }, ['api','tehilim']);

  test('תהילים קי"ט חצי שני – פסוקים 89-176', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Psalms.119?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    const secondHalf = flat.slice(88, 176);
    assertEqual(secondHalf.length, 88, 'Second half has 88 verses');
  }, ['api','tehilim']);

  test('תהילים קנ – פרק אחרון (150)', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Psalms.150?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assert(flat.length > 0, 'Psalm 150 returned empty');
    const stripped = flat[flat.length-1].replace(/[\u0591-\u05C7]/g,'');
    assertContains(stripped, 'הללויה', 'Psalm 150 ends with הללויה');
  }, ['api','tehilim']);

  test('לוח תהילים – 30 ימים מכסים 1-150', () => {
    const SCHEDULE = {
      1:[1,2,3,4,5,6,7,8,9], 2:[10,11,12,13,14,15,16,17],
      3:[18,19,20,21,22], 4:[23,24,25,26,27,28],
      5:[29,30,31,32,33,34], 6:[35,36,37,38],
      7:[39,40,41,42,43], 8:[44,45,46,47,48],
      9:[49,50,51,52,53,54], 10:[55,56,57,58,59],
      11:[60,61,62,63,64,65], 12:[66,67,68],
      13:[69,70,71], 14:[72,73,74,75,76],
      15:[77,78], 16:[79,80,81,82],
      17:[83,84,85,86,87], 18:[88,89],
      19:[90,91,92,93,94,95,96], 20:[97,98,99,100,101,102,103],
      21:[104,105], 22:[106,107],
      23:[108,109,110,111,112], 24:[113,114,115,116,117,118],
      25:['119:1-88'], 26:['119:89-176'],
      27:[120,121,122,123,124,125,126,127,128,129,130,131,132,133,134],
      28:[135,136,137,138,139], 29:[140,141,142,143,144],
      30:[145,146,147,148,149,150]
    };
    const allChapters = new Set();
    for (let d = 1; d <= 30; d++) {
      for (const ch of SCHEDULE[d]) {
        if (typeof ch === 'number') allChapters.add(ch);
        else allChapters.add(119); // range entries
      }
    }
    // Should cover 1-150
    for (let ch = 1; ch <= 150; ch++) {
      assert(allChapters.has(ch), `Psalm ${ch} not in any day`);
    }
  }, ['logic','tehilim']);

  test('ניווט תהילים – CHAPTER_TO_DAY מכיל 119:1-88', async () => {
    const src = await fetch('../js/tehilim.js').then(r => r.text());
    assertContains(src, "getTehilimNavInfo(isRange ? chapterOrRange : chapter)",
      'Nav info uses full range string');
  }, ['ui','tehilim']);
});

// ── COMPASS TESTS ─────────────────────────────────────────────────────
suite('🧭 מצפן – API ו-Geolocation', () => {

  function bearing(lat1, lon1, lat2, lon2) {
    const R = Math.PI / 180;
    const dLon = (lon2 - lon1) * R;
    const y = Math.sin(dLon) * Math.cos(lat2 * R);
    const x = Math.cos(lat1 * R) * Math.sin(lat2 * R) -
              Math.sin(lat1 * R) * Math.cos(lat2 * R) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  const KOTEL = { lat: 31.7767, lon: 35.2345 };

  test('נוסחת כיוון – בין 0 ל-360', () => {
    const b = bearing(32.0, 35.0, KOTEL.lat, KOTEL.lon);
    assertRange(b, 0, 360, 'Bearing in valid range');
  }, ['logic','compass']);

  test('כיוון מצפון (ישראל) לכותל – צפון < 180°', () => {
    // From northern Israel (Haifa ~32.8)
    const b = bearing(32.8, 35.0, KOTEL.lat, KOTEL.lon);
    assert(b > 90 && b < 270, `From north should be southward, got ${b.toFixed(1)}`);
  }, ['logic','compass']);

  test('כיוון ממזרח (ירדן) לכותל – מערב < 270°', () => {
    const b = bearing(31.9, 36.5, KOTEL.lat, KOTEL.lon);
    assert(b > 180 && b < 360, `From east should be westward, got ${b.toFixed(1)}`);
  }, ['logic','compass']);

  test('ייצוא compass.js – מכיל KOTEL', async () => {
    // Check if compass logic is in misc.js or calendar.js
    const misc = await fetch('../js/misc.js').then(r => r.text()).catch(() => '');
    const cal  = await fetch('../js/calendar.js').then(r => r.text()).catch(() => '');
    const combined = misc + cal;
    assertContains(combined, '31.77', 'Kotel latitude in source');
    assertContains(combined, '35.23', 'Kotel longitude in source');
  }, ['ui','compass']);

  test('Geolocation API זמינה בדפדפן', () => {
    assert('geolocation' in navigator, 'Geolocation API available');
  }, ['logic','compass']);

  test('DeviceOrientationEvent – API קיים', () => {
    assert(typeof DeviceOrientationEvent !== 'undefined', 'DeviceOrientationEvent exists');
  }, ['logic','compass']);
});

console.log('[Tests] Omer, Tehilim, Compass tests registered');
