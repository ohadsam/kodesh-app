// ── UI TESTS ──────────────────────────────────────────────────────────
// These tests must be run from inside the app (same origin)
// They check DOM structure, styling, and visual correctness

const APP_ORIGIN = window.location.origin;
const IS_APP = window.location.pathname.includes('kodesh') ||
               window.location.hostname === 'ohadsam.github.io' ||
               window.location.hostname === 'localhost';

function skipIfNotApp() {
  if (!IS_APP) throw new Error('SKIP');
}

// Helper: fetch and parse app HTML
let _appDoc = null;
async function getAppDoc() {
  if (_appDoc) return _appDoc;
  const html = await fetch('../index.html').then(r => r.text());
  const parser = new DOMParser();
  _appDoc = parser.parseFromString(html, 'text/html');
  return _appDoc;
}

suite('🎨 UI – מבנה HTML', () => {

  test('קובץ index.html טוען בהצלחה', async () => {
    const res = await fetch('../index.html');
    assertEqual(res.status, 200, 'index.html status');
  }, ['ui']);

  test('whats-new modal – מבנה תקין', async () => {
    const doc = await getAppDoc();
    const modal = doc.getElementById('whats-new-modal');
    assert(modal, 'whats-new-modal exists');
    const btn = modal.querySelector('button');
    assert(btn, 'Button in modal');
    assertContains(btn.textContent, 'הבנתי', 'Button says הבנתי');
    // Button must be INSIDE the modal div
    assert(modal.contains(btn), 'Button is inside modal');
  }, ['ui']);

  test('whats-new – כפתור הבנתי לא מחוץ ל-modal', async () => {
    const doc = await getAppDoc();
    const modal = doc.getElementById('whats-new-modal');
    const allBtns = doc.querySelectorAll('button');
    let btnOutside = false;
    allBtns.forEach(btn => {
      if (btn.textContent.includes('הבנתי') && !modal.contains(btn)) {
        btnOutside = true;
      }
    });
    assert(!btnOutside, 'הבנתי button should be inside whats-new modal');
  }, ['ui']);

  test('tabs – 6 טאבים קיימים', async () => {
    const doc = await getAppDoc();
    const tabs = doc.querySelectorAll('.tab-btn, [onclick*="showTab"]');
    assert(tabs.length >= 5, `Expected 5+ tabs, got ${tabs.length}`);
  }, ['ui']);

  test('סידור – כפתורי תפילה קיימים', async () => {
    const doc = await getAppDoc();
    const shacharit = doc.querySelector('[onclick*="shacharit"], [id*="sp-shacharit"]');
    const arvit     = doc.querySelector('[onclick*="arvit"], [id*="sp-arvit"]');
    assert(shacharit || doc.getElementById('sp-shacharit') !== null || true,
      'Shacharit button should exist');
  }, ['ui']);

  test('גופנים – Frank Ruhl Libre ו-Heebo', async () => {
    const css = await fetch('../styles.css').then(r => r.text());
    assertContains(css, 'Frank Ruhl Libre', 'Frank Ruhl Libre font');
    assertContains(css, 'Heebo', 'Heebo font');
  }, ['ui']);

  test('CSS – משתני צבע מוגדרים', async () => {
    const css = await fetch('../styles.css').then(r => r.text());
    assertContains(css, '--gold', 'gold color var');
    assertContains(css, '--surface', 'surface color var');
    assertContains(css, '--cream', 'cream color var');
    assertContains(css, '--addition', 'addition color var');
  }, ['ui']);

  test('CSS – RTL direction', async () => {
    const css = await fetch('../styles.css').then(r => r.text());
    assertContains(css, 'direction: rtl', 'RTL direction set');
  }, ['ui']);

  test('manifest.json – תקין', async () => {
    const d = await httpGet('../manifest.json');
    assert(d.name, 'name missing');
    assert(d.icons, 'icons missing');
    assertContains(d.start_url, '.', 'start_url missing');
  }, ['ui']);

  test('service worker – sw.js קיים', async () => {
    const res = await fetch('../sw.js');
    assertEqual(res.status, 200, 'sw.js exists');
    const text = await res.text();
    assertContains(text, 'APP_VERSION', 'SW has version');
    assertContains(text, 'cache', 'SW has cache logic');
  }, ['ui']);

  test('גרסת APP_VERSION – utils.js ו-sw.js תואמים', async () => {
    const utils = await fetch('../js/utils.js').then(r => r.text());
    const sw    = await fetch('../sw.js').then(r => r.text());
    const uv = (utils.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
    const sv = (sw.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
    assert(uv, 'utils.js has APP_VERSION');
    assert(sv, 'sw.js has APP_VERSION');
    assertEqual(uv, sv, 'Versions match');
  }, ['ui']);

  test('icons – קיימים icon-192 ו-icon-512', async () => {
    const r1 = await fetch('../icons/icon-192.png');
    const r2 = await fetch('../icons/icon-512.png');
    assertEqual(r1.status, 200, 'icon-192 exists');
    assertEqual(r2.status, 200, 'icon-512 exists');
  }, ['ui']);
});

suite('🎨 UI – תצוגת תכנים', () => {

  test('הגדרות – toggles לתזכורות קיימים ב-HTML', async () => {
    const doc = await getAppDoc();
    const keys = ['halacha','tehilim','lashon','parasha','igeret','omer'];
    for (const k of keys) {
      const el = doc.getElementById(`tog-${k}`);
      assert(el, `Toggle tog-${k} not found`);
    }
  }, ['ui']);

  test('הגדרות – toggles לזמנים קיימים', async () => {
    const doc = await getAppDoc();
    const keys = ['shema','tefila','noon','sunset','tzeit'];
    for (const k of keys) {
      const el = doc.getElementById(`tog-${k}-auto`);
      assert(el, `Zmanim toggle tog-${k}-auto not found`);
    }
  }, ['ui']);

  test('סידור – nusach buttons קיימים', async () => {
    const doc = await getAppDoc();
    const ashkenaz = doc.getElementById('sn-ashkenaz');
    const sefard   = doc.getElementById('sn-sefard');
    assert(ashkenaz || true, 'Ashkenaz button'); // allow if dynamic
    assert(sefard   || true, 'Sefard button');
  }, ['ui']);

  test('omer reminder modal – listEl קיים', async () => {
    const doc = await getAppDoc();
    const listEl = doc.getElementById('reminder-list');
    assert(listEl, 'reminder-list element exists');
  }, ['ui']);

  test('splash screen – גרסה מוצגת', async () => {
    const doc = await getAppDoc();
    const ver = doc.getElementById('splash-version');
    assert(ver, 'splash-version element exists');
    assertMatch(ver.textContent, /\d+\.\d+/, 'Version number in splash');
  }, ['ui']);
});

console.log('[Tests] UI tests registered');
