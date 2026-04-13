# קודש App – Test Suite

## הרצה

פתח `tests/index.html` בדפדפן (יש להריץ מ-GitHub Pages או localhost עם CORS):

```
# Local server
cd /path/to/kodesh-app
python3 -m http.server 8080
# פתח: http://localhost:8080/tests/
```

## קבצי טסטים

| קובץ | תוכן |
|------|-------|
| `tests-logic.js` | לוגיקה עסקית: עומר, מצפן, עונות, תחנון, תהילים |
| `tests-api.js` | API calls: Sefaria + Hebcal |
| `tests-ui.js` | DOM, CSS, HTML structure |
| `tests-siddur.js` | Siddur refs, seasonal logic, race condition |
| `tests-omer.js` | עומר API, תהילים API, מצפן API |

## קטגוריות (Tags)

- `logic` — לוגיקה עסקית offline
- `api` — בדיקות API חיות (דורשות רשת)
- `ui` — בדיקות DOM ועיצוב
- `siddur` — סידור ספציפי
- `omer` — ספירת העומר
- `tehilim` — תהילים
- `compass` — מצפן וכיוון לכותל
- `calendar` — לוח שנה ותאריכים

## בדיקות מרכזיות

### לוגיקה עסקית
- ✅ ספירת העומר: נוסח יום 1-49 נכון
- ✅ ימים 11-19 (teens) — מחרוזת נכונה
- ✅ יום/ימים ביחיד/רבים לפי הלכה
- ✅ כיוון מצפן לכותל מפתח תקווה ~136°
- ✅ כיוון מניו יורק ~58°, מלונדון ~105°
- ✅ עונות: מוריד הטל / משיב הרוח
- ✅ לוח תחנון (ניסן, ל"ג בעומר, שבת...)
- ✅ תהילים: לוח 30 יום מכסה 1-150
- ✅ פרשות מחוברות: fuzzy matching

### API
- ✅ Sefaria: Genesis 1:1, Psalms 1/119/150
- ✅ Sefaria: שמונה עשרה contains מוריד הטל, ותן ברכה
- ✅ Sefaria calendars: daf yomi, mishna, rambam
- ✅ Hebcal: zmanim, converter, parasha+leyning
- ✅ Hebcal: שחרית לפני שקיעה

### UI
- ✅ whats-new modal: כפתור הבנתי בתוך ה-modal
- ✅ גרסה זהה ב-utils.js וב-sw.js
- ✅ כל ה-reminder toggles קיימים
- ✅ CSS: RTL, משתני צבע, גופנים

## הוספת טסט חדש

```js
suite('שם הסוויטה', () => {
  test('תיאור הטסט', async () => {
    const data = await httpGet('https://api.example.com/...');
    assert(data.field, 'field should exist');
    assertEqual(data.count, 5, 'should have 5 items');
  }, ['api', 'calendar']); // tags
});
```
