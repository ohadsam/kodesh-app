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

**Adding a tefila:** Add entry to `TEFILOT` in `js/tefilot.js` AND root `tefilot.js`.
Add `<button id="tf-{key}" class="aliya-tab" onclick="showTefila('{key}')">` in `index.html` inside `#tefila-buttons`.

### js/content.js
| Function | Description |
|---|---|
| `loadParasha()` | Fetch parasha from Hebcal + Sefaria aliyot |
| `loadAliyaText(ref)` | Load aliya text from Sefaria, scroll to top |
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
| `parseTehilimSearch(q)` | Parse number or Hebrew gematria |
| `hebrewToNumber(str)` | Convert Hebrew letters to numeric value |

### js/omer.js
| Function | Description |
|---|---|
| `getOmerDay()` | Compute omer day from Hebrew date |
| `buildOmerText(day)` | Full omer text including ברכה, ספירה, הרחמן, אנא בכח |
| `showOmerNow()` | Display omer modal |

### js/misc.js
| Function | Description |
|---|---|
| `updateDoneButton(tab, key)` | Mark content as read for today |
| `initCompass()` | GPS + DeviceOrientation → Qibla direction |
| `_checkSensorCalibration(alpha)` | Detect uncalibrated magnetometer |

### js/settings.js
| Function/Const | Description |
|---|---|
| `ALL_TABS` | Array of all tab names in order |
| `initSettings()` | Load settings panel, tab visibility toggles |
| `nuclearReset()` | Clear all state + caches + reload |

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
5. `index.html` → `?v=X.X` on all `<script src>` tags
6. `index.html` → `מה חדש בגרסה X.X` in whats-new-modal title

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
