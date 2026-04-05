// ═══════════════════════════════════════════════════════════════════
// SIDDUR-INSERTS.JS  –  targeted paragraph styling for seasonal inserts
//
// Approach: after _renderParagraphs produces an HTML string,
// wrapSeasonalParagraphs() scans paragraphs for known text patterns
// and wraps matching ones in a styled green block with a label.
// Works on the HTML string BEFORE injecting into DOM – no false positives
// from scanning large combined paragraphs.
// ═══════════════════════════════════════════════════════════════════

const _sd = s => s.replace(/[\u0591-\u05C7]/g, '').trim();

// ── Build a green block wrapper ──────────────────────────────────
function _greenBlock(label, innerHtml, pStyle) {
  const lbl = label
    ? `<span style="display:block;font-size:9px;font-family:'Heebo',sans-serif;` +
      `color:var(--addition);font-style:normal;font-weight:700;letter-spacing:.4px;` +
      `margin-bottom:3px;opacity:.9">${label}</span>`
    : '';
  return `<p style="display:block;margin:4px 0 10px 0;padding:7px 12px 6px;` +
         `background:var(--addition-bg);border-right:3px solid var(--addition);` +
         `border-radius:0 6px 6px 0;font-family:'Frank Ruhl Libre',serif;` +
         `font-size:var(--font-size);color:var(--addition);font-style:italic;` +
         `font-weight:600;line-height:1.85">` + lbl + innerHtml + `</p>`;
}

// ── Definitions of seasonal text patterns ─────────────────────────
// Each entry: { label, condition, starts, ends? }
//   starts : stripped-text pattern that marks the START of the insert paragraph
//   ends   : (optional) stripped-text pattern that marks the END – defaults to full paragraph match
//   condition: key in _siddurCal; if null → always apply

const SEASONAL_DEFS = [
  // ── יעלה ויבוא (embedded in Amida עבודה bracha on R"C/Moed) ─────
  { label: 'ר"ח / חוה"מ', condition: 'isRoshChodeshOrMoed',
    starts: /יעלה ויבוא ויגיע/ },

  // ── מוריד הגשם / משיב הרוח (גבורות – winter) ──────────────────
  { label: 'חורף', condition: 'isWinter',
    starts: /מוריד הגשם|משיב הרוח/ },

  // ── מוריד הטל (גבורות – summer) ────────────────────────────────
  { label: 'קיץ', condition: 'isSummer',
    starts: /מוריד הטל/ },

  // ── ותן טל ומטר לברכה (ברכת השנים – winter) ──────────────────
  { label: 'חורף', condition: 'isWinter',
    starts: /ותן טל ומטר לברכה/ },

  // ── ותן ברכה (ברכת השנים – summer) ───────────────────────────
  { label: 'קיץ', condition: 'isSummer',
    starts: /ותן ברכה/ },

  // ── עשרת ימי תשובה inserts ────────────────────────────────────
  { label: 'עשי"ת', condition: 'isAseretYamei',
    starts: /זכרנו לחיים/ },
  { label: 'עשי"ת', condition: 'isAseretYamei',
    starts: /מי כמוך אב הרחמן/ },
  { label: 'עשי"ת', condition: 'isAseretYamei',
    starts: /וכתוב לחיים טובים/ },
  { label: 'עשי"ת', condition: 'isAseretYamei',
    starts: /בספר חיים ברכה ושלום/ },
];

// ── Main function: post-process rendered HTML string ───────────────
// Called from _fetchSectionHtml after _renderParagraphs but BEFORE caching
function wrapSeasonalParagraphs(html, isAdd) {
  if (!html) return html;
  const cal = window._siddurCal || {};

  // Determine active conditions
  const active = new Set();
  if (cal.isRoshChodesh || cal.isCholHamoed) active.add('isRoshChodeshOrMoed');
  if (cal.isRoshChodesh)   active.add('isRoshChodesh');
  if (cal.isCholHamoed)    active.add('isCholHamoed');
  if (cal.isChanuka)       active.add('isChanuka');
  if (cal.isPurim)         active.add('isPurim');
  if (cal.isShabbat)       active.add('isShabbat');
  if (cal.isYomTov)        active.add('isYomTov');
  if (cal.isAseretYamei)   active.add('isAseretYamei');
  if (_isWinterSeason())   active.add('isWinter');
  else                     active.add('isSummer');

  // Split HTML into individual <p> tags and process each
  const parts = html.split(/(?=<p )|(?=<p>)/);
  return parts.map(part => {
    if (!part.startsWith('<p')) return part;

    // Get text content of this paragraph (strip tags)
    const text = _sd(part.replace(/<[^>]+>/g, ''));
    if (!text) return part;

    // Check each definition
    for (const def of SEASONAL_DEFS) {
      if (def.condition && !active.has(def.condition)) continue;
      if (def.starts.test(text)) {
        // Extract the inner HTML content of the <p> tag
        const innerMatch = part.match(/<p[^>]*>([\s\S]*)<\/p>/);
        const inner = innerMatch ? innerMatch[1] : text;
        console.log(`[Insert] wrapping "${text.slice(0,30)}..." as "${def.label}"`);
        return _greenBlock(def.label, inner);
      }
    }
    return part;
  }).join('');
}

function _isWinterSeason() {
  // Halachic rule: 
  // מוריד הטל + ותן ברכה = Summer = from א' של פסח (15 Nisan) to שמחת תורה (22 Tishrei)
  // משיב הרוח ומוריד הגשם = Winter = from שמחת תורה (22 Tishrei) to א' של פסח (15 Nisan)
  // ותן טל ומטר = from 7 Cheshvan (Israel) to Pesach
  const hDate = (typeof appState !== 'undefined') ? appState?._lastHebrewDate : null;
  if (hDate) {
    const m = hDate.hm, d = hDate.hd;
    // Summer: Nisan 15 → Tishrei 21 (inclusive)
    // Winter: Tishrei 22 → Nisan 14
    if (m === 'Nisan' && d >= 15) return false; // summer starts 1st day Pesach
    if (m === 'Iyar' || m === 'Sivan' || m === 'Tamuz' || m === 'Av' || m === 'Elul') return false;
    if (m === 'Tishrei' && d <= 21) return false; // still summer until Shmini Atzeret
    // Everything else is winter
    return true;
  }
  // Fallback: approximate with Gregorian months
  const gm = new Date().getMonth() + 1;
  return gm >= 10 || gm <= 3;
}
