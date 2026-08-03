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

// Magnetic declination in Israel (~+4.5°E, 2026 epoch).
// calcBearing() returns a TRUE (geographic) bearing, so any heading that is
// referenced to MAGNETIC north must be converted:  true = magnetic + declination.
// Sources and their reference frame:
//   - Android deviceorientationabsolute / AbsoluteOrientationSensor:
//       built on TYPE_ROTATION_VECTOR, documented as pointing to MAGNETIC north
//       → declination MUST be added.
//   - iOS webkitCompassHeading:
//       WebKit reports CLHeading, which is TRUE-north referenced whenever
//       Location Services are authorised (this app requests GPS on init)
//       → declination must NOT be added.
const MAGNETIC_DECLINATION = 4.5;

let qiblaAngle      = null;
let deviceHeading   = null;
let deviceBeta      = null;  // front-back tilt (0=flat, 90=upright portrait)
let deviceTilt      = null;  // total tilt away from flat, degrees (0=flat on a table)
let compassListener = null;
let qiblaInitDone   = false;

// ── Heading source priority ───────────────────────────────────────────────
// A lower-quality source must never overwrite a better one that is still live.
const HSRC_RELATIVE = 1;   // deviceorientation, absolute===false (drifts)
const HSRC_ABSOLUTE = 2;   // deviceorientationabsolute
const HSRC_BEST     = 3;   // iOS webkitCompassHeading / AbsoluteOrientationSensor
let _headingRank    = 0;
let _headingRankTs  = 0;
const HSRC_STALE_MS = 3000;

// Set when no orientation reading arrives at all, so the UI can say so instead of
// leaving the arrow pointing at the top of the screen next to a confident bearing.
let _compassUnavailable = false;
let _compassWatchdog    = null;

function _acceptHeadingSource(rank) {
  const now = Date.now();
  if (rank >= _headingRank || (now - _headingRankTs) > HSRC_STALE_MS) {
    // Switching source: drop the smoothing state. Two sources can use completely
    // different zero references (relative orientation in particular), so blending
    // across the switch would slew the arrow smoothly to a bogus bearing instead
    // of jumping cleanly to the new source's reading.
    if (rank !== _headingRank) { _smoothX = null; _smoothY = null; }
    _headingRank   = rank;
    _headingRankTs = now;
    return true;
  }
  return false;
}

function _screenAngle() {
  return (window.screen?.orientation?.angle ?? window.orientation ?? 0);
}

// Minimum horizontal length of the screen-up axis for the azimuth to be meaningful
// (~sin 9°). Below this the phone is effectively edge-on and the heading is noise.
const HEADING_MIN_PROJ = 0.15;

// ── Tilt-correct compass heading ──────────────────────────────────────────
// Returns the azimuth (clockwise from north) that the TOP OF THE SCREEN points
// at, for any device attitude — including a phone lying flat on a table.
//
// The old code used the shortcut `360 - alpha`, which silently breaks when
// cos(beta) < 0 (device tilted past vertical / screen facing down): the true
// azimuth flips by 180° but `360 - alpha` does not, so the arrow pointed the
// exact opposite way. Building the rotation matrix and reading the screen-up
// axis handles every attitude correctly.
//
// W3C DeviceOrientation: intrinsic Z-X'-Y'' (alpha, beta, gamma).
// Earth frame is East-North-Up. R = Rz(a)·Rx(b)·Ry(g).
function _headingFromEuler(alpha, beta, gamma, screenAngle) {
  const d = Math.PI / 180;
  const a = (alpha || 0) * d, b = (beta || 0) * d, g = (gamma || 0) * d;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);

  // Columns of R that we need (device x and y axes expressed in earth frame)
  const r00 = cA * cG - sA * sB * sG,  r01 = -sA * cB;   // east  components
  const r10 = sA * cG + cA * sB * sG,  r11 =  cA * cB;   // north components

  // "Up on screen" expressed in device coordinates, per screen rotation
  const s  = (screenAngle || 0) * d;
  const sS = Math.sin(s), cS = Math.cos(s);

  const east  = r00 * sS + r01 * cS;
  const north = r10 * sS + r11 * cS;
  // When the screen-up axis approaches vertical (phone held upright, beta ~ 90°)
  // its horizontal projection collapses and the azimuth becomes pure noise.
  // Reject well before the exact-zero singularity.
  if (Math.hypot(east, north) < HEADING_MIN_PROJ) return null;

  return ((Math.atan2(east, north) * 180 / Math.PI) + 360) % 360;
}

// Same result from an AbsoluteOrientationSensor quaternion [x, y, z, w].
function _headingFromQuaternion(q, screenAngle) {
  if (!q || q.length < 4) return null;
  const [x, y, z, w] = q;
  const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w);
  const r10 = 2 * (x * y + z * w),     r11 = 1 - 2 * (x * x + z * z);

  const s  = (screenAngle || 0) * Math.PI / 180;
  const sS = Math.sin(s), cS = Math.cos(s);

  const east  = r00 * sS + r01 * cS;
  const north = r10 * sS + r11 * cS;
  if (Math.hypot(east, north) < HEADING_MIN_PROJ) return null;

  return ((Math.atan2(east, north) * 180 / Math.PI) + 360) % 360;
}

// ── Circular smoothing ────────────────────────────────────────────────────
// Magnetometer output is noisy; averaging the raw degrees would break across
// the 359°→0° wrap, so smooth the unit vector instead.
let _smoothX = null, _smoothY = null;
const SMOOTH_K = 0.25;

function _smoothHeading(h) {
  const r = h * Math.PI / 180;
  const x = Math.cos(r), y = Math.sin(r);
  if (_smoothX === null) { _smoothX = x; _smoothY = y; }
  else {
    _smoothX += (x - _smoothX) * SMOOTH_K;
    _smoothY += (y - _smoothY) * SMOOTH_K;
  }
  return ((Math.atan2(_smoothY, _smoothX) * 180 / Math.PI) + 360) % 360;
}

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
    if (arrowEl) { arrowEl.style.transform = `rotate(${needleAngle}deg)`; arrowEl.style.opacity = '1'; }

    // Legacy elements
    const needle = document.getElementById('jerusalem-needle');
    const tail   = document.getElementById('jerusalem-needle-tail');
    const star   = document.getElementById('jerusalem-star');
    if (needle) needle.style.transform = `rotate(${needleAngle}deg)`;
    if (tail)   tail.style.transform   = `rotate(${needleAngle}deg)`;
    if (star)   star.style.transform   = `translate(-50%,-50%) rotate(${needleAngle}deg) translateY(-100px)`;

    // Normalize diff to -180..+180 for directional feedback
    const normDiff = ((needleAngle % 360) + 540) % 360 - 180;
    const absDiff = Math.abs(normDiff);
    console.log('[Compass] deviceHeading:', Math.round(deviceHeading), '° | qiblaAngle:', Math.round(qiblaAngle), '° | needleAngle:', Math.round(needleAngle), '° | diff from forward:', Math.round(absDiff), '°');
    const ind = document.getElementById('alignment-indicator');
    if (ind) {
      // CSS rotate() is CLOCKWISE for positive angles, so needleAngle > 0 draws the
      // arrow to the RIGHT of screen-up — meaning the Kotel is clockwise from where
      // you face and you must turn RIGHT (ימינה). The labels used to be inverted,
      // telling the user to turn left when the arrow pointed right; that alone made
      // the compass read as pointing the wrong way.
      const dir = normDiff > 0 ? 'ימינה ↻' : 'שמאלה ↺';
      if (absDiff < 8) {
        ind.style.cssText += ';background:rgba(61,140,90,.25);color:#5cb87a;border-color:#3d8c5a';
        ind.textContent = '✅ פנה ירושלים! התפלל כעת';
      } else if (absDiff < 20) {
        ind.style.cssText += ';background:rgba(201,165,74,.2);color:var(--gold);border-color:var(--gold-dim)';
        ind.textContent = `כמעט – סובב ${dir} ${Math.round(absDiff)}°`;
      } else {
        ind.style.cssText += ';background:rgba(100,70,20,.2);color:var(--muted);border-color:var(--border)';
        ind.textContent = `סובב ${dir} ${Math.round(absDiff)}° – החץ יצביע לירושלים`;
      }
    }
    // Tilt warning — prefer the true tilt-from-flat when we have it (the
    // AbsoluteOrientationSensor path has no beta at all), else fall back to beta.
    const tiltWarn = document.getElementById('tilt-warning');
    const tilt = (deviceTilt !== null) ? deviceTilt
               : (deviceBeta !== null) ? Math.abs(deviceBeta) : null;
    if (tiltWarn && tilt !== null) {
      tiltWarn.style.display = tilt > 30 ? 'block' : 'none';
    }
  } else {
    // No heading yet. Dim the arrow so a compass that is merely pointing at the top
    // of the screen is not mistaken for a live reading sitting next to a confident
    // bearing number.
    const arrowEl = document.getElementById('compass-arrows');
    if (arrowEl) { arrowEl.style.transform = 'rotate(0deg)'; arrowEl.style.opacity = '.25'; }
    const ind = document.getElementById('alignment-indicator');
    if (ind) { ind.textContent = _compassUnavailable
      ? '⚠️ אין חיישן מצפן זמין במכשיר – הכיוון למעלה אינו אמיתי'
      : 'לחץ "הפעל חיישן כיוון" למטה'; ind.style.color = 'var(--muted)'; }
    console.log('[Compass] no device heading yet – waiting for sensor data');
  }
}

// Track alpha history to detect uncalibrated sensor
let _alphaHistory = [];
let _calibrationWarned = false;
let _lastAlphaRange = 0;

function _checkSensorCalibration(alpha) {
  _alphaHistory.push(alpha);
  if (_alphaHistory.length > 60) _alphaHistory.shift(); // keep last 60 samples (~3 sec)
  if (_alphaHistory.length < 20) return; // not enough data yet

  const min = Math.min(..._alphaHistory);
  const max = Math.max(..._alphaHistory);
  _lastAlphaRange = max - min;

  const calEl = document.getElementById('qibla-calibration');
  if (!calEl) return;

  if (_lastAlphaRange < 15) {
    // Sensor barely moving — almost certainly uncalibrated
    if (!_calibrationWarned) {
      _calibrationWarned = true;
      calEl.style.display = 'block';
      calEl.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:#c87060;margin-bottom:6px">⚠️ חיישן המצפן לא מכויל</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:8px">
          הטלפון אינו מזהה סיבוב אמיתי. יש לכייל את המגנטומטר:<br>
          <strong>הזז את הטלפון בתנועת שמינייה (∞) כ-10 שניות</strong> ואז לחץ רענון.
        </div>
        <div style="font-size:10px;color:var(--muted);opacity:.7">
          טווח חיישן: ${Math.round(_lastAlphaRange)}° (דרוש: >30°)
        </div>
        <button onclick="initQibla()" style="margin-top:8px;padding:6px 14px;border-radius:8px;
          border:1px solid var(--gold);background:rgba(201,165,74,.15);color:var(--gold);
          cursor:pointer;font-size:12px;font-family:'Heebo',sans-serif">
          🔄 רענן לאחר כיול
        </button>`;
    }
  } else {
    // Sensor is working
    _calibrationWarned = false;
    calEl.style.display = 'none';
  }
}

function startCompassListener() {
  if (compassListener) {
    window.removeEventListener('deviceorientationabsolute', compassListener, true);
    window.removeEventListener('deviceorientation',         compassListener, true);
    compassListener = null;
  }
  if (window._aoSensor) { try { window._aoSensor.stop(); } catch(e){} window._aoSensor = null; }

  // Reset calibration + smoothing tracking
  _alphaHistory = [];
  _calibrationWarned = false;
  _smoothX = null; _smoothY = null;
  _headingRank = 0; _headingRankTs = 0;
  _compassUnavailable = false;

  // Commit a heading reading coming from `rank`, applying smoothing.
  function _applyHeading(h, rank, label) {
    if (h === null || isNaN(h)) return;
    if (!_acceptHeadingSource(rank)) return;
    deviceHeading = _smoothHeading(((h % 360) + 360) % 360);
    console.log(`[Compass] ${label}: raw ${h.toFixed(1)}° → smoothed ${deviceHeading.toFixed(1)}°`);
    updateCompassUI();
  }

  // ── Preferred path on Android: AbsoluteOrientationSensor ────────────────
  // Gives a fused, tilt-correct quaternion. Previously the code only ever
  // *stopped* window._aoSensor — nothing ever created it, so this path was
  // dead and the compass fell back to raw alpha.
  if (typeof AbsoluteOrientationSensor === 'function') {
    let sensor = null;
    try {
      sensor = new AbsoluteOrientationSensor({ frequency: 20, referenceFrame: 'device' });
      let frozenCount = 0, lastQuat = '';
      sensor.addEventListener('reading', () => {
        const q = sensor.quaternion;
        // Chrome sometimes keeps this sensor firing with a frozen quaternion. That
        // would pin the source rank at BEST and lock out the live DOM event stream
        // forever, so detect it and hand back over to deviceorientation*.
        const sig = q ? q.map(n => n.toFixed(5)).join(',') : '';
        if (sig && sig === lastQuat) {
          if (++frozenCount === 40) {
            console.warn('[Compass] AbsoluteOrientationSensor frozen – falling back to deviceorientation');
            try { sensor.stop(); } catch(e2) {}
            if (window._aoSensor === sensor) window._aoSensor = null;
            _headingRank = 0; _headingRankTs = 0;
          }
          return;
        }
        frozenCount = 0; lastQuat = sig;

        // Tilt from flat: the up-component of the device z-axis is R[2][2].
        if (q && q.length >= 4) {
          const r22 = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
          deviceTilt = Math.acos(Math.max(-1, Math.min(1, r22))) * 180 / Math.PI;
        }

        const h = _headingFromQuaternion(q, _screenAngle());
        if (h === null) return;
        _applyHeading((h + MAGNETIC_DECLINATION) % 360, HSRC_BEST, 'AbsoluteOrientationSensor');
      });
      sensor.addEventListener('error', ev => {
        console.warn('[Compass] AbsoluteOrientationSensor error:', ev.error?.name || ev.error);
        try { sensor.stop(); } catch(e2) {}
        if (window._aoSensor === sensor) window._aoSensor = null;
        _headingRank = 0; _headingRankTs = 0;
      });
      // Publish BEFORE start(): if start() throws, the sensor may already be
      // activated with its listener attached, and an unpublished handle can never
      // be stopped — it would keep the magnetometer powered and hold rank at BEST.
      window._aoSensor = sensor;
      sensor.start();
      console.log('[Compass] AbsoluteOrientationSensor started');
    } catch(e) {
      console.warn('[Compass] AbsoluteOrientationSensor unavailable:', e.message);
      if (sensor) { try { sensor.stop(); } catch(e2) {} }
      window._aoSensor = null;
    }
  }

  compassListener = (e) => {
    deviceBeta = (e.beta === undefined) ? null : e.beta;
    // Total tilt from flat, from beta and gamma (0 = lying flat, screen up)
    if (e.beta !== null && e.beta !== undefined && e.gamma !== null && e.gamma !== undefined) {
      const d = Math.PI / 180;
      const upZ = Math.cos(e.beta * d) * Math.cos(e.gamma * d);
      deviceTilt = Math.acos(Math.max(-1, Math.min(1, upZ))) * 180 / Math.PI;
    }

    if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
      // iOS: already tilt-compensated AND true-north referenced by CoreLocation
      // (Location Services are on — initQibla requests GPS). Adding the magnetic
      // declination here double-corrected the heading; do not add it.
      _applyHeading(e.webkitCompassHeading, HSRC_BEST, 'iOS webkitCompassHeading');
      return;
    }

    if (e.alpha === null || e.alpha === undefined) return;

    const screenAngle = _screenAngle();
    const h = _headingFromEuler(e.alpha, e.beta, e.gamma, screenAngle);
    if (h === null) return;   // screen edge-on to the ground: heading undefined

    if (e.absolute === true) {
      _checkSensorCalibration(e.alpha);
      const rawEl = document.getElementById('qibla-raw-alpha');
      if (rawEl) rawEl.textContent = `α=${e.alpha.toFixed(1)}° range=${Math.round(_lastAlphaRange)}°`;
      _applyHeading((h + MAGNETIC_DECLINATION) % 360, HSRC_ABSOLUTE, 'deviceorientationabsolute');
    } else {
      // Relative orientation: arbitrary zero reference, so it drifts — but it is
      // far better than a frozen arrow. Previously this branch computed a heading
      // and then returned without ever assigning it, so the fallback was dead and
      // devices with no absolute sensor showed a compass that never moved.
      // No declination here: this reading is not referenced to magnetic north at
      // all, so "converting" it to true north would be meaningless.
      _applyHeading(h, HSRC_RELATIVE, 'deviceorientation (relative)');
      if (_headingRank === HSRC_RELATIVE) {
        setQiblaStatus('⚠️ מצפן יחסי (פחות מדויק) – יש לכייל');
      }
    }
  };

  window.addEventListener('deviceorientationabsolute', compassListener, true);
  window.addEventListener('deviceorientation',         compassListener, true);
  setQiblaStatus('🧭 מצפן פעיל');

  // Watchdog: some devices (desktop, tablets with no magnetometer, denied sensor
  // permission) never deliver a single orientation event. Say so explicitly.
  if (_compassWatchdog) clearTimeout(_compassWatchdog);
  _compassWatchdog = setTimeout(() => {
    if (deviceHeading === null) {
      _compassUnavailable = true;
      console.warn('[Compass] no orientation reading after 4s – sensor unavailable');
      setQiblaStatus('⚠️ אין חיישן מצפן זמין – הכיוון מוצג במעלות בלבד');
      updateCompassUI();
    }
  }, 4000);
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
  // Release the Generic Sensor too, otherwise it keeps the magnetometer powered
  if (window._aoSensor) {
    try { window._aoSensor.stop(); } catch(e) {}
    window._aoSensor = null;
    console.log('[Qibla] AbsoluteOrientationSensor stopped');
  }
  if (_compassWatchdog) { clearTimeout(_compassWatchdog); _compassWatchdog = null; }
}

function resumeQibla() {
  // Keyed on compassListener only. Gating on window._aoSensor too would mean that
  // if the two ever desync (the sensor is a window global, the listener is not),
  // the DOM listeners never get re-attached and the compass freezes for good.
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

  let lat, lon, locationName;
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS לא נתמך')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      });
    });
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    const acc = pos.coords.accuracy;

    // Spoofing detection: accuracy too perfect or location makes no sense
    const isSuspect = acc === 0 || acc > 5000 ||
                      (lat === 0 && lon === 0) ||
                      (Math.abs(lat) < 0.001 && Math.abs(lon) < 0.001);
    if (isSuspect) {
      console.warn('[Qibla] GPS suspect (acc=' + acc + ') – falling back to saved city');
      throw new Error('GPS לא מדויק (ייתכן שיבוש)');
    }

    locationName = `📍 GPS (${lat.toFixed(4)}°, ${lon.toFixed(4)}°, דיוק: ${Math.round(acc)}מ')`;
    console.log('[Qibla] live GPS OK: lat', lat, 'lon', lon, 'accuracy', acc, 'm');
    setQiblaStatus('');
  } catch(e) {
    console.warn('[Qibla] GPS failed:', e.message, '– falling back to saved city');
    const savedCity = appState.cityKey || 'petah_tikva';
    if (savedCity === 'gps' && appState.gpsLat) {
      lat = appState.gpsLat; lon = appState.gpsLon;
      locationName = `📍 GPS שמור (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
    } else {
      const c = CITIES[savedCity] || CITIES['petah_tikva'];
      lat = c.lat; lon = c.lon; locationName = `🏙️ ${c.name}`;
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
    <div style="font-size:11px;color:var(--muted);margin-top:8px">מחושב לכותל המערבי: 31.7767°N, 35.2345°E</div>
    <button onclick="initQibla()" style="margin-top:8px;padding:5px 12px;border-radius:8px;
      border:1px solid var(--border);background:transparent;color:var(--muted);
      cursor:pointer;font-size:11px">🔄 רענן מיקום</button>`;

  updateCompassUI();
  startCompassListener();
}

// Settings functions moved to settings.js

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
