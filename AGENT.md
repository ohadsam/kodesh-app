# Kodesh App – Agent Memory File
**Last updated:** v5.132 (Oct 9, 2026)
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
  colors are left as-is deliberately: the compass SVG's decorative gradients/text
  (self-contained jewel/arrow graphics, theme-independent by design) and semantic
  status colors (success green, error/warning red) that are mid-saturation enough
  to read on both a very light and a very dark background.
  The PWA `<meta name="theme-color">` tag IS theme-reactive — both the HEAD script
  and `setTheme()` update its `content` to match.
- **`#topbar` and `#bottom-nav` were NOT actually theme-reactive until v5.125** —
  both had their `background` hardcoded as `rgba(14,9,5,...)` (this theme's own
  `--bg`, spelled out as a literal rgba instead of `var(--bg)`), so they stayed
  black in light mode while every button/icon/text inside them correctly switched
  colors — an owner-reported bug, not something caught by the original v5.113
  theme audit. Every OTHER themed surface in the app (`#tabs`, `.card`, modals)
  already used `var(--surface)`/`var(--card)` correctly; these two were the only
  holdouts, and the only reason is that both need a semi-transparent color (for
  the `backdrop-filter: blur()` frosted-glass effect) rather than a fully opaque
  one, so whoever wrote them reached for a literal `rgba(...)` instead of a CSS
  variable and never revisited it for the theme feature. Fixed via two new
  variables, `--nav-bg`/`--nav-bg-fade` (same rgb as `--bg`, kept at their
  original alpha), defined per-theme exactly like `--addition-bg` already is.
  Verified in an actual headless-Chromium render (not just static CSS reading):
  computed `background-image`/`background-color` on both elements now resolves
  to the light rgba in light mode and the dark rgba in dark mode, and EVERY tab
  button's computed text color (all 17 tabs, both `#tabs` and `#bottom-nav`, both
  themes — 68 checks total) was contrast-checked against that resolved
  background, all passing (light theme actually improved to full AA 4.5:1+;
  dark theme's inactive-tab contrast is unchanged at its pre-existing 4.40,
  large-text-only — not a regression, not touched by this fix).

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

### Collapsible Sections — js/utils.js (v5.118)
- Generic, reusable anywhere in the app — not Tehilim-specific, currently used
  by the Tehilim day-selector and Favorites cards. Markup contract: a real
  `<button id="{id}-header" class="card-title collapsible-header"
  onclick="toggleCollapsibleSection('{id}')" aria-expanded="true"
  aria-controls="{id}-body">` plus a `<div id="{id}-body">` wrapping the
  collapsible content. A real `<button>`, not a div+onclick, so it stays
  keyboard-focusable; the chevron rotates purely via CSS
  (`[aria-expanded="false"] .collapsible-chevron`) — no JS needed to flip it.
- State persists to `appState.collapsedSections[id]`, only storing `true`
  (default is expanded, so a user who never collapses anything gets no new
  key). Call `applyCollapsedSection(id)` once after the section's markup
  exists in the DOM (e.g. from the tab's init function) to restore it.
- If you add a collapsible header inside a `.card-header` that already has a
  sibling button (like Favorites' "+ הוסף"), you need the scoped
  `.card-header .collapsible-header { width:auto; flex:1 1 auto; min-width:0 }`
  override in styles.css — the base rule is `width:100%`, correct for a
  header alone in a card but it pushes a flex-sibling off the row otherwise.

### Reminder System — js/settings.js (+ favorite reminders, v5.118)
- Two kinds of reminder-eligible item now feed the same pipeline: the static
  `REMINDER_ITEMS` (omer, halacha, tehilim, lashon, daf, mishna, rambam,
  parasha — settings stored in `appState.reminders[key]`) and, since v5.118,
  one per Tehilim favorite that has `fav.reminder.enabled` (settings stored
  ON the favorite itself, `fav.reminder = {enabled, time, recurring}`, so
  deleting the favorite drops its reminder with no separate cleanup).
  `_allReminderItems()` merges both; `_reminderSettingsFor(item)` reads the
  right place. Every existing consumer (`_getPendingReminders`,
  `_updateNotifBadge`, `_buildReminderList`, `openReminderModal`) iterates
  `_allReminderItems()` now instead of the raw const — do not add a favorite-
  specific parallel code path, extend this one.
- **The OS `Notification` + `setTimeout` path (`scheduleReminder`/
  `scheduleTehilimFavoriteReminder`) is best-effort only** — it only fires if
  the browser tab happens to stay open past the target time, and is NEVER
  re-armed on reload (nothing outside settings.js calls `scheduleReminder`,
  and no init hook re-arms it). **The reliable mechanism for every reminder,
  static or favorite, is `checkRemindersOnOpen()`**, called on every app
  init, which re-evaluates pending reminders fresh against the current time
  and `appState._remindersDone[today]` (which auto-resets daily). Don't let a
  future "fix" for a missed OS notification try to make the `setTimeout` path
  itself more reliable — the fix belongs in the pending-reminder check.
- Recurring vs one-time: a recurring favorite reminder behaves exactly like
  an existing `daily:true` item — it naturally resurfaces via the daily
  `_remindersDone` reset, no new logic needed. A one-time favorite needed
  `_autoDisableIfOneTime(item)`, hooked into `toggleReminderDone` and
  `markAllRemindersDone`, since nothing in the static item set ever
  auto-disables itself.

### Prayer Names — js/prayer-names.js (v5.119)
- A single list, `appState.prayerNames`, shared verbatim between the
  Tehilim and Mishna tabs — there is exactly one collection of names, not
  one per tab. Each tab has its OWN collapsible section (`{loc}-section`
  ids, own collapse state) and its OWN list container in the DOM
  (`prayer-names-list-{loc}`), but `renderAllPrayerNames()` always redraws
  every location together, so the two tabs never show different content.
  If a future change adds a THIRD location, add it to
  `PRAYER_NAMES_LOCATIONS` and mirror the two existing collapsible-card
  blocks in `index.html` — nothing else in `js/prayer-names.js` needs to
  change.
- The add/edit form is ONE modal (`#prayer-names-modal`), opened from
  either tab's "+ הוסף" button. This was a deliberate choice over Tehilim
  favorites' inline-form pattern: an inline form would need a second,
  fully-duplicated copy of every field id per tab (favorites don't have
  this problem — they only appear on the Tehilim tab).
- Gender (בן/בת) and type (לרפואה שלמה/לעילוי נשמה) are 2-button toggles,
  not `<select>`/radio, matching the app's existing toggle-button
  convention (e.g. Mishna's own מצב יומי/בחר). Because they're plain
  buttons, not radio inputs, there is no native `.checked` to read on
  save — `_setPrayerNameGender`/`_setPrayerNameType` track the current
  choice in module-level `_prayerNameFormGender`/`_prayerNameFormType`,
  reset explicitly every time the modal opens for a NEW entry (defaults:
  son / health) or populated from the entry being edited.
- No reminder integration here (unlike Tehilim favorites, v5.118) — not
  requested, and "say this today" doesn't map to a recurring/one-time
  schedule the way "read this psalm" does. If ever requested, follow the
  `_allReminderItems()`/`_reminderSettingsFor()` pattern in js/settings.js
  rather than inventing a second reminder pipeline.

### חג הסוכות (נטילת לולב + Ushpizin) — js/brachot.js
Both live under one "חג הסוכות" category in `#bracha-buttons`, grouped
together at the owner's request (`lulav` moved here from `js/tefilot.js` in
v5.124 specifically so both Sukkot items sit in the same place).

#### נטילת לולב (v5.120, moved from Tefilot to Brachot v5.124)
- Uses the plain `shared` shape like most other BRACHOT entries (no
  day-detection — unlike Ushpizin below, there's no "which day" question
  for this one). Content unchanged by the move.
- The move required converting tefilot.js-specific conventions to
  brachot.js's simpler renderer: `showTefila()` (js/tefilot.js) auto-styles
  a line starting with `【...】` as a gold header and wraps every default
  line in a `<div>`; `_renderBrachaLines()` (js/brachot.js) does neither —
  it wraps every line in `<p>...</p>` and has no `【】` handling at all.
  Both the two section headers and the two shaking-direction opinion blocks
  (previously raw `<div>`, valid inside tefilot.js's own `<div>` wrapper)
  were rewritten as explicit `<span style="display:block/flex">` — the
  same fix already needed twice for Ushpizin's own headers/banner (v5.121,
  v5.123), applied here proactively during the move instead of
  reproducing the bug a third time.
- Verified numerically: a Node `vm` harness loading the real `js/tefilot.js`
  + `js/brachot.js` together — confirms `TEFILOT.lulav` no longer exists,
  `BRACHOT.lulav` renders every piece of text (both יהי רצון texts, both
  ברכות, both shaking-direction opinions) in the same order as before the
  move, the `【〜】` markers never leak into the rendered HTML as literal
  text, and no `<div>` ends up nested inside a `<p>`.

#### Ushpizin (v5.121, day-auto-detection added v5.123)
- Data shape is deliberately NOT the generic `shared`/`nusach` every other
  BRACHOT entry uses: `intro[]` (entrance prayer + daily אזמין formula,
  always shown) + `nights[]` (7 × `{label, text}`) + `afterText` (leaving-
  the-sukkah texts, always shown regardless of mode). `showBracha` special-
  cases `key === 'ushpizin'` to call `_buildUshpizinLines(b)` instead of
  reading `b.shared` directly — everything else about `showBracha` (title/
  source/TTS/afterText rendering) is untouched and shared normally.
- `getUshpizinNightForDisplay()` returns 1–7 or `null`, mirroring
  `getOmerDayForDisplay()` (js/omer.js) exactly in spirit: Hebcal's g2h
  converter returns the DAYTIME Hebrew date for a Gregorian day; after that
  day's tzeit (sunset+18min, the ישיבה.org standard used throughout this
  app), the Hebrew day has already advanced — so Tishrei 15 in the evening
  is really the night of Tishrei 16 (Ushpizin #2), per the owner's own
  explicit example. Uses `getTargetDate()` (currentOffset-aware), not a bare
  `new Date()`, so it responds to the date-nav, not always literal "today".
  **Shares the exact same `appState._lastZmanim` staleness caveat the Omer
  feature already has** (sunset only refreshes when the calendar tab loads,
  not on every date-nav step) — not fixed here, matching existing precedent,
  not a new bug introduced by this feature.
- Auto-mode shows ONLY the detected night; a toggle button always offers the
  opposite view (📜 "show all 7" when one night is auto-shown; 🔎 "show only
  today" when all 7 are shown AND there IS a valid today-night to return
  to). When the date is outside Tishrei 15–21 entirely, all 7 nights show
  unconditionally and no misleading "show only today" button appears (there
  is nothing to return to).
- `_ushpizinShowAll` (module-level toggle) resets to auto-mode only when
  `showBracha('ushpizin')` is called while `currentBracha` is something
  ELSE (a genuine navigate-away-and-back) — a re-render triggered by the
  toggle button itself, or by `loadBrachot()` on a date-nav step, keeps
  `currentBracha === 'ushpizin'` already and does NOT reset the user's
  choice. `loadBrachot()` was extended with `else if (currentBracha ===
  'ushpizin') showBracha('ushpizin')` specifically so paging the date-nav
  (`changeDay()` → `loaded={}` → `loadTab` → `loadBrachot`) updates which
  night is shown, matching the explicit request that date-nav paging should
  drive the same day-detection logic, not just literal real-time "now".
- Night-header labels AND the new banner/toggle-button wrapper both use
  `<span style="display:block/flex">`, never `<div>` — `_renderBrachaLines`
  wraps every non-empty line in `<p>...</p>`, and a `<div>` is invalid
  content there (a browser silently "fixes" it by auto-closing the `<p>`
  early, which still LOOKS fine on screen while leaving genuinely malformed
  markup — caught once already for the night headers in v5.121, and caught
  a SECOND time here when the toggle-button banner initially used `<div>`
  too; both are checked programmatically with a regex over the rendered
  HTML in the verification harness, not by eye, since a visual check alone
  would not have caught either instance).

### IndexedDB cache — js/cache.js (v5.128)
- Scope: Sefaria TEXT responses for the **parasha** tab (Torah aliya, haftara,
  Sacks article, all three Rashi strategy fetches, Onkelos) and the **tehilim**
  tab (`Psalms.N`). Cache key = the full request URL. Opt-in per call site by
  passing the tab id (`sefariaText(ref, delay, 'tehilim')`, `cacheFetch(...)`).
  Deliberately NOT cached: Hebcal lookups and Sefaria's calendar endpoint —
  their URLs embed today's date (a fresh key every day = pure garbage), and
  the parasha-of-the-week answer must stay live.
- Safety rules: (1) only responses with non-empty Hebrew `he` are stored, so a
  transient empty/error answer can never become permanent (the same lesson as
  the Rashi Strategy-3 bug in CLAUDE.md §13); (2) every IndexedDB failure
  degrades to "no cache", never to a broken tab; (3) a hit also skips the
  300ms+ throttling delay, which is what makes cached loads feel instant.
- Settings (`appState.cacheSettings`): default ON; global switch + per-tab
  switch, per-tab item count/size/status, "clear" per tab and for everything.
  Turning a tab OFF stops reads and writes but keeps what is already stored
  (visible in the stats, clearable) — it does not silently delete.
- Failure popup: `offerCacheClearOnFailure()` from `loadTehilim`'s and
  `loadAliyaText`'s catch blocks. Offered, never forced ("לא עכשיו" clears
  nothing). Suppressed when OFFLINE (the failure is the network and clearing
  would destroy the very content that still works offline), when the tab's
  cache is off (it can't be the cause) and for 5 minutes after showing.
- **Combined parshiot vs the same parasha on its own** (verified v5.130): the
  key is the full request URL, so it embeds the exact ref/range. Combined
  `תזריע-מצורע` resolves to `Leviticus 12:1-15:33` and loads either Hebcal's
  combined aliyot (`12:1-13:5`, `13:6-13:17`…) or, with no leyning, that whole
  range; standalone Tazria uses its static aliyot (`12:1-12:8`, `13:1-13:17`…)
  / `12:1-13:59`. Different ref ⇒ different entry, so neither can overwrite the
  other; an identical ref in both flows is identical text and is shared on
  purpose. NEVER key by parasha name. Aliyot load lazily (one entry per aliya
  the user opens), not all seven up front.
- Test-harness note: the app registers a service worker whose own `fetch`
  bypasses Playwright's `context.route` — use `serviceWorkers:'block'`.

### Bookmarks — js/bookmarks.js (v5.132)
- One bookmark per tab in `appState.bookmarks[tab]` (localStorage). Long-press
  (500ms) on text in a tab's content root saves the tab's FULL state plus an
  anchor; the bar at the top of the tab ("🔖 label «snippet» [עבור לסימניה] [✕]")
  returns to it; a 🔖 flag + highlight mark the spot while the tab shows that
  state; long-press on the flag deletes (toast with "בטל").
- **State is per-tab knowledge** (`BM_ADAPTERS`): everything that changes which
  DOM exists is part of it — parasha: ref, aliyot list, aliya, exact aliya ref,
  view (text/Rashi/Onkelos/haftara/Sacks), haftara; tehilim: the exact
  `loadTehilim` argument (`window._lastTehilimArg`, e.g. `"119:1-88"`) + day/
  favorite/manual context; daf/mishna: date, daily-vs-pick, ref, commentary
  view, picker values; brachot: key, nusach AND ushpizin's show-all toggle
  (found by testing — without it GO restored the right bracha but the anchored
  night wasn't rendered); emuna: book + unit. Daily tabs are date-driven, so
  restore moves the global date-nav (`_bmGoDate`) to the saved date. New tab ⇒
  add an adapter; a tab without one is not bookmarkable.
- **Anchor** = child-index path from the content root (skipping `[data-bm-ui]`
  nodes, i.e. our own bar) + 80-char snippet + fractional Y inside the element +
  the press' viewport Y. Restore verifies the path hit with the snippet and
  falls back to a snippet search, then scrolls so the SAME element is at the
  SAME screen height (clamped to stay on screen), and keeps correcting for
  ~2.5s because several loaders scroll on their own after rendering
  (`scrollTehilimTop`, `showBracha`'s smooth `scrollIntoView`, Rashi arriving
  late) — stopped by any user input so it never fights the reader.
- **Restore order matters**: wait for the tab's own initial load to go idle
  BEFORE restoring (otherwise the default load can land after ours and win),
  restore only if `same()` says the tab isn't already there, wait idle again,
  then wait for the anchor. `idle()` per tab: parasha also waits for the
  Rashi/Onkelos/haftara/Sacks data its view needs; a failed load counts as idle.
- **Showing the bar shifts the page**: `_bmShowBar` measures an element at the
  viewport center before/after and scrolls by the difference. A fixed
  compensation double-shifted in Chrome (its scroll anchoring already
  compensates; Safari's doesn't) — measuring works in both.
- Test-harness notes: pressing a button for 700ms and releasing on it CLICKS
  it (the first test run silently switched aliyot); release elsewhere. Block
  coordinates must lie inside the content root (brachot's button list is long).

### Auto-scroll — js/autoscroll.js (v5.127)
- UX: a round ▶ (bottom-left, above the bottom nav; lifted above siddur's own
  stacked floats on that tab) appears by itself when the page overflows the
  screen. Pressing it swaps in a compact pill toolbar (bottom-center, 44px
  touch targets): pause/play, stop, − "מהירות N" +. Thumb zone, doesn't cover
  the text being read. Toolbar speed is session-only; Settings holds the
  DEFAULT (+ reset to the original), changing it there applies immediately.
- **Survives in-tab navigation**: the app's loaders replace content and jump
  to the top. A big upward jump while playing, or new content appearing after
  the bottom was reached (`ended`), is treated as "new section" → optional
  short hold (setting, default 2s) then continue at the SAME speed. A tab
  switch stops it (per-tab by design, as requested).
- Extras beyond the request (owner asked for suggestions): auto-pause on
  manual scroll (wheel/touchmove/keys; taps don't pause, so tapping "next
  aliya" keeps it going), screen wake lock while playing, new-section hold,
  Esc stops, a "הגעת לסוף" state instead of silently stopping, restart from
  the top when pressing play at the end, ▶ hidden on the compass tab.
- **Progress row (v5.131)**: under the buttons, a thin bar + `NN%` + "נותרו
  2 דק׳ 05 שנ׳" (`autoScrollFormatTime`: seconds → min+sec → hours+min).
  Both numbers are RECOMPUTED from the live position on every event, never
  accumulated (`autoScrollCalc(y, max, level, holdMs)`): remaining = distance
  left ÷ px/s of the CURRENT level (+ any still-pending new-section hold), so
  a manual scroll anywhere, a speed change, pause/resume or the page growing
  (next section finished loading) are all just new inputs. Triggers: scroll
  event (rAF-coalesced; covers our own scrolling and the user's), speed
  change/pause/resume via `_asRenderUI`, ResizeObserver content growth, and a
  250ms heartbeat in the tick so a hold's countdown keeps moving. Paused shows
  "מושהה · נותרו …" dimmed; at the bottom "הגעת לסוף" / 100% (it never shows
  100% before the real bottom: floor + cap at 99). DOM writes are skipped when
  the text is unchanged. `#as-eta[data-sec]` exposes the numeric seconds.
- Mechanics: rAF loop with a fractional-pixel accumulator (16px/s is
  0.27px/frame; `scrollBy` needs whole px), `dt` clamped to 100ms so a
  backgrounded tab doesn't lurch, `behavior:'instant'`. Icons are inline SVG
  (`currentColor`) so they follow the theme; every `<button>` sets its own
  color (buttons don't inherit it).

### Omer (omer.js)
- `getOmerDay()`: computed from Hebrew date
- Full text: לשם יחוד, ברכה, ספירה, הרחמן, למנצח, אנא בכח, יהי רצון, עלינו

### Special Zmanim (calendar.js)
- Erev Pesach: chametz times from Hebcal
- Fast days from Hebcal events API

---

## Known Issues / Open Items

### 🟡 Siddur tab is BETA and hidden by default (Sep 22, 2026)
Owner-reported: the siddur pipeline's logic doesn't always behave as expected —
no specific repro captured yet. Made `siddur` `defaultHidden: true` in
`ALL_TABS` (js/settings.js) so new/existing users don't see it unless they
explicitly enable it in Settings → טאבים מוצגים, and tagged it `beta: true`,
which shows a `.beta-badge` pill on both the top and bottom nav tab buttons
plus a note in the visibility list. **This hides the tab, it does not fix
whatever the underlying siddur bug is** — the siddur pipeline itself (see
"Siddur Text Pipeline" below) is unchanged. Next session investigating this
should ask the owner for the specific failure mode before touching
`js/siddur.js`/`js/siddur-inserts.js`, since "doesn't always work as expected"
isn't a reproducible bug report on its own.

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

### v5.132 (Oct 9, 2026) – Bookmarks (סימניה) per tab
- ✅ New js/bookmarks.js — see Key Architecture → Bookmarks. Long-press saves,
  the bar jumps back to the exact state and place, ✕ clears, long-press on the
  flag deletes; stored per tab in localStorage; works for parasha (aliya +
  Rashi/Onkelos/haftara/Sacks view), tehilim, daf, mishna, rambam, tefilot,
  brachot (incl. ushpizin toggle), emuna, siddur and the date-driven tabs.
- Verified in real headless Chromium, 43 checks: short tap / dragged press /
  button press / outside-content press save nothing; a real long-press stores
  state + anchor + label with no selection left and no jump; bar at the top of
  the page, flag at the pressed height; GO from a different parasha restores
  ref + aliya ג + Rashi view + the aliya tab + dropdown and puts the SAME Rashi
  block at the SAME screen height; survives a full reload; a second press
  replaces; per-tab independence; ✕/undo; flag long-press delete/undo; tap on
  the flag only explains; brachot, tefilot and daf (date moved +2 days and
  restored, Steinsaltz view) return to the same spot. Screenshots checked in
  both themes. Auto-scroll (82) and cache (37 + 25) suites re-run: no
  regressions.
- Bugs found by the tests and fixed: (1) an empty spacer `<div>` under the
  finger made the press count as "nothing" — now the nearest paragraph is
  taken; (2) the ushpizin show-all toggle wasn't part of brachot state;
  (3) a fixed scroll compensation for the new bar double-shifted in Chrome.
- `Tests/test_runner.py`: 270/288 (unchanged baseline).

### v5.131 (Oct 8, 2026) – Auto-scroll: percent scrolled + time remaining
- ✅ Toolbar now shows a progress bar, `NN%` and the time left to the bottom
  in minutes/seconds (hours+minutes for very long pages), dynamic and aware of
  manual scrolling, speed changes, pause, a pending new-section hold and the
  page changing size. See Key Architecture → Auto-scroll → Progress row.
- The ended state's "הגעת לסוף" moved from the speed label to the progress row
  (the speed label always reads "מהירות N" now).
- Verified in real headless Chromium, dark + light, 82 checks incl.: format
  edge cases (7s, 1:00, 2:05, 59:59, 1h00, 1h02), calc maths (1000px @32px/s =
  31.25s, halfway 50%, double speed halves it, hold adds, no-overflow = 100%),
  live numbers vs expected, drops ~2s per 2s, speed 4→7 recalculates at once,
  paused freezes + label, manual jump to 80% and back to 10% updates at once,
  user scroll while playing keeps going from the new spot, a +4000px page drops
  the percent and adds ~125s, the hold is counted, bar fill matches percent,
  ended = 100%. Screenshots checked in both themes.
- `Tests/test_runner.py`: 270/288 (unchanged baseline).

### v5.130 (Oct 7, 2026) – Cache verified for combined parshiot (+ rationale comment)
- ✅ Owner asked to make sure the parasha cache handles combined parshiot and
  never overwrites the same parasha cached on its own. Analysis: it cannot, by
  construction (key = full ref URL) — see Key Architecture → IndexedDB cache.
  Rather than trust that, verified it end to end in real headless Chromium with
  mocked Sefaria/Hebcal (25 checks): standalone Tazria stored, then combined
  Tazria-Metzora (Hebcal aliyot) loaded — every standalone row still present and
  byte-identical, combined aliyot in their own rows (lazy, per aliya opened),
  standalone aliya 2 (`13:1-13:17`) and combined aliya 2 (`13:6-13:17`) separate
  and each rendering its OWN text (every mock response embeds its ref, so any
  mix-up shows), swapping back and forth makes zero Sefaria calls, the
  no-leyning whole-range fallback (`12:1-15:33`) gets a third separate key,
  Hebcal (date-keyed) is not cached, stats consistent.
- No behavior change; added a comment in js/cache.js stating the invariant so
  nobody "optimises" the key down to a parasha name later.
- `Tests/test_runner.py`: 270/288 (unchanged baseline).

### v5.129 (Oct 6, 2026) – Auto-scroll speed range 1..15, slower step 1
- ✅ Scale changed from levels 1..10 at `8 + 8*level` px/s to **1..15 at
  `8*level` px/s**: level 1 = 8 px/s (half the old slowest), 15 = 120 px/s
  (old top was 88). Every old level keeps its real speed one step higher
  (old n == new n+1), so the DEFAULT moved from 3 to 4 and is still 32 px/s —
  nobody's feel changes.
- ✅ Saved speeds are migrated once (`_asMigrateSettings`, marker
  `appState.autoScroll.v = 2`): a speed saved under the old scale becomes
  speed+1, keeping its px/s. Every later write stamps `v:2`; "reset to
  defaults" just deletes the object. Settings slider is now 1..15.
- Verified in real headless Chromium, dark + light: measured ~8px/s at level 1
  and ~120px/s at level 15 from actual scrollY, − disabled at 1 and + disabled
  at 15, clamps, default still ~32px/s, migration (3→4, 10→11, once only),
  settings save/reset. `Tests/test_runner.py`: 270/288 (unchanged baseline).
- Test-harness note: seed `_lastSeenVersion` with the CURRENT version or the
  what's-new modal blocks clicks.

### v5.128 (Oct 5, 2026) – IndexedDB cache for parasha + tehilim
- ✅ New js/cache.js — see Key Architecture → IndexedDB cache. Cache-first for
  Sefaria texts on the parasha and tehilim tabs, network on a miss; Settings
  section with global + per-tab switches (default ON), per-tab count/size/
  status and clear buttons; load-failure popup that offers (never forces) a
  clear + retry.
- Verified in real headless Chromium with mocked Sefaria routes, 37 checks:
  miss→network / hit→no network, persistence across a full reload, empty
  responses not stored (and a retry reaches the network), per-tab OFF and
  global OFF both bypass reads and writes, a parasha aliya reload makes ZERO
  Sefaria calls (text + 3 Rashi paths + Onkelos), popup offered / dismissed /
  cooldown / direct clear-and-retry, no popup offline or with the tab's cache
  off, Settings counts/sizes/toggles/clear, no page errors. Screenshots
  checked in both themes (caught and fixed jumbled "12 KB" inside RTL text
  with `<bdi dir="ltr">`).
- `Tests/test_runner.py`: 270/288 (unchanged baseline).

### v5.127 (Oct 1, 2026) – Auto-scroll (גלילה אוטומטית)
- ✅ New js/autoscroll.js — see Key Architecture → Auto-scroll for the design:
  play button on long pages, toolbar (pause/stop/speed), continues across
  in-tab navigation at the same speed, default speed + reset in Settings, plus
  the suggested extras listed there.
- Verified in a REAL headless Chromium (not mocks): 44 checks x dark & light —
  button visible and not overlapping the nav, ~32px/s at level 3 and ~48px/s
  at level 5 measured from actual scrollY, pause/resume, wheel pauses, bottom
  -> `ended` -> content appended + jump to top -> resumes after the 2s hold at
  the same level, jump-to-top while playing holds then continues, stop, tab
  switch stops, hidden on qibla, Settings save/apply/reset, no page errors.
  Screenshots of toolbar + settings checked in both themes.
- Test-harness note: the what's-new modal (shown once per new version) covers
  the page and blocks clicks — pre-set `_lastSeenVersion` in localStorage.
- `Tests/test_runner.py`: 270/288 (unchanged baseline).

### v5.126 (Sep 29, 2026) – קריאת שמע שעל המיטה added to Tefilot
- ✅ New `TEFILOT.shema_mita` (js/tefilot.js) + button `tf-shema_mita` in
  `#tefila-buttons` (index.html), nusach Sfard, text supplied verbatim by the
  owner (pasted from Sefaria's Siddur Sefard page — Sefaria itself is still
  blocked in this sandbox, so `// TODO: verify source` per CLAUDE.md §3 and
  the v5.111/v5.120/v5.121 precedent).
- ✅ **Scoped to what was asked**: the pasted page also contained the
  קידוש לבנה + קדיש יתום text that precedes this section on Sefaria.
  Only what follows the "קריאת שמע שעל המיטה" heading was added (קידוש לבנה
  already exists as `BRACHOT.kiddush_levana`). Verified programmatically that
  none of that text leaked in.
- ✅ Kept as pasted, in order: מחילה + המפיל, the halachic note on who reads
  which parshiyot, אל מלך נאמן / שמע / ברוך שם, ואהבת, ויהי נועם, ישב בסתר,
  ה' מה רבו, השכיבנו, ברוך ה' ביום, יראו עינינו, the verse series, ×3 notes
  (2 of them, as pasted), אדון עולם (10 lines). Instruction/note lines are
  wrapped in a muted `<span>` so they read as instructions, not prayer text.
- ✅ Checked the pre-existing `showTefila()` "targum line" heuristic (muted
  quote style for any line containing `יְיָ`/`תרגום`/`מְחֵית`) does not fire on
  any line — this text spells the Name `יְהֹוָה` — so nothing renders muted by
  accident.
- Verified with a Node `vm` harness on the real `js/tefilot.js` +
  `showTefila('shema_mita')`: 33 assertions (22 section anchors present and in
  the pasted order, no muted wrapper, no leaked קידוש לבנה, all 10 אדון עולם
  lines, notes count). Note this proves structure/order, not letter-level
  fidelity of the owner's paste — that stays under the TODO above.
  `Tests/test_runner.py`: 270/288 (unchanged baseline).

### v5.125 (Sep 27, 2026) – Fixed: top/bottom nav bars stuck dark in light theme
- ✅ **Root cause**: `#topbar` and `#bottom-nav` (styles.css) had their
  `background` hardcoded as `rgba(14,9,5,.97)`/`rgba(14,9,5,.85)` — that's
  this app's DARK-theme `--bg` (#0e0905), spelled out as a literal rgba
  instead of `var(--bg)`, because both bars need a semi-transparent color
  for the `backdrop-filter: blur()` frosted-glass effect rather than a
  fully opaque one. Every button/icon/label inside those bars already used
  `var(--muted)`/`var(--gold)` correctly and DID switch with the theme —
  only the bar backgrounds themselves stayed permanently dark, which is
  exactly the visible symptom reported (bars look "stuck in dark mode"
  while their own icon colors visibly did change).
- ✅ Added two new theme-reactive variables, `--nav-bg`/`--nav-bg-fade`
  (same rgb as `--bg`, at the same original alpha), defined in both
  `:root` and `:root[data-theme="light"]` exactly like `--addition-bg`
  already is — see AGENT.md → Key Architecture → Theme for the full
  writeup of why this was missed in the original v5.113 theme audit.
- ✅ **Verified in an actual headless-Chromium render, not just by reading
  the CSS**: loaded the real `index.html` (via a local HTTP server),
  toggled `localStorage.theme` between `'dark'`/`'light'` before load
  (matching the app's own inline HEAD-script boot sequence), and read
  `getComputedStyle()` on both bars in each theme — confirms the
  background now genuinely resolves to light vs dark. Screenshotted both
  themes for a visual sanity check.
- ✅ **Checked every tab icon/label for legibility, not just the two that
  were visible in a screenshot** — all 17 tabs × both nav bars × both
  themes (68 checks) had their real computed text color contrast-checked
  against the real computed (composited) background color:
  light theme reaches full WCAG AA (≥4.5:1) for every tab, including ones
  that were only "large-text-only" (≥3:1) in dark theme already — and
  that dark-theme number (4.40) is unchanged from before this fix, i.e.
  confirmed NOT a regression, just a pre-existing characteristic this fix
  didn't touch.
- `Tests/test_runner.py`: 270/288 (unchanged baseline — this is a
  styles.css-only fix, no JS behavior changed). `release-checklist.py`
  syntax/version checks unaffected.

### v5.124 (Sep 27, 2026) – נטילת לולב moved from Tefilot to Brachot
- ✅ Moved `lulav` from `TEFILOT` (js/tefilot.js) to `BRACHOT`
  (js/brachot.js), under the "חג הסוכות" category, at the owner's request
  to group it with Ushpizin (v5.121) — both Sukkot items now live in one
  place. Content is unchanged; only the file/tab it lives in changed.
- ✅ **Proactively fixed the same `<div>`-inside-`<p>` nesting bug a third
  time** rather than reproducing it — `showTefila()`'s rendering
  conventions (`【header】` auto-styling, default `<div>` line wrapper)
  don't carry over to `_renderBrachaLines()` (default `<p>` line wrapper,
  no `【】` support at all). Both section headers and the two
  shaking-direction opinion blocks were rewritten as
  `<span style="display:block/flex">` during the move — see AGENT.md → Key
  Architecture → חג הסוכות for the full explanation of why this class of
  bug keeps recurring here and how it's checked (programmatically, with a
  regex over the actual rendered HTML, every time — a visual check has
  never once caught it in this feature).
- ✅ Removed the `tf-lulav` button from `#tefila-buttons` (index.html) and
  added `bb-lulav` under `#bracha-buttons`'s "חג הסוכות" category, next to
  `bb-ushpizin`.
- Verified numerically: a Node `vm` harness loading the real
  `js/tefilot.js` + `js/brachot.js` — confirms `TEFILOT.lulav` no longer
  exists, `BRACHOT.lulav` renders every piece of the original text in the
  same order, no `【〜】` marker leaks into the HTML as literal text, and no
  `<div>` ends up nested inside a `<p>`. Re-ran the existing Ushpizin
  verification harness (31 assertions, v5.123) unchanged to confirm
  inserting `lulav` immediately before it in the `BRACHOT` object didn't
  disturb anything. `Tests/test_runner.py`: 270/288 (unchanged baseline).
  `node --check` clean; no duplicate DOM ids; whole-document `<div>`
  nesting balanced.

### v5.123 (Sep 27, 2026) – Ushpizin auto-shows the correct night by date
- ✅ Ushpizin (v5.121) now automatically shows only the Hebrew-date-relevant
  night (Tishrei 15→ליל א׳/אברהם ... Tishrei 21→ליל ז׳/דוד) instead of always
  showing all 7. Falls back to showing everything when today isn't one of
  the 7 nights (any other Tishrei day, or a different month) — exactly as
  requested. A toggle button is always available to see all 7 nights even
  while a specific night is auto-shown, and to return to just today's night
  from there. See AGENT.md → Key Architecture → Ushpizin for the full
  day-detection design (mirrors `getOmerDayForDisplay()`'s nightfall/tzeit
  pattern) and `getUshpizinNightForDisplay()`/`_buildUshpizinLines`/
  `toggleUshpizinShowAll()` in js/brachot.js.
- ✅ **Nightfall boundary implemented exactly per the owner's own example**:
  on the evening of Tishrei 15, once tzeit (sunset+18min) has passed, the
  night already shown is #2 (Yitzchak), not #1 — verified numerically for
  that exact case, not just read by eye.
- ✅ **Date-nav-aware**: paging via the top date button re-renders whichever
  night is correct for the day actually selected, not always "real today" —
  required extending `loadBrachot()` (previously only called `showBracha`
  once, on first-ever visit) to also re-render `ushpizin` specifically on
  every call, since `changeDay()`'s `loaded={}` reset otherwise leaves the
  Brachot tab's content stale after navigating the date away from and back
  to it.
- ✅ **Found and fixed a second, self-introduced instance of the same
  `<div>`-inside-`<p>` bug already documented for v5.121's night headers** —
  the new "show all / show only today" banner initially used `<div>` too;
  caught by the same programmatic (not visual) check before merge.
- Verified numerically: a Node `vm` harness loading the real `js/utils.js` +
  `js/brachot.js` — 31 assertions covering the day-boundary math (before/
  after tzeit, month/day-range edges, no-zmanim-data fallback, currentOffset
  awareness), the auto-vs-show-all rendering split, the toggle button's
  presence/absence/label in every mode, the "reset only on genuine
  navigate-away" rule for the toggle, the `loadBrachot()` date-nav
  re-render hook, and the `<div>`-in-`<p>` nesting check in all three
  render modes. `Tests/test_runner.py`: 270/288 (unchanged baseline).
  `node --check` clean.

### v5.122 (Sep 27, 2026) – Fixed: duplicate `tefila_haderech` key in BRACHOT
- ✅ **Root cause** (found while adding v5.121's Ushpizin feature, fixed now
  on the owner's explicit go-ahead): `js/brachot.js` defined the object key
  `tefila_haderech` twice, with two completely different texts. In a JS
  object literal a repeated key is not a syntax error — the SECOND
  definition silently wins at construction time, so the first sat in the
  source looking live while actually being unreachable dead code.
- ✅ **Which version to keep was not a coin-flip** — an old, unmerged branch
  in this repo (`claude/add-flight-prayer-Jc66F`) has a commit
  (`4f75700`, authored directly by the app owner, not an agent) titled
  "Fix flight prayer: correct nusach and remove duplicate entry" that
  already resolved this exact duplicate: it replaced the FIRST
  definition's content with the "קונה שמים וארץ" nusach (title `תפילת
  הדרך לטיסה`, source `לאמור לפני ממריאה`) and deleted the SECOND
  ("ותצילנו... טייסים... מטוס" text) entirely. That branch was never
  merged to `main`, so `main` ended up with the fixed first entry's
  content already present (identical to `4f75700`'s replacement — likely
  landed on `main` independently at some point) but WITHOUT the matching
  deletion of the second, stale entry, which is what let the bug persist.
  Removed exactly the same second entry `4f75700` removed, matching the
  owner's own prior decision rather than re-litigating which nusach is
  "correct."
- ✅ Verified: `Object.keys(BRACHOT)` (23 keys) has no duplicates; the
  surviving `tefila_haderech` entry's text contains `קוֹנֵה שָׁמַיִם וָאָרֶץ`
  and does NOT contain any of the deleted entry's distinguishing text
  (`טַּיָּסִים`/`מַּטּוֹס`) — checked programmatically, not by eye. No other
  file references the deleted text. `index.html` already had exactly one
  `bb-tefila_haderech` button with the correct label
  (`✈️ תפילת הדרך לטיסה`) before this fix, so no HTML change was needed —
  this was purely removing unreachable JS dead code.
- `Tests/test_runner.py`: 270/288 (unchanged baseline).

### v5.121 (Sep 27, 2026) – סדר האושפיזין added to Brachot
- ✅ New `BRACHOT.ushpizin` entry (js/brachot.js) + button in `#bracha-buttons`
  under a new "חג הסוכות" category, following the existing "Adding a
  bracha" pattern. All in one card/area, per the request — the nightly
  entrance prayer, the daily "אזמין" invitation formula, all 7 nights'
  guest-specific formulas, and the leaving-the-sukkah texts, are one
  `shared`/`afterText` pair, not 7 separate buttons.
- ✅ Same network-blocked-Sefaria situation as v5.120's נטילת לולב (still
  blocked at the environment policy level — not re-tested, since this is a
  standing policy, not a transient failure). This time the owner pasted the
  full text upfront rather than being asked mid-task, so there was no
  intermediate "content authoring paused, need input" step and no
  placeholder ever needed to exist. Every one of the 11 owner-supplied
  Hebrew strings was verified as an exact runtime-string match (not a raw
  source-text substring check — a raw check falsely flagged one string as
  "missing" because the JS source's `\'` escape for a literal apostrophe
  reads as two characters in the file text but one at runtime; caught and
  corrected before trusting the result) before treating the transcription
  as correct.
- ✅ Per-night header labels (🌙 ליל א׳ – אברהם אבינו, etc.) are our own
  descriptive additions, not part of the liturgical text — verified
  programmatically that each header's named guest actually IS the first
  guest named in that night's own "בְּמָטֵי מִינָךְ" line, so the labeling is
  corroborated by the supplied text itself, not a separate claim resting on
  memory.
- ✅ Headers use `<span style="display:block">`, not `<div>` — `js/brachot.js`'s
  `_renderBrachaLines` wraps every non-empty line in a `<p>...</p>`, and a
  `<div>` is not valid content inside a `<p>` (a browser will silently
  auto-close the `<p>` early to "fix" it, which would still look fine on
  screen but leaves genuinely malformed markup). A `<span>` is inline/
  phrasing content, valid inside a `<p>`, and `display:block` makes it look
  identical to a div. Checked programmatically (regex over the actual
  rendered HTML) that no `<div` ever ends up directly inside a `<p`, not
  just eyeballed on screen.
- ✅ Found, not fixed (out of scope for this task): a genuine duplicate
  `tefila_haderech` key elsewhere in `js/brachot.js` — see Known Issues.
- Verified numerically: a Node `vm` harness loads the real `js/brachot.js`
  and calls the real `showBracha('ushpizin')` — 21 assertions covering
  section order (entrance prayer → daily formula → nights 1‑7 in order →
  leaving-the-sukkah block → its two texts in order), all 7 nights' exact
  formulas present, the afterText visual-separation mechanism firing, and
  the `<div>`-inside-`<p>` nesting check above. `Tests/test_runner.py`:
  270/288 (unchanged baseline). `node --check` clean; no duplicate DOM ids;
  whole-document `<div>` nesting balanced (all checked programmatically).

### v5.120 (Sep 27, 2026) – נטילת לולב added to Tefilot (nusach Sfard)
- ✅ New `TEFILOT.lulav` entry (js/tefilot.js) + button in `#tefila-buttons`
  (index.html), following the existing "Adding a tefila" pattern exactly
  (STRUCTURE.md).
- ✅ **Network constraint hit and documented, not silently worked around**:
  Sefaria is blocked at the environment's network-egress-policy level in
  this sandbox — confirmed 3 independent ways (`curl` CONNECT-tunnel 403,
  the `WebFetch` tool returning `EGRESS_BLOCKED`, and the proxy's own
  status/README explicitly saying "do not retry or route around it, report
  the blocked host"). This is a harder block than the already-known
  Sefaria/Hebcal API-test failures elsewhere in this repo (those are
  *tests* failing offline; this was *content authoring* that needed live
  Sefaria access and genuinely couldn't get it).
  - The two ברכות (על נטילת לולב + שהחיינו) were written from confident,
    independently-certain knowledge — Chazal's fixed wording for a mitzva
    blessing, identical across every nusach, not something that varies —
    and were NOT held up on this.
  - The יהי רצון (both the long קבלי text and the short one) and the
    shaking-direction opinions (real, disputed minhag content — Ashkenaz/
    הגר"א vs Sephardim/האר"י — exactly the kind of content where a
    misattribution or wrong order is a real halachic error, not a
    cosmetic one) were **explicitly NOT filled in from memory**. Asked the
    owner to paste the exact Sefaria text instead (`AskUserQuestion`
    offered 3 options: paste it / best-effort-with-TODO / blessings-only;
    owner chose paste-it) — see CLAUDE.md §3's "add a `// TODO: verify
    source` comment... when in doubt" and the v5.111 precedent for
    exactly this situation (owner-supplied liturgical text, not
    independently cross-checked).
  - While waiting for the pasted text, committed the partial scaffold to
    a **separate branch** (`wip/lulav-tefila`), not `main` — this repo's
    `main` IS the GitHub Pages deploy (CLAUDE.md §11), so a half-finished
    feature with a visible "⚠️ not yet entered" placeholder must not
    reach it. Merged that branch back locally once the owner's text
    arrived, then replaced every placeholder before this version's commit
    — nothing with a placeholder in it was ever pushed to `main`.
  - Every one of the owner-supplied Hebrew strings was verified
    **character-for-character present, byte-for-byte**, in the final file
    with a standalone script (`in` substring check per string) before
    treating the transcription as correct — not eyeballed.
- ✅ **Color-coded shaking-direction opinions, deliberately NOT using the
  app's existing green/red seasonal colors** (`_greenBlock`/`_redBlock` in
  js/siddur-inserts.js) — those already carry a "say this today / don't
  say this today" meaning elsewhere in the app, which would have
  misleadingly implied one of two equally-valid customs is "wrong". Added
  a new neutral second accent, `--shita-b` (styles.css `:root` +
  `:root[data-theme="light"]`), verified for WCAG AA contrast (≥4.5:1
  against both `--bg` and `--surface`, both themes) with a standalone
  script before picking the value — not eyeballed, matching the rigor the
  original theme feature (v5.113) used. `--gold` (already verified, already
  the app's "primary" accent) is reused for the Ashkenaz/הגר"א opinion;
  the new `--shita-b` is used for the Sfaradi/האר"י opinion.
- ✅ Confirmed the new content does not accidentally trip
  `showTefila`'s pre-existing (fragile) "Targum line" styling heuristic —
  it muted-quote-styles any line containing `יְיָ`/`תרגום`/`מְחֵית`. The new
  blessings use the fully-spelled `יְהֹוָה` (as the owner supplied it), which
  doesn't match, so they render in the normal primary style, not muted —
  checked programmatically, not by eye.
- Verified numerically: a Node `vm` harness loads the real `js/tefilot.js`
  and calls the real `showTefila('lulav')` — 24 assertions covering section
  presence/order (יהי רצון ×2 → ברכה → שהחיינו note+ברכה → ניענוע opinions,
  matching the order the owner supplied), the two opinions' exact wording,
  their attribution text, that neither reuses the green/red semantic
  colors, and the Targum-heuristic non-collision. `Tests/test_runner.py`:
  270/288 (unchanged baseline). `node --check` clean; CSS brace count
  balanced; no duplicate DOM ids; whole-document `<div>` nesting balanced
  (checked programmatically, as in v5.118/v5.119).

### v5.119 (Sep 25, 2026) – Shared prayer-names list (רפואה שלמה / עילוי נשמה)
- ✅ **New collapsible section, identical on both the Tehilim and Mishna
  tabs, backed by ONE shared list** (`appState.prayerNames`), not a
  per-tab copy — adding/editing/deleting a name from either tab updates
  both immediately. New file `js/prayer-names.js` per CLAUDE.md §4 (no
  existing file owned this concept); reuses `escapeHtml`/`saveState`/
  `toggleCollapsibleSection`/`applyCollapsedSection` from `js/utils.js`
  rather than duplicating any of that.
- ✅ Add/edit form is a SINGLE shared modal (`#prayer-names-modal`), not one
  instance per tab — avoids duplicate-id HTML and duplicate state-sync code
  that two inline per-tab forms (like Tehilim's own favorites form) would
  have needed. Fields: שם פרטי (free text) → בן/בת (2-button toggle) → שם
  ההורה (free text) → סוג: לרפואה שלמה / לעילוי נשמה (2-button toggle,
  **default לרפואה שלמה** per spec). "אחד או יותר" is satisfied by the list
  itself supporting any number of entries, added one at a time — same
  pattern as Tehilim favorites, not a multi-name-per-entry form.
- ✅ Inside the collapsible body, entries are grouped under two subheaders
  (🙏 לרפואה שלמה / 🕯️ לעילוי נשמה) with a live count each, per spec
  ("צריך שבתוך האיזור הזה תהיה חלוקה"). A group with zero entries renders
  nothing (no empty "לעילוי נשמה (0)" header) rather than an empty section.
- ✅ Full CRUD: add, edit (✏️), delete (🗑️, confirm-dialog looks the name up
  by id rather than taking it as a param — same attribute-injection
  avoidance as `confirmDeleteTehilimFavorite`). Name + parent name are
  trimmed and truncated to 60 chars (mirrors the Tehilim favorites
  defense-in-depth fix from v5.115); an invalid/tampered gender or type
  (only reachable by calling the functions directly, not through the UI,
  since the form uses fixed 2-button toggles) is corrected to a default
  rather than rejected.
- ✅ Security: names are free-text and rendered via `innerHTML` —
  `escapeHtml()` applied to both the name and the parent name.
- ✅ Persistence: stored in `appState.prayerNames`, persisted through the
  same `saveState()` → `localStorage` mechanism as every other preference
  (Tehilim favorites, collapsed-section state, etc.) — small structured
  records, not a text blob, so this doesn't conflict with CLAUDE.md §5's
  "no large blobs in localStorage" rule.
- ✅ Wired into both tabs' init paths: `initTehilim()` and `loadMishnaYomi()`
  both call `initPrayerNamesSection(loc)` (applies saved collapse state +
  draws the list) — in `loadMishnaYomi()` this runs BEFORE the async
  Sefaria fetch/try-block, so the names section still works even if the
  network call fails, exactly like Tehilim's favorites card already did.
- Verified numerically, not by eye: a Node `vm` harness loading the real
  `js/utils.js` + `js/prayer-names.js` — 37 assertions covering validation
  (empty name/parent rejected, whitespace trimmed, invalid gender/type
  defaulted, 60-char truncation), CRUD (add/update/delete/lookup),
  localStorage persistence, rendering (grouping + per-group counts,
  identical HTML drawn into BOTH tab containers from one shared-list
  render call, empty-state show/hide), the XSS escaping path (a raw
  `<script>` name renders as inert escaped text, not executable markup),
  the gender/type button-toggle state machine, and the add-vs-edit modal
  population/reset logic. `python3 Tests/test_runner.py`: 270/288
  (unchanged baseline — all 18 failures are the expected sandbox network
  403s). `node --check` clean on every `js/*.js` file. No duplicate DOM
  ids introduced (checked programmatically across all of `index.html`).

### v5.118 (Sep 22, 2026) – Collapsible Tehilim sections + favorite reminders
- ✅ **Collapsible/expandable sections.** The Tehilim tab's "תהילים לפי תאריך
  עברי" (day/chapter selector) card and "מועדפים" (Favorites) card can now each
  be collapsed independently via a chevron-button header, so the favorites list
  doesn't force the day-selector off-screen on a long list. New reusable
  primitive (not Tehilim-specific): `toggleCollapsibleSection(id)` /
  `applyCollapsedSection(id)` in `js/utils.js`. Markup contract: a real
  `<button id="{id}-header" class="card-title collapsible-header" ...
  aria-expanded aria-controls="{id}-body">` plus a `<div id="{id}-body">`
  wrapping the collapsible content — a real `<button>` (not a div+onclick) so
  it's keyboard-focusable, with the chevron rotated purely via CSS
  (`[aria-expanded="false"] .collapsible-chevron`), no JS needed to flip the
  icon. State persists to `appState.collapsedSections[id]` (only `true` is
  ever stored — default is expanded, so a user who never touches this sees no
  new localStorage key).
  - CSS gotcha found and fixed during implementation, not after: the
    Favorites card's collapsible header button is a flex-SIBLING of the
    pre-existing "+ הוסף" button inside `.card-header` (`display:flex`). The
    initial `.collapsible-header { width:100% }` rule (fine standalone in the
    day-selector card) would have pushed "+ הוסף" off the row there. Fixed
    with a scoped override, `.card-header .collapsible-header { width:auto;
    flex:1 1 auto; min-width:0 }`, verified against `.card-header`'s actual
    flex CSS before writing the fix.
- ✅ **Tehilim favorite reminders**, including a daily-recurring option. The
  favorite add/edit form (`#tehilim-fav-form`) gained a reminder block (time +
  "חזרה יומית" checkbox); saved as `fav.reminder = {enabled, time, recurring}`
  on the favorite itself (`js/tehilim.js`), not in the generic
  `appState.reminders` map — chosen so deleting the favorite automatically
  drops its reminder with no separate cleanup step.
  - Reused, rather than duplicated, the ENTIRE existing reminder subsystem
    (`js/settings.js`: `_getPendingReminders`, `_updateNotifBadge`,
    `_buildReminderList`, `openReminderModal`, `checkRemindersOnOpen`) per
    CLAUDE.md §4. New `_allReminderItems()` returns the static
    `REMINDER_ITEMS` plus one synthetic item per favorite with an enabled
    reminder (`key: favrem_<id>`); every consumer above now iterates this
    instead of the raw const. New `_reminderSettingsFor(item)` reads
    `fav.reminder` for a favorite item or `appState.reminders[key]` for a
    static one, so the rest of the pipeline doesn't need to know which kind
    of item it has.
  - **Recurring vs one-time semantics.** A recurring favorite behaves exactly
    like the existing `daily:true` items (naturally resurfaces because
    `appState._remindersDone` resets every day — no new code needed). A
    one-time favorite needed new logic, since nothing in the static item set
    ever auto-disables: `_autoDisableIfOneTime(item)`, hooked into both
    `toggleReminderDone` (single item) and `markAllRemindersDone` (bulk), sets
    `fav.reminder.enabled = false` so it never resurfaces after being shown
    and dismissed once.
  - **Honesty about the OS-notification limitation, in both code and UI
    text.** `scheduleTehilimFavoriteReminder()` mirrors the pre-existing
    `scheduleReminder(key)` in `js/settings.js` exactly — `Notification` +
    one-shot `setTimeout` — which only fires if the tab happens to stay open
    past the target time and is never re-armed on reload (confirmed via grep:
    nothing outside `settings.js` calls `scheduleReminder`, and `init.js`
    never re-arms it). The RELIABLE mechanism, for both static and favorite
    reminders alike, is the existing `checkRemindersOnOpen()` call on every
    app load, which re-evaluates pending reminders fresh against the current
    time. The in-app copy under the reminder toggle says this explicitly
    rather than implying a real push notification.
  - Security: favorite names are free-text and now also flow into
    `_buildReminderList`'s `innerHTML` via the synthetic item's `name`
    (`🙏 ${f.name}`) — wrapped in `escapeHtml()` there, consistent with the
    v5.113 favorites-list fix, before this ever shipped.
- Verified numerically, not by eye: two Node `vm` harnesses loading the real
  `js/utils.js` (+ `js/settings.js` + `js/tehilim.js` for the reminder one)
  into a shared sandbox — 10 assertions for collapse/expand/persist/restore,
  15 for the reminder integration (add recurring + one-time, both appear in
  `_allReminderItems`/pending list/badge count, one-time auto-disables on
  completion while recurring stays enabled, `_reminderNav` routes to the
  correct favorite, deleting a favorite removes its reminder, and a
  regression check that the pre-existing static `halacha` reminder is
  unaffected). Full suite: 270/288 (all 18 failures are the expected sandbox
  network 403s — see CLAUDE.md §1/§10).

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

### v5.117 (Sep 22, 2026) – Fixed: invisible favorite-star button in Tehilim
User-reported: "I see the hint saying I can star a chapter to favorite it, but
there's no visible star button on the chapter itself."
- ✅ **Root cause**: `#tehilim-fav-star` (index.html, next to the chapter title)
  had no `color` in its inline style, and `<button>` elements do NOT inherit
  `color` from an ancestor the way a `<span>` would — a button's initial color
  is the browser's own `buttontext` system color, independent of the page's
  theme. The button sits inside `.card-title`, which sets `color: var(--gold)`
  (styles.css:181), but that never reached the button itself.
  - The bug was invisible in testing/review because the STARRED state renders
    `⭐` (U+2B50, a color emoji glyph that ignores CSS `color` entirely and
    always renders its own built-in gold star) while the default UNSTARRED
    state renders `☆` (U+2606, a plain monochrome text glyph that DOES respect
    CSS `color`) — so a `git diff` reader or a screenshot taken after clicking
    it once would see a normal gold star and never notice the bug.
  - Fixed by adding `color:var(--gold)` to the button's own inline style,
    matching `.card-title`'s gold — correct in both dark and light theme (see
    Theme section above; `--gold` was chosen with WCAG-verified contrast
    against both `--bg` and `--surface` in each palette).
- Checked every other styled `<button>` in index.html (54 total) for the same
  "no CSS class, no inline color" gap — all 11 that lacked an inline `color`
  get it from a CSS class (`.font-btn`, `.aliya-tab`) instead. This button was
  the only one with neither, i.e. a one-off, not a systemic pattern.

### v5.116 (Sep 22, 2026) – Share the app, Siddur → BETA + hidden by default
- ✅ **Share the app** (Settings, top section): `shareAppWhatsApp()` opens
  `wa.me/?text=...` with no phone number (WhatsApp's own contact/chat picker,
  not a fixed recipient); `shareAppEmail()` sets `location.href` to a
  `mailto:?subject=&body=` with CRLF line breaks for mail-client compatibility.
  Both fields are `encodeURIComponent`'d separately, not the whole URL as one
  blob (would double-encode the `?`/`&` separators).
- ✅ **Siddur tab hidden by default, tagged BETA.** Owner reported the siddur
  pipeline's logic doesn't always work as expected (no specific repro yet —
  see Known Issues below). `ALL_TABS`'s `siddur` entry (js/settings.js) gained
  `defaultHidden: true, beta: true`, reusing the exact mechanism `logs`/
  `network` already used — confirmed via `isTabVisible()`'s `id in vis` check
  that this hides it for BOTH brand-new users and existing users who never
  explicitly toggled it, not just new installs. A `.beta-badge` pill (new CSS
  class, styles.css) now shows on both the top and bottom nav Siddur tab
  buttons and in the Settings visibility list. Users can still turn it on
  themselves in Settings → טאבים מוצגים.
- 2 independent code reviews found no bugs in either change; confirmed the
  `.bnav-btn` badge placement specifically (its `flex-direction:column`
  treats each direct child as a separate row — the badge had to be wrapped
  inside the SAME span as the label text, not added as a sibling, or it would
  stack onto its own 3rd row and misalign the button height against sibling
  nav buttons).

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
