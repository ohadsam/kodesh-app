// ═══════════════════════════════════════════
// SETTINGS, TABS VISIBILITY, REMINDERS
// ═══════════════════════════════════════════
const ALL_TABS = [
  { id: 'calendar', label: '📅 לוח שנה עברי',    fixed: true  },
  { id: 'siddur',   label: '📕 סידור'                          },
  { id: 'halacha',  label: '📖 הלכה יומית'                    },
  { id: 'lashon',   label: '🗣 הלכות לשון הרע'                },
  { id: 'tehilim',  label: '🙏 תהילים יומי'                   },
  { id: 'daf',      label: '📚 דף יומי (בבלי)'                },
  { id: 'mishna',   label: '📜 משנה יומי'                     },
  { id: '929',      label: '✡️ 929 – תנ"ך יומי'               },
  { id: 'parasha',  label: '📜 פרשת השבוע'                    },
  { id: 'igeret',   label: '✉️ אגרת הרמב"ן'                   },
  { id: 'tefilot',  label: '🤲 תפילות נוספות'                  },
  { id: 'brachot',  label: '✨ ברכות'                           },
  { id: 'qibla',    label: '🧭 מצפן תפילה'                    },
  { id: 'logs',     label: '🐛 לוגי מערכת',   defaultHidden: true },
  { id: 'network',  label: '🌐 קריאות רשת',   defaultHidden: true },
];

function getTabVisibility() {
  // default: all visible
  return appState.tabVisibility || {};
}

function isTabVisible(id) {
  const tab = ALL_TABS.find(t => t.id === id);
  if (tab?.fixed) return true;
  const vis = getTabVisibility();
  if (id in vis) return vis[id];          // user set explicitly
  return !tab?.defaultHidden;             // use default (false = hidden by default)
}

function setTabVisible(id, visible) {
  if (!appState.tabVisibility) appState.tabVisibility = {};
  appState.tabVisibility[id] = visible;
  saveState();
  applyTabVisibility();
}

function applyTabVisibility() {
  ALL_TABS.forEach(tab => {
    const show = isTabVisible(tab.id);
    ['t-', 'bn-'].forEach(prefix => {
      const el = document.getElementById(prefix + tab.id);
      if (el) el.style.display = show ? '' : 'none';
    });
  });
  // If current tab is now hidden, switch to calendar
  if (!isTabVisible(currentTab)) {
    showTab('calendar');
  }
}

function renderTabVisibilityRows() {
  const container = document.getElementById('tab-visibility-rows');
  if (!container) return;
  const vis = getTabVisibility();
  container.innerHTML = ALL_TABS.map(tab => {
    const checked = tab.fixed || (tab.id in vis ? vis[tab.id] : !tab.defaultHidden);
    const disabled = tab.fixed ? 'disabled' : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0">
      <label style="font-size:13px;color:${tab.fixed ? 'var(--muted)' : 'var(--cream)'}">${tab.label}</label>
      <label class="toggle" style="opacity:${tab.fixed ? 0.4 : 1}">
        <input type="checkbox" ${checked ? 'checked' : ''} ${disabled}
          onchange="setTabVisible('${tab.id}', this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }).join('');
}


function openSettings() {
  document.getElementById('settings-panel').classList.add('open');
  loadSettingsState();
  renderTabVisibilityRows();
}
function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
}
function setFont(size) {
  document.documentElement.style.setProperty('--font-size', size+'px');
  appState.fontSize = size; saveState();
  [14,16,19,22].forEach(s => {
    document.getElementById('fs'+s)?.classList.toggle('active', s===size);
  });
}
function loadSettingsState() {
  if (appState.fontSize) setFont(appState.fontSize);
  const reminders = appState.reminders || {};

  // Restore standard reminder toggles (halacha, tehilim, lashon, parasha, igeret, omer)
  ['halacha','tehilim','lashon','parasha','igeret','omer'].forEach(k => {
    const r = reminders[k] || {};
    const timeEl = document.getElementById('rem-'+k);
    const togEl  = document.getElementById('tog-'+k);
    if (timeEl && r.time) timeEl.value = r.time;
    if (togEl) togEl.checked = !!r.enabled;
  });

  // Restore igeret day
  const igeretDay = (appState.reminders?.igeret?.day ?? 5).toString();
  const dayEl = document.getElementById('rem-igeret-day');
  if (dayEl) dayEl.value = igeretDay;

  // Restore omer time (handled above, but also call restoreOmerSettings for any extra UI)
  if (typeof restoreOmerSettings === 'function') restoreOmerSettings();

  // Restore zmanim reminder toggles
  const zmRem = appState.zmanimReminders || {};
  ['shema','tefila','noon','sunset','tzeit'].forEach(k => {
    const togEl = document.getElementById(`tog-${k}-auto`);
    if (togEl) togEl.checked = !!zmRem[k];
  });
}
function saveReminder(key, time) {
  if (!appState.reminders) appState.reminders = {};
  if (!appState.reminders[key]) appState.reminders[key] = {};
  appState.reminders[key].time = time; saveState();
}
function saveReminderDay(key, day) {
  if (!appState.reminders) appState.reminders = {};
  if (!appState.reminders[key]) appState.reminders[key] = {};
  appState.reminders[key].day = parseInt(day); saveState();
}
function toggleReminder(key, enabled) {
  if (!appState.reminders) appState.reminders = {};
  if (!appState.reminders[key]) appState.reminders[key] = {};
  appState.reminders[key].enabled = enabled; saveState();
  if (enabled) scheduleReminder(key);
}
function scheduleReminder(key) {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm !== 'granted') return;
    const names = {
      halacha: 'הלכה יומית', tehilim: 'תהילים',
      lashon: 'לשון הרע', parasha: 'פרשת השבוע',
      igeret: 'אגרת הרמב"ן', omer: 'ספירת העומר'
    };
    const r = appState.reminders?.[key] || {};
    const [h,m] = (r.time || '08:00').split(':').map(Number);
    const now = new Date(), target = new Date();
    target.setHours(h, m, 0, 0);
    // For igeret: find next occurrence of the chosen weekday
    if (key === 'igeret' && r.day !== undefined) {
      const targetDay = r.day; // 0=Sun … 6=Sat
      const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
      target.setDate(now.getDate() + daysUntil);
      target.setHours(h, m, 0, 0);
    } else {
      if (target <= now) target.setDate(target.getDate() + 1);
    }
    const delay = target - now;
    console.log(`[Reminder] scheduled "${names[key]}" in ${Math.round(delay/60000)} min`);
    setTimeout(() => new Notification('לימוד יומי 📖', {
      body: 'הגיע זמן: ' + names[key],
      icon: 'icons/icon-192.png'
    }), delay);
  });
}

function softReload() {
  closeSettings();
  window.location.reload(false);
}
async function hardReload() {
  closeSettings();
  console.log('[Cache] clearing service worker caches...');
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    console.log('[Cache] deleted', keys.length, 'caches');
  }
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));
    console.log('[Cache] unregistered service workers');
  }
  window.location.reload(true);
}

async function nuclearReset() {
  // Show progress in button
  const btn = document.querySelector('[onclick="nuclearReset()"]');
  if (btn) btn.textContent = '⏳ מנקה הכל...';

  console.log('[NuclearReset] START');

  // 1. Unregister ALL service workers
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    console.log('[NuclearReset] SW unregistered:', regs.length);
  }

  // 2. Clear ALL browser caches (Cache API)
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    console.log('[NuclearReset] caches deleted:', keys);
  }

  // 3. Clear ALL localStorage
  const savedKeys = Object.keys(localStorage);
  localStorage.clear();
  console.log('[NuclearReset] localStorage cleared:', savedKeys);

  // 4. Clear sessionStorage
  sessionStorage.clear();

  // 5. Force full reload from server (no cache)
  console.log('[NuclearReset] reloading...');
  window.location.href = window.location.href.split('?')[0] + '?nocache=' + Date.now();
}

// ═══════════════════════════════════════════
// WHAT'S NEW POPUP
// ═══════════════════════════════════════════
function showWhatsNew() {
  const overlay = document.getElementById('whats-new-overlay');
  const modal = document.getElementById('whats-new-modal');
  if (overlay) overlay.style.display = 'block';
  if (modal) modal.style.display = 'block';
  // Mark as seen
  appState._lastSeenVersion = APP_VERSION;
  saveState();
}

function closeWhatsNew() {
  const overlay = document.getElementById('whats-new-overlay');
  const modal = document.getElementById('whats-new-modal');
  if (overlay) overlay.style.display = 'none';
  if (modal) modal.style.display = 'none';
}

function checkWhatsNew() {
  const lastSeen = appState._lastSeenVersion || '';
  if (lastSeen !== APP_VERSION) {
    // Show after a short delay so splash finishes first
    setTimeout(() => showWhatsNew(), 2500);
  }
}

// ═══════════════════════════════════════════
// REMINDER CHECK ON APP OPEN
// ═══════════════════════════════════════════
const REMINDER_ITEMS = [
  { key: 'omer', name: '🌾 ספירת העומר', checkFn: () => {
    const hd = appState?._lastHebrewDate;
    if (!hd) return false;
    const m = hd.hm, d = hd.hd;
    return (m === 'Nisan' && d >= 16) || m === 'Iyar' || (m === 'Sivan' && d <= 5);
  }},
  { key: 'halacha',  name: '📖 הלכה יומית',     daily: true },
  { key: 'tehilim',  name: '🙏 תהילים יומי',     daily: true },
  { key: 'lashon',   name: '🗣 שמירת הלשון',     daily: true },
  { key: 'daf',      name: '📚 דף יומי',         daily: true },
  { key: 'mishna',   name: '📜 משנה יומית',       daily: true },
  { key: 'rambam',   name: '📗 רמב"ם יומי',      daily: true },
  { key: 'parasha',  name: '📜 פרשת השבוע',      weekly: true },
];

function checkRemindersOnOpen() {
  const today = formatDate(new Date());
  const doneMap = appState._remindersDone || {};
  
  // Clean old dates (keep only today)
  for (const k of Object.keys(doneMap)) {
    if (k !== today) delete doneMap[k];
  }
  appState._remindersDone = doneMap;
  saveState();
  
  const todayDone = doneMap[today] || {};
  const pending = [];
  
  for (const item of REMINDER_ITEMS) {
    // Check if reminder is enabled
    const r = appState?.reminders?.[item.key];
    if (!r?.enabled) continue;
    
    // Check if applicable today (special check for omer)
    if (item.checkFn && !item.checkFn()) continue;
    
    // Check if already done today
    if (todayDone[item.key]) continue;
    
    // Check scheduled time – only show if scheduled time has passed
    const [h, m] = (r.time || '08:00').split(':').map(Number);
    const now = new Date();
    if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) continue;
    
    pending.push(item);
  }
  
  if (!pending.length) return false;
  
  // Build the reminder list
  const listEl = document.getElementById('reminder-list');
  if (!listEl) return false;
  
  listEl.innerHTML = pending.map(item => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer">
      <input type="checkbox" id="rem-chk-${item.key}" onchange="toggleReminderDone('${item.key}', this.checked)"
        style="width:20px;height:20px;accent-color:var(--gold);flex-shrink:0">
      <span style="font-family:'Frank Ruhl Libre',serif;font-size:15px;flex:1">${item.name}</span>
      ${item.key === 'omer' ? `<button onclick="closeReminderModal();showOmerNow()"
        style="background:var(--gold);color:#000;border:none;border-radius:8px;padding:5px 10px;
        font-size:11px;font-weight:700;cursor:pointer;font-family:'Heebo',sans-serif;white-space:nowrap">
        ספור עכשיו ▶
      </button>` : ''}
    </label>
  `).join('') + `
    <div style="margin-top:10px;font-size:11px;color:var(--muted);text-align:center">
      סמן את מה שכבר ביצעת היום
    </div>`;
  
  window._pendingReminders = pending;
  const modal = document.getElementById('reminder-modal');
  if (modal) modal.style.display = 'flex';
  return true;
}

function toggleReminderDone(key, done) {
  const today = formatDate(new Date());
  if (!appState._remindersDone) appState._remindersDone = {};
  if (!appState._remindersDone[today]) appState._remindersDone[today] = {};
  appState._remindersDone[today][key] = done;
  saveState();
}

function markAllRemindersDone() {
  const today = formatDate(new Date());
  if (!appState._remindersDone) appState._remindersDone = {};
  if (!appState._remindersDone[today]) appState._remindersDone[today] = {};
  for (const item of (window._pendingReminders || [])) {
    appState._remindersDone[today][item.key] = true;
    const chk = document.getElementById('rem-chk-' + item.key);
    if (chk) chk.checked = true;
  }
  saveState();
  setTimeout(() => closeReminderModal(), 500);
}

function closeReminderModal() {
  const modal = document.getElementById('reminder-modal');
  if (modal) modal.style.display = 'none';
  // After reminders, check what's new
  if (typeof checkWhatsNew === 'function') checkWhatsNew();
}
