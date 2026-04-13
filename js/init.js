// ═══════════════════════════════════════════
// INIT - DIAGNOSTIC VERSION
// ═══════════════════════════════════════════

// Write status directly to splash text so we see exactly where it stops
function _status(msg) {
  console.log('[init]', msg);
  var el = document.getElementById('splash-status');
  if (el) el.textContent = msg;
}

function _removeSplash() {
  var splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.cssText = 'display:none!important';
  if (splash.parentNode) splash.parentNode.removeChild(splash);
}

// FAILSAFE after 8s
setTimeout(_removeSplash, 8000);

window.addEventListener('error', function(e) {
  _status('❌ ' + e.message + ' (line ' + e.lineno + ')');
});
window.addEventListener('unhandledrejection', function(e) {
  var msg = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);
  _status('❌ Promise: ' + msg);
});

async function init() {
  _status('מתחיל...');
  try {
    _status('fontSize...');
    if (appState && appState.fontSize) {
      document.documentElement.style.setProperty('--font-size', appState.fontSize + 'px');
    }

    _status('applyTabVisibility...');
    if (typeof applyTabVisibility === 'function') applyTabVisibility();

    _status('updateAllDates...');
    if (typeof updateAllDates === 'function') updateAllDates();

    _status('showTab...');
    if (typeof showTab === 'function') showTab('calendar');

    _status('initTabScrollSync...');
    if (typeof initTabScrollSync === 'function') initTabScrollSync();

    _status('✅ הצלחה! מסיר splash...');
    setTimeout(_removeSplash, 800);

    // Show reminders/whats-new after splash removed
    setTimeout(function() {
      try {
        var hadReminders = typeof checkRemindersOnOpen === 'function'
          ? checkRemindersOnOpen() : false;
        if (!hadReminders && typeof checkWhatsNew === 'function') checkWhatsNew();
      } catch(e2) { console.warn('[init] popup error:', e2.message); }
    }, 1500);

    // Register SW non-blocking
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(function(reg) { reg.update().catch(function(){}); })
        .catch(function(e) { console.warn('[SW]', e.message); });
    }

    console.log('✅ [init] DONE');
  } catch(e) {
    _status('❌ שגיאה: ' + e.message);
    console.error('[init] FATAL:', e.message, e.stack);
    setTimeout(_removeSplash, 5000);
  }
}

init();
