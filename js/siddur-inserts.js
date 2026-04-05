// ═══════════════════════════════════════════════════════════════════
// SIDDUR-INSERTS.JS  –  post-render seasonal text show/hide/styling
//
// After rendering, scan each <p> for known seasonal Hebrew text patterns.
// - If condition IS active → wrap in green styled block
// - If condition is NOT active → REMOVE the paragraph entirely
// ═══════════════════════════════════════════════════════════════════

const _sd = s => s.replace(/[\u0591-\u05C7]/g, '').trim();

function _greenBlock(label, innerHtml) {
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

const SEASONAL_DEFS = [
  { label: 'קיץ – מוריד הטל', starts: /^מוריד הטל$/,
    show: () => !_isWinterSeason() },
  { label: 'חורף – משיב הרוח', starts: /משיב הרוח/,
    show: () => _isWinterSeason() },
  { label: 'קיץ – ותן ברכה', starts: /^ותן ברכה$/,
    show: () => !_isWinterSeason() },
  { label: 'חורף – ותן טל ומטר', starts: /ותן טל ומטר/,
    show: () => _isWinterSeason() },
  { label: 'ר"ח / חוה"מ', starts: /יעלה ויבוא/,
    show: () => { const c = window._siddurCal||{}; return c.isRoshChodesh || c.isCholHamoed || c.isYomTov; } },
  { label: 'חנוכה / פורים', starts: /על הנסים/,
    show: () => { const c = window._siddurCal||{}; return c.isChanuka || c.isPurim; } },
  { label: 'עשי"ת', starts: /^זכרנו לחיים/,
    show: () => _isAseretYemei() },
  { label: 'עשי"ת', starts: /^מי כמוך אב הרחמן/,
    show: () => _isAseretYemei() },
  { label: 'עשי"ת', starts: /^וכתוב לחיים טובים/,
    show: () => _isAseretYemei() },
  { label: 'עשי"ת', starts: /^בספר חיים ברכה ושלום/,
    show: () => _isAseretYemei() },
];

function _isAseretYemei() {
  const hd = (typeof appState !== 'undefined') ? appState?._lastHebrewDate : null;
  return hd && hd.hm === 'Tishrei' && hd.hd >= 1 && hd.hd <= 10;
}

function wrapSeasonalParagraphs(html, isAdd) {
  if (!html) return html;
  const parts = html.split(/(?=<p )|(?=<p>)/);
  return parts.map(part => {
    if (!part.startsWith('<p')) return part;
    const text = _sd(part.replace(/<[^>]+>/g, ''));
    if (!text) return part;
    for (const def of SEASONAL_DEFS) {
      if (def.starts.test(text)) {
        if (def.show()) {
          const innerMatch = part.match(/<p[^>]*>([\s\S]*)<\/p>/);
          const inner = innerMatch ? innerMatch[1] : text;
          return _greenBlock(def.label, inner);
        } else {
          return ''; // HIDE
        }
      }
    }
    return part;
  }).join('');
}

function _isWinterSeason() {
  const hDate = (typeof appState !== 'undefined') ? appState?._lastHebrewDate : null;
  if (hDate) {
    const m = hDate.hm, d = hDate.hd;
    if (m === 'Nisan' && d >= 15) return false;
    if (m === 'Iyar' || m === 'Sivan' || m === 'Tamuz' || m === 'Av' || m === 'Elul') return false;
    if (m === 'Tishrei' && d <= 21) return false;
    return true;
  }
  const gm = new Date().getMonth() + 1;
  return gm >= 10 || gm <= 3;
}
