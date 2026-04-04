# Kodesh App – Agent Memory File
**Last updated:** v5.17 (April 4, 2026)
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
  app.js          – showTab, loadTab, changeDay, loadHebrewDate (caches _lastHebrewDate)
  tehilim.js      – initTehilim, loadTehilim, scrollTehilimTop (150ms timeout)
  calendar.js     – loadCalendar, loadZmanim (chametz times), loadEvents (fast times), setCity
  content.js      – loadParasha, loadAliyaText, _kickoffHaftara, loadSpecificParasha,
                    PARASHA_ALIYOT (54 static), HAFTARA_REFS (54 static haftara refs)
  tefilot.js      – initTefilot, showTefila, TEFILOT static texts
  siddur-inserts.js – wrapSeasonalParagraphs() – post-render HTML string wrapping
  siddur.js       – getSiddurSections, loadSiddur, _renderParagraphs, _fetchSectionHtml,
                    AL_HANISSIM_CHANUKA, AL_HANISSIM_PURIM, CHATZI_KADDISH static texts
  omer.js         – buildOmerText, getOmerDay, getOmerDayForDisplay, showOmerNow
  brachot.js      – BRACHOT data, showBracha, setBrachotNusach, loadBrachot
  misc.js         – updateDoneButton, toggleDone, Qibla/compass
  init.js         – init(), error handlers
```

---

## Key Architecture

### Siddur Text Pipeline
1. Sefaria → `data.he[]` array, one verse per element
2. `heFlat()` flattens nested arrays
3. `cleanSefariaHtml()`: seasonal `<small>` → `\uE001text\uE001` markers
4. `buildParagraphs()`:
   - 60+ BREAK_BEFORE patterns (Amida brachot, kaddish, kedusha, psalms, tachanun…)
   - Sof-pasuk flush: `U+05C3` → `:` at verse end triggers paragraph break
   - BRACHA_END flush: `ברוך אתה יי`
   - MAX_WORDS_PER_PARA = 45
5. `_renderParagraphs(pars, isAdd)` → HTML string
6. `wrapSeasonalParagraphs(html)` post-processes seasonal inserts in green blocks
7. HTML injected into `sc-${id}` placeholders

### Siddur Conditional Sections
- **יעלה ויבוא** – R"C / Chol HaMoed
- **על הנסים** – Chanuka / Purim (static texts in all 3 tefilot + birkat)
- **הלל** – R"C, Chanuka, Chol HaMoed (Psalms 113-118)
- **מוסף** – Rosh Chodesh
- **ספירת העומר** – Nisan 16 – Sivan 5 (computed from Hebrew date)
- **תחנון** – hidden on R"C, Chol HaMoed, Chanuka, Purim, Sun, Shabbat, Yom Tov, Lag BaOmer…
- **אבינו מלכנו** – Aseret Yemei Teshuva, fast days (not Erev Shabbat)

### Parasha / Haftara
- **PARASHA_ALIYOT** – static table of all 54 parshiot
- **HAFTARA_REFS** – static table of 54 haftara refs (Ashkenaz Israel)
- Hebcal `leyning` primary source; HAFTARA_REFS as fallback
- `_kickoffHaftara`: multi-chapter fallback (splits "Book Ch1:V1-Ch2:V2" per chapter)
- `loadSpecificParasha`: always loads haftara via Hebcal or HAFTARA_REFS

### Omer (omer.js)
- `getOmerDay()`: computed from Hebrew date (Nisan 16=1, Iyar 1=16, Sivan 5=49)
- `getOmerDayForDisplay()`: after tzet → advance; Nisan 15 evening → day 1
- Full text: לשם יחוד, ברכה, ספירה, הרחמן, למנצח, אנא בכח, יהי רצון, עלינו

### Special Zmanim (calendar.js)
- Erev Pesach: `sofZmanAchilatChametz` + `sofZmanBiurChametz` from Hebcal
- Fast days: `Fast begins` / `Fast ends` from Hebcal events API
- All special rows auto-show/hide in `z-special-rows` div

---

## Known Issues (as of v5.14)

### 🟡 Siddur – Fine-tuning edge cases
Some Sefaria sections may still have suboptimal breaks if verses lack sof-pasuk marks.

### 🟡 Winter/Summer Season Detection
`_isWinterSeason()` uses hardcoded months. Could use Shmini Atzeret/Pesach dates.

### 🟡 Birkat HaMazon – Sefaria ref fragility
Uses multi-ref fallback. If Sefaria changes API, may need new refs.

---

## Recently Fixed

### v5.17 (April 4, 2026)
- ✅ Rashi: fixed direct endpoint parsing (flat(Infinity), chapterLengths tracking)
- ✅ Siddur: initSiddur is async, fetches today events from Hebcal if missing
- ✅ Siddur: Hallel/Torah reading/Yom Tov conditions now include isYomTov
- ✅ Siddur: Omer section added to arvit with dynamic day text
- ✅ Siddur: seasonal inserts filter by season (winter/summer visibility)
- ✅ Chametz times: uses sofZmanTfilla as accurate base, await loadHebrewDate
- ✅ Motzaei Shabbat: fixed missing words (למען תהילתך, מזוני רויחי)
- ✅ Daf Yomi: added Rashi + Steinsaltz commentary toggle buttons
- ✅ Mishna Yomi: added Bartenura + Steinsaltz commentary toggle buttons
- ✅ Top/bottom tab nav scroll sync (scroll one, other follows)
- ✅ Expandable date navigation drawer (tap date chip in topbar)
- ✅ Date offset badge on topbar when not on today
- ✅ Date drawer affects all screens (global day navigation)

### v5.16 (April 3, 2026)
- ✅ Rashi: uses direct "Rashi on Book Ch" endpoint (much faster, smaller response)
- ✅ Rashi: AbortController timeout (20s) prevents hanging on slow Sefaria responses
- ✅ Siddur seasonal inserts: filters by season (hides winter inserts in summer, vice versa)
- ✅ Siddur seasonal inserts: hides R"C/holiday inserts when not applicable
- ✅ Omer: showOmerNow() force-loads Hebrew date if not cached
- ✅ Chametz times: fallback computation from sunrise when Hebcal doesn't return fields
- ✅ Chametz times: checks alternative Hebcal field names (GRA/MGA variants)

### v5.14 (April 3, 2026)
- ✅ Siddur paragraph spacing – sof-pasuk flush, 60+ patterns, MAX_WORDS=45
- ✅ על הנסים in shacharit/mincha/arvit (Chanuka + Purim)
- ✅ Omer detection from Hebrew date (not just Hebcal events)
- ✅ Omer Nisan 15 evening → day 1
- ✅ skipTachanun: Lag BaOmer, Yom HaAtzmaut, Tu BiShvat, etc.
- ✅ Haftara: multi-chapter fallback + static HAFTARA_REFS for all 54 parshiot
- ✅ Haftara loads for manually-selected parshiot
- ✅ Birkat HaMazon multi-ref fallback (fixes 500 error)
- ✅ ברכת הלבנה complete nusach
- ✅ הבדלה with הנה אל ישועתי
- ✅ תפילה למדינה full Rabbanut nusach
- ✅ על המחיה per-holiday inserts
- ✅ ברכת האילנות correct יהי רצון

### v5.13
- ✅ Omer full text + reminder, brachot fixes, birkat hamazon

### v5.12
- ✅ Brachot tab with 22 brachot + 3 nusachim

### v5.11
- ✅ Combined parshiot, haftara, fast times

### v5.10
- ✅ Static PARASHA_ALIYOT for 54 parshiot

### v5.9
- ✅ Infinite reload loop fix

---

## Pending / Future Work
- Shabbat-specific siddur (Kabbalat Shabbat, Musaf)
- Half-Hallel for Rosh Chodesh
- Winter/summer from Hebcal dates
- Font size slider
- Offline improvements
- Selichot for fast days
