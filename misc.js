// ═══════════════════════════════════════════
// DONE BUTTONS
// ═══════════════════════════════════════════
function updateDoneButton(section, key) {
  const el = document.getElementById('done-'+section);
  if (!el) return;
  const doneKey = `done_${section}_${key}`;
  const isDone = appState[doneKey];
  el.innerHTML = `<button class="done-btn ${isDone?'done':''}" onclick="toggleDone('${section}','${key}')">
    ${isDone ? '✅ נלמד' : '◯ סמן כנלמד'}
  </button>`;
}

function toggleDone(section, key) {
  const doneKey = `done_${section}_${key}`;
  appState[doneKey] = !appState[doneKey];
  saveState();
  updateDoneButton(section, key);
}

// ═══════════════════════════════════════════
// QIBLA / MIZRACH COMPASS
// Pointing to the Western Wall (Kotel), Jerusalem
// Coordinates: 31.7767°N, 35.2345°E
// ═══════════════════════════════════════════
const JERUSALEM_LAT = 31.77668 * Math.PI / 180;  // Kotel exact: 31°46'36.04″N
const JERUSALEM_LON = 35.23444 * Math.PI / 180;  // Kotel exact: 35°14'4″E

let qiblaAngle      = null;
let deviceHeading   = null;
let deviceBeta      = null;  // front-back tilt (0=flat, 90=upright portrait)
let compassListener = null;
let qiblaInitDone   = false;

function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = lon2 - lon1;
  const x = Math.cos(lat2) * Math.sin(dLon);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
}

function calcDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function bearingToLabel(deg) {
  return ['צפון','צ-מזרח','מזרח','ד-מזרח','דרום','ד-מערב','מערב','צ-מערב'][Math.round(deg/45)%8];
}

function setQiblaStatus(msg) {
  const el = document.getElementById('qibla-status');
  if (el) el.textContent = msg;
}

function drawCompassTicks() {
  const g = document.getElementById('tick-marks');
  if (!g) return;
  const cx=140, cy=140, r1=128;
  let html = '';
  for (let i=0; i<36; i++) {
    const a = i*10, rad=(a-90)*Math.PI/180;
    const isMajor = a%30===0, r2 = isMajor ? 112 : 120;
    const x1=cx+r1*Math.cos(rad), y1=cy+r1*Math.sin(rad);
    const x2=cx+r2*Math.cos(rad), y2=cy+r2*Math.sin(rad);
    html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${isMajor?'rgba(201,165,74,.7)':'rgba(201,165,74,.2)'}" stroke-width="${isMajor?2:1}"/>`;
  }
  // Bold north tick
  html += `<line x1="140" y1="12" x2="140" y2="28" stroke="rgba(201,165,74,1)" stroke-width="3.5"/>`;
  g.innerHTML = html;
}

function updateCompassUI() {
  if (qiblaAngle === null) return;
  document.getElementById('qibla-bearing').textContent = Math.round(qiblaAngle);
  document.getElementById('qibla-direction-label').textContent = bearingToLabel(qiblaAngle);

  if (deviceHeading !== null) {
    document.getElementById('device-heading').textContent = Math.round(deviceHeading) + '°';

    // Rotate compass ring so North stays pointing up on screen
    const outerEl = document.getElementById('compass-outer');
    if (outerEl) outerEl.style.transform = `rotate(${-deviceHeading}deg)`;

    // Needle angle: bearing relative to device heading
    const needleAngle = qiblaAngle - deviceHeading;

    // Rotate the arrow SVG to point at Jerusalem
    const arrowEl = document.getElementById('compass-arrows');
    if (arrowEl) arrowEl.style.transform = `rotate(${needleAngle}deg)`;

    // Legacy elements (may not exist)
    const needle = document.getElementById('jerusalem-needle');
    const tail   = document.getElementById('jerusalem-needle-tail');
    const star   = document.getElementById('jerusalem-star');
    if (needle) needle.style.transform = `rotate(${needleAngle}deg)`;
    if (tail)   tail.style.transform   = `rotate(${needleAngle}deg)`;
    if (star)   star.style.transform   = `translate(-50%,-50%) rotate(${needleAngle}deg) translateY(-100px)`;

    // Alignment
    const diff = Math.abs(((needleAngle+180)%360)-180);
    console.log('[Compass] deviceHeading:', Math.round(deviceHeading), '° | qiblaAngle:', Math.round(qiblaAngle), '° | needleAngle:', Math.round(needleAngle), '° | diff from forward:', Math.round(diff), '°');
    const ind  = document.getElementById('alignment-indicator');
    if (ind) {
      if (diff < 10)      { ind.style.cssText += ';background:rgba(61,140,90,.25);color:#5cb87a;border-color:#3d8c5a'; ind.textContent='✅ פנה ירושלים! התפלל כעת'; }
      else if (diff < 25) { ind.style.cssText += ';background:rgba(201,165,74,.2);color:var(--gold);border-color:var(--gold-dim)'; ind.textContent='↻ כמעט – סובב עוד קצת'; }
      else                { ind.style.cssText += ';background:rgba(100,70,20,.2);color:var(--muted);border-color:var(--border)'; ind.textContent='↑ סובב את הטלפון עד שהחץ מצביע למעלה'; }
    }
    // Tilt warning – phone too upright reduces accuracy (beta near 90 = portrait)
    const tiltWarn = document.getElementById('tilt-warning');
    if (tiltWarn && deviceBeta !== null) {
      tiltWarn.style.display = Math.abs(deviceBeta) > 30 ? 'block' : 'none';
    }
  } else {
    const ind = document.getElementById('alignment-indicator');
    if (ind) { ind.textContent='לחץ "הפעל חיישן כיוון" למטה'; ind.style.color='var(--muted)'; }
    console.log('[Compass] no device heading yet – waiting for sensor data');
  }
}

function startCompassListener() {
  if (compassListener) {
    window.removeEventListener('deviceorientationabsolute', compassListener, true);
    window.removeEventListener('deviceorientation',         compassListener, true);
    compassListener = null;
  }
  if (window._aoSensor) { try { window._aoSensor.stop(); } catch(e){} window._aoSensor = null; }

  compassListener = (e) => {
    let h = null;
    deviceBeta = e.beta;

    if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
      // iOS: tilt-compensated by OS. Add ~5° magnetic declination correction for Israel
      h = (e.webkitCompassHeading + 5) % 360;
      console.log('[Compass] iOS webkit+decl:', h.toFixed(1));

    } else if (e.absolute === true && e.alpha !== null) {
      // Android: use fused absolute heading from OS sensor (already tilt-compensated)
      const screenAngle = (window.screen?.orientation?.angle ?? window.orientation ?? 0);
      h = (360 - e.alpha + screenAngle) % 360;
      console.log('[Compass] Android heading:', h.toFixed(1), 'α=', e.alpha.toFixed(1), 'screen=', screenAngle);
    } else {
      return;
    }

    if (h !== null && !isNaN(h)) { deviceHeading = h; updateCompassUI(); }
  };

  window.addEventListener('deviceorientationabsolute', compassListener, true);
  window.addEventListener('deviceorientation',         compassListener, true);
  setQiblaStatus('🧭 מצפן פעיל');
}

function _startDeviceOrientationFallback() {
  startCompassListener();
}

function stopCompassListener() {
  if (compassListener) {
    window.removeEventListener('deviceorientationabsolute', compassListener, true);
    window.removeEventListener('deviceorientation',         compassListener, true);
    compassListener = null;
    console.log('[Qibla] compass stopped');
  }
}

function resumeQibla() {
  if (qiblaInitDone && !compassListener) startCompassListener();
  else updateCompassUI();
}

async function requestCompassPermission() {
  const btn = document.getElementById('compass-permission-btn');
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') { startCompassListener(); if(btn) btn.textContent='✅ מצפן פעיל'; }
      else { if(btn) btn.textContent='❌ הרשאה נדחתה'; setQiblaStatus('⚠️ נדרשת הרשאה בהגדרות'); }
    } catch(e) { console.error('[Qibla] permission error:', e); }
  } else {
    startCompassListener();
    if(btn) btn.textContent='✅ מצפן פעיל';
  }
}

async function initQibla() {
  console.log('[Qibla] init – requesting live GPS');
  setQiblaStatus('📍 מאתר מיקום GPS...');
  drawCompassTicks();
  qiblaInitDone = true;

  // Always try live GPS first for accuracy
  let lat, lon, locationName;
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS לא נתמך')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000   // accept cached position up to 30 sec old
      });
    });
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    locationName = `📍 מיקום נוכחי (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
    console.log('[Qibla] live GPS OK: lat', lat, 'lon', lon, 'accuracy', pos.coords.accuracy, 'm');
    setQiblaStatus('');
  } catch(e) {
    // GPS failed – fall back to saved city
    console.warn('[Qibla] GPS failed:', e.message, '– falling back to saved city');
    const savedCity = appState.cityKey || 'petah_tikva';
    if (savedCity === 'gps' && appState.gpsLat) {
      lat = appState.gpsLat; lon = appState.gpsLon;
      locationName = `📍 GPS שמור (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
    } else {
      const c = CITIES[savedCity] || CITIES['petah_tikva'];
      lat = c.lat; lon = c.lon; locationName = `🏙️ ${c.name} (ברירת מחדל)`;
    }
    setQiblaStatus(`⚠️ GPS לא זמין – משתמש ב${locationName}`);
  }

  qiblaAngle = calcBearing(lat*Math.PI/180, lon*Math.PI/180, JERUSALEM_LAT, JERUSALEM_LON);
  console.log('[Qibla] lat:', lat.toFixed(5), 'lon:', lon.toFixed(5), '| bearing to Kotel:', qiblaAngle.toFixed(2), '°');

  const distKm = calcDistanceKm(lat, lon, 31.7767, 35.2345);
  const infoEl = document.getElementById('qibla-location-info');
  if (infoEl) infoEl.innerHTML = `
    <div style="margin-bottom:6px">📍 <strong>מיקום:</strong> ${locationName}</div>
    <div style="margin-bottom:6px">🕍 <strong>כיוון הכותל המערבי:</strong> ${qiblaAngle.toFixed(1)}° (${bearingToLabel(qiblaAngle)})</div>
    <div style="margin-bottom:6px">📏 <strong>מרחק מהכותל:</strong> ${Math.round(distKm)} ק"מ</div>
    <div style="font-size:11px;color:var(--muted);margin-top:8px">מחושב לכותל המערבי: 31.7767°N, 35.2345°E</div>`;

  updateCompassUI();
  // Auto-start compass sensor
  startCompassListener();
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
