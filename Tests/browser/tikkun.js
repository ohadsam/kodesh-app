// Browser test: maftir button + תיקון קוראים view (Playwright, Sefaria/Hebcal mocked).
//   python3 -m http.server 8791 &   (repo root)   then   node Tests/browser/tikkun.js
// Env: PW, CHROME, V (app version), OUT (screenshot dir)
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const V = process.env.V || '5.142';
const OUT = process.env.OUT || '/tmp';
let n = 0, f = 0;
const ok = (d, c, x) => { n++; if (c) console.log('OK:', d); else { f++; console.log('FAIL:', d, x !== undefined ? JSON.stringify(x) : ''); } };

const V1 = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
const V2 = 'וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ וְחֹ֖שֶׁךְ עַל־פְּנֵ֣י תְה֑וֹם וְר֣וּחַ אֱלֹהִ֔ים מְרַחֶ֖פֶת עַל־פְּנֵ֥י הַמָּֽיִם׃';
const V3 = 'וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י א֑וֹר וַֽיְהִי־אֽוֹר׃ <span class="mam-spi-pe">{פ}</span>';
const verses = k => [V1, V2, V3][k % 3];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const run = async (theme, w, fn) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript(([v, t]) => {
      if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('theme', t); localStorage.setItem('kodesh_app_v1', JSON.stringify({ _lastSeenVersion: v, cacheSettings: { enabled: false } })); }
      // a fake <audio>: records what would be played, lets the test finish a clip
      window.__played = [];
      window.Audio = class { constructor() { this.paused = true; this.playbackRate = 1; } play() { this.paused = false; window.__played.push(this.src); window.__audio = this; return Promise.resolve(); } pause() { this.paused = true; } };
    }, [V, theme]);
    const reqs = [];
    await ctx.route(/sefaria|hebcal/, r => {
      const u = decodeURIComponent(r.request().url()); reqs.push(u); let body = '{"items":[],"calendar_items":[]}', m;
      if ((m = u.match(/api\/texts\/(\w+) (\d+):(\d+)-(\d+):(\d+)/)) && m[2] === m[4]) body = JSON.stringify({ he: Array.from({ length: +m[5] - +m[3] + 1 }, (_, i) => verses(i)), sections: [+m[2], +m[3]], toSections: [+m[4], +m[5]] });
      else if ((m = u.match(/api\/texts\/(\w+) (\d+):(\d+)-(\d+):(\d+)/))) body = JSON.stringify({ he: [Array.from({ length: 4 }, (_, i) => verses(i)), Array.from({ length: 3 }, (_, i) => verses(i))] });
      else if (/api\/texts\/Onkelos/.test(u)) body = JSON.stringify({ he: Array.from({ length: 40 }, (_, i) => 'תרגום ' + (i + 1)) });
      else if (/api\/texts\/Rashi/.test(u)) body = JSON.stringify({ he: Array.from({ length: 40 }, (_, i) => [`פירוש ${i + 1}`]) });
      else if (/api\/related\/Genesis 17:24-17:27/.test(u)) body = JSON.stringify({ links: [], media: [24, 25, 26, 27].map(v => ({ media_url: `https://media.example/gen17_${v}.mp3`, source: 'PocketTorah', anchorRef: `Genesis 17:${v}` })) });
      else if (/api\/related\//.test(u)) body = JSON.stringify({ links: [], media: [] });
      r.fulfill({ status: 200, contentType: 'application/json', body });
    });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.goto('http://127.0.0.1:8791/index.html'); await page.waitForTimeout(2200);
    await page.evaluate(() => showTab('parasha')); await page.waitForTimeout(1200);
    await fn({ page, errors, reqs });
    await ctx.close();
  };
  const tabs = page => page.evaluate(() => [...document.querySelectorAll('#aliya-tabs .aliya-tab')].map(t => t.textContent.trim()));
  const clickTab = (page, label) => page.evaluate(l => { const t = [...document.querySelectorAll('#aliya-tabs .aliya-tab')].find(x => x.textContent.trim() === l); t.click(); }, label);

  for (const [theme, w] of [['light', 380], ['dark', 360]]) await run(theme, w, async ({ page, errors, reqs }) => {
    const T = `[${theme} ${w}px] `;
    // ── 1. maftir ──
    await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1200);
    let t = await tabs(page);
    ok(T + 'aliya buttons: א…ז, מפטיר, הכל (maftir next to the aliyot)', JSON.stringify(t) === JSON.stringify(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'מפטיר', 'הכל']), t);
    await clickTab(page, 'מפטיר'); await page.waitForTimeout(1500);
    let s = await page.evaluate(() => ({ ref: _currentAliyaRef, nv: parashaVerses.length, nums: _aliyaVerseNums.join(','), active: document.querySelector('#aliya-tabs .aliya-tab.active').textContent.trim(), shown: document.querySelectorAll('#parasha-content > div').length }));
    ok(T + 'maftir shows ONLY its verses (Genesis 17:24-27 = 4 verses, numbered 24..27)', s.ref === 'Genesis 17:24-17:27' && s.nv === 4 && s.nums === '17:24,17:25,17:26,17:27' && s.active === 'מפטיר', s);
    await page.click('#view-rashi-btn'); await page.waitForTimeout(2500);
    ok(T + 'maftir + Rashi: Rashi requested for chapter 17 and shown', reqs.some(u => /Rashi on Genesis 17/.test(u)) && /רש"י/.test(await page.textContent('#parasha-content')));
    await page.click('#view-onkelos-btn'); await page.waitForTimeout(2000);
    ok(T + 'maftir + Onkelos works', reqs.some(u => /Onkelos_Genesis\.17/.test(u)) && /אונקלוס/.test(await page.textContent('#parasha-content')));
    await page.click('#view-text-btn');
    await page.evaluate(() => loadSpecificParasha('Deuteronomy 33:1-34:12')); await page.waitForTimeout(1200);
    t = await tabs(page);
    ok(T + 'Vezot Haberakhah has no maftir button (none in Hebcal\'s data)', !t.includes('מפטיר') && t.length === 8, t);
    await page.evaluate(() => loadSpecificParasha('Leviticus 6:1-8:36')); await page.waitForTimeout(1000);
    ok(T + 'Tzav (previously mis-divided): aliya 2 = Leviticus 6:12-7:10', await page.evaluate(() => aliyot[1] === 'Leviticus 6:12-7:10' && aliyot[7] === 'Leviticus 8:30-8:36' === false || aliyot[1] === 'Leviticus 6:12-7:10'), await page.evaluate(() => aliyot));

    // ── 2. תיקון קוראים ──
    await page.evaluate(() => loadSpecificParasha('Genesis 1:1-6:8')); await page.waitForTimeout(1200);
    await page.click('#view-tikkun-btn'); await page.waitForTimeout(800);
    const vis = sel => page.evaluate(x => { const e = document.querySelector(x); return !!e && getComputedStyle(e).display !== 'none'; }, sel);
    ok(T + 'tikkun view: button active, options bar visible, scroll block rendered', (await vis('#tikkun-opts')) && await page.evaluate(() => document.getElementById('view-tikkun-btn').classList.contains('active') && !!document.querySelector('.tk-scroll .tk-v')));
    const txt = () => page.evaluate(() => [...document.querySelectorAll('.tk-t')].map(e => e.textContent).join(' '));
    const hasPts = x => /[ְ-ּׁׂ]/.test(x), hasTro = x => /[֑-֯]/.test(x);
    let tx = await txt();
    ok(T + 'default = bare scroll text: letters only, no maqaf', !hasPts(tx) && !hasTro(tx) && !/־/.test(tx) && /בראשית ברא אלהים/.test(tx), tx.slice(0, 60));
    const font = await page.evaluate(() => ({ ff: getComputedStyle(document.querySelector('.tk-t')).fontFamily, loaded: document.fonts.check('20px "Itim Stam Ashkenaz"', 'בראשית'), size: parseFloat(getComputedStyle(document.querySelector('.tk-t')).fontSize) }));
    ok(T + 'rendered in the Stam (sofer) font, which is loaded; larger than body text', /Itim Stam Ashkenaz/.test(font.ff) && font.loaded && font.size > 22, font);
    await page.screenshot({ path: `${OUT}/tk_${theme}_plain.png` });
    await page.click('#tikkun-opts >> text=ניקוד'); await page.waitForTimeout(300);
    tx = await txt(); ok(T + 'ניקוד layer: points appear, no accents', hasPts(tx) && !hasTro(tx), tx.slice(0, 50));
    await page.click('#tikkun-opts >> text=טעמי המקרא'); await page.waitForTimeout(300);
    tx = await txt(); ok(T + 'טעמים layer on top: accents appear too (same Stam font)', hasPts(tx) && hasTro(tx) && /Itim Stam/.test(await page.evaluate(() => getComputedStyle(document.querySelector('.tk-t')).fontFamily)));
    await page.screenshot({ path: `${OUT}/tk_${theme}_marks.png` });
    await page.click('#tikkun-opts >> text=ניקוד'); await page.waitForTimeout(300);
    tx = await txt(); ok(T + 'nikud off again → accents only', !hasPts(tx) && hasTro(tx));
    await page.click('#tikkun-opts >> text=טעמי המקרא'); await page.waitForTimeout(200);
    ok(T + 'petucha ({פ}) shown as a paragraph break marker; the raw marker text is gone', await page.evaluate(() => document.querySelectorAll('.tk-pe').length >= 1 && !/\{/.test(document.querySelector('.tk-scroll').textContent) && !!document.querySelector('.tk-mk')));
    const nums1 = await page.evaluate(() => document.querySelectorAll('.tk-n').length);
    await page.click('#tikkun-opts >> text=מספרי פסוקים'); await page.waitForTimeout(200);
    ok(T + 'verse numbers toggle off/on', nums1 > 0 && await page.evaluate(() => document.querySelectorAll('.tk-n').length) === 0);
    await page.click('#tikkun-opts >> text=מספרי פסוקים');
    await page.click('#tikkun-opts >> text=כתב: אשכנז'); await page.waitForTimeout(300);
    ok(T + 'script switch → Sefarad font', /Itim Stam Sefarad/.test(await page.evaluate(() => getComputedStyle(document.querySelector('.tk-t')).fontFamily)) && /כתב: ספרד/.test(await txtAll(page)));
    await page.click('#tikkun-opts >> text=כתב: ספרד');

    // aliyot keep working inside the view
    await clickTab(page, 'ב'); await page.waitForTimeout(1200);
    s = await page.evaluate(() => ({ ref: _currentAliyaRef, view: parashaView, tk: !!document.querySelector('.tk-scroll'), first: _aliyaVerseNums[0] }));
    ok(T + 'aliya ב inside תיקון קוראים: loads Genesis 2:4-2:19, view stays', s.ref === 'Genesis 2:4-2:19' && s.view === 'tikkun' && s.tk && s.first === '2:4', s);
    await clickTab(page, 'מפטיר'); await page.waitForTimeout(1200);
    ok(T + 'maftir inside תיקון קוראים shows only the maftir', await page.evaluate(() => _currentAliyaRef === 'Genesis 6:5-6:8' && document.querySelectorAll('.tk-v').length === 4));
    await clickTab(page, 'הכל'); await page.waitForTimeout(1200);
    ok(T + '"הכל" inside תיקון קוראים shows the whole parasha', await page.evaluate(() => _currentAliyaRef === 'Genesis 1:1-6:8' && document.querySelectorAll('.tk-v').length > 4));
    await page.click('#aliya-nav-bottom button >> nth=-1').catch(() => {});

    // ── 3. ta'amim list ──
    await page.click('#tikkun-opts >> text=רשימת הטעמים'); await page.waitForTimeout(500);
    const tl = await page.evaluate(() => ({ rows: document.querySelectorAll('.tk-trop').length, heads: [...document.querySelectorAll('.tk-trop-h')].map(h => h.firstChild.textContent), names: [...document.querySelectorAll('.tk-trop-txt b')].map(b => b.textContent), signFont: getComputedStyle(document.querySelector('.tk-trop-sign')).fontFamily, back: /חזרה לטקסט/.test(document.getElementById('tikkun-opts').textContent) }));
    ok(T + 'ta\'amim list: 33 rows in 3 groups, includes פשטא / מונח / זרקא / סגולתא, signs in the Stam font, back button', tl.rows === 33 && tl.heads.length === 3 && ['פשטא', 'מונח', 'זרקא', 'סגולתא (סגול)', 'אתנחתא', 'תביר'].every(x => tl.names.includes(x)) && /Itim Stam/.test(tl.signFont) && tl.back, tl);
    await page.screenshot({ path: `${OUT}/tk_${theme}_taamim.png`, fullPage: false });
    await clickTab(page, 'ג'); await page.waitForTimeout(1000);
    ok(T + 'changing aliya while on the list keeps the list', await page.evaluate(() => !!document.querySelector('.tk-troplist')));
    await page.click('#tikkun-opts >> text=חזרה לטקסט'); await page.waitForTimeout(300);
    ok(T + 'back to the text', await page.evaluate(() => !!document.querySelector('.tk-scroll') && !document.querySelector('.tk-troplist')));

    // ── 4. recorded reading (shape of Sefaria's related API is an assumption) ──
    await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1000);
    await clickTab(page, 'מפטיר'); await page.waitForTimeout(1200);
    await page.click('#tk-audio-btn'); await page.waitForTimeout(800);
    let a = await page.evaluate(() => ({ played: window.__played, msg: document.querySelector('.tk-msg')?.textContent, btn: document.getElementById('tk-audio-btn').textContent, hl: document.querySelector('.tk-playing')?.dataset.i }));
    ok(T + 'reading found → plays the first verse clip; verse highlighted; source + Ashkenazi stated', a.played.length === 1 && /gen17_24\.mp3$/.test(a.played[0]) && a.hl === '0' && /PocketTorah/.test(a.msg) && /אשכנז/.test(a.msg) && /השהה/.test(a.btn), a);
    await page.evaluate(() => window.__audio.onended());
    await page.waitForTimeout(300);
    ok(T + 'next verse plays when a clip ends, highlight moves', await page.evaluate(() => window.__played.length === 2 && /gen17_25/.test(window.__played[1]) && document.querySelector('.tk-playing').dataset.i === '1'));
    await page.click('#tk-audio-btn'); await page.waitForTimeout(200);
    ok(T + 'pause / resume', await page.evaluate(() => /המשך/.test(document.getElementById('tk-audio-btn').textContent) && window.__audio.paused === true));
    await clickTab(page, 'ב'); await page.waitForTimeout(1200);
    ok(T + 'changing aliya stops the reading', await page.evaluate(() => !document.querySelector('.tk-playing') && /הקראה/.test(document.getElementById('tk-audio-btn').textContent)));
    await page.click('#tk-audio-btn'); await page.waitForTimeout(800);
    ok(T + 'no recording for an aliya → honest Hebrew message, nothing plays', await page.evaluate(() => /לא נמצאה בספריא הקראה מוקלטת/.test(document.querySelector('.tk-msg').textContent) && window.__played.length === 2));
    await page.click('#view-text-btn'); await page.waitForTimeout(300);
    ok(T + 'leaving the view hides the options and resets it', !(await vis('#tikkun-opts')));
    ok(T + 'no page errors', errors.length === 0, errors);
  });

  // search + bookmark integration
  await run('light', 380, async ({ page, errors }) => {
    const r = await page.evaluate(() => ['תיקון קוראים בראשית', 'בראשית מפטיר', 'לך לך מפטיר רש"י'].map(q => { const x = srSearch(q)[0]; return { t: x.title, s: x.sub, go: x.go }; }));
    ok('search "תיקון קוראים בראשית" → parasha בראשית in tikkun view', r[0].go.view === 'tikkun' && r[0].go.ref === 'Genesis 1:1-6:8', r[0]);
    ok('search "בראשית מפטיר" → aliya 8 (the maftir button)', r[1].go.aliya === 8 && /מפטיר/.test(r[1].s), r[1]);
    ok('search "לך לך מפטיר רש״י" → maftir + Rashi', r[2].go.aliya === 8 && r[2].go.view === 'rashi', r[2]);
    await page.click('#search-btn'); await page.fill('#sr-input', 'לך לך מפטיר תיקון קוראים'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(3500);
    const s = await page.evaluate(() => ({ ref: _currentAliyaRef, view: parashaView, name: document.getElementById('parasha-name').textContent }));
    ok('navigating via search lands on לך לך maftir in תיקון קוראים', s.ref === 'Genesis 17:24-17:27' && s.view === 'tikkun', s);
    await page.evaluate(() => { const r = document.querySelector('.tk-v').getBoundingClientRect(); bookmarkAddAt(r.left + 40, r.top + 10, { nearest: true }); }); await page.waitForTimeout(300);
    const bm = await page.evaluate(() => (appState.bookmarks || {}).parasha);
    ok('bookmark stores the tikkun view and its label says so', bm && bm.state.view === 'tikkun' && /תיקון קוראים/.test(bm.label || BM_ADAPTERS.parasha.describe(bm.state)), bm && bm.state.view);
    ok('no page errors (search/bookmark)', errors.length === 0, errors);
  });

  console.log(`${n - f}/${n} passed`); await browser.close(); process.exit(f ? 1 : 0);
})();
async function txtAll(page) { return page.evaluate(() => document.getElementById('tikkun-opts').textContent); }
