# Kodesh App – Agent Memory File
**Last updated:** v5.110 (Jun 24, 2026)
**URL:** https://ohadsam.github.io/kodesh-app/
**Stack:** Vanilla JS PWA, GitHub Pages, RTL Hebrew, Sefaria API + Hebcal API
**Owner:** Ohad (Full Stack Team Lead, Petah Tikva)

---

## Deploy Checklist
1. Bump `APP_VERSION` in **utils.js** AND **sw.js** (must match)
2. Update `?v=X.X` on ALL script tags in index.html
3. Update `גרסה X.X` in splash HTML in index.html
4. Update `var V = 'X.X'` in inline HEAD script (top of `<head>`)
5. Push → GitHub Pages auto-deploys
6. Hard reload on device OR press **"💥 איפוס מוחלט"** in settings

**Important:** The inline HEAD script is the ONLY version guard. Do NOT add another in utils.js — causes infinite reload loop.

---

## Supporting Files
- **CLAUDE.md** – Agent instructions (read every session): API rules, code standards, test requirements
- **STRUCTURE.md** – Full code map: file layout, key functions, HTML IDs, API endpoints, all BRACHOT/TEFILOT keys
- Consult STRUCTURE.md before scanning source files to save tokens.

---

## File Structure
```
js/
  network-log.js  – Patches fetch(), 10-min log retention
  utils.js        – APP_VERSION, state, dates, buildParagraphs, cleanSefariaHtml, logs
  settings.js     – ALL_TABS, tab visibility, reminders (including omer), nuclearReset
  app.js          – showTab, loadTab, changeDay, loadHebrewDate, initTabScrollSync
  tehilim.js      – initTehilim, loadTehilim, scrollTehilimTop,
                    hebrewToNumber, parseTehilimSearch, searchTehilimChapter,
                    TEHILIM_SCHEDULE, CHAPTER_TO_DAY, getTehilimNavInfo
  calendar.js     – loadCalendar, loadZmanim (chametz times), loadEvents (fast times), setCity
  content.js      – loadParasha, loadAliyaText (scrolls to top on aliya change),
                    _kickoffHaftara, loadSpecificParasha,
                    PARASHA_ALIYOT (54 static), HAFTARA_REFS (54 static haftara refs),
                    loadDafYomi, switchDafView (rashi inline),
                    loadMishnaYomi, switchMishnaView (bartenura inline),
                    loadRambamYomi, switchRambamView (steinsaltz INLINE per halacha)
  tefilot.js      – initTefilot, showTefila, TEFILOT static texts
  siddur-inserts.js – wrapSeasonalParagraphs() – multi-paragraph aware green/red blocks
                    SEASONAL_DEFS with multiPara support for על הנסים, יעלה ויבוא
  siddur.js       – getSiddurSections, loadSiddur, _renderParagraphs, _fetchSectionHtml,
                    AL_HANISSIM_CHANUKA, AL_HANISSIM_PURIM, CHATZI_KADDISH static texts,
                    openSiddurStatusPopup/closeSiddurStatusPopup (new in v5.26),
                    initSiddurFloatBtn (3 buttons: top/sections/status)
  omer.js         – buildOmerText, getOmerDay, getOmerDayForDisplay, showOmerNow
  brachot.js      – BRACHOT data (includes tefila_haderech), showBracha, loadBrachot
  misc.js         – updateDoneButton, toggleDone, Qibla/compass (GPS spoof detection)
  init.js         – init(), error handlers
```

---

## Key Architecture

### Siddur Text Pipeline
1. Sefaria → `data.he[]` array, one verse per element
2. `heFlat()` flattens nested arrays
3. `cleanSefariaHtml()`: seasonal `<small>` → `\uE001text\uE001` markers
4. `buildParagraphs()`:
   - 60+ BREAK_BEFORE patterns
   - Sof-pasuk flush: `U+05C3` → `:` triggers paragraph break
   - BRACHA_END flush: `ברוך אתה יי`
   - MAX_WORDS_PER_PARA = 45
5. `_renderParagraphs(pars, isAdd)` → HTML string
6. `wrapSeasonalParagraphs(html)` post-processes — multi-paragraph aware
7. HTML injected into `sc-${id}` placeholders

### Siddur Seasonal Wrapping (siddur-inserts.js) — v5.26
- Each SEASONAL_DEF has: `label`, `starts` (regex on first para), `show()` condition
- New: `multiPara:true` + `ends` regex to capture multi-paragraph blocks
- Covers: מוריד הטל, משיב הרוח, ותן ברכה, ותן טל, יעלה ויבוא (multi), על הנסים (multi), עשי"ת inserts
- **יעלה ויבוא is NO LONGER a separate section** — only shown inline via wrapSeasonalParagraphs

### Siddur Conditional Sections
- **על הנסים** – Chanuka / Purim (static texts + inline via wrapSeasonalParagraphs)
- **הלל** – R"C, Chanuka, Chol HaMoed
- **מוסף ר"ח** – Rosh Chodesh only
- **מוסף לחול המועד** – condition:`isCholHamoed` (NOT isShaloshRegalim — fixed v5.26)
- **ספירת העומר** – Nisan 16 – Sivan 5 (arvit only)
- **תחנון** – hidden on many days

### Siddur Floating Buttons (3 total)
- `siddur-float-btn` (bottom 76px) — scroll to top ☰
- `siddur-sec-btn` (bottom 122px) — sections popup ≡
- `siddur-status-btn` (bottom 168px) — NEW: prayer status popup 📋

### Tehilim — v5.26
- `scrollTehilimTop()` — uses `window.scrollTo({top:0})` + page.scrollTop=0
- Called automatically at end of `loadTehilim()` render
- `wrapAction` in nav buttons also calls scrollTehilimTop
- **Search**: `hebrewToNumber()` converts Hebrew letters to gematria value
- `parseTehilimSearch(query)`: supports plain numbers AND Hebrew gematria (קל=130)
- Search input in HTML with Enter key support

### Parasha/Torah — v5.26
- `loadAliyaText()` scrolls to top on each aliya change

### Rambam Steinsaltz — v5.26
- `switchRambamView('steinsaltz')` now shows commentary INLINE per halacha
- Format: halacha text → green block with 📚 שטיינזלץ label below it
- Same pattern as Rashi in Daf Yomi

### Compass/Qibla — v5.110 (js/misc.js)
Points at the Kotel (31.77668°N, 35.23444°E). Two independent angles are combined:
1. **Qibla bearing** — `calcBearing(lat, lon, JERUSALEM_LAT, JERUSALEM_LON)`, a TRUE
   geographic bearing. **Takes RADIANS** (the Jerusalem constants are pre-converted;
   the call site converts the user's lat/lon). Petah Tikva → Kotel ≈ 136.1° (ד-מזרח).
2. **Device heading** — azimuth the top of the screen points at.

Heading sources, best first (`_acceptHeadingSource` keeps the best live one; a source
that goes quiet for `HSRC_STALE_MS` = 3 s yields to a lower-ranked one):

| Rank | Source | Reference | Declination |
|---|---|---|---|
| BEST | iOS `webkitCompassHeading` | true north (CoreLocation) | none |
| BEST | `AbsoluteOrientationSensor` quaternion | magnetic | +4.5° |
| ABSOLUTE | `deviceorientationabsolute` | magnetic | +4.5° |
| RELATIVE | `deviceorientation` (`absolute:false`) | arbitrary zero, drifts | none |

- `_headingFromEuler(a,b,g,screenAngle)` / `_headingFromQuaternion(q,screenAngle)` both
  build R (device→ENU), rotate the screen-up axis `(sin s, cos s, 0)`, and return
  `atan2(east, north)`. They agree to 1e-9. Reject when the horizontal projection is
  below `HEADING_MIN_PROJ` (phone edge-on ⇒ azimuth is noise).
- **Rendering:** `#compass-outer` gets `rotate(-heading)` (ring + cardinal letters),
  `#compass-arrows` gets `rotate(qibla - heading)`. They are SIBLINGS in index.html —
  do not nest them or the rotation applies twice.
- **Turn guidance:** CSS `rotate()` is CLOCKWISE, so `normDiff > 0` ⇒ Kotel is to the
  RIGHT ⇒ ימינה. (This was inverted before v5.110 and was the actual reported bug.)
- GPS spoofing detection: rejects accuracy=0, >5000 m, or lat/lon≈0; falls back to the
  saved city. "🔄 רענון מיקום" button in the qibla info panel.

### Tab Scroll Sync — v5.26
- `initTabScrollSync()` restored with proportional scroll sync
- Uses `_syncLock` flag + `requestAnimationFrame` to prevent bounce loops

### Parasha / Haftara
- **PARASHA_ALIYOT** – static table of all 54 parshiot
- **HAFTARA_REFS** – static table of 54 haftara refs (Ashkenaz Israel)
- Hebcal `leyning` primary; HAFTARA_REFS as fallback
- `_kickoffHaftara`: multi-chapter fallback

### Omer (omer.js)
- `getOmerDay()`: computed from Hebrew date
- Full text: לשם יחוד, ברכה, ספירה, הרחמן, למנצח, אנא בכח, יהי רצון, עלינו

### Special Zmanim (calendar.js)
- Erev Pesach: chametz times from Hebcal
- Fast days from Hebcal events API

---

## Known Issues / Open Items

### 🟡 Compass – iOS declination reference unverified (v5.110)
`MAGNETIC_DECLINATION` (+4.5°E) is added to Android sources but NOT to iOS
`webkitCompassHeading`, on the basis that WebKit surfaces `CLHeading.trueHeading`
when Location Services are authorised (this app requests GPS on init). Not verified
on a physical iPhone. If iOS turns out to report `magneticHeading`, the iOS branch in
`startCompassListener` needs `+ MAGNETIC_DECLINATION` restored. Worst case is a 4.5°
error — inside the ±8° "facing Jerusalem" tolerance, so it cannot by itself make the
compass look wrong.

### 🟡 Compass – GPS Spoofing (partial fix in v5.26)
GPS spoofing detection added, but if device returns plausible fake coords
the compass will still show wrong direction. User can press "רענון מיקום"
or change city in settings as workaround.

### 🟡 Siddur – wrapSeasonalParagraphs multiPara
The `ends` regex for יעלה ויבוא / על הנסים must match the last paragraph exactly.
If Sefaria changes text, adjust `ends` regex in siddur-inserts.js SEASONAL_DEFS.

### 🟡 Push Notifications for Omer
Requires Firebase Cloud Messaging backend. Not yet implemented.
Web Push API needs a service worker with VAPID keys + server.

### 🟡 Birkat HaMazon – Sefaria ref fragility
Multi-ref fallback. If Sefaria changes API, may need new refs.

### 🟡 Winter/Summer Season Detection
Uses Hebrew calendar months (correct), but Shmini Atzeret/Pesach exact dates
could be more precise for edge cases.

---

## Recently Fixed

### v5.26 (April 9, 2026)
- ✅ Tab scroll sync restored (proportional sync, lock prevents bounce)
- ✅ Auto-scroll to top on Tehilim chapter change (window.scrollTo)
- ✅ Auto-scroll to top on Parasha aliya change
- ✅ Rambam Steinsaltz: now inline per halacha (like Rashi in Daf)
- ✅ יעלה ויבוא removed as separate section (was duplicated outside Amida)
- ✅ על הנסים: multi-paragraph wrapping fixed in wrapSeasonalParagraphs
- ✅ מוריד הטל / משיב הרוח: displayed with green/red (never deleted)
- ✅ ברכת השנים: same fix via multiPara-aware wrapping
- ✅ מוסף לחול המועד: condition changed to isCholHamoed (stops after Pesach)
- ✅ GPS compass: spoofing detection + refresh button
- ✅ תפילת הדרך added to Brachot tab (with תהילים קכא)
- ✅ Siddur: 3rd floating button 📋 shows prayer status popup
- ✅ Tehilim search: gematria support (פרק קל, כג, 130 etc.)

### v5.110 (Aug 3, 2026) – Qibla compass
- ✅ **Root cause of "compass points the wrong way": the turn guidance was inverted.**
  CSS `rotate()` is clockwise for positive angles, so `normDiff > 0` means the Kotel is
  to the RIGHT — but the label said `שמאלה` (left). The arrow was correct all along;
  the text contradicted it. `updateCompassUI` now says ימינה/שמאלה to match the arrow.
- ✅ Heading is now computed from the full W3C rotation matrix (`_headingFromEuler`)
  instead of the `360 - alpha` shortcut. Identical when flat (verified numerically),
  but correct when `cos(beta) < 0` — the old formula was 180° off with the screen
  facing down. Near-vertical attitudes are now rejected (`HEADING_MIN_PROJ`) instead
  of returning noise.
- ✅ `AbsoluteOrientationSensor` path actually created. `window._aoSensor` was only ever
  *stopped* — nothing constructed it, so the preferred Android path was dead code.
  Includes a frozen-quaternion detector (a known Chrome failure) that hands back to
  `deviceorientation*`. `_headingFromQuaternion` agrees with `_headingFromEuler` to 1e-9
  across 360 attitudes.
- ✅ Relative-orientation fallback un-broken: it computed a heading then `return`ed
  before assigning it, so devices with no absolute sensor showed a permanently frozen
  arrow. Heading-source ranking (`_acceptHeadingSource`) keeps the best live source and
  resets smoothing on a source switch so readings with different zero references are
  never blended.
- ✅ Magnetic declination (+4.5°E) applied consistently: added to magnetic-referenced
  Android sources, NOT to iOS `webkitCompassHeading` (CoreLocation already returns true
  north with Location Services on), never to relative readings (no magnetic zero).
- ✅ Devices with no orientation sensor at all now get an explicit Hebrew message and a
  dimmed arrow after a 4 s watchdog, instead of an arrow frozen at screen-up sitting
  next to a confident bearing.
- ✅ Circular (unit-vector) smoothing so the needle does not jitter or glitch at 359°→0°.
- ✅ Tilt warning now uses true tilt-from-flat (`deviceTilt`), computed on both the Euler
  and quaternion paths; previously the sensor path never updated it.

### v5.109 (Jun 24, 2026)
- ✅ Rashi: fixed verse mis-alignment in multi-chapter aliyot (e.g., Balak aliya 6, Numbers 23:27-24:13 showed Rashi 2 verses too early)
- ✅ Root cause: `chapterLengths[ch]` (from Rashi endpoint) was inflated, causing phantom iterations before ch advance; now `_torahChLengths` (from Torah text's nested `data.he`) is used as authoritative source
- ✅ `_computeVerseNums`: now uses `_torahChLengths` for correct chapter boundary detection even before Rashi loads (chapter headers in text view)
- ✅ Race condition fix: stale-aliya check moved to BEFORE `_aliyaVerseNums` overwrite in `loadRashiForRef` — prevents corrupting newly loaded aliya's chapter display when user switches while Rashi is fetching

### v5.108 (May 27, 2026)
- ✅ Rashi: restored `actualVerseStart` from `data2.sections` in Strategy 2 — Sefaria may return from ch:1 even for mid-chapter range queries
- ✅ Rashi: removed `chEnd` (=60) from `Math.max` for `chapterLengths[ch]` in Strategy 2 — inflated chapter length caused mapping loop mis-alignment
- ✅ Fixes missing Rashi mid-aliya in multi-chapter aliyot (e.g., Beha'alotcha aliyot 5 and 6)

### v5.99 (May 10, 2026)
- ✅ תפילת הדרך לטיסה added to Brachot tab (key: `tefila_haderech`), activates pre-existing `bb-tefila_haderech` button
- ✅ Floating nav for Brachot picks up new prayer automatically (built from Object.keys(BRACHOT))
- ✅ CLAUDE.md created: agent instructions for every session (API checks, orthodox standards, test requirements)
- ✅ STRUCTURE.md created: full code map, entry points, all keys – use before scanning files
- ✅ .gitignore added: excludes Python __pycache__ from Tests/

### v5.27 (April 9, 2026) – Fixes
- ✅ Siddur seasonal: RED strikethrough for wrong-season blocks
- ✅ Rambam Steinsaltz: per-halacha inline, raw array indexing (no heFlat drift)
- ✅ Compass: uncalibrated sensor detection, figure-8 instruction, iOS declination 4.5°
- ✅ Tehilim scroll: scrolls to #tehilim-num-title (chapter title)
- ✅ Brachot TTS: readBrachaAloud() via Web Speech API, stop/resume toggle

### v5.25 (prior)
- ✅ Various fixes (see previous AGENT.md)

---

## Pending / Future Work
- Push notifications for omer (Firebase Cloud Messaging)
- Shabbat-specific siddur (Kabbalat Shabbat, Musaf Shabbat)
- Half-Hallel for Rosh Chodesh
- Font size slider
- Offline improvements
- Selichot for fast days

---

## v5.27 (April 9, 2026) – Fixes

### Siddur – seasonal text
- `_renderParagraphs` now shows RED strikethrough for wrong-season \uE002 blocks instead of deleting them
- Helper `_shouldShowSeasonalLabel(label)` centralizes all season/calendar logic
- מוריד הטל, משיב הרוח, ותן ברכה, ותן טל ומטר — always visible (green ✅ or red ❌)
- על הנסים (חנוכה/פורים labels), יעלה ויבוא — same treatment
- Status banner now includes tachanun reason (ר"ח, חנוכה, ניסן, etc.)

### Rambam Steinsaltz alignment
- `switchRambamView('steinsaltz')` now uses `rawArr.map()` per-halacha instead of `heFlat()`
- Each entry in Sefaria's he array corresponds to one halacha — paragraphs joined with space
- Eliminates index drift when one halacha has multiple Steinsaltz paragraphs

### Tehilim scroll
- `scrollTehilimTop()` scrolls to `#tehilim-num-title` (chapter title) not page top

### Brachot
- תפילת הדרך updated with 3× repeated verses after prayer
- `readBrachaAloud()` added: Web Speech API TTS with he-IL voice
- `#bracha-tts-wrap` div added in index.html; button shown if speechSynthesis available
- Stop/resume toggle on same button

### Compass calibration detection
- `_alphaHistory[]` tracks last 60 alpha samples
- `_checkSensorCalibration(alpha)`: if range < 15° → shows `#qibla-calibration` warning
- Warning includes figure-8 calibration instruction + sensor range display
- `#qibla-raw-alpha` shows live α and range for debugging
- iOS declination corrected to 4.5° (was 5°)
- Relative orientation fallback added (when absolute=false, used only if no absolute ever received)

### Key learnings
- Android `deviceorientationabsolute` can return `e.absolute=true` but still be uncalibrated
- Uncalibrated: alpha range < 15° during full rotation (should be ~360°)
- Fix: user must do figure-8 motion with phone to calibrate magnetometer
- `heFlat()` on Steinsaltz commentary arrays causes index misalignment — use raw array indexing
