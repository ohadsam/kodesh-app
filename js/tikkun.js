// ═══════════════════════════════════════════════════════════════════════
// TIKKUN.JS – "תיקון קוראים": the parasha as it is written in a Torah scroll (sofer script),
// with optional layers on the SAME text: ניקוד, טעמי המקרא, verse numbers; a table of the ta'amim
// (js/taamim-data.js); and a best-effort recorded reading of the current aliya.
//
//   tikkunTransform(raw, opts)    pure: Sefaria verse → {html, pe, se} for the chosen layers
//   renderTikkun(el, helpers)     called by renderParasha() when parashaView === 'tikkun'
//   tikkunToggle / tikkunSetScript / tikkunShowTaamim / tikkunBackToText   toolbar actions
//   js/tikkun-audio.js            recorded reading (Sefaria's PocketTorah recordings, Ashkenazi) if found: speeds,
//                                 synced scrolling, progress bar, jump-to-verse/aliya, bookmarks
//
// Fonts: fonts/ItimStam{Ashkenaz,Sefarad}.woff2 – Culmus' Stam CLM letters + nikud/ta'amim (tools/build_stam_pointed.py).
// Options persist in appState.tikkun = { nikud, teamim, nums, script }.
// ═══════════════════════════════════════════════════════════════════════

const TIKKUN_DEFAULTS = { nikud: false, teamim: false, nums: true, script: 'ashkenaz' };
let _tikkunSub = 'text';                       // 'text' | 'taamim'

function getTikkunOpts() { return Object.assign({}, TIKKUN_DEFAULTS, appState.tikkun || {}); }

// ── Text layers ─────────────────────────────────────────────────────────
// nikud: the vowel points (and dagesh, shin/sin dots, rafe, qamats qatan);  ta'amim: the accents (U+0591-05AF),
// meteg/silluq, paseq. Sof pasuq stays with either layer. The maqaf joins words only when a layer is on:
// in a Torah scroll there is none (the words are just written with a space).
const TK_NIKUD_RE = /[ְ-ׇּֿׁׂׅׄ]/g;
const TK_TAAMIM_RE = /[֑-ֽ֯׀]/g;
const TK_TOKENS = { b: ['<span class="tk-big">', '</span>'], s: ['<span class="tk-small">', '</span>'], u: ['<span class="tk-sup">', '</span>'] };

function tikkunTransform(raw, o) {
  o = o || {};
  let s = String(raw == null ? '' : raw);
  // footnotes some editions embed are not part of the text
  s = s.replace(/<sup[^>]*footnote[^>]*>[\s\S]*?<\/sup>/gi, '').replace(/<i[^>]*footnote[^>]*>[\s\S]*?<\/i>/gi, '');
  // big / small / raised letters are part of the scroll: keep them as tokens, drop every other tag
  s = s.replace(/<(\/?)(big|small|sup)\b[^>]*>/gi, (m, sl, t) => '\u0001' + (sl ? '/' : '') + t[0].toLowerCase() + '\u0002')
       .replace(/<[^>]*>/g, '');
  s = s.replace(/&nbsp;|&thinsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // petucha / setuma markers → how the line is laid out
  const pe = /\{\s*פ\s*\}/.test(s), se = /\{\s*ס\s*\}/.test(s);
  s = s.replace(/\{\s*[פסר]\s*\}/g, '');
  const layers = !!(o.nikud || o.teamim);
  s = s.replace(/־/g, layers ? '־' : ' ');
  if (!o.nikud) s = s.replace(TK_NIKUD_RE, '');
  if (!o.teamim) s = s.replace(TK_TAAMIM_RE, '');
  if (!layers) s = s.replace(/׃/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  let html = escapeHtml(s).replace(/\u0001(\/?)([bsu])\u0002/g, (m, sl, t) => TK_TOKENS[t][sl ? 1 : 0]);
  return { html, pe, se, text: s };
}

// ── Toolbar ─────────────────────────────────────────────────────────────
function _tikkunChip(label, on, act, extra) {
  return `<button type="button" class="tk-chip${on ? ' on' : ''}" onclick="${act}" aria-pressed="${on ? 'true' : 'false'}"${extra || ''}>${label}</button>`;
}
function _tikkunRenderOpts() {
  const box = document.getElementById('tikkun-opts'); if (!box) return;
  const o = getTikkunOpts();
  box.innerHTML =
    `<div class="tk-row">` +
      _tikkunChip('ניקוד', o.nikud, "tikkunToggle('nikud')") +
      _tikkunChip('טעמי המקרא', o.teamim, "tikkunToggle('teamim')") +
      _tikkunChip('מספרי פסוקים', o.nums, "tikkunToggle('nums')") +
      _tikkunChip('כתב: ' + (o.script === 'sefarad' ? 'ספרד' : 'אשכנז'), false, 'tikkunSetScript()') +
    `</div><div class="tk-row">` +
      (typeof tikkunAudioButtonHtml === 'function' ? tikkunAudioButtonHtml() : '') +
      _tikkunChip(_tikkunSub === 'taamim' ? '← חזרה לטקסט' : '📋 רשימת הטעמים', _tikkunSub === 'taamim', _tikkunSub === 'taamim' ? 'tikkunBackToText()' : 'tikkunShowTaamim()') +
    `</div><div id="tk-audio-panel"></div>`;
  if (typeof tikkunAudioRenderPanel === 'function') tikkunAudioRenderPanel();
}

function tikkunToggle(key) {
  const o = getTikkunOpts(); o[key] = !o[key];
  appState.tikkun = o; saveState();
  renderParasha();
}
function tikkunSetScript() {
  const o = getTikkunOpts(); o.script = o.script === 'sefarad' ? 'ashkenaz' : 'sefarad';
  appState.tikkun = o; saveState();
  renderParasha();
}
function tikkunShowTaamim() { _tikkunSub = 'taamim'; renderParasha(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function tikkunBackToText() { _tikkunSub = 'text'; renderParasha(); }

// ── The ta'amim table ───────────────────────────────────────────────────
function tikkunTaamimHtml() {
  const o = getTikkunOpts();
  const font = o.script === 'sefarad' ? 'tk-sefarad' : 'tk-ashkenaz';
  const row = t => {
    const alt = t.alt ? `<span class="tk-trop-sign tk-trop-alt ${font}" title="סימון חלופי">${t.alt.map(c => taamimSign([c])).join(' ')}</span>` : '';
    return `<div class="tk-trop"><span class="tk-trop-sign ${font}">${taamimSign(t.cps)}</span>${alt}` +
      `<span class="tk-trop-txt"><b>${escapeHtml(t.he)}</b><span>${escapeHtml(t.pos)}${t.note ? ' · ' + escapeHtml(t.note) : ''}</span></span></div>`;
  };
  const sec = (title, sub, list) => `<div class="tk-trop-h">${title}<span>${sub}</span></div>` + list.map(row).join('');
  return `<div class="tk-troplist">` +
    `<div class="tk-trop-intro">טעמי המקרא – כל טעם נכתב על אות; הסימן מוצג כאן על האות א׳ כדי שיהיה ברור איפה הוא נכתב.</div>` +
    sec('טעמים מפסיקים', 'מפרידים בין חלקי הפסוק (לפי סדר חשיבות משוער)', TAAMIM_DISJUNCTIVE) +
    sec('טעמים מחברים', 'מקשרים את המילה למילה שאחריה', TAAMIM_CONJUNCTIVE) +
    sec('סימנים נוספים', 'בעיקר בספרי אמ״ת ובסימני עזר', TAAMIM_OTHER) +
    `</div>`;
}

// ── Rendering ───────────────────────────────────────────────────────────
function renderTikkun(el, h) {
  if (typeof tikkunAudioBeforeRender === 'function') tikkunAudioBeforeRender();      // another aliya: the recording no longer fits
  _tikkunRenderOpts();
  if (_tikkunSub === 'taamim') { el.innerHTML = tikkunTaamimHtml(); return; }
  const o = getTikkunOpts();
  const marks = o.nikud || o.teamim;
  const cls = 'tk-t ' + (o.script === 'sefarad' ? 'tk-sefarad' : 'tk-ashkenaz') + (marks ? ' tk-marks' : '');
  el.innerHTML = '<div class="tk-scroll">' + parashaVerses.map((v, i) => {
    const t = tikkunTransform(v, o);
    return h.chapterHeader(i) +
      `<div class="tk-v${t.pe ? ' tk-pe' : ''}${t.se ? ' tk-se' : ''}" data-i="${i}">` +
      (o.nums ? `<span class="tk-n">${h.verseLabel(i)}</span>` : '') +
      `<span class="${cls}">${t.html}</span>` +
      (t.pe ? '<span class="tk-mk" title="פרשה פתוחה">פ</span>' : t.se ? '<span class="tk-mk" title="פרשה סתומה">ס</span>' : '') +
      '</div>';
  }).join('') + '</div>';
  if (typeof tikkunAudioAfterRender === 'function') tikkunAudioAfterRender();       // re-mark the verse being read; start a requested reading
}
