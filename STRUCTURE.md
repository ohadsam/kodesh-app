# STRUCTURE.md – Kodesh App Code Map

**Always consult this file before scanning source files.**
Last updated: v5.99 (May 10, 2026)

---

## Repository Layout

```
kodesh-app/
├── index.html          Single-file PWA shell (~3800 lines). All HTML, inline CSS, tab pages.
├── manifest.json       PWA manifest (name, icons, theme_color)
├── sw.js               Service Worker – cache versioning, offline support
├── .gitignore
├── CLAUDE.md           ← Agent instructions (read every session)
├── AGENT.md            ← Architecture notes, known issues, version history
├── STRUCTURE.md        ← This file: code map and entry points
├── PROJECT_SUMMARY.md  Legacy overview (Hebrew, may be outdated)
│
├── js/                 ← PRIMARY source files (loaded by index.html)
│   ├── utils.js
│   ├── settings.js
│   ├── app.js
│   ├── calendar.js
│   ├── content.js
│   ├── tehilim.js
│   ├── tefilot.js
│   ├── siddur.js
│   ├── siddur-inserts.js
│   ├── omer.js
│   ├── brachot.js
│   ├── misc.js
│   ├── init.js
│   └── network-log.js
│
├── *.js                Root-level mirrors of js/ files (kept in sync, older)
│
├── icons/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
│
└── Tests/
    ├── test_runner.py          Framework + CLI runner
    ├── test_html_structure.py  DOM element checks, version consistency
    ├── test_siddur_seasonal.py Winter/summer seasonal logic
    ├── test_omer.py            49-day omer grammar
    ├── test_business_logic.py  Tachanun, compass, seasonal edge cases
    ├── test_zmanim.py          Prayer times, compass bearings
    ├── test_parasha.py         Torah portions, fuzzy matching
    ├── test_api_sefaria.py     Live Sefaria API (network)
    └── test_api_hebcal.py      Live Hebcal API (network)
```

---

## Script Load Order (index.html bottom of body)

```html
js/network-log.js   → patches fetch(), 10-min log retention
js/utils.js         → must be first: APP_VERSION, state, shared helpers
js/settings.js      → ALL_TABS, tab visibility config
js/app.js           → showTab, loadTab, navigation
js/calendar.js      → Hebrew dates, zmanim, events
js/content.js       → Parasha, Daf Yomi, Mishna, Rambam
js/tehilim.js       → Tehilim by day
js/siddur-inserts.js→ wrapSeasonalParagraphs (must load before siddur.js)
js/siddur.js        → getSiddurSections, loadSiddur, _renderParagraphs
js/omer.js          → buildOmerText, getOmerDay
js/tefilot.js       → TEFILOT static data, showTefila
js/brachot.js       → BRACHOT static data, showBracha, openBrachotNavPopup
js/misc.js          → updateDoneButton, compass/Qibla
js/init.js          → init() – called on DOMContentLoaded
```

---

## Key Functions by File

### js/utils.js
| Function/Const | Description |
|---|---|
| `APP_VERSION` | Version string – must match sw.js |
| `appState` | Global state object (persisted to localStorage) |
| `saveState()` | Persist appState to localStorage |
| `heFlat(arr)` | Flatten nested Sefaria he[] arrays |
| `cleanSefariaHtml(str)` | Strip HTML tags, convert `<small>` to seasonal markers |
| `buildParagraphs(flat)` | Break verse array into display paragraphs |
| `sefariaText(ref, max)` | Fetch + cache Sefaria text by ref |
| `formatHebrewDate(d)` | Hebrew date string from JS Date |
| `escapeHtml(s)` | Escape `&<>"'` — use for any USER-typed text (favorite names etc.) going into an `innerHTML` template. Sefaria/Hebcal text is trusted and rendered as-is elsewhere; text typed on the device is not |
| `toggleCollapsibleSection(id)` | Toggle a `{id}-header`/`{id}-body` pair (see markup contract in the code comment), persists collapsed state to `appState.collapsedSections[id]` (only `true` stored — default is expanded) |
| `applyCollapsedSection(id)` | Call once after a collapsible section's markup exists in the DOM (e.g. from a tab's init function) to restore last session's collapsed state |

### js/app.js
| Function | Description |
|---|---|
| `showTab(name)` | Switch active tab, lazy-load on first visit |
| `loadTab(name)` | Call init function for a tab |
| `changeDay(delta)` | Navigate date +/- days |
| `loadHebrewDate()` | Fetch Hebrew date from Hebcal |
| `initTabScrollSync()` | Proportional scroll sync between siddur sections |

### js/siddur.js
| Function | Description |
|---|---|
| `getSiddurSections(nusach, prayer)` | Build section list for a nusach+prayer combo |
| `loadSiddur()` | Fetch all sections, render with progress |
| `_fetchSectionHtml(s, style, occ)` | Fetch one section from Sefaria |
| `_renderParagraphs(pars, isAdd)` | Convert paragraph array → HTML string |
| `shouldShowSection(s)` | Filter sections by halachic day conditions |
| `initSiddur()` | Bootstrap: compute `window._siddurCal`, init buttons |
| `openSiddurStatusPopup()` | Show 📋 prayer status floating popup |

### js/siddur-inserts.js
| Function/Const | Description |
|---|---|
| `wrapSeasonalParagraphs(html)` | Post-process HTML to highlight/strikethrough seasonal text |
| `SEASONAL_DEFS[]` | Array of seasonal definitions (label, starts regex, show(), multiPara) |

### js/brachot.js
| Function/Const | Description |
|---|---|
| `BRACHOT` | Object of all brachot: `{ key: { title, source, shared/nusach } }` |
| `showBracha(key)` | Display bracha by key, set active button |
| `setBrachotNusach(n)` | Switch nusach (sfard/ashkenaz/mizrach) |
| `loadBrachot()` | Init: restore nusach, show first bracha |
| `openBrachotNavPopup()` | Floating nav – auto-built from Object.keys(BRACHOT) |
| `closeBrachotNavPopup()` | Close floating nav |
| `readBrachaAloud()` | Web Speech API TTS (he-IL voice) |

**Adding a bracha:** Add entry to `BRACHOT` in `js/brachot.js` AND root `brachot.js`.
Add a `<button id="bb-{key}" class="aliya-tab bracha-btn" onclick="showBracha('{key}')">` in `index.html` inside `#bracha-buttons`. The floating nav picks it up automatically.

### js/tefilot.js
| Function/Const | Description |
|---|---|
| `TEFILOT` | Object of static prayers: `{ key: { title, source, text[] } }` |
| `showTefila(key)` | Display prayer, render text with header/targum styling |
| `initTefilot()` | Init: show first prayer (motzash) |

**Adding a tefila:** Add entry to `TEFILOT` in `js/tefilot.js` only — the root-level
`tefilot.js` (and every other root-level `.js`/`.css` file alongside `js/`) is a dead
pre-reorg leftover, not loaded by `index.html` (verified: only `js/*.js` is
`<script src>`'d) and last touched at a much older commit. A previous session's
"keep both in sync" note here was wrong and wasted real effort — do not resurrect it.
Add `<button id="tf-{key}" class="aliya-tab" onclick="showTefila('{key}')">` in `index.html` inside `#tefila-buttons`.

### js/content.js
| Function | Description |
|---|---|
| `loadParasha()` | Fetch parasha from Hebcal + Sefaria aliyot. Matches Hebcal's Hebrew name against `ALL_PARASHIOT` — tries `cleanSpaced` (hyphen→space) BEFORE the combined-parshiot hyphen-split fallback, since Hebcal writes multi-word single names like "כי-תצא" with a hyphen too |
| `loadAliyaText(ref)` | Load aliya text from Sefaria, scroll to top |
| `loadRashiForRef(ref)` | 3-strategy Rashi loader. Per-chapter `s1WorthRetrying`/`s2WorthRetrying` flags skip re-fetching a strategy on retry once it deterministically fails (HTTP ok, insufficient data) — only genuine exceptions stay retryable. Strategy 3 only accepts a zero-entry result on the final attempt |
| `loadDafYomi()` | Fetch daily Daf from Sefaria calendar |
| `switchDafView(mode)` | Toggle Rashi inline view |
| `loadMishnaYomi()` | Fetch Mishna Yomit |
| `loadRambamYomi()` | Fetch Rambam daily |
| `switchRambamView(mode)` | Toggle Steinsaltz inline (per-halacha, uses raw array index) |
| `PARASHA_ALIYOT` | Static table: 54 parshiot → aliya refs |
| `HAFTARA_REFS` | Static table: 54 parshiot → haftara refs (Ashkenaz Israel) |

### js/calendar.js
| Function | Description |
|---|---|
| `loadCalendar()` | Fetch Hebrew date + zmanim + events |
| `loadZmanim(date, city)` | Fetch zmanim from Hebcal API |
| `loadEvents(date)` | Fetch holidays/fasts from Hebcal events API |
| `setCity(cityKey)` | Update city for zmanim + compass |

### js/tehilim.js
| Function/Const | Description |
|---|---|
| `initTehilim()` | Bootstrap tehilim tab |
| `loadTehilim(chapter)` | Fetch + render Psalm, scroll to top |
| `TEHILIM_SCHEDULE` | Map: Hebrew day-of-month → chapter list |
| `getTehilimNavInfo(chapterOrRange)` | Prev/next chapter + day-boundary nav info. Branches on `tehilimContext` — day-mode (default, unchanged), favorite-mode, or manual-mode |
| `_tehilimDayChapterRow(nav, currentKeyStr)` | Chip row of the active context's chapters (day, favorite, or manual-history), current one highlighted; rendered near both top and bottom nav buttons |
| `parseTehilimSearch(q)` | Parse number or Hebrew gematria |
| `hebrewToNumber(str)` | Convert Hebrew letters to numeric value |
| **Favorites** | Individual chapters or custom ranges, saved to `appState.tehilimFavorites` |
| `tehilimContext` | `{type:'day'}` (default) / `{type:'favorite', id}` / `{type:'manual'}` — which chapter list drives nav/chips |
| `addTehilimFavorite(name, from, to, reminder?)` / `updateTehilimFavorite(id, name, from, to, reminder?)` / `deleteTehilimFavorite(id)` | CRUD; range is expanded to a plain chapter-number array at save time (mirrors `TEHILIM_SCHEDULE`'s shape so nav code doesn't need to special-case it). `reminder` is `{enabled, time, recurring}`, stored as `fav.reminder` (deleting the favorite drops it automatically) |
| `_normalizeReminder(r)` | Validates/defaults a raw reminder object before storing — rejects a malformed `time` rather than storing something `_getPendingReminders` can't parse |
| `scheduleTehilimFavoriteReminder(favId)` | Best-effort OS `Notification`, one-shot `setTimeout` — mirrors `scheduleReminder(key)` in js/settings.js exactly, same limitation (only fires if the tab stays open past the target time, never re-armed on reload). The reliable path is `checkRemindersOnOpen()` via `_allReminderItems()` below |
| `toggleTehilimFavoriteChapter(ch)` / `isChapterFavorited(ch)` | The ⭐ star button next to the chapter title — single-chapter favorites only |
| `viewTehilimFavorite(favId, idx)` | Enters favorite-mode and loads `chapters[idx]` |
| `openTehilimFavForm(editId?)` / `closeTehilimFavForm()` / `saveTehilimFavForm()` | Add/edit form in the Favorites card |
| `renderTehilimFavoritesList()` | Populates `#tehilim-fav-list`; active favorite highlighted via `tehilimContext` |
| `confirmDeleteTehilimFavorite(id)` | Looks the name up itself rather than taking it as a param — see the XSS note in js/utils.js `escapeHtml` |
| **Manual-selection history** | Dropdown (`#tehilim-select`) / search (`searchTehilimChapter`) picks — in-memory only, never persisted |
| `tehilimManualHistory` | Array of distinct chapter numbers visited via manual/search selection this tab-visit, kept SORTED ascending (reading-progress view, not click order) |
| `viewTehilimManual(chapter)` | Sets `tehilimContext = {type:'manual'}` and loads it — entry point for BOTH the dropdown `onchange` and `searchTehilimChapter()`. Prev/next = simple chapter±1 (no schedule/favorite list to derive from), bounded at 1/150 |
| `_recordManualVisit(chapter)` | De-dupes + re-sorts into `tehilimManualHistory`; called from `getTehilimNavInfo`'s manual branch, so any path that renders a manual-mode chapter records it |
| `resetTehilimManualHistory()` | Clears the array (and drops `tehilimContext` back to `{type:'day'}` if it was manual) — called from `showTab()` in app.js on leaving the Tehilim tab, NOT on switching between day/favorite/manual navigation while still in the tab (history must survive that, per spec) |

### js/omer.js
| Function | Description |
|---|---|
| `getOmerDay()` | Compute omer day from Hebrew date |
| `buildOmerText(day)` | Full omer text including ברכה, ספירה, הרחמן, אנא בכח |
| `showOmerNow()` | Display omer modal |

### js/misc.js
| Function / Const | Description |
|---|---|
| `updateDoneButton(tab, key)` | Mark content as read for today |
| `initQibla()` | GPS (with spoof detection) → `qiblaAngle`, then starts the compass |
| `calcBearing(lat1,lon1,lat2,lon2)` | TRUE bearing, **arguments in RADIANS** |
| `calcDistanceKm(...)` | Haversine distance, arguments in DEGREES |
| `bearingToLabel(deg)` | Bearing → Hebrew label (צפון / ד-מזרח / …) |
| `startCompassListener()` | Starts `AbsoluteOrientationSensor` + `deviceorientation*` |
| `stopCompassListener()` | Removes listeners, stops the sensor, clears the watchdog |
| `_headingFromEuler(a,b,g,screen)` | Tilt-correct heading from W3C alpha/beta/gamma |
| `_headingFromQuaternion(q,screen)` | Same, from an AbsoluteOrientationSensor quaternion |
| `_acceptHeadingSource(rank)` | Heading-source priority + smoothing reset on switch |
| `_smoothHeading(h)` | Circular (unit-vector) EMA — wrap-safe at 359°→0° |
| `_checkSensorCalibration(alpha)` | Detect uncalibrated magnetometer |
| `updateCompassUI()` | Rotates `#compass-outer` / `#compass-arrows`, turn guidance |
| `MAGNETIC_DECLINATION` | +4.5° Israel; magnetic→true. Android only — see AGENT.md |
| `HEADING_MIN_PROJ` | Below this horizontal projection the azimuth is rejected |

> Compass invariants live in **AGENT.md → Key Architecture → Compass/Qibla**.
> The two that break silently: `calcBearing` takes radians, and `rotate()` is clockwise
> so `normDiff > 0` means turn RIGHT.

### js/settings.js
| Function/Const | Description |
|---|---|
| `ALL_TABS` | Array of all tab names in order. Each entry can carry `fixed` (always visible, e.g. calendar), `defaultHidden` (hidden unless the user explicitly opts in — used by `logs`/`network`/`siddur`), `autoShowFn` (force-visible when it returns true), `beta` (shows a `.beta-badge` pill on the tab button + in the Settings visibility list) |
| `isTabVisible(id)` / `setTabVisible(id, v)` / `applyTabVisibility()` | Visibility logic — `defaultHidden` tabs stay hidden for any user with no explicit `appState.tabVisibility[id]` entry, including existing users who never toggled it |
| `initSettings()` | Load settings panel, tab visibility toggles |
| `nuclearReset()` | Clear all state + caches + reload |
| `shareAppWhatsApp()` / `shareAppEmail()` | Settings → "שתפו את האפליקציה". `wa.me/?text=` (no phone number → opens WhatsApp's own contact picker) and `mailto:?subject=&body=` (CRLF line breaks, each field separately `encodeURIComponent`'d) |
| `setTheme(mode)` | `'dark'`\|`'light'` — sets/removes `data-theme` on `<html>`, persists to `localStorage.theme`, updates the `theme-color` meta tag, highlights the settings button + `aria-pressed`. The actual FIRST-PAINT theme application is a separate, earlier inline `<script>` in index.html's `<head>` (before `styles.css` loads) reading the same key — see the comment above `setTheme` for why |
| `initThemeUI()` | Called from `loadSettingsState()` — syncs the settings buttons to whatever the HEAD script already applied; does not re-apply the theme itself |
| `REMINDER_ITEMS` | Static array of the 8 built-in daily reminder items (omer, halacha, tehilim, lashon, daf, mishna, rambam, parasha) |
| `_allReminderItems()` | `REMINDER_ITEMS` plus one synthetic item (`key: favrem_<id>`) per Tehilim favorite with an enabled reminder (js/tehilim.js). Every reminder consumer (`_getPendingReminders`, `_updateNotifBadge`, `_buildReminderList`, `openReminderModal`) iterates this, not the raw const |
| `_reminderSettingsFor(item)` | Reads `{time, enabled}` regardless of source — `fav.reminder` for a favorite item, `appState.reminders[key]` for a static one |
| `_autoDisableIfOneTime(item)` | A one-time (non-recurring) favorite reminder disables itself once marked done, so it never resurfaces; daily favorites and all static items are unaffected (they recur naturally via the daily `_remindersDone` reset) — hooked into `toggleReminderDone`/`markAllRemindersDone` |
| `_reminderNav(key)` | Routes "פתח עכשיו" — `favrem_<id>` keys go to `viewTehilimFavorite`, everything else uses the static `REMINDER_NAV` map |

---

## HTML Structure (index.html)

### Key IDs

| ID | Location | Purpose |
|---|---|---|
| `page-{tab}` | ~line 500–1200 | Each tab's content container |
| `whats-new-modal` | ~line 251 | What's New modal (update content every version) |
| `tefila-buttons` | ~line 913 | Tefilot tab selector buttons |
| `bracha-buttons` | ~line 960 | Brachot tab selector buttons |
| `brachot-nav-list` | ~line 1029 | Floating nav popup content (auto-built) |
| `siddur-content` | siddur page | Siddur rendered HTML |
| `bracha-content` | brachot page | Bracha rendered HTML |
| `tefila-content` | tefilot page | Tefila rendered HTML |
| `done-{tab}` | each tab | Done/read tracking button |
| `topbar-date` | topbar | Date display chip |
| `settings-panel` | overlay | Settings panel |

### Version Numbers – Must All Match
Update ALL of these when bumping version:
1. `js/utils.js` → `APP_VERSION`
2. `sw.js` → `APP_VERSION`
3. `index.html` → `var V = 'X.X'` (inline HEAD script)
4. `index.html` → `גרסה X.X` in splash screen
5. `index.html` → `גרסה X.X` in the footer (`· עיתים ·`)
6. `index.html` → `?v=X.X` on all `<script src>` tags
7. `index.html` → `מה חדש בגרסה X.X` in whats-new-modal title

Run `python3 release-checklist.py` to verify all of the above automatically instead
of grepping for each one by hand.

---

## API Endpoints

| API | Base URL | Used For |
|---|---|---|
| Sefaria texts | `https://www.sefaria.org/api/texts/{ref}` | Prayer texts, Torah, Tehilim |
| Sefaria calendar | `https://www.sefaria.org/api/calendars` | Daf, Parasha, Mishna, Rambam |
| Hebcal zmanim | `https://www.hebcal.com/zmanim` | Prayer times |
| Hebcal calendar | `https://www.hebcal.com/hebcal` | Events, holidays, candles |
| Hebcal converter | `https://www.hebcal.com/converter` | Hebrew date conversion |

---

## Brachot Keys (BRACHOT object)

| Key | Title |
|---|---|
| `birkat_hamazon` | ברכת המזון (Sefaria dynamic) |
| `mezonot` | על המחיה |
| `shehakol` | שהכל |
| `borei_nefashot` | בורא נפשות |
| `gomel` | ברכת הגומל |
| `birkot_torah` | ברכות התורה |
| `birkot_haftara_lifnei` | ברכות ההפטרה – לפני |
| `birkot_haftara_acharei` | ברכות ההפטרה – אחרי |
| `tefila_haderech` | תפילת הדרך לטיסה |
| `kiddush_levana` | ברכת הלבנה |
| `birkat_ilanot` | ברכת האילנות |
| `havdala` | הבדלה |
| `yam_gadol` | ברכה על הים הגדול |
| `raam` | ברכה על רעם |
| `barak` | ברכה על ברק |
| `keshet` | ברכה על קשת |
| `nof` | ברכה על נופים מיוחדים |
| `chacham` | חכמי ישראל |
| `chacham_umot` | חכמי אומות העולם |
| `melachim` | מלכים / ראשי מדינה |
| `tzahal` | תפילה לשלום חיילי צה"ל |
| `medinat_israel` | תפילה לשלום המדינה |

## Tefilot Keys (TEFILOT object)

| Key | Title |
|---|---|
| `motzash` | תפילה למוצאי שבת |
| `simcha` | תפילה לשמחה |
| `shla` | תפילת השל"ה הקדוש |
| `man` | פרשת המן |
