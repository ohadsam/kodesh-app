// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

// Show any error as a visible popup (for debugging)
function _showError(msg, src) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.92);' +
    'z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl';
  d.innerHTML = '<div style="background:#2a1f0a;border:2px solid #e07060;border-radius:12px;' +
    'padding:20px;max-width:360px;width:100%;font-family:monospace;font-size:12px;' +
    'color:#e8d5a3;word-break:break-word">' +
    '<div style="color:#e07060;font-size:14px;font-weight:700;margin-bottom:10px">❌ שגיאה</div>' +
    '<div style="color:#ccc;margin-bottom:8px">' + String(msg).replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
    (src ? '<div style="color:#888;font-size:10px">' + String(src).replace(/</g,'&lt;') + '</div>' : '') +
    '<button onclick="localStorage.clear();sessionStorage.clear();location.reload(true)" ' +
    'style="margin-top:14px;width:100%;background:#c9a54a;color:#000;border:none;' +
    'border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">🔄 איפוס וטעינה מחדש</button>' +
    '<button onclick="this.parentNode.parentNode.remove()" ' +
    'style="margin-top:8px;width:100%;background:transparent;color:#888;border:1px solid #444;' +
    'border-radius:8px;padding:8px;font-size:12px;cursor:pointer">✕ סגור</button>' +
    '</div>';
  document.body.appendChild(d);
}

// FAILSAFE: remove splash after 6s no matter what
var _splashTimer = setTimeout(function() {
  var splash = document.getElementById('splash');
  if (splash && splash.parentNode) {
    splash.classList.add('hide');
    setTimeout(function() { if (splash && splash.parentNode) splash.remove(); }, 600);
  }
}, 6000);

// Catch ALL uncaught JS errors and show them
window.addEventListener('error', function(e) {
  console.error('🔴 [uncaught error]', e.message, e.filename, e.lineno);
  _showError(e.message + ' (line ' + e.lineno + ')', e.filename);
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('🔴 [unhandled rejection]', e.reason);
  var msg = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);
  _showError('Promise rejected: ' + msg);
});

async function init() {
  console.log('🚀 [init] START v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?'));
  try {
    console.log('[init] 1. fontSize');
    if (appState.fontSize) {
      document.documentElement.style.setProperty('--font-size', appState.fontSize+'px');
    }

    console.log('[init] 2. applyTabVisibility');
    applyTabVisibility();

    console.log('[init] 3. updateAllDates');
    updateAllDates();

    console.log('[init] 4. showTab calendar');
    showTab('calendar');

    console.log('[init] 5. initTabScrollSync');
    if (typeof initTabScrollSync === 'function') initTabScrollSync();

    console.log('[init] 6. scheduling splash removal');
    setTimeout(function() {
      clearTimeout(_splashTimer); // cancel failsafe since we're removing it ourselves
      var splash = document.getElementById('splash');
      if (splash) splash.classList.add('hide');
      setTimeout(function() {
        var s = document.getElementById('splash');
        if (s) s.remove();
      }, 600);
      setTimeout(function() {
        try {
          var hadReminders = typeof checkRemindersOnOpen === 'function'
            ? checkRemindersOnOpen() : false;
          if (!hadReminders && typeof checkWhatsNew === 'function') checkWhatsNew();
        } catch(e) { console.warn('[init] reminders/whats-new error:', e.message); }
      }, 500);
    }, 1500);

    console.log('[init] 7. registering SW');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(function(reg) {
          console.log('[SW] registered ok, scope:', reg.scope);
          reg.update().catch(function(){});
        })
        .catch(function(e) { console.warn('[SW] register failed:', e.message); });
    }

    console.log('✅ [init] DONE');
  } catch(e) {
    console.error('❌ [init] FATAL ERROR:', e.message, e.stack);
    _showError(e.message + '\n\n' + (e.stack || ''), 'init()');
  }
}

console.log('📜 Script loaded, calling init()...');
init();
