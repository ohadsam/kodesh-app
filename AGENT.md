# לימוד יומי – Agent Reference v4.1

**URL**: `https://ohadsam.github.io/kodesh-app/`  
**Stack**: Vanilla JS PWA, GitHub Pages, RTL Hebrew, Sefaria API + Hebcal API  
**No build step** – edit files and push directly.

---

## File Structure

```
kodesh-app/
├── index.html        # HTML shell only (~829 lines, no JS logic)
├── styles.css        # All CSS + CSS variables
├── sw.js             # Service worker – cache list must match JS files
├── manifest.json     # PWA manifest
├── AGENT.md          # This file
├── js/
│   ├── utils.js      # State, date helpers, fetch, heFlat, buildParagraphs, cleanSefariaHtml
│   ├── settings.js   # ALL_TABS, tab visibility, openSettings, setFont, reminders
│   ├── app.js        # showTab, loadTab, changeDay, updateAllDates, loadHebrewDate
│   ├── calendar.js   # loadCalendar, loadZmanim, zmanim display, setCity
│   ├── tehilim.js    # initTehilim, loadTehilim, TEHILIM_SCHEDULE
│   ├── content.js    # loadHalacha, loadParasha+Rashi, loadLashon, loadIgeret, loadDafYomi, loadMishnaYomi, loadTanach929
│   ├── tefilot.js    # initTefilot, showTefila, TEFILOT static texts (4 prayers)
│   ├── siddur.js     # Full siddur: getSiddurSections, loadSiddur, initSiddur, _fetchSectionHtml,
│   │                 #   openSiddurSectionsPopup, closeSiddurSectionsPopup,
│   │                 #   toggleZmanimReminder, scheduleZmanimRemindersForToday
│   ├── misc.js       # updateDoneButton, toggleDone, full Qibla/compass logic
│   └── init.js       # init(), error handlers, calls init()
└── icons/
```

**Load order** (index.html bottom): utils → settings → app → tehilim → calendar → content → tefilot → siddur → misc → init

### ⚠️ Critical: File Ownership Rules
- `ALL_TABS` and tab visibility functions live **only** in `settings.js`
- `toggleZmanimReminder` and zmanim notifications live **only** in `siddur.js`  
- `tefilot.js` contains **only** `TEFILOT`, `initTefilot`, `showTefila` — nothing else
- Do NOT add `const ALL_TABS` or settings functions to any other file

---

## Global State (js/utils.js)

```js
let currentOffset = 0;          // days from today (0=today)
let userLat, userLon, userElev; // GPS coords (default: Petah Tikva 32.0833, 34.8878, 52m)
let currentTab = 'calendar';
let loaded = {};                 // { tabName: true } – prevents double-load
let aliyot = [];                 // current parasha aliyot refs from Sefaria calendars
let rashiLoaded = false;         // Rashi background load complete flag
const APP_VERSION = '4.1';
const STORAGE_KEY = 'kodesh_app_v1';
let appState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
```

---

## Key Utilities (js/utils.js)

| Function | Purpose |
|---|---|
| `fetchWithDelay(url, delay?)` | fetch with 300ms default delay + logging |
| `sefariaText(ref, delay?)` | Sefaria `/api/texts/` fetch, logs he verse count |
| `heFlat(data)` | Flatten Sefaria response → `string[]` of Hebrew verses |
| `cleanSefariaHtml(str)` | Strip Sefaria HTML, keep `<b>/<i>`, decode entities |
| `buildParagraphs(flat)` | Group verses into logical paragraphs (breaks on ברכות etc.) |
| `getTargetDate()` | Today + currentOffset |
| `formatDate(d)` | → `"YYYY-MM-DD"` |
| `saveState()` | Persist appState to localStorage |

---

## Tab System (js/app.js + js/settings.js)

- `showTab(name)` – switches active page/tab/bnav; special cases: siddur (always reinit), qibla (compass), logs
- `loadTab(name)` – calls the right load function; sets `loaded[name]=true`
- `changeDay(delta)` / `goToToday()` – modify `currentOffset`, reset `loaded`, reload current tab
- Tab IDs: `calendar siddur halacha lashon tehilim daf mishna 929 parasha igeret tefilot qibla logs`
- Each tab has: `#page-{id}` (page div), `#t-{id}` (top tab), `#bn-{id}` (bottom nav)
- Tab visibility controlled by `ALL_TABS` in settings.js + `appState.tabVisibility`

---

## Siddur (js/siddur.js)

**State**: `siddurNusach` (`sfard`|`ashkenaz`|`mizrach`), `siddurPrayer` (`shacharit`|`mincha`|`arvit`|`birkat`|`layla`)

**Flow**: `initSiddur()` → `loadSiddur()` → per section: `_fetchSectionHtml(s, style, yaalehOccasion)`

**Section object**: `{ label, ref, isAddition?, condition?, staticText?, isHallel? }`

**Conditions** (in `SIDDUR_CONDITIONS`): `isShabbat`, `isRoshChodesh`, `isRoshChodeshOrMoed`, `isCholHamoed`, `isYomTov`, `isHallel`, `isTachanun`, `isSefirat`, `isAlNisim`, `isMussaf`, `isMussakRH`

**Rendering pipeline** (v4.1):
- `_sectionStyle(s)` – returns **only** font/layout CSS (no color – color is set per-paragraph)
- `_staticTextToHtml(rawText, isAdd)` – groups multiline static text into flowing `<p>` blocks; isAdd=true → `color:var(--addition)`, italic, bold
- `_renderParagraphs(paragraphs, isAdd)` – renders API-fetched paragraphs; isAdd=true → `color:var(--addition)`
- Addition blocks in skeleton use CSS class `.siddur-addition-block` with green border + background
- CONDITION_LABELS shown as `📅 מתי נאמר` label inside addition block header

**Floating buttons** (v4.1):
- `#siddur-float-btn` (☰) – scrolls back to top nav, shown after 150px scroll
- `#siddur-sec-btn` (≡) – opens sections popup, shown together with ☰
- `openSiddurSectionsPopup()` – builds list from live DOM `[id^="ss-"]` elements, scrolls to active section
- `closeSiddurSectionsPopup()` – hides overlay + popup; also triggered by clicking overlay

**Key HTML elements**: `#siddur-content`, `#siddur-progress-wrap/bar/lbl`, `#siddur-sections` (chip nav), `#siddur-sec-popup`, `#siddur-sec-popup-list`, `#siddur-sec-popup-overlay`

---

## Parasha + Rashi (js/content.js)

**State**: `parashaVerses[]`, `rashiVerses[]`, `parashaView` (`text`|`rashi`), `currentParashaRef`

**Flow**:
1. `loadParasha()` → Hebcal for current parasha name → match `ALL_PARASHIOT` → Sefaria calendars for aliyot
2. `loadAliyaText(ref)` → `sefariaText(ref)` → fills `parashaVerses[]` → calls `loadRashiForRef()` in background
3. `loadRashiForRef(ref)` → per chapter with `?commentary=1` → **3 retries + exponential backoff** → fills `rashiVerses[]`

**Parasha matching** (prevents "צו" matching "תצוה"):
```js
const matchP = ALL_PARASHIOT.find(p => clean === p.he)                          // exact
  || ALL_PARASHIOT.find(p => heName === 'פרשת ' + p.he)                         // with prefix
  || ALL_PARASHIOT.find(p => clean.length >= 3 && p.he.startsWith(clean)        // partial safe
      && p.he.length <= clean.length + 2);
```

**Rashi anti-bleed filter** (v4.1 – prevents cross-chapter leakage):
```js
if (cCh !== ch) return;           // must be exact chapter being fetched
if (cV < 1 || cV > chapLen) return; // verse must be within actual chapter length
```

**Rashi progress bar**: `#rashi-progress-wrap/bar/lbl` – shows per-chapter progress label like `"רש"י פרק 7..."`, hidden on completion.

---

## Tefilot (js/tefilot.js)

- `TEFILOT` object with 4 prayers: `motzash`, `simcha`, `shla`, `tefila_derech`
- `initTefilot()` → calls `showTefila('motzash')`
- `showTefila(key)` → renders `TEFILOT[key]` into `#tefila-content`, updates button states
- **tefilot.js contains ONLY these** – no settings, no ALL_TABS

---

## Calendar & Zmanim (js/calendar.js)

- `loadCalendar()` → parallel: Hebcal zmanim, Hebrew date, holiday events, candles/havdalah
- `setCity(city)` → switch between predefined cities or GPS
- Zmanim stored in `appState._lastZmanim` for notification scheduling
- Zmanim source: `https://www.hebcal.com/zmanim?cfg=json&...`

---

## Content Tabs (js/content.js)

| Function | Source | Key detail |
|---|---|---|
| `loadHalacha()` | Sefaria `Kitzur_Shulchan_Arukh` | `getKitzurRef(dayOfYear)` calculates section |
| `loadLashon()` | Sefaria `Chafetz_Chaim` | Cycles 20 parts by day-of-year |
| `loadIgeret()` | Sefaria `Iggeret_HaRamban` | Full letter split into sections |
| `loadDafYomi()` | Sefaria calendars API | `calendar_items` find Daf Yomi ref |
| `loadMishnaYomi()` | Sefaria calendars API | `calendar_items` find Mishna Yomi ref |
| `loadTanach929()` | Sefaria calendars API | `calendar_items` find 929 ref |

---

## APIs Used

| API | Purpose | Notes |
|---|---|---|
| `https://www.hebcal.com/converter` | Hebrew date | `?cfg=json&date=YYYY-MM-DD&g2h=1` |
| `https://www.hebcal.com/zmanim` | Prayer times | `?cfg=json&date=...&latitude=...&longitude=...&elevation=...` |
| `https://www.hebcal.com/hebcal` | Events/parasha | `?v=1&cfg=json&s=on&start=...&end=...` |
| `https://www.sefaria.org/api/texts/{ref}` | Torah/prayer text | `?lang=he&commentary=0&context=0` |
| `https://www.sefaria.org/api/texts/{ref}?commentary=1` | Rashi | Only for parasha, one chapter at a time |
| `https://www.sefaria.org/api/calendars` | Daily learning | `?diaspora=0` |

**Rate limiting**: `sefariaText()` has 0ms default delay; `fetchWithDelay()` has 300ms default. Rashi loop adds 300ms between chapters + 1.5s/3s backoff on retry.

---

## CSS Variables (styles.css)

```css
--bg: #0e0905          /* dark brown background */
--surface: #1c1208     /* slightly lighter surface */
--card: #251a0c        /* card backgrounds */
--border: #3d2b14      /* borders */
--gold: #c9a54a        /* primary accent */
--gold-dim: #7a6128    /* muted gold */
--cream: #f5ead4       /* main text */
--text: #e8d9b8        /* secondary text */
--muted: #8a7355       /* muted text */
--addition: #7ed6a0    /* green-mint for siddur special additions */
--addition-bg: rgba(126,214,160,.08)
--addition-border: rgba(126,214,160,.45)
--font-size: 16px      /* user-adjustable via setFont() */
--radius: 14px
```

**Key CSS classes**:
- `.siddur-addition-block` – green bordered box for special prayer additions (יעלה ויבוא, הלל etc.)
- `.siddur-section-divider` – 1px separator between regular prayer sections
- `#rashi-progress-wrap/bar/lbl` – Rashi chapter loading indicator
- `#siddur-sec-popup` – floating sections quick-nav panel (scrollable, semi-transparent dark)

---

## Known Issues / Limitations

1. **אשכנז/עדות המזרח** – many sections fallback to ספרד refs (Sefaria API limitation)
2. **Rashi load time** – Leviticus ch 6-7 occasionally get rate-limited by Sefaria; 3-retry backoff handles it but adds ~15-30s
3. **Qibla compass** – depends on device sensor calibration; iOS needs `requestCompassPermission()`

---

## Common Fixes Cheatsheet

| Problem | File | What to look for |
|---|---|---|
| Tefilot tab shows nothing | `js/tefilot.js` | Check `initTefilot` exists and `showTefila` renders `#tefila-content` |
| **tefilot.js is broken** | `js/tefilot.js` | Must end after `showTefila` closing `}` – no ALL_TABS or settings code inside |
| Wrong parasha shown | `js/content.js` | `matchP` logic in `loadParasha()` |
| Rashi bleeds to wrong verses | `js/content.js` | `cCh !== ch` filter in `loadRashiForRef()` |
| Rashi not loading | `js/content.js` | Retry loop: 3 attempts, backoff 0/1.5s/3s |
| Siddur additions wrong color | `js/siddur.js` | `_sectionStyle` must NOT set color; color set in `_renderParagraphs`/`_staticTextToHtml` |
| Siddur additions no label | `js/siddur.js` | `whenLabel` from `CONDITION_LABELS[s.condition]` in skeleton builder |
| Sections popup not working | `js/siddur.js` | `openSiddurSectionsPopup`, `closeSiddurSectionsPopup`; HTML: `#siddur-sec-popup-overlay`, `#siddur-sec-popup` |
| Float buttons not showing | `js/siddur.js` | `initSiddurFloatBtn()` – checks scroll > 150px |
| Wrong zman shown | `js/calendar.js` | Field names in Hebcal zmanim response |
| Tab not loading | `js/app.js` | `loadTab()` switch |
| Settings not saving | `js/settings.js` | `saveState()` + `appState` |
| Cache stale after deploy | `sw.js` + `js/utils.js` | Bump `APP_VERSION` in **both** files |
| New JS file added | `index.html` + `sw.js` | Add `<script src>` before `init.js` AND add to `STATIC[]` in sw.js |

---

## Deploy Checklist

1. Bump `APP_VERSION` in **both** `js/utils.js` AND `sw.js`
2. If adding a new JS file: add `<script src="js/newfile.js">` to `index.html` (before `init.js`) AND add `'./js/newfile.js'` to `STATIC[]` in `sw.js`
3. Push to `main` branch → GitHub Pages auto-deploys
4. Hard-reload in browser (or ⚙️ → ניקוי Cache) to bust SW cache


**URL**: `https://ohadsam.github.io/kodesh-app/`  
**Stack**: Vanilla JS PWA, GitHub Pages, RTL Hebrew, Sefaria API + Hebcal API  
**No build step** – edit files and push directly.

---

## File Structure

```
kodesh-app/
├── index.html        # HTML shell only (~795 lines, no JS logic)
├── styles.css        # All CSS + CSS variables
├── sw.js             # Service worker – cache list must match JS files
├── manifest.json     # PWA manifest
├── AGENT.md          # This file
├── js/
│   ├── utils.js      # State, date helpers, fetch, heFlat, buildParagraphs, cleanSefariaHtml
│   ├── settings.js   # ALL_TABS, tab visibility, openSettings, setFont, reminders
│   ├── app.js        # showTab, loadTab, changeDay, updateAllDates, loadHebrewDate
│   ├── calendar.js   # loadCalendar, loadZmanim, zmanim display
│   ├── tehilim.js    # initTehilim, loadTehilim, TEHILIM_SCHEDULE
│   ├── content.js    # loadHalacha, loadParasha+Rashi, loadLashon, loadIgeret, loadDafYomi, loadMishnaYomi, loadTanach929
│   ├── tefilot.js    # initTefilot, showTefila, static prayer texts
│   ├── siddur.js     # Full siddur: getSiddurSections, loadSiddur, initSiddur, _fetchSectionHtml
│   ├── misc.js       # updateDoneButton, toggleDone, full Qibla/compass logic
│   └── init.js       # init(), error handlers, calls init()
└── icons/
```

**Load order** (index.html bottom): utils → settings → app → tehilim → calendar → content → tefilot → siddur → misc → init

---

## Global State (js/utils.js)

```js
let currentOffset = 0;          // days from today (0=today)
let userLat, userLon, userElev; // GPS coords (default: Petah Tikva)
let currentTab = 'calendar';
let loaded = {};                 // { tabName: true } – prevents double-load
let aliyot = [];                 // current parasha aliyot refs
let rashiLoaded = false;         // rashi background load complete
const APP_VERSION = '4.0';
const STORAGE_KEY = 'kodesh_app_v1';
let appState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
```

---

## Key Utilities (js/utils.js)

| Function | Purpose |
|---|---|
| `fetchWithDelay(url, delay?)` | fetch with 300ms default delay + logging |
| `sefariaText(ref, delay?)` | Sefaria `/api/texts/` fetch, logs he count |
| `heFlat(data)` | Flatten Sefaria response → `string[]` of Hebrew verses |
| `cleanSefariaHtml(str)` | Strip Sefaria HTML, keep `<b>/<i>`, decode entities |
| `buildParagraphs(flat)` | Group verses into logical paragraphs (breaks on ברכות etc.) |
| `getTargetDate()` | Today + currentOffset |
| `formatDate(d)` | → `"YYYY-MM-DD"` |
| `saveState()` | Persist appState to localStorage |

---

## Tab System (js/app.js + js/settings.js)

- `showTab(name)` – switches active page/tab/bnav; special cases: siddur (always reinit), qibla (compass), logs
- `loadTab(name)` – calls the right load function; sets `loaded[name]=true`
- `changeDay(delta)` / `goToToday()` – modify `currentOffset`, reset `loaded`, reload current tab
- Tab IDs: `calendar siddur halacha lashon tehilim daf mishna 929 parasha igeret tefilot qibla logs`
- Each tab has: `#page-{id}` (page div), `#t-{id}` (top tab), `#bn-{id}` (bottom nav)
- Tab visibility controlled by `ALL_TABS` + `appState.tabVisibility`

---

## Siddur (js/siddur.js)

**State**: `siddurNusach` (`sfard`|`ashkenaz`|`mizrach`), `siddurPrayer` (`shacharit`|`mincha`|`arvit`|`birkat`|`layla`)

**Flow**: `initSiddur()` → `loadSiddur()` → per section: `_fetchSectionHtml(s, style, yaalehOccasion)`

**Section object**: `{ label, ref, isAddition?, condition?, staticText?, isHallel? }`

**Conditions** (in `SIDDUR_CONDITIONS`): `isShabbat`, `isRoshChodesh`, `isRoshChodeshOrMoed`, `isCholHamoed`, `isYomTov`, `isHallel`, `isTachanun`, `isSefirat`, `isAlNisim`, `isMussaf`, `isMussakRH`

**Rendering fixes (v4.0)**:
- `_staticTextToHtml()` – groups multiline static text into flowing `<p>` blocks (fixes word-per-line bug)
- `_renderParagraphs()` – renders API-fetched paragraphs with proper `display:block` 
- Skeleton uses `.siddur-addition-block` CSS class (not inline styles)
- Section separators use `.siddur-section-divider` (6px, not 24px)
- No cache – always fetches fresh from Sefaria

**Key HTML elements**: `#siddur-content`, `#siddur-progress-wrap`, `#siddur-progress-bar`, `#siddur-progress-lbl`, `#siddur-sections` (jump nav), `#siddur-title`, `#siddur-subtitle`

---

## Parasha + Rashi (js/content.js)

**State**: `parashaVerses[]`, `rashiVerses[]`, `parashaView` (`text`|`rashi`), `currentParashaRef`

**Flow**:
1. `loadParasha()` → Hebcal for current parasha name → match in `ALL_PARASHIOT` → Sefaria calendars for aliyot
2. `loadAliyaText(ref)` → `sefariaText(ref)` → fills `parashaVerses[]` → calls `loadRashiForRef()` in background
3. `loadRashiForRef(ref)` → fetches each chapter with `?commentary=1` → **3 retries with backoff** → fills `rashiVerses[]`

**Parasha matching fix (v4.0)**: exact match first, prevents "צו" matching "תצוה"
```js
const matchP = ALL_PARASHIOT.find(p => clean === p.he)
  || ALL_PARASHIOT.find(p => heName === 'פרשת ' + p.he)
  || ALL_PARASHIOT.find(p => clean.length >= 3 && p.he.startsWith(clean) && p.he.length <= clean.length + 2);
```

**Rashi progress bar** (v4.0): `#rashi-progress-wrap`, `#rashi-progress-bar`, `#rashi-progress-lbl`  
Styled via `.rp-bar-wrap` in styles.css. Shows per-chapter progress, hides on completion.

**Rashi retry logic (v4.0)**:
```js
for (let attempt = 0; attempt < 3 && !success; attempt++) {
  await delay(attempt === 0 ? 300 : 1500 * attempt); // backoff
  // fetch chapter with commentary=1
}
```

---

## Calendar & Zmanim (js/calendar.js)

- `loadCalendar()` → parallel: Hebcal zmanim, Hebrew date, holiday events, candles/havdalah
- Location: GPS → `setCity(city)` → predefined cities or manual coords
- Zmanim source: `https://www.hebcal.com/zmanim?cfg=json&...`
- Stores zmanim in `appState._lastZmanim` for notification scheduling

---

## Content Tabs (js/content.js)

| Function | Source | Key detail |
|---|---|---|
| `loadHalacha()` | Sefaria `Kitzur_Shulchan_Arukh` | `getKitzurRef(dayOfYear)` calculates section |
| `loadLashon()` | Sefaria `Chofetz_Chaim` | Cycles 20 parts |
| `loadIgeret()` | Sefaria `Iggeret_HaRamban` | Full letter, split into sections |
| `loadDafYomi()` | Sefaria calendars API | `calendar_items` → daf ref |
| `loadMishnaYomi()` | Sefaria calendars API | `calendar_items` → mishna ref |
| `loadTanach929()` | Sefaria calendars API | `calendar_items` → tanach ref |

---

## APIs Used

| API | Purpose | Notes |
|---|---|---|
| `https://www.hebcal.com/converter` | Hebrew date | `?cfg=json&date=YYYY-MM-DD&g2h=1` |
| `https://www.hebcal.com/zmanim` | Prayer times | `?cfg=json&date=...&latitude=...&longitude=...&elevation=...` |
| `https://www.hebcal.com/hebcal` | Events/parasha | `?v=1&cfg=json&s=on&start=...&end=...` |
| `https://www.sefaria.org/api/texts/{ref}` | Torah/prayer text | `?lang=he&commentary=0&context=0` |
| `https://www.sefaria.org/api/texts/{ref}?commentary=1` | Rashi | Used only for parasha |
| `https://www.sefaria.org/api/calendars` | Daily learning | `?diaspora=0` |

**Rate limiting**: `sefariaText()` has 0ms default delay; `fetchWithDelay()` has 300ms default. Rashi loop adds 300ms between chapters.

---

## CSS Variables (styles.css)

```css
--bg: #0e0905          /* dark brown background */
--surface: #1c1208     /* slightly lighter surface */
--card: #251a0c        /* card backgrounds */
--border: #3d2b14      /* borders */
--gold: #c9a54a        /* primary accent */
--gold-dim: #7a6128    /* muted gold */
--cream: #f5ead4       /* main text */
--text: #e8d9b8        /* secondary text */
--muted: #8a7355       /* muted text */
--addition: #7ed6a0    /* green-mint for siddur additions */
--addition-bg: rgba(126,214,160,.08)
--addition-border: rgba(126,214,160,.45)
--font-size: 16px      /* user-adjustable via setFont() */
--radius: 14px
```

**Siddur-specific classes**:
- `.siddur-addition-block` – green bordered box for special additions (יעלה ויבוא, הלל etc.)
- `.siddur-section-divider` – 1px separator between regular prayer sections
- `#rashi-progress-wrap` / `#rashi-progress-bar` / `#rashi-progress-lbl` – Rashi loading indicator

---

## Known Issues / Limitations

1. **אשכנז/עדות המזרח** – many sections fallback to ספרד refs (Sefaria API limitation)
2. **Rashi ch 6–7 Leviticus** – Sefaria sometimes rate-limits; retry handles it but can be slow (~30s)
3. **Qibla compass** – depends on device sensor calibration; iOS needs `requestCompassPermission()`
4. **Parasha double-match** – handled by v4.0 exact-first matching

---

## Common Fixes Cheatsheet

| Problem | File | What to look for |
|---|---|---|
| Wrong parasha shown | `js/content.js` | `matchP` logic in `loadParasha()` |
| Rashi not loading | `js/content.js` | `loadRashiForRef()` – check retry loop |
| Siddur text word-per-line | `js/siddur.js` | `_staticTextToHtml()` grouping logic |
| Siddur spacing too large | `js/siddur.js` + `styles.css` | `.siddur-section-divider` margin |
| Wrong zman shown | `js/calendar.js` | field names in Hebcal zmanim response |
| Tab not loading | `js/app.js` | `loadTab()` switch-case |
| Settings not saving | `js/settings.js` | `saveState()` + `appState` |
| Cache stale after deploy | `sw.js` | bump `APP_VERSION` + `utils.js` `APP_VERSION` |
| New JS file added | `index.html` + `sw.js` | add `<script src>` + add to `STATIC[]` |

---

## Deploy Checklist

1. Bump `APP_VERSION` in **both** `js/utils.js` AND `sw.js`
2. If adding a new JS file: add `<script src="js/newfile.js">` to `index.html` (before `init.js`) AND add `'./js/newfile.js'` to `STATIC[]` in `sw.js`
3. Push to `main` branch → GitHub Pages auto-deploys
4. Hard-reload in browser (or use ⚙️ → ניקוי Cache) to clear SW cache
