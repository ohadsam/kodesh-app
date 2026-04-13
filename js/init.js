// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

function _showError(msg, src) {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.92);' +
    'z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl';
  d.innerHTML = '<div style="background:#2a1f0a;border:2px solid #e07060;border-radius:12px;' +
    'padding:20px;max-width:360px;width:100%;font-family:monospace;font-size:12px;color:#e8d5a3;word-break:break-word">' +
    '<div style="color:#e07060;font-size:14px;font-weight:700;margin-bottom:10px">❌ שגיאה</div>' +
    '<div style="color:#ccc;margin-bottom:8px">' + String(msg).replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
    (src ? '<div style="color:#888;font-size:10px">' + String(src).replace(/</g,'&lt;') + '</div>' : '') +
    '<button onclick="localStorage.clear();sessionStorage.clear();location.reload(true)" ' +
    'style="margin-top:14px;width:100%;background:#c9a54a;color:#000;border:none;' +
    'border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">🔄 איפוס וטעינה מחדש</button>' +
    '</div>';
  document.body.appendChild(d);
}

// Utility: forcibly remove splash no matter what
function _removeSplash() {
  var splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.display = 'none';     // immediate hide
  splash.style.opacity = '0';
  splash.style.pointerEvents = 'none';
  splash.classList.add('hide');
  // Also remove from DOM after transition
  setTimeout(function() {
    var s = document.getElementById('splash');
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }, 100);
}

// FAILSAFE: force-remove splash after 5s regardless
var _splashFailsafe = setTimeout(_removeSplash, 5000);

window.addEventListener('error', function(e) {
  console.error('🔴 [uncaught error]', e.message, e.filename, e.lineno);
  _showError(e.message + ' (line ' + e.lineno + ')', e.filename);
  _removeSplash();
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('🔴 [unhandled rejection]', e.reason);
  var msg = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);
  _showError('Promise rejected: ' + msg);
  _removeSplash();
});

async function init() {
  console.log('🚀 [init] START');
  try {
    if (appState.fontSize) {
      document.documentElement.style.setProperty('--font-size', appState.fontSize + 'px');
    }
    applyTabVisibility();
    updateAllDates();
    showTab('calendar');
    if (typeof initTabScrollSync === 'function') initTabScrollSync();

    // Remove splash after 1.5s
    setTimeout(function() {
      clearTimeout(_splashFailsafe);
      _removeSplash();
      setTimeout(function() {
        try {
          var hadReminders = typeof checkRemindersOnOpen === 'function'
            ? checkRemindersOnOpen() : false;
          if (!hadReminders && typeof checkWhatsNew === 'function') checkWhatsNew();
        } catch(e2) { console.warn('[init] popup error:', e2.message); }
      }, 500);
    }, 1500);

    // Register SW (non-blocking)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(function(reg) {
          console.log('[SW] registered');
          reg.update().catch(function(){});
        })
        .catch(function(e) { console.warn('[SW] register failed:', e.message); });
    }

    console.log('✅ [init] DONE');
  } catch(e) {
    console.error('❌ [init] FATAL:', e.message, e.stack);
    _showError(e.message + '\n\n' + (e.stack || ''), 'init()');
    _removeSplash();
  }
}

console.log('📜 init.js loaded');
init();
