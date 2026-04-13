// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

// FAILSAFE: Always remove splash after 6 seconds, no matter what
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash && splash.parentNode) {
    splash.classList.add('hide');
    setTimeout(() => { if (splash && splash.parentNode) splash.remove(); }, 600);
  }
}, 6000);

async function init() {
  console.log('🚀 [init] START');
  try {
    if (appState.fontSize) {
      document.documentElement.style.setProperty('--font-size', appState.fontSize+'px');
    }
    applyTabVisibility();
    console.log('[init] calling updateAllDates...');
    updateAllDates();
    console.log('[init] calling showTab calendar...');
    showTab('calendar');
    console.log('[init] showTab done');

    // Initialize tab scroll sync
    if (typeof initTabScrollSync === 'function') initTabScrollSync();

    // Remove splash
    setTimeout(() => {
      const splash = document.getElementById('splash');
      if (splash) splash.classList.add('hide');
      setTimeout(() => { const s = document.getElementById('splash'); if(s) s.remove(); }, 600);
      setTimeout(() => {
        const hadReminders = typeof checkRemindersOnOpen === 'function' ? checkRemindersOnOpen() : false;
        if (!hadReminders && typeof checkWhatsNew === 'function') checkWhatsNew();
      }, 500);
    }, 1500);

    // Register service worker with updateViaCache:'none' so browser always
    // fetches fresh sw.js from network (bypasses HTTP cache for SW file)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(reg => {
          console.log('[SW] registered, state:', reg.active?.state);
          // Force check for updates immediately
          reg.update().catch(() => {});
        })
        .catch(e => console.warn('[SW] register failed:', e.message));

      // Listen for SW postMessage — new SW activated, reload to get fresh files
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'SW_UPDATED') {
          console.log('[SW] new version active:', e.data.version, '— reloading');
          // Small delay so current render completes
          setTimeout(() => location.reload(), 300);
        }
      });
    }

    console.log('✅ [init] DONE');
  } catch(e) {
    console.error('❌ [init] FATAL ERROR:', e);
    const splash = document.getElementById('splash');
    if (splash) {
      splash.innerHTML = `
        <div style="color:#e07060;padding:30px 20px;text-align:center;font-family:'Heebo',sans-serif">
          <div style="font-size:40px;margin-bottom:16px">⚠️</div>
          <div style="font-size:15px;font-weight:700;margin-bottom:8px">שגיאה בהפעלה</div>
          <div style="font-size:12px;color:#888;margin-bottom:20px">${e.message}</div>
          <button onclick="location.reload()"
            style="background:#c9a54a;color:#000;border:none;border-radius:10px;
                   padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">
            נסה שוב
          </button>
        </div>`;
    }
  }
}

window.addEventListener('error', e => {
  console.error('🔴 [uncaught error]', e.message, 'at', e.filename, 'line', e.lineno);
});
window.addEventListener('unhandledrejection', e => {
  console.error('🔴 [unhandled promise rejection]', e.reason);
});

console.log('📜 Script loaded, calling init()...');
init();
