// Chofetz Chaim (שמירת הלשון / הלכות לשון הרע) – structure + daily-portion planner.
// Refs are the ones loadLashon already used before v5.136 (base + ',_Principle_N').
// TODO: verify source – the sandbox blocks Sefaria, so they were not re-fetched on 2026-10-08.

const LASHON_PARTS = [
  { base: 'Chafetz_Chaim,_Part_One,_The_Prohibition_Against_Lashon_Hara,_Principle_', klalim: 10, label: 'חלק א (איסור לשון הרע)' },
  { base: 'Chafetz_Chaim,_Part_Two,_The_Prohibition_Against_Rechilut,_Principle_',    klalim: 9,  label: 'חלק ב (איסור רכילות)' },
];
const LASHON_HE_LETTERS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י'];
const LASHON_CHUNK_CHARS = 1000;   // ≈ 2-3 minutes of reading per day
const LASHON_EPOCH_DAY = 19723;    // 2024-01-01 in days since 1970 – any fixed day works, it only anchors the cycle

// Every klal of both parts, in order: [{ref, label}]
function lashonKlalim() {
  const out = [];
  LASHON_PARTS.forEach(p => {
    for (let k = 1; k <= p.klalim; k++) out.push({ ref: p.base + k, label: `${p.label} – כלל ${LASHON_HE_LETTERS[k]}` });
  });
  return out;
}

// Greedy packing: consecutive seifim of ONE klal up to ~LASHON_CHUNK_CHARS (at least one seif).
// klalTexts: array (per klal, same order as lashonKlalim()) of arrays of seif strings.
// Returns [{ref, label, from, to}] with 0-based from / exclusive to.
function lashonBuildPlan(klalim, klalTexts, maxChars = LASHON_CHUNK_CHARS) {
  const plan = [];
  klalim.forEach((k, ki) => {
    const seifim = klalTexts[ki] || [];
    let from = 0, len = 0;
    for (let i = 0; i < seifim.length; i++) {
      const l = String(seifim[i]).length;
      if (i > from && len + l > maxChars) { plan.push({ ref: k.ref, label: k.label, from, to: i }); from = i; len = 0; }
      len += l;
    }
    if (seifim.length > from) plan.push({ ref: k.ref, label: k.label, from, to: seifim.length });
  });
  return plan;
}

// Continuous day counter (no year-end seam, unlike day-of-year % N)
function lashonDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) - LASHON_EPOCH_DAY;
}

function lashonPickEntry(plan, date) {
  if (!plan.length) return null;
  const n = lashonDayNumber(date);
  return plan[((n % plan.length) + plan.length) % plan.length];
}
