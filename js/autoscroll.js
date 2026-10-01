// ═══════════════════════════════════════════
// AUTO-SCROLL — גלילה אוטומטית
// ═══════════════════════════════════════════
// A ▶ button appears (bottom-left, above the bottom nav) whenever the current
// page is taller than the screen. Pressing it opens a compact toolbar —
// pause/resume, stop, slower/faster — and scrolls the window at a steady
// speed. Playback deliberately SURVIVES in-tab navigation (next aliya, next
// psalm, date-nav...): those loaders replace the content and jump to the top,
// which this module treats as "new section" (optional short pause, then keep
// going at the same speed). Switching TABS stops it.
// Settings (appState.autoScroll) are the defaults; speed changes made from
// the toolbar are session-only and are reset to the default by Settings.

const AUTOSCROLL_DEFAULTS = { speed: 3, keepAwake: true, pauseOnTouch: true, newSectionDelay: 2 };
const AUTOSCROLL_MIN_LEVEL = 1;
const AUTOSCROLL_MAX_LEVEL = 10;
const AUTOSCROLL_EXCLUDED_TABS = ['qibla'];   // compass screen: nothing to read
const AUTOSCROLL_MIN_OVERFLOW_PX = 80;        // page must overflow by this much for ▶ to show

let _asState = 'idle';          // 'idle' | 'playing' | 'paused' | 'ended'
let _asLevel = null;            // session speed level (null until first use → settings default)
let _asRaf = 0, _asLastTs = 0, _asAcc = 0, _asLastY = 0, _asDelayUntil = 0;
let _asWakeLock = null;

// ── Pure helpers ────────────────────────────────────────────────────────
function getAutoScrollSettings() {
  return { ...AUTOSCROLL_DEFAULTS, ...(appState.autoScroll || {}) };
}

function _asClampLevel(l) {
  l = Math.round(Number(l));
  if (!isFinite(l)) return AUTOSCROLL_DEFAULTS.speed;
  return Math.min(AUTOSCROLL_MAX_LEVEL, Math.max(AUTOSCROLL_MIN_LEVEL, l));
}

// level 1 → 16 px/s (slow, careful reading) … level 10 → 88 px/s
function autoScrollPxPerSec(level) { return 8 + _asClampLevel(level) * 8; }

function _asMaxScroll() {
  return document.documentElement.scrollHeight - window.innerHeight;
}

function _asEligible() {
  return !AUTOSCROLL_EXCLUDED_TABS.includes(currentTab) && _asMaxScroll() > AUTOSCROLL_MIN_OVERFLOW_PX;
}

function _asCurrentLevel() {
  if (_asLevel === null) _asLevel = _asClampLevel(getAutoScrollSettings().speed);
  return _asLevel;
}

// ── UI (built once, appended to <body>) ─────────────────────────────────
const _AS_SVG = {
  play:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  stop:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>',
  minus:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v2H6z"/></svg>',
  plus:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6h2v5h5v2h-5v5h-2v-5H6v-2h5z"/></svg>',
};

function _asEnsureUI() {
  if (document.getElementById('as-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'as-fab'; fab.type = 'button'; fab.className = 'as-fab';
  fab.setAttribute('aria-label', 'הפעל גלילה אוטומטית');
  fab.title = 'גלילה אוטומטית';
  fab.innerHTML = _AS_SVG.play;
  fab.addEventListener('click', autoScrollStart);
  document.body.appendChild(fab);

  const tb = document.createElement('div');
  tb.id = 'as-toolbar';
  tb.setAttribute('role', 'toolbar');
  tb.setAttribute('aria-label', 'גלילה אוטומטית');
  tb.innerHTML = `
    <button id="as-btn-toggle" type="button" class="as-btn as-btn-main"></button>
    <button id="as-btn-stop" type="button" class="as-btn" aria-label="עצור" title="עצור">${_AS_SVG.stop}</button>
    <div class="as-speed" dir="ltr">
      <button id="as-btn-slower" type="button" class="as-btn as-btn-sm" aria-label="האט" title="האט">${_AS_SVG.minus}</button>
      <span id="as-label" class="as-label" dir="rtl" aria-live="polite"></span>
      <button id="as-btn-faster" type="button" class="as-btn as-btn-sm" aria-label="הגבר מהירות" title="הגבר מהירות">${_AS_SVG.plus}</button>
    </div>`;
  document.body.appendChild(tb);
  document.getElementById('as-btn-toggle').addEventListener('click', autoScrollToggle);
  document.getElementById('as-btn-stop').addEventListener('click', autoScrollStop);
  document.getElementById('as-btn-slower').addEventListener('click', () => autoScrollChangeSpeed(-1));
  document.getElementById('as-btn-faster').addEventListener('click', () => autoScrollChangeSpeed(1));
}

function _asRenderUI() {
  const fab = document.getElementById('as-fab');
  const tb = document.getElementById('as-toolbar');
  if (!fab || !tb) return;
  const active = _asState !== 'idle';

  // tab-specific offset: siddur has its own 3 floating buttons stacked up the left edge
  fab.style.bottom = currentTab === 'siddur' ? 'calc(222px + env(safe-area-inset-bottom, 0px))' : '';
  fab.style.display = !active && _asEligible() ? 'flex' : 'none';
  tb.style.display = active ? 'flex' : 'none';
  if (!active) return;

  const toggle = document.getElementById('as-btn-toggle');
  const playing = _asState === 'playing';
  toggle.innerHTML = playing ? _AS_SVG.pause : _AS_SVG.play;
  toggle.setAttribute('aria-label', playing ? 'השהה' : (_asState === 'ended' ? 'התחל מההתחלה' : 'המשך'));
  toggle.title = toggle.getAttribute('aria-label');
  const level = _asCurrentLevel();
  document.getElementById('as-label').textContent =
    _asState === 'ended' ? 'הגעת לסוף' : `מהירות ${level}`;
  document.getElementById('as-btn-slower').disabled = level <= AUTOSCROLL_MIN_LEVEL;
  document.getElementById('as-btn-faster').disabled = level >= AUTOSCROLL_MAX_LEVEL;
}

// ── Wake lock (keep the screen on while actually scrolling) ─────────────
async function _asAcquireWake() {
  if (!getAutoScrollSettings().keepAwake || !('wakeLock' in navigator) || _asWakeLock) return;
  try {
    _asWakeLock = await navigator.wakeLock.request('screen');
    _asWakeLock.addEventListener('release', () => { _asWakeLock = null; });
  } catch (e) { _asWakeLock = null; /* denied / unsupported: harmless */ }
}
function _asReleaseWake() {
  if (_asWakeLock) { try { _asWakeLock.release(); } catch (e) {} _asWakeLock = null; }
}

// ── Playback loop ───────────────────────────────────────────────────────
function _asTick(ts) {
  if (_asState !== 'playing') return;
  if (!_asLastTs) _asLastTs = ts;
  const dt = Math.min(ts - _asLastTs, 100) / 1000;   // clamp: a backgrounded tab must not lurch
  _asLastTs = ts;

  // Content replaced under us (next aliya / date-nav): the app jumped to the top.
  const y = window.scrollY;
  if (y < _asLastY - 150) {
    _asDelayUntil = ts + getAutoScrollSettings().newSectionDelay * 1000;
    _asAcc = 0;
  }

  if (ts >= _asDelayUntil) {
    _asAcc += autoScrollPxPerSec(_asCurrentLevel()) * dt;
    const whole = Math.floor(_asAcc);          // fractional px/frame accumulate; scrollBy needs whole px
    if (whole >= 1) {
      _asAcc -= whole;
      window.scrollBy({ top: whole, behavior: 'instant' });
    }
  }
  _asLastY = window.scrollY;

  if (window.scrollY >= _asMaxScroll() - 1) { _asEnd(); return; }
  _asRaf = requestAnimationFrame(_asTick);
}

function _asBeginLoop(delayMs) {
  cancelAnimationFrame(_asRaf);
  _asLastTs = 0; _asAcc = 0; _asLastY = window.scrollY;
  _asDelayUntil = delayMs ? performance.now() + delayMs : 0;
  _asRaf = requestAnimationFrame(_asTick);
}

// Reached the bottom. Keep the session alive: if the content grows / is
// replaced (next aliya finishing its load), _asRefresh resumes automatically.
function _asEnd() {
  cancelAnimationFrame(_asRaf);
  _asState = 'ended';
  _asReleaseWake();
  _asRenderUI();
}

// ── Public controls ─────────────────────────────────────────────────────
function autoScrollStart() {
  _asEnsureUI();
  _asState = 'playing';
  _asAcquireWake();
  _asBeginLoop(0);
  _asRenderUI();
}

function autoScrollPause() {
  if (_asState !== 'playing') return;
  cancelAnimationFrame(_asRaf);
  _asState = 'paused';
  _asReleaseWake();
  _asRenderUI();
}

function autoScrollResume() {
  if (_asState === 'ended') {
    // finished and sitting at the bottom → "play" means start again from the top
    if (_asMaxScroll() - window.scrollY < 10) window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (_asState !== 'paused') return;
  _asState = 'playing';
  _asAcquireWake();
  _asBeginLoop(0);
  _asRenderUI();
}

function autoScrollToggle() {
  if (_asState === 'playing') autoScrollPause(); else autoScrollResume();
}

function autoScrollStop() {
  cancelAnimationFrame(_asRaf);
  _asState = 'idle';
  _asReleaseWake();
  _asRenderUI();
}

function autoScrollChangeSpeed(delta) {
  _asLevel = _asClampLevel(_asCurrentLevel() + delta);
  _asRenderUI();
}

// Called from showTab() (js/app.js): auto-scroll is per-tab, a tab switch ends it.
function autoScrollOnTabChange() {
  if (_asState !== 'idle') autoScrollStop();
  setTimeout(_asRefresh, 150);   // content of the new tab may still be loading
}

// ── Visibility / content-change tracking ────────────────────────────────
function _asRefresh() {
  _asEnsureUI();
  if (_asState === 'ended' && _asMaxScroll() - window.scrollY > 150) {
    // new content arrived below us after the end was hit → carry on, same speed
    _asState = 'playing';
    _asAcquireWake();
    _asBeginLoop(getAutoScrollSettings().newSectionDelay * 1000);
  }
  _asRenderUI();
}

function _asOnManualScroll(e) {
  if (_asState !== 'playing' || !getAutoScrollSettings().pauseOnTouch) return;
  if (e.target && e.target.closest && e.target.closest('#as-toolbar')) return;
  autoScrollPause();
}

function initAutoScroll() {
  _asEnsureUI();
  window.addEventListener('wheel', _asOnManualScroll, { passive: true });
  window.addEventListener('touchmove', _asOnManualScroll, { passive: true });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _asState !== 'idle') { autoScrollStop(); return; }
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) _asOnManualScroll(e);
  });
  window.addEventListener('resize', _asRefresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _asState === 'playing') _asAcquireWake();   // lock is dropped when the tab hides
  });
  if ('ResizeObserver' in window) new ResizeObserver(_asRefresh).observe(document.body);
  _asRefresh();
}

// ── Settings panel ──────────────────────────────────────────────────────
function initAutoScrollSettingsUI() {
  const s = getAutoScrollSettings();
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('as-set-speed',  el => { el.value = _asClampLevel(s.speed); });
  set('as-set-speed-val', el => { el.textContent = _asClampLevel(s.speed); });
  set('as-set-delay',  el => { el.value = String(s.newSectionDelay); });
  set('as-set-touch',  el => { el.checked = !!s.pauseOnTouch; });
  set('as-set-awake',  el => { el.checked = !!s.keepAwake; });
}

function setAutoScrollSetting(key, value) {
  if (!(key in AUTOSCROLL_DEFAULTS)) return;
  const next = { ...(appState.autoScroll || {}) };
  if (key === 'speed') next.speed = _asClampLevel(value);
  else if (key === 'newSectionDelay') next.newSectionDelay = Math.max(0, Math.min(10, Number(value) || 0));
  else next[key] = !!value;
  appState.autoScroll = next;
  saveState();
  // changing the default speed in Settings is meant to be felt right away
  if (key === 'speed') { _asLevel = next.speed; _asRenderUI(); }
  if (key === 'keepAwake' && !next.keepAwake) _asReleaseWake();
  initAutoScrollSettingsUI();
}

function resetAutoScrollSettings() {
  delete appState.autoScroll;
  saveState();
  _asLevel = AUTOSCROLL_DEFAULTS.speed;
  _asRenderUI();
  initAutoScrollSettingsUI();
}
