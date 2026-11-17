// ═══════════════════════════════════════════════════════════════════════
// RAMBAM-DATA.JS – Mishneh Torah structure for the "ספרי הרמב"ם" sub-tab
//
// 14 sefarim → 84 hilchot sets (the 4 introductory items of Hebcal's cycle are not included).
// English titles and chapter counts are Hebcal's `mishnehTorah.json` (@hebcal/learning 6.13.2,
// which builds Sefaria links as "Mishneh_Torah,_<Title>.<perek>"), cross-checked in
// Tests/test_rambam_books.py. Hebrew names/grouping are the standard ones.
// TODO: verify source – the sandbox cannot reach sefaria.org, so the chapter counts were
// NOT re-checked against Sefaria's own index. Run
//   python3 .claude/skills/sefaria-api/scripts/sefaria_probe.py rambam-check
// on a machine with network access (it compares every set's chapter count and Steinsaltz coverage).
// ═══════════════════════════════════════════════════════════════════════

// [Sefaria title, Hebrew name, chapters]
const RAMBAM_SEFARIM = [
  { id: 'madda', he: 'ספר המדע', hil: [
    ['Foundations of the Torah', 'הלכות יסודי התורה', 10],
    ['Human Dispositions', 'הלכות דעות', 7],
    ['Torah Study', 'הלכות תלמוד תורה', 7],
    ['Foreign Worship and Customs of the Nations', 'הלכות עבודה זרה וחוקות הגויים', 12],
    ['Repentance', 'הלכות תשובה', 10],
  ] },
  { id: 'ahava', he: 'ספר אהבה', hil: [
    ['Reading the Shema', 'הלכות קריאת שמע', 4],
    ['Prayer and the Priestly Blessing', 'הלכות תפילה וברכת כהנים', 15],
    ['Tefillin, Mezuzah and the Torah Scroll', 'הלכות תפילין ומזוזה וספר תורה', 10],
    ['Fringes', 'הלכות ציצית', 3],
    ['Blessings', 'הלכות ברכות', 11],
    ['Circumcision', 'הלכות מילה', 3],
    ['The Order of Prayer', 'סדר תפילות כל השנה', 4],
  ] },
  { id: 'zmanim', he: 'ספר זמנים', hil: [
    ['Sabbath', 'הלכות שבת', 30],
    ['Eruvin', 'הלכות עירובין', 8],
    ['Rest on the Tenth of Tishrei', 'הלכות שביתת עשור', 3],
    ['Rest on a Holiday', 'הלכות שביתת יום טוב', 8],
    ['Leavened and Unleavened Bread', 'הלכות חמץ ומצה', 9],
    ['Shofar, Sukkah and Lulav', 'הלכות שופר וסוכה ולולב', 8],
    ['Sheqel Dues', 'הלכות שקלים', 4],
    ['Sanctification of the New Month', 'הלכות קידוש החודש', 19],
    ['Fasts', 'הלכות תעניות', 5],
    ['Scroll of Esther and Hanukkah', 'הלכות מגילה וחנוכה', 4],
  ] },
  { id: 'nashim', he: 'ספר נשים', hil: [
    ['Marriage', 'הלכות אישות', 25],
    ['Divorce', 'הלכות גירושין', 13],
    ['Levirate Marriage and Release', 'הלכות ייבום וחליצה', 8],
    ['Virgin Maiden', 'הלכות נערה בתולה', 3],
    ['Woman Suspected of Infidelity', 'הלכות סוטה', 4],
  ] },
  { id: 'kedusha', he: 'ספר קדושה', hil: [
    ['Forbidden Intercourse', 'הלכות איסורי ביאה', 22],
    ['Forbidden Foods', 'הלכות מאכלות אסורות', 17],
    ['Ritual Slaughter', 'הלכות שחיטה', 14],
  ] },
  { id: 'hafla', he: 'ספר הפלאה', hil: [
    ['Oaths', 'הלכות שבועות', 12],
    ['Vows', 'הלכות נדרים', 13],
    ['Nazariteship', 'הלכות נזירות', 10],
    ['Appraisals and Devoted Property', 'הלכות ערכין וחרמין', 8],
  ] },
  { id: 'zeraim', he: 'ספר זרעים', hil: [
    ['Diverse Species', 'הלכות כלאים', 10],
    ['Gifts to the Poor', 'הלכות מתנות עניים', 10],
    ['Heave Offerings', 'הלכות תרומות', 15],
    ['Tithes', 'הלכות מעשרות', 14],
    ["Second Tithes and Fourth Year's Fruit", 'הלכות מעשר שני ונטע רבעי', 11],
    ['First Fruits and other Gifts to Priests Outside the Sanctuary', 'הלכות ביכורים ושאר מתנות כהונה שבגבולין', 12],
    ['Sabbatical Year and the Jubilee', 'הלכות שמיטה ויובל', 13],
  ] },
  { id: 'avoda', he: 'ספר עבודה', hil: [
    ['The Chosen Temple', 'הלכות בית הבחירה', 8],
    ['Vessels of the Sanctuary and Those who Serve Therein', 'הלכות כלי המקדש והעובדין בו', 10],
    ['Admission into the Sanctuary', 'הלכות ביאת מקדש', 9],
    ['Things Forbidden on the Altar', 'הלכות איסורי מזבח', 7],
    ['Sacrificial Procedure', 'הלכות מעשה הקרבנות', 19],
    ['Daily Offerings and Additional Offerings', 'הלכות תמידין ומוספין', 10],
    ['Sacrifices Rendered Unfit', 'הלכות פסולי המוקדשין', 19],
    ['Service on the Day of Atonement', 'הלכות עבודת יום הכיפורים', 5],
    ['Trespass', 'הלכות מעילה', 8],
  ] },
  { id: 'korbanot', he: 'ספר קרבנות', hil: [
    ['Paschal Offering', 'הלכות קרבן פסח', 10],
    ['Festival Offering', 'הלכות חגיגה', 3],
    ['Firstlings', 'הלכות בכורות', 8],
    ['Offerings for Unintentional Transgressions', 'הלכות שגגות', 15],
    ['Offerings for Those with Incomplete Atonement', 'הלכות מחוסרי כפרה', 5],
    ['Substitution', 'הלכות תמורה', 4],
  ] },
  { id: 'tahara', he: 'ספר טהרה', hil: [
    ['Defilement by a Corpse', 'הלכות טומאת מת', 25],
    ['Red Heifer', 'הלכות פרה אדומה', 15],
    ['Defilement by Leprosy', 'הלכות טומאת צרעת', 16],
    ['Those Who Defile Bed or Seat', 'הלכות מטמאי משכב ומושב', 13],
    ['Other Sources of Defilement', 'הלכות שאר אבות הטומאות', 20],
    ['Defilement of Foods', 'הלכות טומאת אוכלין', 16],
    ['Vessels', 'הלכות כלים', 28],
    ['Immersion Pools', 'הלכות מקוואות', 11],
  ] },
  { id: 'nezikin', he: 'ספר נזיקין', hil: [
    ['Damages to Property', 'הלכות נזקי ממון', 14],
    ['Theft', 'הלכות גניבה', 9],
    ['Robbery and Lost Property', 'הלכות גזילה ואבידה', 18],
    ['One Who Injures a Person or Property', 'הלכות חובל ומזיק', 8],
    ['Murderer and the Preservation of Life', 'הלכות רוצח ושמירת נפש', 13],
  ] },
  { id: 'kinyan', he: 'ספר קנין', hil: [
    ['Sales', 'הלכות מכירה', 30],
    ['Ownerless Property and Gifts', 'הלכות זכייה ומתנה', 12],
    ['Neighbors', 'הלכות שכנים', 14],
    ['Agents and Partners', 'הלכות שלוחין ושותפין', 10],
    ['Slaves', 'הלכות עבדים', 9],
  ] },
  { id: 'mishpatim', he: 'ספר משפטים', hil: [
    ['Hiring', 'הלכות שכירות', 13],
    ['Borrowing and Deposit', 'הלכות שאלה ופקדון', 8],
    ['Creditor and Debtor', 'הלכות מלווה ולווה', 27],
    ['Plaintiff and Defendant', 'הלכות טוען ונטען', 16],
    ['Inheritances', 'הלכות נחלות', 11],
  ] },
  { id: 'shoftim', he: 'ספר שופטים', hil: [
    ['The Sanhedrin and the Penalties within their Jurisdiction', 'הלכות סנהדרין והעונשין המסורין להם', 26],
    ['Testimony', 'הלכות עדות', 22],
    ['Rebels', 'הלכות ממרים', 7],
    ['Mourning', 'הלכות אבל', 14],
    ['Kings and Wars', 'הלכות מלכים ומלחמות', 12],
  ] },
];

// Flat list of the 84 sets: { idx, sefer (sefer index), seferHe, en, he, ch, slug }.
// `slug` is ASCII-only: it goes into done-marker keys and DOM ids (a title like
// "Second Tithes and Fourth Year's Fruit" has an apostrophe that would break an onclick attribute).
const RAMBAM_HIL = (() => {
  const out = [];
  RAMBAM_SEFARIM.forEach((s, si) => s.hil.forEach(([en, he, ch]) => {
    out.push({ idx: out.length, sefer: si, seferHe: s.he, en, he, ch, slug: en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') });
  }));
  return out;
})();

// "Mishneh Torah, Sabbath 5" – the form Sefaria's own refs and Hebcal's links use
function rambamRef(h, ch) { return `Mishneh Torah, ${h.en} ${ch}`; }
// Steinsaltz on a whole chapter: Sefaria wants the halacha RANGE ("…4:1-20"), a bare chapter ref reads as a halacha
function rambamSteinsaltzRef(h, ch, halachot) { return `Steinsaltz on Mishneh Torah, ${h.en} ${ch}:1-${Math.max(1, halachot)}`; }
function rambamDoneKey(h, ch) { return `rb_${h.slug}_${ch}`; }
function rambamByIdx(i) { return RAMBAM_HIL[i] || null; }
function rambamTotalChapters() { return RAMBAM_HIL.reduce((a, h) => a + h.ch, 0); }

// previous / next chapter across the boundaries of hilchot sets (null at the very ends)
function rambamNeighbor(hIdx, ch, delta) {
  let h = RAMBAM_HIL[hIdx], c = ch + delta;
  if (c < 1) { if (hIdx === 0) return null; h = RAMBAM_HIL[hIdx - 1]; c = h.ch; }
  else if (c > h.ch) { if (hIdx === RAMBAM_HIL.length - 1) return null; h = RAMBAM_HIL[hIdx + 1]; c = 1; }
  return { hIdx: h.idx, ch: c };
}
