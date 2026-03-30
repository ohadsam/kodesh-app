// ═══════════════════════════════════════════
// NETWORK LOG TAB
// Captures all fetch() calls with response + timestamp
// Keeps only last 10 minutes of requests
// ═══════════════════════════════════════════

const _netLog = [];          // { ts, url, method, status, ms, size, resp }
const NET_MAX_AGE = 10 * 60 * 1000;  // 10 minutes

// Patch global fetch
(function() {
  const _origFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url    = (typeof input === 'string') ? input : (input?.url || String(input));
    const method = (init?.method || 'GET').toUpperCase();
    const t0     = Date.now();
    let status = 0, size = 0, snippet = '';
    try {
      const resp = await _origFetch(input, init);
      status = resp.status;
      // Clone to read body without consuming the original
      try {
        const clone = resp.clone();
        const text  = await clone.text();
        size   = text.length;
        snippet = text.slice(0, 400);
      } catch(_) {}
      _pushNetLog({ ts: t0, url, method, status, ms: Date.now() - t0, size, snippet });
      return resp;
    } catch(err) {
      _pushNetLog({ ts: t0, url, method, status: 0, ms: Date.now() - t0, size: 0, snippet: err.message });
      throw err;
    }
  };
})();

function _pushNetLog(entry) {
  _netLog.push(entry);
  _pruneNetLog();
  if (document.getElementById('page-network')?.classList.contains('active')) {
    renderNetworkLog();
  }
}

function _pruneNetLog() {
  const cutoff = Date.now() - NET_MAX_AGE;
  while (_netLog.length && _netLog[0].ts < cutoff) _netLog.shift();
}

function clearNetworkLog() {
  _netLog.length = 0;
  renderNetworkLog();
}

function copyNetworkLog() {
  _pruneNetLog();
  const lines = _netLog.map(e => {
    const t = new Date(e.ts).toLocaleTimeString('he-IL');
    return `[${t}] ${e.method} ${e.status} ${e.ms}ms ${e.url}\n${e.snippet}`;
  }).join('\n---\n');
  navigator.clipboard?.writeText(lines).then(() => {
    const btn = document.querySelector('[onclick="copyNetworkLog()"]');
    if (btn) { btn.textContent = '✅ הועתק'; setTimeout(() => btn.textContent = '📋 העתק', 2000); }
  });
}

function renderNetworkLog() {
  const el = document.getElementById('network-container');
  const stats = document.getElementById('network-stats');
  if (!el) return;
  _pruneNetLog();

  if (stats) {
    const ok  = _netLog.filter(e => e.status >= 200 && e.status < 300).length;
    const err = _netLog.filter(e => !e.status || e.status >= 400).length;
    stats.textContent = `סה"כ: ${_netLog.length} | הצלחות: ${ok} | שגיאות: ${err} | (אחרון 10 דקות)`;
  }

  if (!_netLog.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">אין קריאות רשת</div>';
    return;
  }

  el.innerHTML = [..._netLog].reverse().map(e => {
    const t    = new Date(e.ts).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const ok   = e.status >= 200 && e.status < 300;
    const col  = !e.status ? '#e05555' : ok ? '#7ab87a' : '#c9913a';
    const bg   = !e.status ? 'rgba(224,85,85,.07)' : ok ? 'transparent' : 'rgba(201,145,58,.07)';
    const kb   = e.size > 0 ? (e.size > 1024 ? (e.size/1024).toFixed(1)+'KB' : e.size+'B') : '';
    // Short URL for display
    const shortUrl = e.url.replace('https://www.sefaria.org/api/texts/', '📖 ')
                          .replace('https://www.hebcal.com/', '📅 ')
                          .replace(/\?.*/, '…');
    return `<div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.04);background:${bg}">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="color:var(--muted);font-size:10px;font-family:monospace">${t}</span>
        <span style="color:${col};font-size:10px;font-weight:700;font-family:monospace">${e.status||'ERR'}</span>
        <span style="color:var(--muted);font-size:10px;font-family:monospace">${e.ms}ms ${kb}</span>
        <span style="color:var(--muted);font-size:9px;font-family:monospace">${e.method}</span>
      </div>
      <div style="color:#c8b890;font-size:11px;font-family:monospace;word-break:break-all">${shortUrl}</div>
      ${e.snippet ? `<details style="margin-top:4px">
        <summary style="color:var(--muted);font-size:10px;cursor:pointer">תגובה</summary>
        <pre style="color:#aaa;font-size:10px;overflow-x:auto;white-space:pre-wrap;margin:4px 0;max-height:120px;overflow-y:auto">${e.snippet.replace(/</g,'&lt;')}</pre>
      </details>` : ''}
    </div>`;
  }).join('');
}
