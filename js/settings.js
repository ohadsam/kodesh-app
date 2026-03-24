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
  { id: 'qibla',    label: '🧭 מצפן תפילה'                    },
  { id: 'logs',     label: '🐛 לוגי מערכת',   defaultHidden: true },
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
  ['halacha','tehilim','lashon','parasha','igeret'].forEach(k => {
    const r = reminders[k] || {};
    const timeEl = document.getElementById('rem-'+k);
    const togEl  = document.getElementById('tog-'+k);
    if (timeEl && r.time) timeEl.value = r.time;
    if (togEl) togEl.checked = !!r.enabled;
  });
  // Restore igeret day
  const igeretDay = (appState.reminders?.igeret?.day ?? 5).toString(); // default Friday
  const dayEl = document.getElementById('rem-igeret-day');
  if (dayEl) dayEl.value = igeretDay;
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
      lashon: 'לשון הרע', parasha: 'פרשת השבוע', igeret: 'אגרת הרמב"ן'
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
  window.location.reload(false); // reload from cache
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
  window.location.reload(true); // force fresh from server
}
