# Kodesh App – Agent Memory File
**Last updated:** v5.115 (Sep 21, 2026)
**URL:** https://ohadsam.github.io/kodesh-app/
**Stack:** Vanilla JS PWA, GitHub Pages, RTL Hebrew, Sefaria API + Hebcal API
**Owner:** Ohad (Full Stack Team Lead, Petah Tikva)

---

## Deploy Checklist
Run `python3 release-checklist.py` first — it verifies steps 1-4 below automatically
(version consistency, AGENT.md currency, what's-new content, full test suite with
network-only failures downgraded to warnings, `node --check` on every js file) and
exits non-zero if anything blocking is wrong. Use `--verbose` to see passing checks too.

1. Bump `APP_VERSION` in **utils.js** AND **sw.js** (must match)
2. Update `?v=X.X` on ALL script tags in index.html
3. Update `גרסה X.X` in splash HTML in index.html
4. Update `var V = 'X.X'` in inline HEAD script (top of `<head>`)
5. Push → GitHub Pages auto-deploys
6. Hard reload on device OR press **"💥 איפוס מוחלט"** in settings

**Important:** The inline HEAD script is the ONLY version guard. Do NOT add another in utils.js — causes infinite reload loop.

**Note:** `release-checklist.py` cannot verify halachic accuracy or on-device UI/UX —
those still need human review (step 6 above + a real-device spot-check).

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

### Theme (dark / light) — styles.css, js/settings.js
- All colors are CSS custom properties on `:root` (styles.css) — `--bg`, `--surface`,
  `--card`, `--border`, `--gold`, `--gold-dim`, `--cream`, `--text`, `--muted`,
  `--accent`, `--red`, `--green`, `--addition*`. Light mode is a second value set
  under `:root[data-theme="light"]`, same warm gold/cream Judaica palette inverted,
  not a generic gray theme. Every light-mode text color was checked for WCAG AA
  contrast (≥4.5:1) against BOTH `--bg` and `--surface` with a standalone script
  before being chosen — see git history for the exact ratios if retuning it.
- **Applied in two places, deliberately:** an inline `<script>` at the very top of
  `<head>` in index.html (before `<link rel="stylesheet" href="styles.css">`) sets
  `data-theme="light"` on `<html>` synchronously from `localStorage.theme`, so the
  correct theme paints on the FIRST frame with no flash. `setTheme()` in
  `js/settings.js` is what actually changes it at runtime (toggle in settings),
  and re-persists to the same `localStorage` key. If you only wire up the settings
  button without touching the HEAD script, reloading will flash dark-then-light
  (or vice versa) for one frame every time.
- `styles.css` itself is only inline-`<link>`'d from index.html — there is no
  `js/styles.css`. Its `?v=` cache-buster (currently tracked separately in
  index.html) must be bumped on ANY styles.css change or the CDN/browser cache
  can serve the old stylesheet. `release-checklist.py` now checks this too.
- Almost the entire app (styles.css + all inline `style="..."` in index.html) uses
  `var(--x)`, so it reacts to the theme automatically. A handful of hardcoded hex
  colors were audited and left as-is deliberately: the compass SVG's decorative
  gradients/text (self-contained jewel/arrow graphics, theme-independent by
  design) and semantic status colors (success green, error/warning red) that are
  mid-saturation enough to read on both a very light and a very dark background.
  The PWA `<meta name="theme-color">` tag IS theme-reactive — both the HEAD script
  and `setTheme()` update its `content` to match.

### Parasha / Haftara
- **PARASHA_ALIYOT** – static table of all 54 parshiot
- **HAFTARA_REFS** – static table of 54 haftara refs (Ashkenaz Israel)
- Hebcal `leyning` primary; HAFTARA_REFS as fallback
- `_kickoffHaftara`: multi-chapter fallback

### Tehilim Favorites — js/tehilim.js
- Individual chapters or custom ranges, stored in `appState.tehilimFavorites`
  (persisted the same way as every other preference — `saveState()`). A range is
  expanded to a plain array of chapter numbers at save time, deliberately mirroring
  `TEHILIM_SCHEDULE[day]`'s own shape, so `getTehilimNavInfo` / `_tehilimDayChapterRow`
  (prev/next + the chip row) can drive BOTH the daily schedule and a favorite
  without duplicating that logic — see `tehilimContext` (`{type:'day'}` vs
  `{type:'favorite', id}`).
- Day-mode navigation is 100% unchanged by this feature — verified with a
  standalone Node harness that loads the real tehilim.js and asserts the
  wraparound-to-adjacent-day behavior is byte-identical to before.
- A favorite's first/last chapter has no prev/next (no day-style month-wraparound
  for a user-defined list — doesn't make sense the same way). `loadTehilim`'s
  button rendering was fixed to render nothing rather than a literal broken
  `null` button/onclick in that case — that fix was needed and is not optional
  boilerplate; removing it re-breaks favorites at their boundary chapters.
- `escapeHtml()` (js/utils.js) is applied to every favorite name interpolated into
  `innerHTML`. The delete confirmation deliberately takes only an `id` and looks
  the name up itself, rather than threading free-text through an `onclick="..."`
  attribute — that's a second, harder-to-escape injection context (attribute
  breakout) on top of plain `innerHTML` text, not worth it for a confirm-dialog
  label. Do not "simplify" this back to passing the name as a parameter.

### Tehilim Manual-Selection History — js/tehilim.js (v5.114)
- Picking a chapter from the `#tehilim-select` dropdown or via search
  (`searchTehilimChapter`) now enters a THIRD `tehilimContext` mode,
  `{type:'manual'}`, via the shared entry point `viewTehilimManual(chapter)`.
  Gets the same prev/next buttons and chip row as day/favorite mode (same
  `getTehilimNavInfo` / `_tehilimDayChapterRow` machinery), but prev/next is
  simple `chapter±1` (bounded 1..150) — there's no schedule/favorite list to
  derive "next" from for a one-off manual pick.
- `tehilimManualHistory`: every DISTINCT chapter visited this way, kept sorted
  ascending (a reading-progress view: "what have I already said", not a visit
  log). **Deliberately in-memory only — never written to `appState`/
  `localStorage`.** Scope is explicit per the feature request: persists across
  switching between day/favorite/manual navigation WITHIN a single stay on the
  Tehilim tab, but is wiped the moment the user leaves the tab (hook in
  `showTab()`, app.js — mirrors the existing "stop compass on leaving qibla
  tab" pattern), and naturally wiped by any full page reload anyway. Do not
  add persistence here without re-confirming that's actually wanted — the
  request was explicit that it should NOT survive a tab switch.
- The null-prevAction/nextAction button-rendering fix from the Favorites work
  above is what makes this safe at the chapter-1/chapter-150 boundaries too —
  same mechanism, same reason it's needed.

### Omer (omer.js)
- `getOmerDay()`: computed from Hebrew date
- Full text: לשם יחוד, ברכה, ספירה, הרחמן, למנצח, אנא בכח, יהי רצון, עלינו

### Special Zmanim (calendar.js)
- Erev Pesach: chametz times from Hebcal
- Fast days from Hebcal events API

---

## Known Issues / Open Items

### 🟡 Dead root-level duplicate .js/.css files (found Sep 21, 2026)
Every file that exists in `js/*.js` also has a same-named copy sitting at the repo
root (e.g. root `tefilot.js`, `content.js`, `styles.css`, plus `manifest.json`,
`reset.html`, `PROJECT_SUMMARY.md`). Confirmed: `index.html` only `<script src>`'s
from `js/*.js` — the root copies are unreferenced anywhere, out of sync with their
`js/` counterparts, and last touched at a much older commit (pre-`js/`-folder reorg).
STRUCTURE.md previously (incorrectly) instructed keeping root `tefilot.js` in sync —
that caused real wasted effort in an earlier session and has been corrected. Not
deleted here (out of scope for the task that found this) — a future session could
safely `git rm` the root-level duplicates after a final confirm-nothing-references-
them pass, but should NOT touch `manifest.json`/`reset.html` without checking those
specifically (didn't audit them as thoroughly as the `.js` files).

### 🟡 Rashi – exact-verse-coverage check not relaxed for chapter-end verses (v5.112)
`loadRashiForRef`'s Strategy 1/2 require the fetched response to cover exactly
up to the aliya's `endV`. If a chapter's true LAST verse legitimately has no
Rashi of its own (common — Rashi sometimes covers a closing verse inside the
previous verse's comment) AND the aliya's `endV` happens to BE that chapter's
actual last verse, this still needlessly discards good data and cascades into
slower strategies. A same-session fix for this was reverted after code review
found it couldn't distinguish "aliya ends at the true chapter boundary" from
"aliya ends mid-chapter" for single-chapter aliyot — `_torahChLengths` (which
could tell them apart) is only populated when Sefaria returns a multi-chapter
array-of-arrays response, never for a single-chapter aliya. A correct fix needs
either: (a) the real per-chapter verse count from a source available even for
single-chapter aliyot (e.g. compare against the NEXT aliya's start verse in
`PARASHA_ALIYOT`, threaded into `loadRashiForRef`), or (b) live verification
against Sefaria of whether its Rashi response is actually right-trimmed when a
trailing verse has no comment (unverified — Sefaria API calls are blocked in
this sandbox; see CLAUDE.md §1). The retry-skip fix from the same version
(`s1WorthRetrying`/`s2WorthRetrying`) already cuts the cost of hitting this
case substantially even though it isn't eliminated.

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

### v5.115 (Sep 21, 2026) – Post-release deep audit fixes (Tehilim + theme)
Three real, minor bugs found by 3 parallel independent code-review agents doing a
deep cross-feature regression audit of v5.113/v5.114 (requested explicitly: "no
regression, everything works as expected"), all fixed and re-verified:
- ✅ **State desync on a failed fetch during a mode switch.** `loadTehilim`'s
  `catch` block only showed an error message — it never refreshed the favorites
  sidebar/star. Repro: view a favorite, go offline, search for another chapter.
  `tehilimContext` correctly switches to `'manual'` internally, but the old
  favorite stayed highlighted and the star still reflected the old chapter until
  the next successful load, because `currentTehilimChapter` (set synchronously,
  before the fetch) had already moved on but nothing re-rendered. Now
  `renderTehilimFavoriteStar()`/`renderTehilimFavoritesList()` are also called
  from the `catch` block.
- ✅ **Theme toggle buttons had no `aria-pressed`.** `#theme-btn-dark`/
  `#theme-btn-light` are toggle buttons but only ever got a `.active` CSS class,
  giving screen-reader users no toggle-state feedback (unlike the Favorites ⭐
  star, which already did this correctly). Added `aria-pressed` in the HTML and
  kept it in sync in both `setTheme()` and `initThemeUI()`.
- ✅ **Favorite name length relied entirely on the HTML `maxlength="60"`.**
  `addTehilimFavorite`/`updateTehilimFavorite` are callable directly (e.g. from
  the browser console), bypassing the input's `maxlength`. Added
  `.slice(0, 60)` in both functions — defense in depth, not a live exploit
  (output was already `escapeHtml()`-safe either way).
- Confirmed clean by the same 3-agent audit, no fix needed: `currentTehilimChapter`
  staleness across manual→day→star was a false alarm (set synchronously before
  any `await`); editing an unrelated favorite while in manual mode correctly
  leaves the manual session alone; `tehilimManualHistory` can never accumulate an
  out-of-range/stale chapter (only ever written through the validated
  `viewTehilimManual` → `_recordManualVisit` path); no XSS path bypasses
  `escapeHtml()`; no RTL `margin-left`/`margin-right` regressions; all new UI
  (Favorites card, theme toggle, manual-mode chip row) is `var(--x)`-consistent
  from when it was first written, not retrofitted.

### v5.114 (Sep 21, 2026) – Tehilim manual-selection nav + reading-progress history
- ✅ Picking a chapter from the `#tehilim-select` dropdown or via search now gets
  the same prev/next navigation buttons day-mode and favorites already had, via
  a new `tehilimContext = {type:'manual'}` (third mode alongside `day`/`favorite`)
  and its shared entry point `viewTehilimManual(chapter)`. Unlike day/favorite
  mode, next/prev here is simple `chapter±1` bounded at 1/150 — there's no
  schedule or favorite list to derive "next" from for a one-off manual pick.
- ✅ Every distinct chapter visited this way is tracked in `tehilimManualHistory`
  and shown as a chip row above and below the content (reusing
  `_tehilimDayChapterRow`), current chapter highlighted — "מה כבר קראתי הפעם".
  Sorted ascending by chapter number (a reading-progress view), not click order.
- ✅ Scope, exactly as requested: in-memory only, never written to
  `appState`/`localStorage`. Survives switching between day/favorite/manual
  navigation while remaining on the Tehilim tab, but is cleared the instant the
  user leaves the tab (`resetTehilimManualHistory()`, hooked into `showTab()` in
  app.js — mirrors the existing "stop compass on leaving qibla tab" pattern) —
  and naturally cleared by any full app reload too. Verified with a Node
  harness that awaits the real (async) `loadTehilim` calls and asserts the
  history grows/dedupes/sorts correctly, survives an in-tab mode switch, and is
  wiped on the tab-away hook — not just read by eye.
- ✅ Reused the null-prevAction/nextAction button-rendering fix from the
  Favorites feature (v5.113) for the chapter-1/chapter-150 boundaries here too
  — same failure mode, same fix, no new bug class introduced.

### v5.113 (Sep 21, 2026) – release-checklist.py, Tehilim favorites, light/dark theme
- ✅ Added `release-checklist.py`: a single command that gates a merge to main —
  version consistency across all 8 places it must match (now including
  `styles.css`'s own `?v=`, previously frozen at `5.2` and never bumped — see
  below), AGENT.md currency, what's-new content, the full test suite (network
  failures auto-downgraded to warnings, `test_siddur_seasonal`/`test_omer`/
  `test_html_structure` required 100% clean per CLAUDE.md §10), and `node --check`
  on every `js/*.js` file. Exit code 1 = not ready. `--verbose` shows passing
  checks too.
- ✅ **Fixed 3 stale tests found while building the checklist** (all were failing
  before any change in this or the prior session — verified with `git stash`):
  - `test_html_structure.py`: required DOM ids were from a pre-refactor HTML layout
    (`main-content`, `tab-calendar` etc.) that no longer exists — the app now uses
    per-tab `#page-X` containers. Updated to the current ids.
  - `test_html_structure.py`: the whats-new-modal div-balance check anchored its
    start position on `id="whats-new-modal"` (inside the tag) but its end position
    included the tag's own closing `</div>` — an unconditional off-by-one that
    failed for every version's modal content, not a real markup bug. Anchored on
    the full `<div id="whats-new-modal"` instead.
  - `test_zmanim.py`: "calendar.js references Kotel coords" checked the wrong
    file — Kotel/Qibla coordinates are a compass concern (fixed Jerusalem target,
    `js/misc.js` since v5.110's compass rewrite) not a zmanim concern (user's own
    location, `js/calendar.js`). Moved the check to `js/misc.js`.
  - `test_business_logic.py`: asserted `is_winter('Nisan', 15) == True`,
    contradicting both the test's own `is_winter()` implementation
    (`Nisan >= 15 → False`) and the real app's `_isWinterSeason()` in
    `js/siddur-inserts.js:127` — both correctly treat Nisan 15 (Mussaf of the
    first day of Pesach) as the start of summer. The assertion was simply
    backwards; fixed and added the missing "Summer: Nisan 15" boundary case.
- 🟡 Found, not fixed (out of scope, flagged in Known Issues below): every
  root-level `.js`/`.css` file (e.g. root `tefilot.js`) is dead code from a
  pre-`js/`-folder layout — confirmed unreferenced by `index.html`. A stale
  STRUCTURE.md note that told future sessions to keep root `tefilot.js` in sync
  is corrected.
- ✅ **Tehilim favorites** (js/tehilim.js): save individual chapters (⭐ toggle
  next to the chapter title) or custom ranges (named, via the new "+ הוסף" form
  in a dedicated Favorites card). Viewing a favorite drives the SAME prev/next
  nav + chip-row UI the daily schedule already used — see `tehilimContext` in
  AGENT.md → Key Architecture → Tehilim Favorites. Edit/rename/delete supported;
  editing a range that no longer contains the chapter you're viewing, or
  deleting the favorite you're viewing, correctly drops back to day-mode instead
  of leaving stale navigation state (verified with a Node harness that loads the
  real tehilim.js, not just read by eye).
  - Found + fixed during this work: `loadTehilim`'s prev/next button rendering
    unconditionally interpolated `nav.prevAction`/`nextAction` into an
    `onclick="..."` string — harmless for day-mode (always had a wraparound
    fallback, never null) but produced a literal broken `onclick="...;null"`
    button at a favorite's first/last chapter, where there's deliberately no
    wraparound. Now renders nothing there instead.
  - Security: favorite names are free-text user input rendered via `innerHTML`.
    Added `escapeHtml()` (js/utils.js, reusable) and applied it everywhere a name
    is interpolated. The delete-confirmation button was changed to take only the
    favorite's `id` and look the name up itself, rather than threading raw text
    through a SECOND injection context (an `onclick="fn('...')"` attribute,
    where a `"` in the name would break out of the attribute — escaping for
    single quotes alone, which the first draft did, does not cover this).
- ✅ **Light/dark theme** (styles.css, js/settings.js): a `מצב תצוגה` toggle in
  Settings. All colors are CSS custom properties; light mode is a second value
  set under `:root[data-theme="light"]`, same warm gold/cream palette inverted.
  Every light-mode text color was verified for WCAG AA contrast (≥4.5:1) against
  both `--bg` and `--surface` with a standalone script before being chosen, not
  eyeballed. Applied in two places on purpose — an inline `<head>` script
  (before `styles.css` loads, avoiding a flash of the wrong theme) sets the
  attribute from `localStorage.theme` on first paint, and `setTheme()` handles
  the runtime toggle + persists to the same key. See AGENT.md → Key Architecture
  → Theme for why both are needed and what was deliberately left un-themed
  (compass SVG decorative colors, semantic status colors — reasoned through, not
  overlooked).


### v5.112 (Aug 3, 2026) – Parasha name matching, Rashi retry waste, Tehilim daily chip list
- ✅ **Fixed:** current parasha not found for multi-word single parshiot (כי תצא, לך
  לך, חיי שרה, אחרי מות, כי תשא, כי תבוא, וזאת הברכה). Root cause: Hebcal writes
  these with a HYPHEN ("כי-תצא"), identical in form to genuinely combined parshiot
  ("תזריע-מצורע"). `loadParasha()`'s matcher only tried the raw hyphenated string
  (fails — `ALL_PARASHIOT` uses spaces) then fell into the combined-parasha
  hyphen-SPLIT fallback, which cut "כי-תצא" into "כי" + "תצא" and fuzzy-matched
  each half separately — able to land on the wrong parasha (all of כי תשא/כי
  תצא/כי תבוא start with "כי") or nothing at all. Fixed by trying a
  space-normalized `cleanSpaced` form against `ALL_PARASHIOT` BEFORE the
  combined-split logic runs; verified against all 7 multi-word entries plus 3
  genuinely-combined parshiot with a standalone script (not just read by eye).
- ✅ **Fixed:** Strategy 3 in `loadRashiForRef` (the `commentary=1` fallback) used
  to set `success = true` unconditionally after running once, even when it found
  ZERO Rashi entries — a single bad/empty response was accepted as final with no
  retry. This is the likely cause of "Rashi completely missing despite existing"
  reported in Ki Teitzei. Now only accepts a zero-entry result once out of
  attempts (`chEntries > 0 || attempt === 2`); otherwise the outer attempt loop
  gets a real chance to retry.
- ✅ **Fixed:** the significant slowness loading Rashi on aliyot 3-4 (reported
  across multiple parshiot). Root cause: when Strategy 1 or 2 completed its fetch
  (HTTP ok) but judged the DATA structurally insufficient, the outer retry loop
  re-ran ALL strategies from scratch on the next attempt — repeating an identical,
  deterministic (non-transient) failure up to 3 times. Worst case: 3 attempts ×
  (S1 20s + S2 20s + S3 35s) ≈ 225s for one chapter before giving up. Added
  `s1WorthRetrying`/`s2WorthRetrying` flags, reset per chapter: a strategy that
  fails with an HTTP-ok-but-insufficient response is skipped on later attempts;
  only a genuine exception (network error/timeout) leaves it eligible for retry.
- 🟡 **Tried and reverted — see Known Issues below:** a same-session attempt to
  also relax the exact-verse-coverage check by 1 verse (to tolerate a chapter's
  last verse lacking its own Rashi, theorized for Ki Teitzei aliya 3 = Deut
  22:8-22:29, since ch. 22 has exactly 29 verses) was caught by code review and
  reverted before merge: the check only keys on `ch === endCh` (last chapter of
  the REQUESTED range), which is true for every single-chapter aliya, not just
  ones ending at a true chapter boundary. Most aliyot end MID-chapter (e.g.
  Ki Teitzei aliya 1 = Deut 21:10-21:21, but ch. 21 actually has 23 verses) —
  relaxing the check there would have silently accepted a response missing the
  aliya's own actual last verse. `_torahChLengths` (which could tell the two
  cases apart) is only populated for multi-chapter aliyot, so it can't gate this
  for the single-chapter case that needed it most. Left unfixed; see Known Issues.
- ✅ Added `_tehilimDayChapterRow()` / `_tehilimChipLabel()` in js/tehilim.js: a
  horizontally-scrollable chip row listing every chapter/range learned on the
  current Hebrew day (from `TEHILIM_SCHEDULE[nav.day]`), current chapter
  highlighted gold, near both the top and bottom prev/next buttons.

### v5.111 (Aug 3, 2026) – Motzei Shabbat prayer text correction
- ✅ Corrected the wording of `TEFILOT.motzash` (תפילה למוצאי שבת, ר' לוי יצחק
  מברדיטשוב) in **both** `js/tefilot.js` and root `tefilot.js` (kept in sync per
  STRUCTURE.md's documented dual-file convention — the root copy was found stale
  during review and would otherwise have silently diverged).
- ✅ Corrected text supplied verbatim by the app owner; reconstructed the array's
  line breaks and verified character-for-character equality against the supplied
  text before committing (script-verified, not eyeballed).
- ✅ Restored two diacritics present in the old text but dropped from the pasted
  correction (likely lost in copy/paste, not an intentional change): the sin/shin
  dot in `דִשְׁמַיָּא` and the dagesh in `חַיֵּי`. Wording otherwise unchanged from
  what was supplied.
- ✅ Added `// TODO: verify source` above `motzash.text` per CLAUDE.md §3 — this
  wording came directly from the app owner, not independently cross-checked
  against Sefaria/Chabad/a printed siddur.
- 🟡 **Known Issue added:** the exact wording of a few phrases (e.g. `מִכָּל רָע
  בִּתְהִלָּתֶךָ` vs the prior `מִכָּל רָע, לְמַעַן תְּהִלָּתֶךָ`; the added
  `לְהוֹדוֹת לְךָ` clause) has not been independently verified against a printed
  edition of this Berditchever text — flagging per the TODO above, not blocking.

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
