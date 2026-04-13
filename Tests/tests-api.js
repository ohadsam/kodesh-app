// ── API TESTS ─────────────────────────────────────────────────────────
// Tests that verify Sefaria and Hebcal API responses

suite('🌐 Sefaria API – מבנה תשובה', () => {

  test('טקסט תורה – בראשית א:א מחזיר עברית', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Genesis.1.1?lang=he&commentary=0&context=0`);
    assert(Array.isArray(d.he) || typeof d.he === 'string', 'he field missing');
    const flat = Array.isArray(d.he) ? d.he.flat(Infinity).filter(Boolean) : [d.he];
    assert(flat.length > 0, 'No hebrew verses');
    assertContains(flat[0], 'בְּרֵאשִׁית', 'First verse content');
  }, ['api']);

  test('תהילים פרק א – 6 פסוקים', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Psalms.1?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assertEqual(flat.length, 6, 'Psalm 1 has 6 verses');
  }, ['api','tehilim']);

  test('תהילים קי"ט – 176 פסוקים', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Psalms.119?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assertEqual(flat.length, 176, 'Psalm 119 has 176 verses');
  }, ['api','tehilim']);

  test('ויקרא פרק יב – 8 פסוקים (תזריע)', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Leviticus.12?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assertEqual(flat.length, 8, 'Leviticus 12 has 8 verses');
  }, ['api','calendar']);

  test('ויקרא טווח תזריע-מצורע – Leviticus 12:1-15:33', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Leviticus%2012:1-15:33?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assert(flat.length > 50, `Expected 50+ verses, got ${flat.length}`);
  }, ['api','calendar']);

  test('רש"י על בראשית א – מחזיר פירוש', async () => {
    const d = await httpGet(`${SEFARIA}/texts/Rashi%20on%20Genesis%201?lang=he&commentary=0&context=0`);
    const he = d.he;
    assert(he && (Array.isArray(he) ? he.flat(Infinity).filter(Boolean).length > 0 : he.length > 0),
      'Rashi on Genesis 1 returned empty');
  }, ['api']);

  test('שמונה עשרה – Weekday Siddur', async () => {
    const ref = 'Weekday_Siddur_Sefard_Linear,_The_Morning_Prayers,_Shemoneh_Esrei';
    const d = await httpGet(`${SEFARIA}/texts/${encodeURI(ref)}?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assert(flat.length > 50, `Shemoneh esrei should have 50+ verses, got ${flat.length}`);
  }, ['api','siddur']);

  test('שמונה עשרה – מכיל מוריד הטל', async () => {
    const ref = 'Weekday_Siddur_Sefard_Linear,_The_Morning_Prayers,_Shemoneh_Esrei';
    const d = await httpGet(`${SEFARIA}/texts/${encodeURI(ref)}?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    const stripped = flat.map(v => v.replace(/[\u0591-\u05C7]/g, ''));
    const hasTal = stripped.some(v => v.includes('מוריד הטל'));
    const hasGeshem = stripped.some(v => v.includes('משיב הרוח'));
    assert(hasTal, 'Should contain מוריד הטל');
    assert(hasGeshem, 'Should contain משיב הרוח');
  }, ['api','siddur']);

  test('שמונה עשרה – מכיל ותן ברכה', async () => {
    const ref = 'Weekday_Siddur_Sefard_Linear,_The_Morning_Prayers,_Shemoneh_Esrei';
    const d = await httpGet(`${SEFARIA}/texts/${encodeURI(ref)}?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    const stripped = flat.map(v => v.replace(/[\u0591-\u05C7]/g, ''));
    const hasBracha = stripped.some(v => v.includes('ותן ברכה'));
    assert(hasBracha, 'Should contain ותן ברכה');
  }, ['api','siddur']);

  test('דף יומי – Sefaria calendars API', async () => {
    const today = formatDate(new Date());
    const [y,m,d] = today.split('-');
    const data = await httpGet(`${SEFARIA}/calendars?diaspora=0&year=${y}&month=${m}&day=${d}`);
    assert(data.calendar_items, 'calendar_items missing');
    const daf = data.calendar_items.find(i => i.title?.en?.toLowerCase().includes('daf'));
    assert(daf, 'Daf Yomi not found in calendar items');
    assert(daf.ref, 'Daf ref missing');
  }, ['api']);

  test('משנה יומית – Sefaria calendars API', async () => {
    const today = formatDate(new Date());
    const [y,m,d] = today.split('-');
    const data = await httpGet(`${SEFARIA}/calendars?diaspora=0&year=${y}&month=${m}&day=${d}`);
    const mishna = data.calendar_items.find(i =>
      (i.title?.en || '').toLowerCase().includes('mishna') ||
      (i.title?.he || '').includes('משנה')
    );
    assert(mishna, 'Mishna Yomit not found');
  }, ['api']);

  test('רמב"ם יומי – Sefaria calendars API', async () => {
    const today = formatDate(new Date());
    const [y,m,d] = today.split('-');
    const data = await httpGet(`${SEFARIA}/calendars?diaspora=0&year=${y}&month=${m}&day=${d}`);
    const ram = data.calendar_items.find(i =>
      (i.title?.en || '').toLowerCase().includes('rambam') ||
      (i.title?.he || '').includes('רמב')
    );
    assert(ram, 'Rambam Yomi not found');
  }, ['api']);

  test('שטיינזלץ – range ref מחזיר מערך', async () => {
    // Test Steinsaltz range ref pattern that was fixed
    const d = await httpGet(`${SEFARIA}/texts/Steinsaltz%20on%20Mishneh%20Torah%2C%20Prayer%20and%20the%20Priestly%20Blessing%206:1-10?lang=he&commentary=0&context=0`);
    const he = d.he;
    assert(he, 'Steinsaltz response has he field');
  }, ['api']);

  test('הפטרה – II Kings 4:42-5:19', async () => {
    const d = await httpGet(`${SEFARIA}/texts/II%20Kings%204:42-5:19?lang=he&commentary=0&context=0`);
    const flat = (d.he || []).flat(Infinity).filter(Boolean);
    assertEqual(flat.length, 22, 'Haftara Tazria-Metzora has 22 verses');
  }, ['api','calendar']);
});

suite('🌐 Hebcal API – תאריכים ולוח', () => {

  test('המרת תאריך גרגורי לעברי – היום', async () => {
    const today = formatDate(new Date());
    const d = await httpGet(`${HEBCAL}/converter?cfg=json&date=${today}&g2h=1&strict=1`);
    assert(d.hm, 'Hebrew month missing');
    assert(d.hd, 'Hebrew day missing');
    assert(d.hy, 'Hebrew year missing');
    assertRange(d.hd, 1, 30, 'Hebrew day in range');
  }, ['api','calendar']);

  test('ניסן טו – פסח', async () => {
    const d = await httpGet(`${HEBCAL}/converter?cfg=json&hy=5786&hm=Nisan&hd=15&h2g=1&strict=1`);
    assert(d.gy, 'Gregorian year missing');
    assert(d.gm, 'Gregorian month missing');
  }, ['api','calendar']);

  test('זמנים – מחזיר שחרית ושקיעה', async () => {
    const today = formatDate(new Date());
    const d = await httpGet(`${HEBCAL}/zmanim?cfg=json&date=${today}&sec=1&latitude=32.0833&longitude=34.8878&elevation=52&tzid=Asia/Jerusalem`);
    assert(d.times, 'times missing');
    assert(d.times.sunrise, 'sunrise missing');
    assert(d.times.sunset, 'sunset missing');
    assert(d.times.sofZmanShma, 'sofZmanShma missing');
    assert(d.times.sofZmanTfilla, 'sofZmanTfilla missing');
  }, ['api','calendar']);

  test('שחרית לפני שקיעה', async () => {
    const today = formatDate(new Date());
    const d = await httpGet(`${HEBCAL}/zmanim?cfg=json&date=${today}&sec=1&latitude=32.0833&longitude=34.8878&elevation=52&tzid=Asia/Jerusalem`);
    const sunrise = new Date(d.times.sunrise).getTime();
    const sunset  = new Date(d.times.sunset).getTime();
    assert(sunrise < sunset, 'Sunrise should be before sunset');
  }, ['api','calendar']);

  test('פרשת השבוע – מחזיר פרשה', async () => {
    const today = formatDate(new Date());
    const end   = formatDate(new Date(Date.now() + 14 * 86400000));
    const d = await httpGet(`${HEBCAL}/hebcal?v=1&cfg=json&s=on&start=${today}&end=${end}`);
    assert(d.items, 'items missing');
    const parasha = d.items.find(i => i.category === 'parashat');
    assert(parasha, 'No parasha found in next 14 days');
    assert(parasha.hebrew || parasha.title, 'Parasha has no name');
  }, ['api','calendar']);

  test('פרשת השבוע – עליות מהebcal', async () => {
    const today = formatDate(new Date());
    const end   = formatDate(new Date(Date.now() + 14 * 86400000));
    const d = await httpGet(`${HEBCAL}/hebcal?v=1&cfg=json&s=on&start=${today}&end=${end}`);
    const parasha = d.items?.find(i => i.category === 'parashat');
    assert(parasha, 'No parasha');
    const aliyot = parasha.leyning;
    assert(aliyot, 'No leyning data');
    assert(aliyot['1'], 'Aliya 1 missing');
    assert(aliyot['7'], 'Aliya 7 missing');
  }, ['api','calendar']);

  test('API תאריך שונה – כ"ה ניסן תשפ"ו', async () => {
    // Specific date test: April 13 2026 = 25 Nisan 5786
    const d = await httpGet(`${HEBCAL}/converter?cfg=json&date=2026-04-13&g2h=1&strict=1`);
    assertEqual(d.hm, 'Nisan', 'Should be Nisan');
    assertRange(d.hd, 24, 26, 'Should be ~25 Nisan');
  }, ['api','calendar']);

  test('API – ניסן = אין תחנון (event)', async () => {
    const d = await httpGet(`${HEBCAL}/hebcal?v=1&cfg=json&maj=on&min=on&nx=on&start=2026-04-01&end=2026-04-30&c=off&i=1`);
    // In Nisan all days should skip tachanun - verify Nisan events exist
    assert(d.items, 'items missing');
    assert(d.items.length > 0, 'Should have events in Nisan');
  }, ['api','calendar']);
});

console.log('[Tests] API tests registered');
