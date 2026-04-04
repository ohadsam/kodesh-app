// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
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

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('sw.js');
        console.log('[init] service worker registered');
      } catch(e) {
        console.warn('[init] service worker failed:', e.message);
      }
    }

    // Hide splash
    setTimeout(() => {
      const splash = document.getElementById('splash');
      if (splash) splash.classList.add('hide');
      setTimeout(() => { const s = document.getElementById('splash'); if(s) s.remove(); }, 600);
    }, 1500);

    console.log('✅ [init] DONE');
  } catch(e) {
    console.error('❌ [init] FATAL ERROR:', e);
    // Show error on page
    const splash = document.getElementById('splash');
    if (splash) splash.innerHTML = `<div style="color:red;padding:20px;font-size:14px">שגיאה בהפעלה:<br>${e.message}</div>`;
  }
}

// Log any uncaught errors
window.addEventListener('error', e => {
  console.error('🔴 [uncaught error]', e.message, 'at', e.filename, 'line', e.lineno);
});
window.addEventListener('unhandledrejection', e => {
  console.error('🔴 [unhandled promise rejection]', e.reason);
});

console.log('📜 Script loaded, calling init()...');
init();
