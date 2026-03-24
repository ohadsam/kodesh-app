# לימוד יומי – Agent Reference v4.0

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
