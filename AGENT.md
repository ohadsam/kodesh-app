# Kodesh App – Agent Memory File
**Last updated:** v5.7 (March 31, 2026)
**URL:** https://ohadsam.github.io/kodesh-app/
**Stack:** Vanilla JS PWA, GitHub Pages, RTL Hebrew, Sefaria API + Hebcal API

## File Structure
```
js/
  utils.js        – State, dates, fetch, buildParagraphs, cleanSefariaHtml, logs
  settings.js     – ALL_TABS, tab visibility, openSettings, setFont, nuclearReset
  app.js          – showTab (scroll-to-top), loadTab, changeDay
  calendar.js     – loadCalendar, loadZmanim, setCity
  tehilim.js      – initTehilim, loadTehilim, scrollTehilimTop (150ms timeout)
  content.js      – loadHalacha, loadParasha, loadAliyaText, loadRashiForRef,
                    loadOnkelosForRef, loadSpecificParasha, loadLashon, loadIgeret,
                    loadDaf, loadMishna, load929
  tefilot.js      – initTefilot, showTefila, TEFILOT static texts
  siddur-inserts.js – wrapSeasonalParagraphs() – post-render HTML string wrapping
  siddur.js       – Full siddur: getSiddurSections, loadSiddur, _renderParagraphs
  network-log.js  – Fetch patching, 10-min retention, renderNetworkLog
  misc.js         – updateDoneButton, toggleDone, Qibla/compass
  init.js         – init(), error handlers
```

## Deploy Checklist
1. Bump `APP_VERSION` in **utils.js** AND **sw.js** (must match)
2. Update `?v=X.X` on all script tags in index.html
3. Update `גרסה X.X` in splash HTML in index.html
4. Update `var V = 'X.X'` in inline HEAD script
5. Push → GitHub Pages auto-deploys
6. Press **"💥 איפוס מוחלט"** in settings OR reload twice

## ALL_TABS (settings.js)
```
calendar(fixed), siddur, halacha, lashon, tehilim, daf, mishna, 929,
parasha, igeret, tefilot, qibla, logs(hidden), network(hidden)
```

## Key Architecture Decisions

### Siddur Text Pipeline
1. Sefaria returns Hebrew in `data.he[]` – one verse per array element
2. `heFlat()` flattens nested arrays
3. `cleanSefariaHtml()` processes each verse:
   - Non-seasonal `<small>` → muted inline span
   - Seasonal `<small>` (בקיץ/בחרף/לר"ח/לפסח etc.) → `\uE001text\uE001` markers
4. `buildParagraphs()` joins verses into paragraphs:
   - Breaks BEFORE: לשם יחוד, יהי רצון, שמע ישראל, ויאמר, הללויה, מזמור, etc.
   - Flushes AFTER: ברוך אתה יהוה/יי (BRACHA_END)
   - MAX_WORDS_PER_PARA = 80 (prevents 500-word single blocks)
   - Seasonal markers split into `\uE002label\uE003content\uE004` paragraphs
5. `_renderParagraphs(pars, isAdd)` → HTML string
   - isAdd=true: all green (var(--addition)), overrides muted spans
   - Seasonal blocks: green box with label
6. `wrapSeasonalParagraphs(html)` post-processes: wraps יעלה ויבוא/מוריד הגשם/ותן ברכה etc.
7. HTML injected into `sc-${id}` divs; cached in memory

### isSeasonalInsert regex (utils.js)
Detects seasonal `<small>` content:
```js
/(?:^|[לב])(?:ר[".]ח|ראש.?ח)/ || /(?:^|[לב])(?:פסח|שבועות|סוכות|חנוכה|פורים|יו"ט)/
|| /(?:^|ב)(?:קיץ|חרף|חורף)/ || /^(?:טל|גשם|מטר)/
```
**Key**: requires ר"ח to have quote separator to avoid false positives on רחמן/ברחמים.

### Parasha / Aliyot
- Hebcal API provides `leyning: {"1":"Leviticus 9:1-9:16",...}` – use `.trim()` only!
- **`_currentAliyaRef`** guards against stale Rashi/Onkelos callbacks
- Reset `_rashiLoading = false` and `_onkelosLoading = false` at start of `loadAliyaText`
- Rashi/Onkelos check `_currentAliyaRef !== torahRef` and discard if mismatch
- `loadSpecificParasha` fetches Hebcal 60-day window to find aliyot for any parasha
- Bottom aliya nav: `aliya-nav-bottom` div, updated by `_updateAliyaNavBottom()`

### Siddur Calendar (`_siddurCal`)
```js
{ isRoshChodesh, isCholHamoed, isChanuka, isPurim, isOmer, isAvinuMalkeinu,
  isTorahReading, isSunday, isShabbat, isYomTov, dow, skipTachanun }
```
- `dow` stored for psalm-of-day selection
- Winter = months 10,11,12,1,2,3,4 (Israel: mashiv haruach season)

### Psalm of Day
- `PSALM_BY_DOW = [24, 48, 82, 94, 81, 93, 92]` (Sun–Sat)
- `window._psalmOfDayIntro` stores the "היום יום..." intro text
- `window._psalmOfDayNum` stores the psalm number

### Cache
- SW v5.7: network-first for app JS/CSS/HTML
- Inline HEAD script checks `var V = '5.7'` vs localStorage, unregisters old SW if mismatch
- Siddur content cached in memory (`_siddurCache` Map) per session

## CSS Variables
```css
--bg:#0e0905 --surface:#1c1208 --card:#251a0c --border:#3d2b14
--gold:#c9a54a --gold-dim:#7a6128 --cream:#f5ead4 --text:#e8d9b8
--muted:#8a7355 --addition:#7ed6a0 --addition-bg:rgba(126,214,160,.08)
--addition-border:rgba(126,214,160,.45) --font-size:16px --radius:14px
```

## Known Issues (as of v5.7)
1. **Siddur spacing** – Still has very long paragraphs (>80w) in some sections (אשרי, תחנון). MAX_WORDS_PER_PARA=80 helps but some content naturally exceeds this.
2. **יעלה ויבוא** – wrapSeasonalParagraphs should catch it; if not visible check that `_siddurCal.isRoshChodesh || .isCholHamoed` is true.
3. **אשכנז/עדות המזרח** – Many sections fallback to ספרד (Sefaria API limitation).
4. **Rashi load time** – Leviticus ch 6-7 sometimes rate-limited (15-30s).

## Pending / Future
- Hallel full text on Rosh Chodesh
- Musaf for Shabbat
- Evening prayers (Arvit) sections
- Settings: font size slider
