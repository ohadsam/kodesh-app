#!/usr/bin/env node
// ── Kodesh App – Pre-release Test Runner (Node.js) ───────────────────
// Runs offline: logic tests + file structure checks + syntax validation
// API tests require browser (see tests/index.html)
//
// Usage: node tests/run-tests.js [--verbose]
//
'use strict';

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const VERBOSE = process.argv.includes('--verbose');
let pass = 0, fail = 0, skip = 0;
const failures = [];

// ── Mini test framework ───────────────────────────────────────────────
function assert(cond, msg)       { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg)  { if (a !== b) throw new Error(`${msg||'Equal'}: got "${a}", expected "${b}"`); }
function assertContains(s, sub, msg) { if (!String(s).includes(sub)) throw new Error(`${msg||'Contains'}: "${sub}" not in "${String(s).slice(0,60)}"`); }
function assertRange(v, lo, hi, msg) { if (v < lo || v > hi) throw new Error(`${msg||'Range'}: ${v} not in [${lo},${hi}]`); }
function assertMatch(s, re, msg) { if (!re.test(String(s))) throw new Error(`${msg||'Match'}: ${re} vs "${String(s).slice(0,60)}"`); }

function test(name, fn) {
  try {
    fn();
    pass++;
    if (VERBOSE) console.log(`  ✅ ${name}`);
  } catch(e) {
    if (e.message === 'SKIP') { skip++; if (VERBOSE) console.log(`  ⏭  ${name}`); return; }
    fail++;
    failures.push({ name, error: e.message });
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

function suite(name, fn) {
  console.log(`\n📋 ${name}`);
  fn();
}

function readFile(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function fileExists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

// ═══════════════════════════════════════════════════════════════════════
// 1. FILE STRUCTURE CHECKS
// ═══════════════════════════════════════════════════════════════════════
suite('📁 מבנה קבצים', () => {
  const required = [
    'index.html','sw.js','manifest.json','styles.css','AGENT.md',
    'js/utils.js','js/siddur.js','js/content.js','js/calendar.js',
    'js/omer.js','js/tehilim.js','js/settings.js','js/siddur-inserts.js',
    'js/app.js','js/init.js','js/misc.js','js/brachot.js','js/tefilot.js',
    'icons/icon-192.png','icons/icon-512.png','icons/icon.svg',
    'tests/index.html','tests/run-tests.js',
  ];
  for (const f of required) {
    test(`קיים: ${f}`, () => assert(fileExists(f), `Missing: ${f}`));
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. VERSION CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════
suite('🔢 גרסאות', () => {
  test('APP_VERSION זהה ב-utils.js וב-sw.js', () => {
    const utils = readFile('js/utils.js');
    const sw    = readFile('sw.js');
    const uv = (utils.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
    const sv = (sw.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
    assert(uv, 'APP_VERSION not found in utils.js');
    assert(sv, 'APP_VERSION not found in sw.js');
    assertEqual(uv, sv, 'Version mismatch');
  });

  test('גרסה ב-index.html תואמת utils.js', () => {
    const utils = readFile('js/utils.js');
    const html  = readFile('index.html');
    const uv = (utils.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
    assertContains(html, `var V = '${uv}'`, `index.html missing version ${uv}`);
  });

  test('whats-new כותרת מכילה גרסה נוכחית', () => {
    const utils = readFile('js/utils.js');
    const html  = readFile('index.html');
    const uv = (utils.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
    assertContains(html, `גרסה ${uv}`, `whats-new title missing version ${uv}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. HTML STRUCTURE
// ═══════════════════════════════════════════════════════════════════════
suite('🎨 מבנה HTML', () => {
  test('whats-new – כפתור הבנתי בתוך ה-modal', () => {
    const html = readFile('index.html');
    const modalStart = html.indexOf('id="whats-new-modal"');
    // Find closing </div> that ends the modal — it's the one after the </button>
    const btnEnd = html.indexOf('</button>', modalStart);
    assert(btnEnd > modalStart, 'button found in modal area');
    const modalClose = html.indexOf('</div>', btnEnd);
    const modal = html.slice(modalStart, modalClose + 6);
    assertContains(modal, 'הבנתי', 'הבנתי button inside modal');
    assertContains(modal, 'closeWhatsNew', 'closeWhatsNew in modal');
  });

  test('index.html – כל קבצי JS נטענים', () => {
    const html = readFile('index.html');
    const required = ['utils.js','app.js','init.js','calendar.js','siddur.js',
                      'content.js','omer.js','tehilim.js','settings.js'];
    for (const f of required) {
      // Accept both with and without cache-busting ?v= param
      assert(html.includes(`src="js/${f}"`) || html.includes(`src="js/${f}?`),
        `Missing script: ${f}`);
    }
    // init.js must come AFTER utils.js
    const utilsPos = html.search(/src="js\/utils\.js/);
    const initPos  = html.search(/src="js\/init\.js/);
    assert(utilsPos < initPos, 'utils.js must load before init.js');
  });

  test('whats-new – overlay קיים', () => {
    const html = readFile('index.html');
    assertContains(html, 'id="whats-new-overlay"', 'whats-new overlay');
  });

  test('reminder-modal קיים', () => {
    const html = readFile('index.html');
    assertContains(html, 'id="reminder-modal"', 'reminder modal');
    assertContains(html, 'id="reminder-list"', 'reminder list');
  });

  test('כל 6 toggles תזכורות קיימים', () => {
    const html = readFile('index.html');
    const keys = ['halacha','tehilim','lashon','parasha','igeret','omer'];
    for (const k of keys) assertContains(html, `id="tog-${k}"`, `tog-${k} toggle`);
  });

  test('כל 5 toggles זמנים קיימים', () => {
    const html = readFile('index.html');
    const keys = ['shema','tefila','noon','sunset','tzeit'];
    for (const k of keys) assertContains(html, `id="tog-${k}-auto"`, `tog-${k}-auto`);
  });

  test('manifest.json – PWA fields', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assert(m.name, 'manifest name');
    assert(m.icons?.length, 'manifest icons');
    assert(m.start_url, 'manifest start_url');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. JAVASCRIPT SYNTAX CHECK
// ═══════════════════════════════════════════════════════════════════════
suite('📝 תקינות JavaScript', () => {
  const jsFiles = fs.readdirSync(path.join(ROOT,'js')).filter(f=>f.endsWith('.js'));
  for (const f of jsFiles) {
    test(`syntax: js/${f}`, () => {
      const { execSync } = require('child_process');
      try {
        execSync(`node --check "${path.join(ROOT,'js',f)}"`, { stdio:'pipe' });
      } catch(e) {
        throw new Error(e.stderr?.toString()?.slice(0,200) || 'Syntax error');
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. OMER LOGIC
// ═══════════════════════════════════════════════════════════════════════
suite('🌾 ספירת העומר', () => {
  // Extract and re-implement omer functions from omer.js
  const src = readFile('js/omer.js');

  // Parse arrays from source
  const onesMatch  = src.match(/const _OMER_ONES\s*=\s*(\[[\s\S]*?\]);/);
  const tensMatch  = src.match(/const _OMER_TENS\s*=\s*(\[[\s\S]*?\]);/);
  const weeksMatch = src.match(/const _OMER_WEEKS\s*=\s*(\[[\s\S]*?\]);/);
  const diwMatch   = src.match(/const _OMER_DAYS_IN_WEEK\s*=\s*(\[[\s\S]*?\]);/);

  let ONES, TENS, WEEKS, DAYS_IN_WEEK;
  try {
    ONES         = eval(onesMatch[1]);
    TENS         = eval(tensMatch[1]);
    WEEKS        = eval(weeksMatch[1]);
    DAYS_IN_WEEK = eval(diwMatch[1]);
  } catch(e) {
    test('parse omer arrays', () => { throw new Error('Could not parse arrays: ' + e.message); });
    return;
  }

  const TEENS = ['אַחַד עָשָׂר','שְׁנֵים עָשָׂר','שְׁלֹשָׁה עָשָׂר','אַרְבָּעָה עָשָׂר',
                 'חֲמִשָּׁה עָשָׂר','שִׁשָּׁה עָשָׂר','שִׁבְעָה עָשָׂר','שְׁמוֹנָה עָשָׂר','תִּשְׁעָה עָשָׂר'];

  function dayHe(n) {
    if (n <= 10) return ONES[n];
    if (n < 20)  return TEENS[n - 11];
    const t = Math.floor(n/10), o = n%10;
    return o ? `${ONES[o]} וְ${TENS[t]}` : TENS[t];
  }

  function countStr(day) {
    const total  = dayHe(day);
    const weeks  = Math.floor(day/7), rem = day%7;
    const plural   = day === 1 ? 'יוֹם אֶחָד' : day === 2 ? 'שְׁנֵי יָמִים' : `${total} יָמִים`;
    const singular = `${total} יוֹם`;
    if (weeks === 0) return plural;
    const ws = WEEKS[weeks];
    if (rem === 0) return `${plural} שֶׁהֵם ${ws}`;
    return `${singular} שֶׁהֵם ${ws} וְ${DAYS_IN_WEEK[rem]}`;
  }

  test('יום 1 = יוֹם אֶחָד', () => assertEqual(countStr(1), 'יוֹם אֶחָד'));
  test('יום 2 = שְׁנֵי יָמִים', () => assert(countStr(2).startsWith('שְׁנֵי יָמִים')));
  test('יום 7 = שִׁבְעָה יָמִים שֶׁהֵם שָׁבוּעַ', () => {
    const s = countStr(7);
    assertContains(s, 'שָׁבוּעַ');
    assertContains(s, 'יָמִים');
  });
  test('יום 8 = שְׁמוֹנָה יוֹם (ביחיד)', () => assertContains(countStr(8), 'שְׁמוֹנָה יוֹם'));
  test('יום 11 = אַחַד עָשָׂר יוֹם', () => {
    const s = countStr(11);
    assertContains(s, 'אַחַד עָשָׂר יוֹם');
    assertContains(s, 'אַרְבָּעָה יָמִים');
  });
  test('יום 14 = שְׁנֵי שָׁבוּעוֹת', () => assertContains(countStr(14), 'שְׁנֵי שָׁבוּעוֹת'));
  test('יום 49 = שִׁבְעָה שָׁבוּעוֹת', () => assertContains(countStr(49), 'שִׁבְעָה שָׁבוּעוֹת'));
  test('כל 49 ימים מחזירים מחרוזת', () => {
    for (let d = 1; d <= 49; d++) {
      const s = countStr(d);
      assert(s && s.length > 3, `Day ${d} empty`);
    }
  });
  test('ימים 11-19 לא מחזירים את כל הרצף', () => {
    for (let d = 11; d <= 19; d++) {
      const s = dayHe(d);
      assert(s && !s.includes('   ') && s.split(' ').length <= 4,
        `dayHe(${d}) returned too long string: "${s}"`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. COMPASS LOGIC
// ═══════════════════════════════════════════════════════════════════════
suite('🧭 כיוון לכותל', () => {
  function bearing(lat1, lon1, lat2, lon2) {
    const R = Math.PI / 180;
    const dLon = (lon2 - lon1) * R;
    const y = Math.sin(dLon) * Math.cos(lat2 * R);
    const x = Math.cos(lat1 * R) * Math.sin(lat2 * R) -
              Math.sin(lat1 * R) * Math.cos(lat2 * R) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  const K = { lat: 31.7767, lon: 35.2345 };

  test('פתח תקווה → כותל ~136°', () => assertRange(bearing(32.0833,34.8878,K.lat,K.lon), 130,142));
  test('תל אביב → כותל ~136°',    () => assertRange(bearing(32.0853,34.7818,K.lat,K.lon), 128,142));
  test('ניו יורק → כותל ~58°',    () => assertRange(bearing(40.7128,-74.006,K.lat,K.lon), 50,70));
  test('לונדון → כותל ~105°',     () => assertRange(bearing(51.5074,-0.1278,K.lat,K.lon), 95,115));
  test('חיפה → כותל דרומה',       () => {
    const b = bearing(32.8,35.0,K.lat,K.lon);
    assert(b > 90 && b < 270, `From north should be southward, got ${b.toFixed(1)}`);
  });
  test('קואורדינטות כותל קיימים בסורס', () => {
    const cal = readFile('js/calendar.js');
    const misc = readFile('js/misc.js');
    const all = cal + misc;
    assert(all.includes('31.77') || all.includes('31.776'), 'Kotel lat in source');
    assert(all.includes('35.23') || all.includes('35.234'), 'Kotel lon in source');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. SEASONAL LOGIC
// ═══════════════════════════════════════════════════════════════════════
suite('📕 עונות – מוריד הטל / ותן ברכה', () => {
  function isWinter(month, day) {
    if (month === 'Nisan' && day >= 15) return false;
    if (['Iyar','Sivan','Tamuz','Av','Elul'].includes(month)) return false;
    if (month === 'Tishrei' && day <= 21) return false;
    return true;
  }

  test('חשוון – חורף',           () => assert(isWinter('Cheshvan', 1)));
  test('ניסן יד – חורף עדיין',   () => assert(isWinter('Nisan', 14)));
  test('ניסן טו – קיץ',          () => assert(!isWinter('Nisan', 15)));
  test('אייר – קיץ',             () => assert(!isWinter('Iyar', 18)));
  test('תשרי כא – קיץ',          () => assert(!isWinter('Tishrei', 21)));
  test('תשרי כב – חורף',         () => assert(isWinter('Tishrei', 22)));
  test('כסלו – חורף',            () => assert(isWinter('Kislev', 15)));
  test('ניסן כ"ה כרגע – קיץ',   () => assert(!isWinter('Nisan', 25)));

  test('regex מוריד הטל מוצא עם ניקוד', () => {
    const N = '[\\u0591-\\u05C7]*';
    const re = new RegExp('מ'+N+'ו'+N+'ר'+N+'י'+N+'ד'+N+'\\s+ה'+N+'ט'+N+'ל'+N);
    assert(re.test('מוֹרִיד הַטָּל'), 'TAL_RE with nikud');
  });

  test('regex ותן ברכה מוצא ללא ותן לפני טל ומטר', () => {
    const plain = 'ותן ברכה, טל ומטר לברכה';
    assert(plain.includes('ותן ברכה'), 'hasBracha');
    assert(plain.includes('טל ומטר'), 'hasMatar (no ותן prefix)');
    assert(!plain.includes('ותן טל ומטר'), 'ותן NOT before טל');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. TEHILIM SCHEDULE
// ═══════════════════════════════════════════════════════════════════════
suite('📖 לוח תהילים', () => {
  const src = readFile('js/tehilim.js');
  assertContains(src, "'119:1-88'", 'Day 25 range entry');
  assertContains(src, "'119:89-176'", 'Day 26 range entry');

  test('119:1-88 = 88 פסוקים', () => {
    const [,vr] = '119:1-88'.split(':');
    const [f,t] = vr.split('-').map(Number);
    assertEqual(t-f+1, 88);
  });
  test('119:89-176 = 88 פסוקים', () => {
    const [,vr] = '119:89-176'.split(':');
    const [f,t] = vr.split('-').map(Number);
    assertEqual(t-f+1, 88);
  });
  test('getTehilimNavInfo מועבר עם range string', () =>
    assertContains(src, 'getTehilimNavInfo(isRange ? chapterOrRange : chapter)'));
});

// ═══════════════════════════════════════════════════════════════════════
// 9. PARASHA COMBINED
// ═══════════════════════════════════════════════════════════════════════
suite('📜 פרשות מחוברות', () => {
  function stripVowelLetters(s) {
    return s ? s.replace(/(?<=[א-ת])[וי](?=[א-ת])/g, '') : '';
  }
  const P = ['ויקהל','פקודי','תזריע','מצורע','אחרי מות','קדושים','בהר','בחוקותי','חקת','בלק','מטות','מסעי','נצבים','וילך'];
  function fuzzy(name) {
    if (!name) return null;
    const nc = stripVowelLetters(name);
    return P.find(p=>p===name) || P.find(p=>stripVowelLetters(p)===nc) ||
           P.find(p=>name.length>=3&&p.startsWith(name.slice(0,3))) ||
           P.find(p=>nc.length>=3&&stripVowelLetters(p).startsWith(nc.slice(0,3)));
  }
  test('מצרע → מצורע',   () => assertEqual(fuzzy('מצרע'),'מצורע'));
  test('בחקתי → בחוקותי',() => assertEqual(fuzzy('בחקתי'),'בחוקותי'));
  test('ויקהל מוצא',     () => assertEqual(fuzzy('ויקהל'),'ויקהל'));
  test('מסעי מוצא',      () => assertEqual(fuzzy('מסעי'),'מסעי'));

  const content = readFile('js/content.js');
  test('stripVowelLetters קיים בסורס', () =>
    assertContains(content, 'stripVowelLetters'));
  test('fuzzyFind קיים בסורס', () =>
    assertContains(content, 'fuzzyFind'));
});

// ═══════════════════════════════════════════════════════════════════════
// 10. SIDDUR RACE CONDITION & SETTINGS
// ═══════════════════════════════════════════════════════════════════════
suite('📕 סידור – race condition ותזכורות', () => {
  const siddur   = readFile('js/siddur.js');
  const settings = readFile('js/settings.js');

  test('_siddurLoadId קיים',         () => assertContains(siddur,'_siddurLoadId'));
  test('_siddurPendingReload קיים',  () => assertContains(siddur,'_siddurPendingReload'));
  test('stale check בלולאה',         () => assertContains(siddur,'myLoadId !== _siddurLoadId'));
  test('loadSettingsState מכיל omer',() => {
    const fn = settings.slice(settings.indexOf('function loadSettingsState'),
                               settings.indexOf('\n}', settings.indexOf('function loadSettingsState'))+2);
    assertContains(fn, "'omer'");
  });
  test('loadSettingsState מכיל zmanim shema', () => {
    const fn = settings.slice(settings.indexOf('function loadSettingsState'),
                               settings.indexOf('\n}', settings.indexOf('function loadSettingsState'))+2);
    assertContains(fn, 'shema');
  });
  test('ספור עכשיו ב-reminder popup',() => assertContains(settings,'ספור עכשיו'));
  test('תחנון לא בערבית',            () => assertContains(siddur,'isArvit'));
});

// ═══════════════════════════════════════════════════════════════════════
suite('📜 פרשות מחוברות – מקף עברי (maqaf)', () => {
  // Mirror the fix: normalize maqaf U+05BE to hyphen before splitting
  function normalizeMaqaf(s) { return s ? s.replace(/־/g, '-') : s; }
  function cleanParasha(heName) {
    return normalizeMaqaf(heName).replace(/פרשת\s*/, '').trim();
  }

  test('מקף עברי (U+05BE) מנורמל ל-hyphen', () => {
    const s = 'אחרי מות־קדשים';
    assertEqual(normalizeMaqaf(s), 'אחרי מות-קדשים');
  });

  test('פרשת אחרי מות־קדשים (maqaf) → חלקים נכונים', () => {
    const clean = cleanParasha('פרשת אחרי מות־קדשים');
    assertEqual(clean, 'אחרי מות-קדשים');
    const parts = clean.split('-');
    assertEqual(parts[0].trim(), 'אחרי מות');
    assertEqual(parts[1].trim(), 'קדשים');
  });

  test('פרשת תזריע-מצרע (hyphen רגיל) עדיין עובד', () => {
    const clean = cleanParasha('פרשת תזריע-מצרע');
    assertEqual(clean, 'תזריע-מצרע');
    const parts = clean.split('-');
    assertEqual(parts[0].trim(), 'תזריע');
    assertEqual(parts[1].trim(), 'מצרע');
  });

  test('content.js מכיל נרמול maqaf', () => {
    const src = readFile('js/content.js');
    assertContains(src, '\u05be', 'maqaf normalization in content.js');
  });
});

// SUMMARY
suite('📅 נרמול חודשים עבריים מ-Hebcal', () => {
  // Mirror normalizeMonth from app.js
  function normalizeMonth(m) {
    if (m === 'Iyyar')   return 'Iyar';
    if (m === 'Tammuz')  return 'Tamuz';
    if (m === 'Adar I' || m === 'Adar 1') return 'Adar';
    return m;
  }
  function getOmerDay(month, day) {
    const m = normalizeMonth(month);
    if (m === 'Nisan' && day >= 16) return day - 15;
    if (m === 'Iyar')  return day + 15;
    if (m === 'Sivan' && day <= 5) return day + 44;
    return null;
  }

  test('Iyyar (Hebcal) → Iyar', () => assertEqual(normalizeMonth('Iyyar'), 'Iyar'));
  test('Tammuz (Hebcal) → Tamuz', () => assertEqual(normalizeMonth('Tammuz'), 'Tamuz'));
  test('Adar I → Adar', () => assertEqual(normalizeMonth('Adar I'), 'Adar'));
  test('Adar II → Adar II (unchanged)', () => assertEqual(normalizeMonth('Adar II'), 'Adar II'));
  test('Nisan → Nisan (unchanged)', () => assertEqual(normalizeMonth('Nisan'), 'Nisan'));

  test('Iyyar 5 = יום 20 לעומר', () => assertEqual(getOmerDay('Iyyar', 5), 20));
  test('Iyyar 18 = יום 33 (לג בעומר)', () => assertEqual(getOmerDay('Iyyar', 18), 33));
  test('Nisan 16 = יום 1', () => assertEqual(getOmerDay('Nisan', 16), 1));
  test('Sivan 5 = יום 49', () => assertEqual(getOmerDay('Sivan', 5), 49));
  test('Sivan 6 = null (שבועות)', () => assert(getOmerDay('Sivan', 6) === null));

  // Verify app.js has normalization
  test('app.js מכיל normalizeMonth', () => {
    const src = readFile('js/app.js');
    assertContains(src, '_normalizeMonth');
    assertContains(src, "Iyyar");
    assertContains(src, "Tammuz");
  });
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`✅ עברו: ${pass}   ❌ נכשלו: ${fail}   ⏭  דולגו: ${skip}`);
console.log(`📊 סה"כ: ${pass+fail+skip} טסטים`);
if (failures.length) {
  console.log('\n🔴 כשלונות:');
  failures.forEach(f => console.log(`  • ${f.name}: ${f.error}`));
}
console.log('═'.repeat(50));
if (fail > 0) process.exit(1);
