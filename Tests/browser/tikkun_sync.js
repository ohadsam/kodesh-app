// REAL <audio> (no stub) in headless Chromium: does the chosen speed survive a clip change, and does the follow-along
// scroll stay on the reading point at 0.5× / 1× / 2×?   (node Tests/browser/tikkun_sync.js; server on :8791)
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const V = process.env.V || '5.146';
let n = 0, f = 0;
const ok = (d, c, x) => { n++; if (c) console.log('OK:', d); else { f++; console.log('FAIL:', d, x !== undefined ? JSON.stringify(x) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function wav(sec) {                                   // 8 kHz mono 16-bit sine
  const sr = 8000, N = sr * sec, b = Buffer.alloc(44 + N * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + N * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++) b.writeInt16LE(Math.round(3000 * Math.sin(2 * Math.PI * 330 * i / sr)), 44 + i * 2);
  return b;
}
const V0 = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
const V1 = Array(14).fill(V0).join(' ');     // a verse of several lines, so progress inside a verse moves the text a lot

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 380, height: 800 }, serviceWorkers: 'block' });
  await ctx.addInitScript(v => { localStorage.setItem('kodesh_app_v1', JSON.stringify({ _lastSeenVersion: v, cacheSettings: { enabled: false } })); }, V);
  const clip = wav(12);        // ONE file for the aliya, like Sefaria's PocketTorah; the 4 verses are its 3-second slices
  await ctx.route(/media\.example/, r => r.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: clip }));
  await ctx.route(/sefaria|hebcal/, r => {
    const u = decodeURIComponent(r.request().url()); let body = '{"items":[],"calendar_items":[]}', m;
    if ((m = u.match(/api\/texts\/(\w+) (\d+):(\d+)-(\d+):(\d+)/)) && m[2] === m[4]) body = JSON.stringify({ he: Array.from({ length: +m[5] - +m[3] + 1 }, () => V1), sections: [+m[2], +m[3]] });
    else if (/api\/related\/Genesis 17:24-17:27/.test(u)) body = JSON.stringify({ links: [], media: [24, 25, 26, 27].map((v, j) => ({ media_url: 'https://media.example/Lech-Lecha-7.wav', source: 'PocketTorah', start_time: 3 * j, end_time: 3 * j + 3, anchorRef: `Genesis 17:${v}` })) });
    else if (/api\/(texts\/(Rashi|Onkelos)|related)/.test(u)) body = '{"he":[],"media":[]}';
    r.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8791/index.html'); await page.waitForTimeout(2200);
  await page.evaluate(() => showTab('parasha')); await page.waitForTimeout(1000);
  await page.evaluate(() => loadSpecificParasha('Genesis 12:1-17:27')); await page.waitForTimeout(1200);
  await page.evaluate(() => { [...document.querySelectorAll('#aliya-tabs .aliya-tab')].find(x => x.textContent.trim() === 'מפטיר').click(); }); await page.waitForTimeout(1200);
  await page.click('#view-tikkun-btn'); await page.waitForTimeout(400);
  await page.addStyleTag({ content: '.tk-v { margin-bottom: 700px !important; }' });
  await page.click('#tk-audio-btn'); await page.waitForTimeout(2500);
  const real = await page.evaluate(() => ({ state: TK_AUDIO.state, dur: TK_AUDIO.el.duration, t: TK_AUDIO.el.currentTime, durs: TK_AUDIO.durs.map(x => +x.toFixed(2)) }));
  ok('real audio plays (the one file ≈ 12 s, time advancing, the 4 verse durations come from the slices)', real.state === 'playing' && Math.abs(real.dur - 12) < 0.1 && real.t > 0.5 && real.durs.length === 4 && real.durs.every(d => Math.abs(d - 3) < 0.1), real);

  // sample: media position, reading point (px from the target line) and whether the speed is what was chosen
  const sample = () => page.evaluate(() => {
    const a = TK_AUDIO, v = document.querySelector(`.tk-v[data-i="${_aliyaVerseNums.indexOf(a.items[a.i].key)}"]`), r = v.getBoundingClientRect();
    const it = a.items[a.i], tv = a.el.currentTime - it.start, p = Math.min(1, Math.max(0, tv / a.durs[a.i]));
    return { i: a.i, t: tv, rate: a.el.playbackRate, want: a.rate, err: r.top + p * r.height - innerHeight * 0.38, y: scrollY };
  });
  const speeds = {};
  for (const rate of ['0.5', '1', '2']) {
    await page.selectOption('#tk-rate', rate);
    await page.evaluate(() => tikkunSeekCommit(0)); await page.waitForTimeout(700);
    const rows = []; const t0 = Date.now();
    // two clips' worth at this speed, crossing a clip boundary
    const span = Math.min(8000, 3000 / parseFloat(rate) * 2 + 700);
    while (Date.now() - t0 < span) { rows.push(await sample()); await sleep(80); }
    const crossed = rows.some(r => r.i === 1);
    const speedOk = rows.every(r => Math.abs(r.rate - parseFloat(rate)) < 0.01);
    ok(`${rate}×: the player really runs at ${rate}× in every sample, also after the clip changed (${crossed ? 'crossed into clip 2' : 'did not cross'})`, speedOk && (rate === '0.5' || crossed), { bad: rows.filter(r => Math.abs(r.rate - parseFloat(rate)) >= 0.01).slice(0, 2), crossed });
    // steady state = the last 60% of each clip window (the first part of a verse is the scroll jumping to it)
    const steady = rows.filter(r => r.t > 1.2 && r.t < 2.8);
    const worst = Math.max(...steady.map(r => Math.abs(r.err)), 0);
    ok(`${rate}×: text stays on the reading point (|offset| ≤ 40 px over ${steady.length} samples, worst ${worst.toFixed(0)} px)`, steady.length >= 3 && worst <= 40, { worst, n: steady.length });
    // scroll speed while one verse is read (real px/s) – measured over the steady part of clip 1
    const seg = rows.filter(r => r.i === 0 && r.t > 1.0 && r.t < 2.8);
    if (seg.length >= 4) {
      const dy = seg[seg.length - 1].y - seg[0].y, dtMedia = seg[seg.length - 1].t - seg[0].t, pxPerMediaSec = dy / dtMedia;
      speeds[rate] = pxPerMediaSec * parseFloat(rate);          // px per REAL second
    }
  }
  ok('scroll speed follows the audio speed: px/s at 2× ≈ 4× that at 0.5× and ≈ 2× that at 1× (±35%)',
     speeds['2'] / speeds['0.5'] > 4 * 0.65 && speeds['2'] / speeds['0.5'] < 4 * 1.35 && speeds['2'] / speeds['1'] > 2 * 0.65 && speeds['2'] / speeds['1'] < 2 * 1.35, speeds);

  // changing the speed WHILE a verse is being read
  const mid = async ms => { const rs = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { rs.push(await sample()); await sleep(80); } return rs; };
  const sp = rs => (rs[rs.length - 1].y - rs[0].y) / ((rs[rs.length - 1].t - rs[0].t) / rs[0].rate);   // px per real second
  const err = rs => Math.max(...rs.slice(3).map(r => Math.abs(r.err)));
  // (every window stays inside ONE clip: a clip boundary is a jump to the next verse, not part of this measurement)
  await page.selectOption('#tk-rate', '1');
  await page.evaluate(() => tikkunSeekCommit(0)); await page.waitForTimeout(700);
  const slow = await mid(800);
  await page.selectOption('#tk-rate', '2');                                   // ← mid-verse
  const after = await mid(550);
  ok(`speed changed mid-verse (1× → 2×): the player switches at once and the scroll follows (${sp(slow).toFixed(0)} → ${sp(after).toFixed(0)} px/s)`,
     after.every(r => r.rate === 2 && r.i === 0) && sp(after) > sp(slow) * 1.4, { slow: sp(slow), after: sp(after), i: after.map(r => r.i) });
  ok(`…and stays on the reading point right after the change (worst ${err(after).toFixed(0)} px)`, err(after) <= 40, err(after));
  await page.evaluate(() => tikkunSeekCommit(0)); await page.waitForTimeout(700);
  const fast2 = await mid(400);
  await page.selectOption('#tk-rate', '0.5');
  const down = await mid(1200);
  ok(`slowed down mid-verse (2× → 0.5×): scroll slows with it (${sp(fast2).toFixed(0)} → ${sp(down).toFixed(0)} px/s), text on the reading point (worst ${err(down).toFixed(0)} px)`, down.every(r => r.i === 0) && sp(down) < sp(fast2) * 0.6 && err(down) <= 40, { fast: sp(fast2), down: sp(down), e: err(down) });

  // the fixed-speed generic auto-scroll must not run beside the follow-along (it would drift off when the speed changes)
  await page.evaluate(() => autoScrollStart());
  ok('the generic auto-scroll refuses to start while the reading owns the scroll', await page.evaluate(() => _asState === 'idle'));
  await page.evaluate(() => tikkunAudioToggleSync());
  await page.evaluate(() => autoScrollStart());
  ok('with the follow-along switched off it can be used', await page.evaluate(() => _asState === 'playing'));
  await page.evaluate(() => autoScrollStop());
  ok('no page errors', errors.length === 0, errors);
  console.log(`${n - f}/${n} passed`); await browser.close(); process.exit(f ? 1 : 0);
})();
