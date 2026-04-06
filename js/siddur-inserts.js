// ═══════════════════════════════════════════════════════════════════
// SIDDUR-INSERTS.JS – seasonal text STYLING (not hiding)
//
// Instead of hiding seasonal text, we STYLE it:
// - Active: green block (say this today)
// - Inactive: red-muted strikethrough (don't say this today)
// The user can always see what exists and what to say/skip.
// ═══════════════════════════════════════════════════════════════════

const _sd = s => s.replace(/[\u0591-\u05C7]/g, '').trim();

function _greenBlock(label, innerHtml) {
  const lbl = `<span style="display:block;font-size:9px;font-family:'Heebo',sans-serif;
    color:var(--addition);font-style:normal;font-weight:700;letter-spacing:.4px;
    margin-bottom:3px;opacity:.9">✅ ${label}</span>`;
  return `<p style="display:block;margin:4px 0 10px 0;padding:7px 12px 6px;
    background:var(--addition-bg);border-right:3px solid var(--addition);
    border-radius:0 6px 6px 0;font-family:'Frank Ruhl Libre',serif;
    font-size:var(--font-size);color:var(--addition);font-style:italic;
    font-weight:600;line-height:1.85">${lbl}${innerHtml}</p>`;
}

function _redBlock(label, innerHtml) {
  const lbl = `<span style="display:block;font-size:9px;font-family:'Heebo',sans-serif;
    color:#c87060;font-style:normal;font-weight:700;letter-spacing:.4px;
    margin-bottom:3px;opacity:.9">❌ ${label} – לא אומרים</span>`;
  return `<p style="display:block;margin:4px 0 10px 0;padding:7px 12px 6px;
    background:rgba(180,80,60,.08);border-right:3px solid rgba(180,80,60,.3);
    border-radius:0 6px 6px 0;font-family:'Frank Ruhl Libre',serif;
    font-size:calc(var(--font-size)*0.85);color:rgba(180,80,60,.5);
    font-style:italic;line-height:1.85;text-decoration:line-through">${lbl}${innerHtml}</p>`;
}

const SEASONAL_DEFS = [
  { label: 'מוריד הטל (קיץ)', starts: /^מוריד הטל$/,
    show: () => !_isWinterSeason() },
  { label: 'משיב הרוח ומוריד הגשם (חורף)', starts: /משיב הרוח/,
    show: () => _isWinterSeason() },
  { label: 'ותן ברכה (קיץ)', starts: /^ותן ברכה$/,
    show: () => !_isWinterSeason() },
  { label: 'ותן טל ומטר לברכה (חורף)', starts: /ותן טל ומטר/,
    show: () => _isWinterSeason() },
  { label: 'יעלה ויבוא', starts: /יעלה ויבוא/,
    show: () => { const c = window._siddurCal||{}; return c.isRoshChodesh || c.isCholHamoed || c.isYomTov; } },
  { label: 'על הנסים', starts: /על הנסים/,
    show: () => { const c = window._siddurCal||{}; return c.isChanuka || c.isPurim; } },
  { label: 'זכרנו לחיים (עשי"ת)', starts: /^זכרנו לחיים/,
    show: () => _isAseretYemei() },
  { label: 'מי כמוך אב הרחמן (עשי"ת)', starts: /^מי כמוך אב הרחמן/,
    show: () => _isAseretYemei() },
  { label: 'וכתוב לחיים (עשי"ת)', starts: /^וכתוב לחיים/,
    show: () => _isAseretYemei() },
  { label: 'בספר חיים (עשי"ת)', starts: /^בספר חיים/,
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
        const innerMatch = part.match(/<p[^>]*>([\s\S]*)<\/p>/);
        const inner = innerMatch ? innerMatch[1] : text;
        if (def.show()) {
          return _greenBlock(def.label, inner);
        } else {
          return _redBlock(def.label, inner);
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
