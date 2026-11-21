// ═══════════════════════════════════════════════════════════════════════
// TAAMIM-DATA.JS – טעמי המקרא: names + signs for the "רשימת הטעמים" table of the תיקון קוראים view
// Code points are the Unicode "Hebrew accent" characters (names cross-checked in
// Tests/test_tikkun.py against Python's unicodedata); the grouping (מפסיקים / מחברים) and the Hebrew
// names are the standard ones of the Chumash printings. In the Torah text the zarqa is written with
// U+05AE (Unicode ZINOR) in the Westminster/OSHB text and U+0598 (ZARQA) in some others, so both are listed.
// ═══════════════════════════════════════════════════════════════════════

// cps = code points shown on the sample letter; en = lower-case Unicode name stem (for tests);
// pos = where the sign sits relative to the letter; note = short Hebrew remark
const TAAMIM_DISJUNCTIVE = [
  { he: 'סוף פסוק (סילוק)', cps: [0x5BD, 0x5C3], en: 'meteg+sof pasuq', pos: 'מתחת + נקודותיים', note: 'מסיים את הפסוק; הסילוק הוא מעין געיה מתחת לאות האחרונה לפני ׃' },
  { he: 'אתנחתא', cps: [0x591], en: 'etnahta', pos: 'מתחת', note: 'מחלק את הפסוק לשניים' },
  { he: 'סגולתא (סגול)', cps: [0x592], en: 'segol', pos: 'מעל, בסוף המילה', note: 'שלוש נקודות במשולש; אינה נקודת הסגול' },
  { he: 'שלשלת', cps: [0x593], en: 'shalshelet', pos: 'מעל', note: 'נדיר – בתורה רק בארבעה מקומות' },
  { he: 'זקף קטן', cps: [0x594], en: 'zaqef qatan', pos: 'מעל', note: 'שתי נקודות אנכיות' },
  { he: 'זקף גדול', cps: [0x595], en: 'zaqef gadol', pos: 'מעל', note: 'שתי נקודות אנכיות עם קו ביניהן' },
  { he: 'רביע', cps: [0x597], en: 'revia', pos: 'מעל', note: 'מעוין קטן' },
  { he: 'טפחא (טרחא)', cps: [0x596], en: 'tipeha', pos: 'מתחת, בתחילת המילה', note: 'בא בדרך כלל אחרי מרכא' },
  { he: 'פשטא', cps: [0x599], en: 'pashta', pos: 'מעל, בסוף המילה', note: 'בא בסוף המילה; אם הטעם במילה לפני כן – נכפל' },
  { he: 'יתיב', cps: [0x59A], en: 'yetiv', pos: 'מתחת-ימין, בתחילת המילה', note: 'קודם למילה, לפני אות הטעם' },
  { he: 'תביר', cps: [0x59B], en: 'tevir', pos: 'מתחת', note: '' },
  { he: 'זרקא', cps: [0x5AE], alt: [0x598], en: 'zinor', pos: 'מעל, בסוף המילה', note: 'מסומן ב-֮ (ובחלק מהדפוסים ב-֘)' },
  { he: 'גרש', cps: [0x59C], en: 'geresh', pos: 'מעל', note: '' },
  { he: 'גרשיים', cps: [0x59E], en: 'gershayim', pos: 'מעל', note: 'שני גרשים' },
  { he: 'פזר', cps: [0x5A1], en: 'pazer', pos: 'מעל', note: '' },
  { he: 'תלישא גדולה', cps: [0x5A0], en: 'telisha gedola', pos: 'מעל, בתחילת המילה', note: 'קודם לאות' },
  { he: 'קרני פרה', cps: [0x59F], en: 'qarney para', pos: 'מעל', note: 'נדיר – בתורה רק במקום אחד' },
  { he: 'לגרמיה (מונח + פסק)', cps: [0x5A3, 0x5C0], en: 'munah+paseq', pos: 'מתחת + קו אנכי', note: 'מונח ואחריו פסק – מפסיק' },
];
const TAAMIM_CONJUNCTIVE = [
  { he: 'מונח', cps: [0x5A3], en: 'munah', pos: 'מתחת', note: '' },
  { he: 'מרכא', cps: [0x5A5], en: 'merkha', pos: 'מתחת', note: 'לפני טפחא ואתנחתא ועוד' },
  { he: 'מרכא כפולה', cps: [0x5A6], en: 'merkha kefula', pos: 'מתחת', note: 'שתי מרכאות' },
  { he: 'מהפך', cps: [0x5A4], en: 'mahapakh', pos: 'מתחת', note: 'לפני פשטא' },
  { he: 'דרגא', cps: [0x5A7], en: 'darga', pos: 'מתחת', note: 'לפני תביר' },
  { he: 'קדמא (אזלא)', cps: [0x5A8], en: 'qadma', pos: 'מעל', note: 'בא לפני פשטא או גרש' },
  { he: 'תלישא קטנה', cps: [0x5A9], en: 'telisha qetana', pos: 'מעל, בסוף המילה', note: 'בא אחרי האות' },
  { he: 'ירח בן יומו (גלגל)', cps: [0x5AA], en: 'yerah ben yomo', pos: 'מתחת', note: 'לפני פזר' },
];
// signs that appear mainly outside the Torah, plus the helper signs
const TAAMIM_OTHER = [
  { he: 'עולה', cps: [0x5AB], en: 'ole', pos: 'מעל', note: 'עולה ויורד – בספרי אמ״ת' },
  { he: 'עילוי', cps: [0x5AC], en: 'iluy', pos: 'מעל', note: 'בספרי אמ״ת' },
  { he: 'דחי', cps: [0x5AD], en: 'dehi', pos: 'מתחת', note: 'בספרי אמ״ת' },
  { he: 'אתנח הפוך', cps: [0x5A2], en: 'atnah hafukh', pos: 'מתחת', note: 'סימן נדיר' },
  { he: 'גרש מוקדם', cps: [0x59D], en: 'geresh muqdam', pos: 'מעל', note: 'גרש הבא בתחילת המילה' },
  { he: 'געיה (מתג)', cps: [0x5BD], en: 'meteg', pos: 'מתחת', note: 'סימן הטעמה משנית; אינו טעם' },
  { he: 'מקף', cps: [0x5BE], en: 'maqaf', pos: 'בין מילים', note: 'מחבר שתי מילים לטעם אחד' },
];

// the sign on a carrier letter (so it is shown the way it is written: a mark needs a letter to sit on)
function taamimSign(cps, carrier) {
  return (carrier || 'א') + cps.map(c => String.fromCodePoint(c)).join('');
}
