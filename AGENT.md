# Kodesh App – Agent Memory File
**Last updated:** v5.26 (April 9, 2026)
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

### Compass/Qibla — v5.26
- GPS spoofing detection: rejects if accuracy=0, >5000m, or lat/lon≈0
- Falls back to saved city on spoofed/unavailable GPS
- "🔄 רענון מיקום" button added to qibla info panel

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
