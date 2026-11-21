// Browser test for the "ספרי הרמב"ם" sub-tab (Playwright, Sefaria/Hebcal mocked).
//   python3 -m http.server 8791 &   (from the repo root)   then   node Tests/browser/rambam_books.js
// Env: PW=/path/to/playwright (default /opt/node22/lib/node_modules/playwright), CHROME=/opt/pw-browsers/chromium, V=<app version>
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const V = process.env.V || '5.144';
const URL = 'http://127.0.0.1:8791/index.html';
let n = 0, f = 0;
const ok = (d, c, x) => { n++; if (c) console.log('OK:', d); else { f++; console.log('FAIL:', d, x !== undefined ? JSON.stringify(x) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HAL = ['הִלְכוֹת שַׁבָּת – הֲלָכָה א: מִי שֶׁעָשָׂה מְלָאכָה בְּשַׁבָּת', 'הֲלָכָה ב: הַמּוֹצִיא מֵרְשׁוּת לִרְשׁוּת <b>חַיָּב</b> חַטָּאת', 'הֲלָכָה ג: אֵין מוֹצִיאִין', 'הֲלָכָה ד: הַכּוֹתֵב שְׁתֵּי אוֹתִיּוֹת', 'הֲלָכָה ה: הַבּוֹנֶה', 'הֲלָכָה ו: הַחוֹרֵשׁ <img src=x onerror="window.__xss=1"> וְהַזּוֹרֵעַ'];
const E = (kw, t) => `<b>${kw}</b> ${t}`;
const ST5 = [[E('מי שעשה מלאכה', 'פירוש להלכה א')], [E('המוציא', 'פירוש ב1'), E('חטאת', 'פירוש ב2')], [], [E('הכותב', 'פירוש ד')], [], [E('החורש', 'פירוש ו')]];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const run = async (theme, w, fn) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript(([v, t]) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('theme', t); localStorage.setItem('kodesh_app_v1', JSON.stringify({ _lastSeenVersion: v, cacheSettings: { enabled: false } })); } }, [V, theme]);
    const reqs = [];
    let calDelay = 0;
    await ctx.route(/sefaria|hebcal/, async r => {
      const u = decodeURIComponent(r.request().url()); let body = '{"items":[],"calendar_items":[]}', status = 200;
      reqs.push(u);
      let m;
      if (/api\/calendars/.test(u)) { if (calDelay) await sleep(calDelay); body = JSON.stringify({ calendar_items: [{ title: { en: 'Daily Rambam', he: 'רמב"ם יומי' }, ref: 'Mishneh Torah, Prayer and the Priestly Blessing 4', heRef: 'תפילה ד' }] }); }
      else if (/api\/texts\/Mishneh Torah, Prayer and the Priestly Blessing 4/.test(u)) body = JSON.stringify({ he: ['יומי א', 'יומי ב'] });
      else if (/api\/texts\/Steinsaltz on Mishneh Torah, Sabbath 5:1-6/.test(u)) body = JSON.stringify({ he: ST5, sections: [5, 1], toSections: [5, 6] });
      else if (/api\/texts\/Steinsaltz on Mishneh Torah, Sabbath 7/.test(u)) body = JSON.stringify({ he: [E('לא קיים בטקסט', 'פירוש נודד'), E('הכותב', 'פירוש ד')] });   // flat → keyword placement
      else if (/api\/texts\/Steinsaltz on/.test(u)) body = JSON.stringify({ he: [] });
      else if (/api\/texts\/Mishneh Torah, Sabbath 5/.test(u)) body = JSON.stringify({ he: HAL });
      else if (/api\/texts\/Mishneh Torah, Sabbath 7/.test(u)) body = JSON.stringify({ he: HAL });
      else if (/api\/texts\/Mishneh Torah, Fasts 4/.test(u)) { status = 500; body = '{"error":"boom"}'; }
      else if ((m = u.match(/api\/texts\/Mishneh Torah, (.+) (\d+)(\?|$)/))) body = JSON.stringify({ he: [`${m[1]} פרק ${m[2]} הלכה א`, `${m[1]} פרק ${m[2]} הלכה ב`, ['פסקה א', 'פסקה ב']] });
      else if (/api\/texts/.test(u)) body = JSON.stringify({ he: ['x'] });
      await r.fulfill({ status, contentType: 'application/json', body });
    });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await fn({ ctx, page, errors, reqs, setCalDelay: d => { calDelay = d; } });
    await ctx.close();
  };
  const boot = async page => { await page.goto(URL); await page.waitForTimeout(2200); };

  for (const [theme, w] of [['light', 380], ['dark', 360]]) await run(theme, w, async ({ page, errors, reqs }) => {
    const T = `[${theme} ${w}px] `;
    const txt = sel => page.textContent(sel);
    const halCount = () => page.evaluate(() => document.querySelectorAll('#rambam-content .rb-hal').length);
    await boot(page);
    await page.evaluate(() => showTab('rambam')); await page.waitForTimeout(1500);
    ok(T + 'default: daily Rambam, mode buttons visible, books UI hidden', await page.evaluate(() => document.getElementById('rb-mode-daily').classList.contains('active') && document.getElementById('rambam-books-ui').style.display === 'none' && /יומי/.test(document.getElementById('rambam-content').textContent)));
    await page.click('#rb-mode-books'); await page.waitForTimeout(1200);
    const ui = await page.evaluate(() => ({ title: document.getElementById('rambam-title').textContent, sefarim: document.querySelectorAll('#rb-sefer option').length, hils: document.querySelectorAll('#rb-hil option').length, chips: document.querySelectorAll('.rb-chip').length, sub: document.getElementById('rambam-subtitle').textContent, first: document.getElementById('rambam-content').textContent.slice(0, 60) }));
    ok(T + 'books mode: 14 sefarim, 5 sets in ספר המדע, 10 chapter chips, first chapter loaded', ui.title === 'ספרי הרמב"ם' && ui.sefarim === 14 && ui.hils === 5 && ui.chips === 10 && /יסודי התורה/.test(ui.sub) && /פרק 1 הלכה א/.test(ui.first), ui);
    ok(T + 'requested ref is "Mishneh Torah, Foundations of the Torah 1"', reqs.some(u => /api\/texts\/Mishneh Torah, Foundations of the Torah 1\?/.test(u)), reqs.slice(-3));
    await page.screenshot({ path: `${process.env.OUT || '/tmp'}/rb_${theme}_nav.png` });

    // search → Sabbath 5
    await page.fill('#rb-q', 'שבת ה'); await page.waitForTimeout(300);
    const res = await page.evaluate(() => [...document.querySelectorAll('#rb-q-res .rb-res-row')].map(r => r.textContent));
    ok(T + 'local search "שבת ה" offers הלכות שבת פרק ה first', /הלכות שבת פרק ה/.test(res[0] || ''), res);
    await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
    let s = await page.evaluate(() => ({ sub: document.getElementById('rambam-subtitle').textContent, chip: document.querySelector('.rb-chip-on')?.textContent.trim(), hil: document.getElementById('rb-hil').selectedOptions[0].textContent }));
    ok(T + 'opens Sabbath chapter 5 (subtitle, active chip, selects follow)', /ספר זמנים · הלכות שבת · פרק ה[׳']? \(5 מתוך 30\)/.test(s.sub) && s.chip === '5' && /הלכות שבת/.test(s.hil), s);
    ok(T + '6 halachot rendered, numbered; hostile <img onerror> stripped', (await halCount()) === 6 && await page.evaluate(() => !document.querySelector('#rambam-content img') && window.__xss === undefined));
    ok(T + 'text view has no Steinsaltz request yet', !reqs.some(u => /Steinsaltz/.test(u)));

    // Steinsaltz inline: exact placement
    await page.click('#rambam-view-buttons >> text=רמב"ם + שטיינזלץ'); await page.waitForTimeout(1200);
    const place = await page.evaluate(() => [...document.querySelectorAll('#rambam-content .rb-hal')].map(h => [...h.querySelectorAll('.rb-st-e')].map(e => e.textContent.replace(/\s+/g, ' ').trim())));
    ok(T + 'Steinsaltz sits under the right halacha: [א:1, ב:2, ג:0, ד:1, ה:0, ו:1]', JSON.stringify(place.map(a => a.length)) === '[1,2,0,1,0,1]' && /פירוש ב1/.test(place[1][0]) && /פירוש ב2/.test(place[1][1]) && /פירוש ד/.test(place[3][0]), place);
    ok(T + 'requested "Steinsaltz on Mishneh Torah, Sabbath 5:1-6" (range = the chapter\'s halacha count)', reqs.some(u => /Steinsaltz on Mishneh Torah, Sabbath 5:1-6/.test(u)));
    ok(T + 'note says 5 Steinsaltz entries, none approximate', /5 פירושי שטיינזלץ/.test(await txt('#rambam-content')) && !/משוער/.test(await txt('#rambam-content')));
    await page.screenshot({ path: `${process.env.OUT || '/tmp'}/rb_${theme}_steinsaltz.png` });
    await page.click('#rambam-view-buttons >> text=שטיינזלץ בלבד'); await page.waitForTimeout(400);
    const only = await page.evaluate(() => [...document.querySelectorAll('#rambam-content .rb-hal-h')].map(h => h.textContent));
    ok(T + 'Steinsaltz-only: headed by halacha letter, only halachot that have comments (א ב ד ו)', JSON.stringify(only.map(x => x.replace(/[׳']/g, ''))) === JSON.stringify(['הלכה א', 'הלכה ב', 'הלכה ד', 'הלכה ו']), only);

    // next chapter: no Steinsaltz for it
    await page.click('.rb-navrow >> nth=0 >> text=פרק 6'); await page.waitForTimeout(1200);
    ok(T + 'next chapter (6): Rambam shown, "no Steinsaltz" note in Steinsaltz view', /אין פירוש שטיינזלץ לפרק זה/.test(await txt('#rambam-content')) && /פרק ו/.test(await txt('#rambam-subtitle')));
    // read markers
    await page.click('#rambam-view-buttons >> text=רמב"ם'); await page.waitForTimeout(300);
    await page.click('#done-rambam button'); await page.waitForTimeout(200);
    s = await page.evaluate(() => ({ done: document.querySelector('#done-rambam button').textContent.trim(), chip: document.querySelector('.rb-chip[data-ch="6"]'), key: Object.keys(appState).filter(k => k.startsWith('done_rambam_rb_')) }));
    ok(T + 'mark as read works (✅, key done_rambam_rb_sabbath_6)', /נלמד/.test(s.done) && s.key.includes('done_rambam_rb_sabbath_6'), s);
    await page.evaluate(() => rbRenderNav());
    ok(T + 'chapter chip shows ✓ and progress line counts it', await page.evaluate(() => /✓/.test(document.querySelector('.rb-chip[data-ch="6"]').textContent) && /נלמדו 1 מתוך 30/.test(document.querySelector('.rb-progress').textContent)));
    await page.click('#rambam-books-bottom >> text=סמן כנלמד והמשך'); await page.waitForTimeout(1200);
    ok(T + '"mark read and continue" marks 6 and moves to 7', await page.evaluate(() => appState['done_rambam_rb_sabbath_6'] === true && _rbState.ch === 7 && /פרק ז/.test(document.getElementById('rambam-subtitle').textContent)));
    // flat Steinsaltz (chapter 7) → keyword placement, unmatched flagged
    await page.click('#rambam-view-buttons >> text=רמב"ם + שטיינזלץ'); await page.waitForTimeout(1200);
    const kw = await page.evaluate(() => ({ perHal: [...document.querySelectorAll('#rambam-content .rb-hal')].map(h => h.querySelectorAll('.rb-st-e').length), approx: document.querySelectorAll('.rb-approx').length, note: document.querySelector('.rb-note').textContent }));
    ok(T + 'flat Steinsaltz: placed by lemma under halacha ד, unmatched one flagged "(מיקום משוער)"', kw.perHal[3] === 1 && kw.approx === 1 && /לפי מילת הפתיחה/.test(kw.note), kw);

    // in-chapter find
    await page.click('#rambam-view-buttons >> text=רמב"ם'); await page.waitForTimeout(300);
    await page.fill('#rb-find', 'הכותב'); await page.waitForTimeout(300);
    ok(T + 'find in chapter highlights the word (nikud-insensitive)', await page.evaluate(() => document.querySelectorAll('mark.rb-hit').length >= 1 && document.querySelector('mark.rb-hit.rb-hit-on') !== null && /1 \/ \d+/.test(document.getElementById('rb-find-n').textContent)), await txt('#rb-find-n'));
    await page.fill('#rb-find', ''); await page.waitForTimeout(200);
    ok(T + 'clearing the find box removes the marks', await page.evaluate(() => document.querySelectorAll('mark.rb-hit').length === 0));

    // across sets
    await page.evaluate(() => rbOpen(RAMBAM_HIL.findIndex(h => h.en === 'Sabbath'), 30, 'text')); await page.waitForTimeout(900);
    await page.click('#rambam-books-bottom >> text=←'); await page.waitForTimeout(1000);
    s = await page.evaluate(() => ({ sub: document.getElementById('rambam-subtitle').textContent }));
    ok(T + 'next after the last chapter of שבת → עירובין פרק א', /הלכות עירובין · פרק א/.test(s.sub), s);
    await page.evaluate(() => rbOpen(RAMBAM_HIL.findIndex(h => h.en === "Second Tithes and Fourth Year's Fruit"), 2, 'text')); await page.waitForTimeout(900);
    await page.click('#done-rambam button'); await page.waitForTimeout(200);
    ok(T + 'a title with an apostrophe still works (slug key, onclick not broken)', await page.evaluate(() => appState['done_rambam_rb_second_tithes_and_fourth_year_s_fruit_2'] === true));
    // error state
    await page.evaluate(() => rbOpen(RAMBAM_HIL.findIndex(h => h.en === 'Fasts'), 4, 'text')); await page.waitForTimeout(1500);
    ok(T + 'HTTP 500 → Hebrew error with retry button (no crash)', await page.evaluate(() => /שגיאה בטעינה/.test(document.getElementById('rambam-content').textContent) && !!document.querySelector('#rambam-content .rb-btn')));

    // persistence + modes
    await page.evaluate(() => rbOpen(RAMBAM_HIL.findIndex(h => h.en === 'Sabbath'), 5, 'steinsaltz')); await page.waitForTimeout(1500);
    await page.reload(); await page.waitForTimeout(2200);
    await page.evaluate(() => showTab('rambam')); await page.waitForTimeout(2000);
    s = await page.evaluate(() => ({ mode: _rbMode, sub: document.getElementById('rambam-subtitle').textContent, st: document.querySelectorAll('.rb-st').length }));
    ok(T + 'after reload: books mode, same chapter and view restored', s.mode === 'books' && /הלכות שבת · פרק ה/.test(s.sub) && s.st === 4, s);   // 5 comments in 4 blocks (halachot א ב ד ו)
    await page.click('#rb-mode-daily'); await page.waitForTimeout(1500);
    ok(T + 'back to the daily Rambam: daily text, books UI hidden', await page.evaluate(() => /יומי א/.test(document.getElementById('rambam-content').textContent) && document.getElementById('rambam-books-ui').style.display === 'none' && document.getElementById('rambam-title').textContent === 'רמב"ם יומי'));
    ok(T + 'no page errors', errors.length === 0, errors);
  });

  // race: the daily load is still in flight when the user jumps to a book (via global search)
  await run('light', 380, async ({ page, errors, setCalDelay }) => {
    await boot(page);
    setCalDelay(1500);
    await page.evaluate(() => showTab('rambam')); await page.waitForTimeout(300);
    await page.click('#search-btn'); await page.fill('#sr-input', 'הלכות שבת פרק ג'); await page.waitForTimeout(300);
    const top = await page.evaluate(() => document.querySelector('#sr-results .sr-row').textContent);
    ok('global search "הלכות שבת פרק ג": top result is הלכות שבת פרק ג (רמב״ם)', /הלכות שבת פרק ג/.test(top) && /רמב"ם/.test(top), top);
    await page.keyboard.press('Enter'); await page.waitForTimeout(3500);
    const s = await page.evaluate(() => ({ mode: _rbMode, sub: document.getElementById('rambam-subtitle').textContent, content: document.getElementById('rambam-content').textContent.slice(0, 40) }));
    ok('navigated to Sabbath 3 in books mode; the late daily response did not overwrite it', s.mode === 'books' && /הלכות שבת · פרק ג/.test(s.sub) && /Sabbath פרק 3 הלכה א/.test(s.content), s);
    await page.click('#search-btn'); await page.fill('#sr-input', 'רמב"ם שבת פרק ה שטיינזלץ'); await page.waitForTimeout(300);
    await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
    const s2 = await page.evaluate(() => ({ view: _rbState.view, ch: _rbState.ch, st: document.querySelectorAll('.rb-st').length }));
    ok('"רמב״ם שבת פרק ה שטיינזלץ" → chapter 5 with Steinsaltz', s2.view === 'steinsaltz' && s2.ch === 5 && s2.st === 4, s2);
    // bookmark round trip across modes
    await page.evaluate(() => { const r = document.querySelector('#rambam-content .rb-hal:nth-child(4)').getBoundingClientRect(); bookmarkAddAt(r.left + 40, r.top + 10, { nearest: true }); }); await page.waitForTimeout(400);
    const bm = await page.evaluate(() => (appState.bookmarks || {}).rambam);
    ok('bookmark in books mode stores set + chapter + view', bm && bm.state.mode === 'books' && bm.state.hil === 'sabbath' && bm.state.ch === 5 && bm.state.view === 'steinsaltz', bm && bm.state);
    await page.click('#rb-mode-daily'); await page.waitForTimeout(1800);
    await page.evaluate(() => bookmarkGo('rambam')); await page.waitForTimeout(4500);
    const s3 = await page.evaluate(() => ({ mode: _rbMode, sub: document.getElementById('rambam-subtitle').textContent, st: document.querySelectorAll('.rb-st').length }));
    ok('going to the bookmark from daily mode returns to Sabbath 5 + Steinsaltz', s3.mode === 'books' && /הלכות שבת · פרק ה/.test(s3.sub) && s3.st === 4, s3);
    ok('no page errors (race + bookmark)', errors.length === 0, errors);
  });

  console.log(`${n - f}/${n} passed`); await browser.close(); process.exit(f ? 1 : 0);
})();
