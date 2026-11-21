// Browser test: maftir button + תיקון קוראים view (Playwright, Sefaria/Hebcal mocked).
//   python3 -m http.server 8791 &   (repo root)   then   node Tests/browser/tikkun.js
// Env: PW, CHROME, V (app version), OUT (screenshot dir)
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const V = process.env.V || '5.144';
const OUT = process.env.OUT || '/tmp';
let n = 0, f = 0;
const ok = (d, c, x) => { n++; if (c) console.log('OK:', d); else { f++; console.log('FAIL:', d, x !== undefined ? JSON.stringify(x) : ''); } };

const V1 = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
const V2 = 'וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ וְחֹ֖שֶׁךְ עַל־פְּנֵ֣י תְה֑וֹם וְר֣וּחַ אֱלֹהִ֔ים מְרַחֶ֖פֶת עַל־פְּנֵ֥י הַמָּֽיִם׃';
const V3 = 'וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י א֑וֹר וַֽיְהִי־אֽוֹר׃ <span class="mam-spi-pe">{פ}</span>';
const verses = k => [V1, V2, V3][k % 3];
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function satStr() { const d = new Date(), add = d.getDay() === 6 ? 0 : 6 - d.getDay(); return fmt(new Date(d.getTime() + add * 86400000)); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const run = async (theme, w, fn, cacheOn) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript(([v, t, cacheOn]) => {
      if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('theme', t); localStorage.setItem('kodesh_app_v1', JSON.stringify({ _lastSeenVersion: v, cacheSettings: { enabled: !!cacheOn } })); }
      // a fake <audio>: records what would be played, lets the test finish a clip
      window.__played = [];
      window.Audio = class { constructor() { this.paused = true; this.playbackRate = 1; this.currentTime = 0; this.duration = NaN; } set src(v) { this._src = v; setTimeout(() => { this.duration = 2; this.onloadedmetadata && this.onloadedmetadata(); }, 5); } get src() { return this._src; } play() { this.paused = false; window.__played.push(this._src); window.__audio = this; return Promise.resolve(); } pause() { this.paused = true; } };
    }, [V, theme, !!cacheOn]);
    const reqs = [];
    const st = { cal: null };
    const mediaHits = [];
    await ctx.route(/media\.example/, r => { const u = r.request().url(); mediaHits.push(u); if (/broken/.test(u)) return r.abort(); r.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from('ID3-fake-mp3-bytes-' + u) }); });
    await ctx.route(/sefaria|hebcal/, r => {
      const u = decodeURIComponent(r.request().url()); reqs.push(u); let body = '{"items":[],"calendar_items":[]}', m;
      if ((m = u.match(/api\/texts\/(\w+) (\d+):(\d+)-(\d+):(\d+)/)) && m[2] === m[4]) body = JSON.stringify({ he: Array.from({ length: +m[5] - +m[3] + 1 }, (_, i) => verses(i)), sections: [+m[2], +m[3]], toSections: [+m[4], +m[5]] });
      else if ((m = u.match(/api\/texts\/(\w+) (\d+):(\d+)-(\d+):(\d+)/))) body = JSON.stringify({ he: [Array.from({ length: 4 }, (_, i) => verses(i)), Array.from({ length: 3 }, (_, i) => verses(i))] });
      else if (/api\/texts\/Onkelos/.test(u)) body = JSON.stringify({ he: Array.from({ length: 40 }, (_, i) => 'תרגום ' + (i + 1)) });
      else if (/api\/texts\/Rashi/.test(u)) body = JSON.stringify({ he: Array.from({ length: 40 }, (_, i) => [`פירוש ${i + 1}`]) });
      else if (st.cal && /hebcal\.com\/hebcal/.test(u) && /s=on/.test(u)) body = JSON.stringify({ items: [{ category: 'parashat', date: satStr(), hebrew: st.cal.he, title: 'Parashat X' }] });
      else if (st.cal && /api\/calendars/.test(u)) body = JSON.stringify({ calendar_items: [{ title: { en: 'Parashat X' }, extraDetails: { aliyot: st.cal.aliyot } }] });
      else if (/api\/related\/Genesis 12:14-13:4/.test(u)) body = JSON.stringify({ links: [], media: [...[14,15,16,17,18,19,20].map(v => `12:${v}`), ...[1,2,3,4].map(v => `13:${v}`)].map(k => ({ media_url: `https://media.example/gen${k.replace(':','_')}.mp3`, source: 'PocketTorah', anchorRef: `Genesis ${k}` })) });
      else if (/api\/related\/Genesis 17:24-17:27/.test(u)) body = JSON.stringify({ links: [], media: [24, 25, 26, 27].map(v => ({ media_url: `https://media.example/gen17_${v}.mp3`, source: 'PocketTorah', anchorRef: `Genesis 17:${v}` })) });
      else if (/api\/related\//.test(u)) body = JSON.stringify({ links: [], media: [] });
      r.fulfill({ status: 200, contentType: 'application/json', body });
    });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.goto('http://127.0.0.1:8791/index.html'); await page.waitForTimeout(2200);
    await page.evaluate(() => showTab('parasha')); await page.waitForTimeout(1200);
    await fn({ page, errors, reqs, mediaHits, ctx, theme, st });
    await ctx.close();
  };
  const tabs = page => page.evaluate(() => [...document.querySelectorAll('#aliya-tabs .aliya-tab')].map(t => t.textContent.trim()));
  const clickTab = (page, label) => page.evaluate(l => { const t = [...document.querySelectorAll('#aliya-tabs .aliya-tab')].find(x => x.textContent.trim() === l); t.click(); }, label);

  for (const [theme, w] of [['light', 380], ['dark', 360]]) await run(theme, w, async ({ page, errors, reqs, mediaHits }) => {
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
    ok(T + 'reading found → plays the first verse clip (fetched from the clip URL); verse highlighted; source + Ashkenazi stated', a.played.length === 1 && mediaHits.some(u => /gen17_24\.mp3$/.test(u)) && a.hl === '0' && /PocketTorah/.test(a.msg) && /אשכנז/.test(a.msg) && /השהה/.test(a.btn), a);
    await page.evaluate(() => window.__audio.onended());
    await page.waitForTimeout(300);
    ok(T + 'next verse plays when a clip ends, highlight moves', await page.evaluate(() => window.__played.length === 2 && document.querySelector('.tk-playing').dataset.i === '1'));
    await page.click('#tk-audio-btn'); await page.waitForTimeout(200);
    ok(T + 'pause / resume', await page.evaluate(() => /המשך/.test(document.getElementById('tk-audio-btn').textContent) && window.__audio.paused === true));
    await clickTab(page, 'ג'); await page.waitForTimeout(1200);
    ok(T + 'changing aliya stops the reading', await page.evaluate(() => !document.querySelector('.tk-playing') && /הקראה/.test(document.getElementById('tk-audio-btn').textContent)));
    await page.click('#tk-audio-btn'); await page.waitForTimeout(800);
    const nr = await page.evaluate(() => ({ msg: (document.querySelector('.tk-msg') || {}).textContent, played: window.__played.length }));
    ok(T + 'no recording for an aliya → honest Hebrew message, nothing plays', /לא נמצאה בספריא הקראה מוקלטת/.test(nr.msg || '') && nr.played === 2, nr);
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



  // ── maftir button on the CURRENT parasha when the source gives only 7 aliyot (Sefaria calendar) ──
  await run('light', 380, async ({ page, errors, reqs, st }) => {
    const lech = ['Genesis 12:1-12:13', 'Genesis 12:14-13:4', 'Genesis 13:5-13:18', 'Genesis 14:1-14:20', 'Genesis 14:21-15:6', 'Genesis 15:7-17:6', 'Genesis 17:7-17:27'];
    st.cal = { he: 'פרשת לך-לך', aliyot: lech };
    await page.evaluate(() => { loaded = {}; loadParasha(); }); await page.waitForTimeout(2500);
    let t = await tabs(page);
    ok('current parasha (Sefaria\'s 7 aliyot, no Hebcal leyning): the maftir button appears, taken from Hebcal\'s data', JSON.stringify(t) === JSON.stringify(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'מפטיר', 'הכל']) && await page.evaluate(() => aliyot[7] === 'Genesis 17:24-17:27'), { t, a: await page.evaluate(() => aliyot) });
    await clickTab(page, 'מפטיר'); await page.waitForTimeout(1200);
    ok('…and it loads only the maftir', await page.evaluate(() => _currentAliyaRef === 'Genesis 17:24-17:27' && parashaVerses.length === 4));
    // a 7th aliya that does not end where the table's does → no (possibly wrong) maftir is invented
    st.cal = { he: 'פרשת לך-לך', aliyot: lech.slice(0, 6).concat(['Genesis 17:7-17:20']) };
    await page.evaluate(() => { loaded = {}; loadParasha(); }); await page.waitForTimeout(2500);
    ok('a mismatching 7th aliya → no maftir invented', !(await tabs(page)).includes('מפטיר'), await tabs(page));
    // combined week
    st.cal = { he: 'תזריע-מצורע', aliyot: ['Leviticus 12:1-13:23', 'Leviticus 13:24-13:39', 'Leviticus 13:40-13:54', 'Leviticus 13:55-14:20', 'Leviticus 14:21-14:32', 'Leviticus 14:33-15:15', 'Leviticus 15:16-15:33'] };
    await page.evaluate(() => { loaded = {}; loadParasha(); }); await page.waitForTimeout(2500);
    ok('combined week (תזריע-מצורע): maftir = Leviticus 15:31-15:33 from the combined table', await page.evaluate(() => aliyot.length === 8 && aliyot[7] === 'Leviticus 15:31-15:33' && currentParashaRef === 'Leviticus 12:1-15:33'), await page.evaluate(() => ({ a: aliyot, r: currentParashaRef })));
    await page.evaluate(() => loadSpecificParasha('Leviticus 12:1-15:33')); await page.waitForTimeout(1000);
    ok('combined week picked from the list (static path): 7 aliyot + maftir too', await page.evaluate(() => aliyot.length === 8 && aliyot[7] === 'Leviticus 15:31-15:33'));
    ok('no page errors (maftir sources)', errors.length === 0, errors);
  });

  // ── reading controls: speeds, follow-along scroll, progress bar, jump drop-down, bookmark ──
  await run('light', 380, async ({ page, errors, reqs, mediaHits }) => {
    const aud = () => page.evaluate(() => ({ st: TK_AUDIO.state, i: TK_AUDIO.i, t: window.__audio && window.__audio.currentTime, rate: window.__audio && window.__audio.playbackRate, played: window.__played.length, y: Math.round(scrollY) }));
    await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1200);
    await clickTab(page, 'מפטיר'); await page.waitForTimeout(1200);
    await page.click('#view-tikkun-btn'); await page.waitForTimeout(400);
    await page.addStyleTag({ content: '.tk-v { margin-bottom: 900px !important; }' });     // a page that really scrolls
    await page.click('#tk-audio-btn'); await page.waitForTimeout(1500);
    const panel = await page.evaluate(() => ({ rates: [...document.querySelectorAll('#tk-rate option')].map(o => o.value), seek: !!document.getElementById('tk-seek'), time: document.getElementById('tk-time').textContent, vl: document.getElementById('tk-vlabel').textContent, sync: document.querySelector('#tk-audio-panel .tk-chip.on')?.textContent, pitch: window.__audio.preservesPitch }));
    ok('reading panel: 11 speeds 0.5×–2×, progress bar, time + verse label, follow-along on by default, pitch preserved', panel.rates.length === 11 && panel.rates[0] === '0.5' && panel.rates.includes('2') && panel.seek && /0:0\d \/ 0:08/.test(panel.time) && /פרק י״ז פסוק כ״ד · 1\/4/.test(panel.vl) && /פועל/.test(panel.sync) && panel.pitch === true, panel);
    // speeds
    await page.selectOption('#tk-rate', '1.5'); let a = await aud();
    ok('speed 1.5× applied to the player and remembered', a.rate === 1.5 && await page.evaluate(() => appState.tikkunAudio.rate === 1.5), a);
    await page.selectOption('#tk-rate', '0.5'); a = await aud();
    ok('speed 0.5× (slower than normal) applied', a.rate === 0.5);
    await page.selectOption('#tk-rate', '2'); a = await aud();
    ok('speed 2× (faster) applied; the next clip starts at the chosen speed', a.rate === 2 && (await page.evaluate(() => { window.__audio.onended(); return new Promise(r => setTimeout(() => r(window.__audio.playbackRate), 150)); })) === 2);
    // progress bar
    await page.evaluate(() => { window.__audio.currentTime = 1; window.__audio.ontimeupdate(); });
    let pr = await page.evaluate(() => ({ v: document.getElementById('tk-seek').value, time: document.getElementById('tk-time').textContent, vl: document.getElementById('tk-vlabel').textContent }));
    ok('progress bar follows the reading: clip 2 at 1s of 8s total = 375/1000, "0:03 / 0:08", verse label 2/4', pr.v === '375' && pr.time === '0:03 / 0:08' && /1\/4|2\/4/.test(pr.vl) && /פסוק כ״ה · 2\/4/.test(pr.vl), pr);
    const before = (await aud()).played;
    await page.evaluate(() => { const s = document.getElementById('tk-seek'); s.value = 750; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); }); await page.waitForTimeout(400);
    a = await aud();
    ok('dragging the bar to 75% moves to verse 4 (second 6 of 8) and keeps playing', a.i === 3 && a.st === 'playing' && a.played === before + 1 && await page.evaluate(() => document.querySelector('.tk-playing').dataset.i === '3'), a);
    // follow-along scroll
    await page.waitForTimeout(1200);
    let r = await page.evaluate(() => { const v = document.querySelector('.tk-v[data-i="3"]').getBoundingClientRect(); return { top: Math.round(v.top), h: innerHeight }; });
    ok('text scrolled by itself so that the verse being read sits at ~38% of the screen', r.top > r.h * 0.15 && r.top < r.h * 0.6, r);
    const y1 = (await aud()).y;
    await page.evaluate(() => { window.__audio.currentTime = 2; window.__audio.ontimeupdate(); }); await page.waitForTimeout(800);   // fake "end of the verse" → the reading point moves down inside the verse
    ok('the scroll advances with the reading position inside the verse', (await aud()).y > y1, { y1, y2: (await aud()).y });
    await page.click('#tk-audio-btn'); await page.waitForTimeout(150);
    const yp = (await aud()).y; await page.waitForTimeout(500);
    ok('pause stops the reading AND the scrolling together', (await aud()).st === 'paused' && (await aud()).y === yp);
    await page.evaluate(() => { scrollTo(0, 0); }); await page.waitForTimeout(100);
    await page.click('#tk-audio-btn'); await page.waitForTimeout(900);
    ok('resume: both continue (the text scrolls back to the reading point)', (await aud()).st === 'playing' && (await aud()).y > 300);
    await page.evaluate(() => { tikkunAudioUserScrolled(); scrollTo(0, 0); }); await page.waitForTimeout(600);
    ok('the reader scrolling by hand pauses the follow-along for a few seconds', (await aud()).y < 5);
    await page.evaluate(() => { _tkHoldUntil = 0; }); await page.waitForTimeout(900);
    ok('…then it takes over again', (await aud()).y > 300);
    await page.evaluate(() => { autoScrollStart(); }); await page.waitForTimeout(100);
    await page.evaluate(() => { tikkunAudioPause(); tikkunAudioResume(); }); await page.waitForTimeout(200);
    ok('the generic auto-scroll is stopped while the follow-along runs (no two scrollers)', await page.evaluate(() => _asState === 'idle'));
    await page.click('#tk-audio-panel .tk-chip >> text=גלילה עם ההקראה'); await page.waitForTimeout(100);
    await page.evaluate(() => { tikkunSeekCommit(0); scrollTo(0, 0); }); await page.waitForTimeout(300);
    await page.evaluate(() => { scrollTo(0, 0); }); await page.evaluate(() => { window.__audio.onended(); }); await page.waitForTimeout(700);
    ok('follow-along switched off: the reading continues, the text stays', (await aud()).st === 'playing' && (await aud()).y < 5 && await page.evaluate(() => appState.tikkunAudio.sync === false));
    await page.click('#tk-audio-panel .tk-chip >> text=גלילה עם ההקראה');
    // jump drop-down with search
    await page.click('#tk-audio-panel .tk-chip >> text=קפוץ'); await page.waitForTimeout(300);
    let j = await page.evaluate(() => ({ rows: document.querySelectorAll('#tk-jlist .tk-jrow').length, aliyot: document.querySelectorAll('#tk-jlist .tk-jaliya').length, focus: document.activeElement.id }));
    ok('jump list: aliyot (incl. מפטיר) + the 4 verses, search box focused', j.aliyot === 8 && j.rows === 12 && j.focus === 'tk-jq', j);
    await page.fill('#tk-jq', 'כו'); await page.waitForTimeout(200);
    j = await page.evaluate(() => [...document.querySelectorAll('#tk-jlist .tk-jrow')].map(x => x.textContent));
    ok('search "כו" → just verse 26', j.length === 1 && /פסוק כ״ו/.test(j[0]), j);
    await page.click('#tk-jlist .tk-jrow'); await page.waitForTimeout(500);
    a = await aud();
    ok('picking a verse jumps the reading there (and closes the list)', a.i === 2 && a.st === 'playing' && !(await page.evaluate(() => !!document.getElementById('tk-jlist'))), a);
    await page.click('#tk-audio-panel .tk-chip >> text=קפוץ'); await page.waitForTimeout(200);
    await page.fill('#tk-jq', 'עליה ב'); await page.waitForTimeout(200);
    ok('search "עליה ב" → that aliya only', (await page.evaluate(() => [...document.querySelectorAll('#tk-jlist .tk-jrow')].map(x => x.textContent))).length === 1);
    await page.click('#tk-jlist .tk-jrow'); await page.waitForTimeout(2500);
    a = await page.evaluate(() => ({ ref: _currentAliyaRef, active: document.querySelector('#aliya-tabs .aliya-tab.active').textContent.trim(), st: TK_AUDIO.state, ref2: TK_AUDIO.ref, first: TK_AUDIO.items[0] && TK_AUDIO.items[0].key, played: window.__played.length }));
    ok('picking another aliya loads it and starts its reading from the beginning', a.ref === 'Genesis 12:14-13:4' && a.active === 'ב' && a.st === 'playing' && a.ref2 === a.ref && a.first === '12:14', a);
    // bookmark with the reading position
    await page.evaluate(() => { window.__audio.currentTime = 1; window.__audio.ontimeupdate(); });
    await page.click('#tk-audio-btn'); await page.waitForTimeout(150);
    await page.evaluate(() => { scrollTo(0, 0); const r = document.querySelector('.tk-v').getBoundingClientRect(); bookmarkAddAt(r.left + 40, r.top + 10, { nearest: true }); }); await page.waitForTimeout(400);
    const bm = await page.evaluate(() => (appState.bookmarks || {}).parasha);
    ok('a bookmark made with the reading open stores the reading position, speed and follow-along', bm && bm.state.audio && bm.state.audio.key === '12:14' && bm.state.audio.t === 1 && bm.state.audio.rate === 2 && bm.state.audio.sync === true, bm && bm.state);
    ok('…and its label says so', /🎧/.test(await page.evaluate(() => BM_ADAPTERS.parasha.describe(appState.bookmarks.parasha.state))));
    ok('a state without the reading is NOT "the same place" as that bookmark (so it gets restored)', await page.evaluate(() => { const cur = BM_ADAPTERS.parasha.capture(); const noAudio = Object.assign({}, cur, { audio: undefined }); return BM_ADAPTERS.parasha.same(noAudio, appState.bookmarks.parasha.state) === false && BM_ADAPTERS.parasha.same(cur, appState.bookmarks.parasha.state) === true; }));
    await page.evaluate(() => { tikkunAudioStop(); showTab('calendar'); }); await page.waitForTimeout(600);
    await page.evaluate(() => bookmarkGo('parasha')); await page.waitForTimeout(5000);
    a = await page.evaluate(() => ({ tab: currentTab, view: parashaView, st: TK_AUDIO.state, i: TK_AUDIO.i, t: TK_AUDIO.el && TK_AUDIO.el.currentTime, rate: TK_AUDIO.rate, panel: !!document.getElementById('tk-seek'), msg: (document.querySelector('.tk-msg') || {}).textContent }));
    ok('going to the bookmark restores text place AND reading position (paused, ready to continue), speed included', a.tab === 'parasha' && a.view === 'tikkun' && a.st === 'paused' && a.i === 0 && a.t === 1 && a.rate === 2 && a.panel && /להמשך/.test(a.msg), a);
    ok('no page errors (reading controls)', errors.length === 0, errors);
  }, true);

  // ── caching: text, clip list, clip audio (IndexedDB, tab "tikkun") ──
  await run('light', 380, async ({ page, errors, reqs, mediaHits }) => {
    const rows = () => page.evaluate(async () => { const st = await cacheStats(); return { tikkun: st.byTab.tikkun, parasha: st.byTab.parasha }; });
    const count = (arr, re) => arr.filter(u => re.test(u)).length;
    await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = [...document.querySelectorAll('#aliya-tabs .aliya-tab')].find(x => x.textContent.trim() === 'מפטיר'); t.click(); }); await page.waitForTimeout(1500);
    await page.click('#view-tikkun-btn'); await page.waitForTimeout(500);
    const textReq1 = count(reqs, /api\/texts\/Genesis 17:24-17:27/);
    await page.click('#tk-audio-btn'); await page.waitForTimeout(2500);
    let r = await rows();
    ok('first play: clip list requested once (/api/related), clips downloaded once each (current + fetched ahead)', count(reqs, /api\/related\//) === 1 && [24, 25, 26, 27].every(v => count(mediaHits, new RegExp(`gen17_${v}\\.mp3`)) === 1), { rel: count(reqs, /api\/related\//), media: mediaHits });
    ok('IndexedDB tab "tikkun" now holds the clip list + 4 clips (bytes counted); the text is in tab "parasha"', r.tikkun.count === 5 && r.tikkun.bytes > 100 && r.parasha.count >= 1, r);
    ok('playback uses the stored bytes (blob URL), not the remote URL', await page.evaluate(() => /^blob:/.test(window.__played[0])), await page.evaluate(() => window.__played));
    await page.evaluate(() => tikkunAudioStop()); 
    await page.reload(); await page.waitForTimeout(2200);
    await page.evaluate(() => showTab('parasha')); await page.waitForTimeout(800);
    await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = [...document.querySelectorAll('#aliya-tabs .aliya-tab')].find(x => x.textContent.trim() === 'מפטיר'); t.click(); }); await page.waitForTimeout(1200);
    await page.evaluate(() => setParashaView('tikkun')); await page.waitForTimeout(500);
    ok('after a reload the maftir text comes from the cache (no second /api/texts request)', count(reqs, /api\/texts\/Genesis 17:24-17:27/) === textReq1, count(reqs, /api\/texts\/Genesis 17:24-17:27/));
    await page.click('#tk-audio-btn'); await page.waitForTimeout(1500);
    ok('after a reload: clip list + audio come from IndexedDB — zero new network requests, still plays', count(reqs, /api\/related\//) === 1 && mediaHits.length === 4 && await page.evaluate(() => window.__played.length >= 1 && /^blob:/.test(window.__played[0])), { rel: count(reqs, /api\/related\//), media: mediaHits.length });
    await page.evaluate(() => tikkunAudioStop());
    const settings = await page.evaluate(async () => { openSettings(); await renderCacheSettings(); return document.getElementById('cache-tab-rows').textContent; });
    ok('Settings → cache shows the "הקראות תיקון קוראים" row with its size', /הקראות תיקון קוראים/.test(settings) && /5 פריטים/.test(settings), settings.replace(/\s+/g, ' ').slice(0, 300));
    await page.evaluate(async () => { closeSettings(); await cacheClear('tikkun'); });
    ok('clearing that tab removes only the audio entries', (await rows()).tikkun.count === 0 && (await rows()).parasha.count >= 1);
    // eviction: a small budget keeps only the newest entries
    const ev = await page.evaluate(async () => { CACHE_TAB_MAX_BYTES.tikkun = 1000; const mk = n => new Blob([new Uint8Array(600).fill(n)]); await cachePutBlob('k1', mk(1), 'tikkun'); await new Promise(r => setTimeout(r, 5)); await cachePutBlob('k2', mk(2), 'tikkun'); await new Promise(r => setTimeout(r, 5)); await cachePutBlob('k3', mk(3), 'tikkun'); const st = await cacheStats(); return { n: st.byTab.tikkun.count, bytes: st.byTab.tikkun.bytes, k1: !!(await cacheGetBlob('k1', 'tikkun')), k3: !!(await cacheGetBlob('k3', 'tikkun')) }; });
    ok('byte budget: oldest clips are evicted first', ev.n === 1 && ev.bytes === 600 && !ev.k1 && ev.k3, ev);
    ok('empty bodies are never stored', await page.evaluate(async () => (await cachePutBlob('empty', new Blob([]), 'tikkun')) === false && !(await cacheGetBlob('empty', 'tikkun'))));
    ok('no page errors (cache)', errors.length === 0, errors);
  }, true);

  // a clip host without CORS headers (download impossible) → the clip is streamed, nothing half-cached
  await run('light', 380, async ({ page, errors, reqs, mediaHits }) => {
    await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = [...document.querySelectorAll('#aliya-tabs .aliya-tab')].find(x => x.textContent.trim() === 'מפטיר'); t.click(); }); await page.waitForTimeout(1500);
    await page.evaluate(() => {   // pretend the downloads fail (CORS): every clip fetch rejects
      const f = window.fetch; window.fetch = (u, i) => /media\.example/.test(String(u)) ? Promise.reject(new TypeError('Failed to fetch')) : f(u, i);
    });
    await page.click('#view-tikkun-btn'); await page.waitForTimeout(400);
    await page.click('#tk-audio-btn'); await page.waitForTimeout(1500);
    const s = await page.evaluate(async () => ({ played: window.__played, st: (await cacheStats()).byTab.tikkun }));
    ok('download blocked → clip is streamed from its URL, still plays; no clip bytes stored (only the list)', s.played.length >= 1 && /^https:\/\/media\.example\/gen17_24\.mp3$/.test(s.played[0]) && s.st.count === 1, s);
    ok('no page errors (stream fallback)', errors.length === 0, errors);
  }, true);

  // cache switched off → nothing stored, everything still works
  await run('light', 380, async ({ page, errors }) => {
    await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = [...document.querySelectorAll('#aliya-tabs .aliya-tab')].find(x => x.textContent.trim() === 'מפטיר'); t.click(); }); await page.waitForTimeout(1500);
    await page.click('#view-tikkun-btn'); await page.waitForTimeout(400);
    await page.click('#tk-audio-btn'); await page.waitForTimeout(1500);
    const s = await page.evaluate(async () => ({ played: window.__played.length, st: await cacheStats() }));
    ok('cache off: plays, nothing written to IndexedDB', s.played >= 1 && s.st.total.count === 0, s);
    ok('no page errors (cache off)', errors.length === 0, errors);
  }, false);
  console.log(`${n - f}/${n} passed`); await browser.close(); process.exit(f ? 1 : 0);
})();
async function txtAll(page) { return page.evaluate(() => document.getElementById('tikkun-opts').textContent); }
