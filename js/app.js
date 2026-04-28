// ═══════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════
function showTab(name) {
  console.log(`[showTab] switching to "${name}"`);
  // Stop compass when leaving qibla tab (save battery)
  if (currentTab === 'qibla' && name !== 'qibla') {
    stopCompassListener();
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-'+name);
  const tab  = document.getElementById('t-'+name);
  const bn   = document.getElementById('bn-'+name);
  if (!page) { console.error(`[showTab] page element "page-${name}" NOT FOUND`); return; }
  page.classList.add('active');
  if (tab) tab.classList.add('active');
  if (bn)  bn.classList.add('active');
  currentTab = name;

  // Scroll active tab into view in both nav bars
  if (tab) tab.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  if (bn)  bn.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });

  // Scroll to top on every tab switch
  window.scrollTo({ top: 0, behavior: 'instant' });
  page.scrollTop = 0;

  if (name === 'logs')    { renderLogs(); return; }
  if (name === 'network') { renderNetworkLog(); return; }
  if (name === 'qibla') { if (!loaded[name]) { loaded[name]=true; initQibla(); } resumeQibla(); return; }
  // Siddur always re-inits on tab switch to reset loading state
  if (name === 'siddur') { siddurLoading = false; initSiddur(); return; }
  if (!loaded[name]) {
    console.log(`[showTab] "${name}" not yet loaded, calling loadTab`);
    loadTab(name);
  } else {
    console.log(`[showTab] "${name}" already loaded`);
  }
}

function loadTab(name) {
  console.log(`[loadTab] loading "${name}"`);
  loaded[name] = true;
  if (name === 'calendar')  loadCalendar();
  if (name === 'siddur')    initSiddur();
  if (name === 'halacha')   loadHalacha();
  if (name === 'tehilim')   initTehilim();
  if (name === 'parasha')   loadParasha();
  if (name === 'lashon')    loadLashon();
  if (name === 'igeret')    loadIgeret();
  if (name === 'tefilot')   initTefilot();
  if (name === 'brachot')   loadBrachot();
  if (name === 'daf')       loadDafYomi();
  if (name === 'mishna')    loadMishnaYomi();
  if (name === '929')       loadTanach929();
  if (name === 'rambam')    loadRambamYomi();
  if (name === 'emuna')     loadEmuna();
  if (name === 'logs')      renderLogs();
  if (name === 'qibla')     initQibla();
}

// ═══════════════════════════════════════════
// DATE NAV
// ═══════════════════════════════════════════
function updateTodayButtons() {
  const isToday = currentOffset === 0;
  ['cal','hal','lash'].forEach(id => {
    const btn = document.getElementById(`today-btn-${id}`);
    if (btn) btn.classList.toggle('hidden', isToday);
  });
  // legacy wrapper
  const wrapper = document.getElementById('today-btn-wrapper');
  if (wrapper) wrapper.style.display = 'none';
}

function changeDay(delta) {
  currentOffset += delta;
  loaded = {};
  updateAllDates();
  loadTab(currentTab);
  updateTodayButtons();
}

function goToToday() {
  currentOffset = 0;
  loaded = {};
  updateAllDates();
  loadTab(currentTab);
  updateTodayButtons();
}

function updateAllDates() {
  console.log('[updateAllDates] currentOffset=', currentOffset);
  const d = getTargetDate();
  const display = formatDisplayDate(d);
  console.log('[updateAllDates] display date:', display);
  document.getElementById('cal-greg').textContent = display;
  document.getElementById('hal-date').textContent = display;
  document.getElementById('lash-date').textContent = display;
  document.getElementById('topbar-greg').textContent = currentOffset === 0 ? 'היום' : display;
  // Update drawer dates
  const drawerGreg = document.getElementById('drawer-greg');
  const drawerHeb  = document.getElementById('drawer-heb');
  if (drawerGreg) drawerGreg.textContent = display;
  // Update offset badge
  const badge = document.getElementById('topbar-offset-badge');
  if (badge) {
    if (currentOffset !== 0) {
      badge.textContent = currentOffset > 0 ? `+${currentOffset}` : String(currentOffset);
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
  // Drawer today button
  const dtBtn = document.getElementById('drawer-today-btn');
  if (dtBtn) dtBtn.classList.toggle('hidden', currentOffset === 0);

  loadHebrewDate();
}

function toggleDateNav() {
  const drawer = document.getElementById('date-nav-drawer');
  if (!drawer) return;
  const isOpen = drawer.style.display !== 'none';
  drawer.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Update drawer dates
    const d = getTargetDate();
    const display = formatDisplayDate(d);
    const drawerGreg = document.getElementById('drawer-greg');
    const drawerHeb  = document.getElementById('drawer-heb');
    if (drawerGreg) drawerGreg.textContent = display;
    if (drawerHeb)  drawerHeb.textContent = document.getElementById('topbar-heb')?.textContent || '';
  }
}

// ═══════════════════════════════════════════
// TAB SCROLL SYNC
// ═══════════════════════════════════════════
function initTabScrollSync() {
  const topNav    = document.getElementById('tabs');
  const bottomNav = document.getElementById('bottom-nav');
  if (!topNav || !bottomNav) return;

  let _syncLock = false;

  function syncScroll(source, target) {
    if (_syncLock) return;
    _syncLock = true;
    // Calculate proportional scroll position
    const srcMax = source.scrollWidth - source.clientWidth;
    const tgtMax = target.scrollWidth - target.clientWidth;
    if (srcMax > 0 && tgtMax > 0) {
      const ratio = source.scrollLeft / srcMax;
      target.scrollLeft = ratio * tgtMax;
    }
    requestAnimationFrame(() => { _syncLock = false; });
  }

  topNav.addEventListener('scroll',    () => syncScroll(topNav, bottomNav),    { passive: true });
  bottomNav.addEventListener('scroll', () => syncScroll(bottomNav, topNav),    { passive: true });
}

async function loadHebrewDate() {
  const d = getTargetDate();
  const ds = formatDate(d);
  console.log('[loadHebrewDate] date string:', ds);
  try {
    const data = await fetchWithDelay(`https://www.hebcal.com/converter?cfg=json&date=${ds}&g2h=1&strict=1`);
    console.log('[loadHebrewDate] response:', JSON.stringify(data).slice(0,200));
    const hd = data.hebrew || '';
    document.getElementById('cal-heb').textContent = hd;
    document.getElementById('topbar-heb').textContent = hd;
    document.getElementById('hal-heb').textContent = hd;
    document.getElementById('lash-heb').textContent = hd;
    const drawerHeb = document.getElementById('drawer-heb');
    if (drawerHeb) drawerHeb.textContent = hd;
    // Cache for omer calculation
    // Normalize Hebcal month names (Hebcal uses "Iyyar", code uses "Iyar" etc.)
    const _normalizeMonth = m => {
      if (m === 'Iyyar')   return 'Iyar';
      if (m === 'Tammuz')  return 'Tamuz';
      if (m === 'Adar I' || m === 'Adar 1') return 'Adar';
      return m; // Adar II, Tishrei, Nisan etc. unchanged
    };
    appState._lastHebrewDate = { hm: _normalizeMonth(data.hm), hd: data.hd, hy: data.hy };
    saveState();
    // Re-check reminders now that Hebrew date is available (omer checkFn needs it)
    if (typeof _updateNotifBadge === 'function') _updateNotifBadge();
    // Schedule omer reminder if enabled
    if (typeof scheduleOmerReminder === 'function') scheduleOmerReminder();
    const tehilimEl = document.getElementById('tehilim-day-info');
    if (tehilimEl) {
      const day = data.hd;
      const tehilimChapters = getTehilimChapters(day);
      tehilimEl.textContent = `${hd} | פרקים להיום: ${tehilimChapters.join(', ')}`;
    }
  } catch(e) {
    console.error('[loadHebrewDate] FAILED:', e.message);
  }
}
