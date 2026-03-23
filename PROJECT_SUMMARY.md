# 📖 לימוד יומי – סיכום פרויקט

## מהות הפרויקט
PWA (Progressive Web App) בעברית לאנדרואיד/Xiaomi, מותקנת דרך GitHub Pages.  
**URL**: `https://ohadsam.github.io/kodesh-app/`  
**גרסה נוכחית**: 3.9  
**קבצים**: `index.html` (הכל בקובץ אחד), `manifest.json`, `sw.js`, `icons/`

---

## לשוניות האפליקציה

| לשונית | תוכן | מקור |
|---|---|---|
| 📅 לוח | תאריך עברי, זמני היום, חגים | Hebcal API |
| 📕 סידור | שחרית/מנחה/ערבית/ברכת המזון/ק"ש על המיטה | Sefaria API |
| 📖 הלכה | קיצור שו"ע יומי (2 סעיפים) | Sefaria |
| 📚 דף יומי | דף בבלי יומי | Sefaria Calendar |
| 📜 משנה | משנה יומי | Sefaria Calendar |
| ✡️ 929 | פרק תנ"ך יומי | Sefaria Calendar |
| 🙏 תהילים | לפי יום בחודש העברי | Sefaria |
| 📜 פרשה | פרשת השבוע + עליות + רש"י משולב | Sefaria + Hebcal |
| 🗣 לשה"ר | חפץ חיים – 20 חלקים מתחלפים | Sefaria |
| ✉️ אגרת | אגרת הרמב"ן | Sefaria |
| 🤲 תפילות | 4 תפילות סטטיות | סטטי |
| 🧭 מצפן | מצפן תפילה לכותל המערבי | GPS + DeviceOrientation |
| 🐛 לוגים | לוג מערכת בזמן אמת | פנימי |

---

## ארכיטקטורת הסידור

### נוסחים (3 נוסחים מספריא)
- **ספרד**: `Weekday_Siddur_Sefard_Linear` – מלא
- **אשכנז**: `Siddur_Ashkenaz` – refs מאומתים (חלקי, fallback לספרד)
- **עדות המזרח**: `Siddur_Edot_HaMizrach` – refs מאומתים (חלקי, fallback לספרד)

### פונקציות מרכזיות
- `getSiddurSections(nusach, prayer)` – מייצרת את רשימת הקטעים לפי נוסח ותפילה
- `loadSiddur()` – טוען את כל הקטעים עם progress bar
- `_fetchSectionHtml(s, style, yaalehOccasion)` – מביא HTML לקטע מספריא
- `shouldShowSection(s)` – מסנן תוספות לפי יום (SIDDUR_CONDITIONS)
- `initSiddur()` – מאתחל `window._siddurCal` עם לוגיקת יום הלכתי (כולל תיקון אחרי שקיעה)

### תוספות חכמות (מוצגות/מוסתרות אוטומטית)
תחנון מוסתר בר"ח/חוה"מ/חנוכה/פורים/ראשון/שבת.  
יעלה ויבוא, הלל, קריאת התורה, מוסף, אבינו מלכנו, ספירת העומר, על הנסים – כל אחד לפי תנאי.  
**עיצוב תוספות**: ירוק-מנטה `#7ed6a0`, נטוי, מודגש, עם תווית "מתי נאמר".

### refs מאומתים – עדות המזרח ✓
```
Preparatory_Prayers: Modeh_Ani, Morning_Blessings, Torah_Blessings
Weekday_Shacharit:   Amida, The_Shema, Ashrei, Hodu, Torah_Reading, Alenu, Song_of_the_Day
Weekday_Mincha:      Amida, Alenu + למנצח (Psalms.20) לפני עלינו
Weekday_Arvit:       The_Shema, Alenu, Barchu
```

### refs מאומתים – אשכנז ✓
```
Preparatory_Prayers: Modeh_Ani, Morning_Blessings, Torah_Blessings, Tallit, Tefillin
Berachot:            Birkat_HaMazon
Kaddish:             Mourner's_Kaddish, Half_Kaddish, Kaddish_d'Rabbanan
Weekday,Minchah:     Ashrei
```

---

## פרשת השבוע + רש"י

### זרימה
1. **Hebcal** → שם הפרשה הנכון (אמין, ללא בעיות cache של ספריא)
2. **Sefaria calendars API** → חלוקת עליות
3. `loadRashiForRef(torahRef)` → מביא רש"י לפי פרק (`commentary=1`), ממפה לפסוקים לפי `chapterLengths`

### רש"י – בעיה ידועה
ספריא לא תמיד מחזיר רש"י על פסוק ראשון של פרק (למשל ויקרא 6:1 – אין רש"י).  
הפתרון הנוכחי: `chapterLengths` מונע "גלישה" של פירושים לפסוקים הלא נכונים.

---

## מצפן לכותל

### קואורדינטות הכותל
`31.77668°N, 35.23444°E`

### נוסחאות
- **iOS**: `webkitCompassHeading + 5` (תיקון סטייה מגנטית ישראל)
- **אנדרואיד**: `(360 - e.alpha + screenAngle) % 360`

---

## זמני היום (Hebcal Zmanim API)

| זמן | שדה / חישוב |
|---|---|
| עלות השחר | `alotHaShachar` |
| משיכיר | `misheyakir` |
| הנץ | `sunrise` |
| סוף ק"ש גר"א/מג"א | `sofZmanShma` / `sofZmanShmaMGA` |
| סוף תפילה גר"א/מג"א | `sofZmanTfilla` / `sofZmanTfillaMGA` |
| חצות | `chatzot` |
| מנחה גדולה/קטנה | `minchaGedola` / `minchaKetana` |
| פלג המנחה | `plagHaMincha` |
| שקיעה | `sunset` |
| צאת הכוכבים | `sunset + 18 דקות` |
| הדלקת נרות | Hebcal candles API `b=18&m=42` |
| הבדלה | Hebcal havdalah API `m=42` |

---

## Cache ו-Service Worker

- **SW**: `kodesh-v{APP_VERSION}` – מחיקת כל caches ישנים בכל שדרוג
- **JS**: בטעינה ראשונה עם גרסה חדשה → מנקה localStorage + מרענן
- **Siddur cache**: session-only (אין persistence), מנוקה בשינוי נוסח

---

## עיצוב

- רקע: `#14100a` (כהה-חום)
- טקסט ראשי: `var(--cream)` `#f5edd6`
- זהב: `var(--gold)` `#c9a54a`
- תוספות: `var(--addition)` `#7ed6a0` (ירוק-מנטה)
- גופנים: `Frank Ruhl Libre` (עברי), `Heebo` (UI)
- RTL מלא

---

## בעיות ידועות פתוחות

1. **אשכנז/עדות המזרח** – חלק גדול מהקטעים fallback לספרד (ספריא מגביל refs)
2. **ברכת המזון עדות המזרח** – אין ref, fallback לספרד
3. **מצפן** – תלוי בכיול חיישן המכשיר, דורש כיול ידני לפעמים
4. **רש"י** – slow load (3 API calls, 300ms כל אחד) + פסוק ראשון של פרק לפעמים ללא רש"י

---

## קבצי פרויקט

```
kodesh-app/
├── index.html      (~3700 שורות – הכל בקובץ אחד)
├── manifest.json
├── sw.js
└── icons/
    ├── icon.svg
    ├── icon-192.png
    └── icon-512.png
```
