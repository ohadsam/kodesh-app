// ═══════════════════════════════════════════════════════════════════
// SIDDUR-INSERTS.JS  –  static seasonal inserts for the Amida
//
// Instead of trying to parse <small> tags from Sefaria dynamically,
// we define the known inserts explicitly with their correct:
//  • label (shown above the green block)
//  • condition (which calendar state triggers them)
//  • exactText (the Hebrew text as it comes from Sefaria, stripped of nikud)
//
// Flow: after _renderParagraphs produces HTML, postProcessInserts()
// scans the rendered HTML for matching text patterns and wraps them
// in the correct styled block.
// ═══════════════════════════════════════════════════════════════════

// Strip nikud/cantillation for matching
const _sd = s => s.replace(/[\u0591-\u05C7]/g, '').trim();

// ── Known inserts ────────────────────────────────────────────────
// Each entry:
//   label     : shown above the green block (tiny text)
//   condition : key into _siddurCal
//   match     : regex (against stripped text) OR exact stripped string
const SIDDUR_INSERTS = [
  // ── עשרת ימי תשובה ─────────────────────────────────────────────
  {
    label: 'עשי"ת',
    condition: 'isAseretYamei',   // set true for days 1-10 of Tishrei
    patterns: [
      /זכרנו לחיים/,
      /מי כמוך אב הרחמן/,
      /וכתוב לחיים טובים/,
      /בספר חיים ברכה ושלום/,
      /ונכתב ונחתם/,
      /לשנה טובה תכתב/,
    ],
  },
  // ── ראש חודש / חול המועד – יעלה ויבוא (embedded in עבודה) ──────
  {
    label: 'ר"ח / חוה"מ',
    condition: 'isRoshChodeshOrMoed',
    patterns: [
      /יעלה ויבוא ויגיע/,
    ],
  },
  // ── ברכת השנים – גשם ────────────────────────────────────────────
  {
    label: 'חורף',
    condition: 'isWinter',    // mashiv haruach season
    patterns: [
      /ותן טל ומטר לברכה/,
      /משיב הרוח ומוריד הגשם/,
      /מוריד הגשם/,
    ],
  },
  // ── ברכת השנים – טל ────────────────────────────────────────────
  {
    label: 'קיץ',
    condition: 'isSummer',
    patterns: [
      /ותן ברכה/,
      /מוריד הטל/,
    ],
  },
  // ── שבת ─────────────────────────────────────────────────────────
  {
    label: 'שבת',
    condition: 'isShabbat',
    patterns: [
      /רצה והחליצנו/,
      /מקדש השבת/,
    ],
  },
  // ── ראש חודש ────────────────────────────────────────────────────
  {
    label: 'ר"ח',
    condition: 'isRoshChodesh',
    patterns: [
      /יעלה ויבוא ויגיע/,
      /ראש החדש הזה/,
    ],
  },
  // ── יום טוב ────────────────────────────────────────────────────
  {
    label: 'יו"ט',
    condition: 'isYomTov',
    patterns: [
      /יעלה ויבוא ויגיע/,
    ],
  },
  // ── חנוכה ──────────────────────────────────────────────────────
  {
    label: 'חנוכה',
    condition: 'isChanuka',
    patterns: [
      /על הניסים ועל הפרקן.*חנוכה/,
      /בימי מתתיהו/,
    ],
  },
  // ── פורים ──────────────────────────────────────────────────────
  {
    label: 'פורים',
    condition: 'isPurim',
    patterns: [
      /על הניסים ועל הפרקן.*פורים/,
      /בימי מרדכי ואסתר/,
    ],
  },
];

// ── Build the green-block HTML for an insert ─────────────────────
function _insertBlockHtml(label, innerHtml) {
  const labelHtml = label
    ? `<span style="display:block;font-size:9px;font-family:'Heebo',sans-serif;` +
      `color:var(--addition);font-style:normal;font-weight:700;letter-spacing:.4px;` +
      `margin-bottom:2px;opacity:.9">${label}</span>`
    : '';
  return `<span class="siddur-insert" style="display:block;margin:4px 0 8px 0;` +
         `padding:6px 10px 5px;background:var(--addition-bg);` +
         `border-right:3px solid var(--addition);border-radius:0 6px 6px 0;` +
         `font-family:'Frank Ruhl Libre',serif;font-size:var(--font-size);` +
         `color:var(--addition);font-style:italic;font-weight:600;line-height:1.85">` +
         labelHtml + innerHtml + `</span>`;
}

// ── Called after rendering each section's HTML ───────────────────
// Wraps matching text in green blocks based on active calendar state.
// NOTE: This operates on the DOM element, not a string, for reliability.
function postProcessInserts(containerEl) {
  if (!containerEl) return;
  const cal = window._siddurCal || {};

  // Determine which conditions are active
  const active = new Set();
  if (cal.isRoshChodesh)              active.add('isRoshChodesh');
  if (cal.isRoshChodesh || cal.isCholHamoed) active.add('isRoshChodeshOrMoed');
  if (cal.isCholHamoed)               active.add('isCholHamoed');
  if (cal.isChanuka)                  active.add('isChanuka');
  if (cal.isPurim)                    active.add('isPurim');
  if (cal.isShabbat)                  active.add('isShabbat');
  if (cal.isYomTov)                   active.add('isYomTov');
  // Winter = mashiv haruach season: roughly Oct–Apr (months 7–1 in Hebrew calendar)
  // We detect via the mashivHaruach flag stored in cal, or approximate by month
  if (cal.isMashivHaruach || _isWinterSeason()) active.add('isWinter');
  if (!active.has('isWinter'))        active.add('isSummer');
  // עשרת ימי תשובה: Rosh Hashana through Yom Kippur (we approximate via skipTachanun + month Tishrei)
  if (cal.isAseretYamei)              active.add('isAseretYamei');

  // Walk all <p> elements in the container
  containerEl.querySelectorAll('p').forEach(p => {
    const stripped = _sd(p.textContent || '');
    for (const insert of SIDDUR_INSERTS) {
      if (!active.has(insert.condition)) continue;
      const matches = insert.patterns.some(pat =>
        typeof pat === 'string' ? stripped.includes(pat) : pat.test(stripped)
      );
      if (matches) {
        // Wrap the <p> content in a green block
        p.style.cssText = `display:block;margin:4px 0 8px 0;padding:6px 10px 5px;` +
          `background:var(--addition-bg);border-right:3px solid var(--addition);` +
          `border-radius:0 6px 6px 0;font-family:'Frank Ruhl Libre',serif;` +
          `font-size:var(--font-size);color:var(--addition);font-style:italic;` +
          `font-weight:600;line-height:1.85`;
        // Add label if not already there
        if (insert.label && !p.querySelector('.insert-label')) {
          const lbl = document.createElement('span');
          lbl.className = 'insert-label';
          lbl.style.cssText = `display:block;font-size:9px;font-family:'Heebo',sans-serif;` +
            `color:var(--addition);font-style:normal;font-weight:700;letter-spacing:.4px;` +
            `margin-bottom:2px;opacity:.9`;
          lbl.textContent = insert.label;
          p.insertBefore(lbl, p.firstChild);
        }
        break; // Only apply first matching insert
      }
    }
  });
}

// ── Season detection helper ────────────────────────────────────────
function _isWinterSeason() {
  // In Israel, mashiv haruach said roughly Oct 22 – April 15 (varies by year)
  // Simple approximation: months 10, 11, 12, 1, 2, 3, 4
  const m = new Date().getMonth() + 1; // 1-12
  return m >= 10 || m <= 4;
}
