// ── Runner ────────────────────────────────────────────────────────────
let _activeCategory = null;

async function runAll() {
  _activeCategory = null;
  await _run(TEST_REGISTRY);
}

async function runCategory(cat) {
  _activeCategory = cat;
  const filtered = TEST_REGISTRY.filter(t => t.tags.includes(cat));
  await _run(filtered);
}

async function _run(tests) {
  const startTime = Date.now();
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';

  // Reset counters
  let pass = 0, fail = 0, skip = 0;
  const total = tests.length;
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-pass').textContent = 0;
  document.getElementById('s-fail').textContent = 0;
  document.getElementById('s-skip').textContent = 0;
  document.getElementById('s-pending').textContent = total;
  document.getElementById('s-time').textContent = '…';
  document.getElementById('progress-bar').style.width = '0%';

  // Group by suite
  const suites = {};
  for (const t of tests) {
    const s = t.suite || 'כללי';
    if (!suites[s]) suites[s] = [];
    suites[s].push(t);
  }

  let done = 0;
  for (const [suiteName, suiteTests] of Object.entries(suites)) {
    const suiteEl = document.createElement('div');
    suiteEl.className = 'suite';
    suiteEl.innerHTML = `<h2>${suiteName}</h2>`;
    resultsEl.appendChild(suiteEl);

    for (const t of suiteTests) {
      const testEl = document.createElement('div');
      testEl.className = 'test pending';
      const tagHtml = t.tags.map(tag => {
        const cls = tag === 'api' ? 'api-tag' : tag === 'logic' ? 'logic-tag' : 'ui-tag';
        return `<span class="tag ${cls}">${tag}</span>`;
      }).join('');
      testEl.innerHTML = `<span class="status">⏳</span><div class="test-name">${tagHtml}${t.name}<div class="test-detail"></div></div>`;
      suiteEl.appendChild(testEl);

      try {
        await Promise.resolve(t.fn());
        t.status = 'pass'; pass++;
        testEl.className = 'test pass';
        testEl.querySelector('.status').textContent = '✅';
      } catch(e) {
        if (e.message === 'SKIP') {
          t.status = 'skip'; skip++;
          testEl.className = 'test skip';
          testEl.querySelector('.status').textContent = '⏭';
          testEl.querySelector('.test-detail').textContent = 'דולג';
        } else {
          t.status = 'fail'; fail++;
          testEl.className = 'test fail';
          testEl.querySelector('.status').textContent = '❌';
          testEl.querySelector('.test-detail').textContent = e.message;
          console.error(`[FAIL] ${t.suite} > ${t.name}:`, e.message);
        }
      }

      done++;
      document.getElementById('s-pass').textContent = pass;
      document.getElementById('s-fail').textContent = fail;
      document.getElementById('s-skip').textContent = skip;
      document.getElementById('s-pending').textContent = total - done;
      document.getElementById('progress-bar').style.width = `${(done/total)*100}%`;

      // Yield to UI
      await new Promise(r => setTimeout(r, 0));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  document.getElementById('s-time').textContent = elapsed;
  console.log(`[Runner] Done: ${pass} pass, ${fail} fail, ${skip} skip in ${elapsed}s`);
}

// Auto-run on load
window.addEventListener('load', () => {
  console.log('[Runner] Registered tests:', TEST_REGISTRY.length);
  document.getElementById('s-total').textContent = TEST_REGISTRY.length;
  document.getElementById('s-pending').textContent = TEST_REGISTRY.length;
});
