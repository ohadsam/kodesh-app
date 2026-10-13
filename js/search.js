// ═══════════════════════════════════════════════════════════════════════
// SEARCH.JS – global smart search (🔍 in the top bar)
//
//   srNormalize / srStem / srHebNum   – text helpers (pure)
//   srParse(query)                    – splits a query into modifiers (aliya, view, current,
//                                       numbers) and the words that name something (pure)
//   srBuildIndex()                    – every searchable thing the app knows (reads globals)
//   srSearch(query)                   – ranked results [{kind,title,sub,icon,tag,score,go,toks}]
//   searchGo(go)                      – navigates to a result (re-uses each tab's own loaders)
//   openSearch / closeSearch + UI     – panel under the top bar, results drop-down
//
// Vocabulary lives in js/search-data.js. Navigation reuses the same loaders the bookmark
// restore uses (loadSpecificParasha, showAliya, setParashaView, _loadPickedDaf, …).
// ═══════════════════════════════════════════════════════════════════════

// ── Text helpers ────────────────────────────────────────────────────────
const _SR_FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

// no nikud/teamim, no quotes/gershayim (רש"י = רשי), final letters folded, punctuation → space
function srNormalize(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[׳״"'`’‘“”׳״]/g, '')
    .replace(/[ךםןףץ]/g, c => _SR_FINALS[c])
    .replace(/[־\-–—_.,:;!?()\[\]{}\/\\|•·]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// light stemmer so תפילה / תפילת / תפילות meet
function srStem(w) {
  if (w.length > 4 && /(ות|ים)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && /[הת]$/.test(w)) return w.slice(0, -1);
  return w;
}

const _SR_PREFIXES = 'הוובלמשכ';
function _srLev1(a, b) {                 // true when edit distance ≤ 1
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;                                   // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);   // transposition
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);   // insert/delete
}

// 0 = no match; higher = better. q and f are normalized single words.
function _srWordQuality(q, f) {
  if (!q || !f) return 0;
  if (q === f) return 3;
  const qs = srStem(q), fs = srStem(f);
  if (qs === fs) return 2.8;
  if (qs.length >= 2 && fs.startsWith(qs)) return 2.2;
  if (q.length >= 4) {                     // a one-letter prefix: ובראשית, לפרשה …
    const qp = srStem(q.slice(1));
    if (_SR_PREFIXES.includes(q[0]) && qp.length >= 3 && (fs === qp || fs.startsWith(qp))) return 1.9;
  }
  if (qs.length >= 3 && fs.includes(qs)) return 1.3;
  if (qs.length >= 5 && qs[0] === fs[0] && _srLev1(qs, fs)) return 1.1;   // a typo (same first letter)
  return 0;
}

// Hebrew numerals → number (null when it is not a well-formed numeral).
// "בא" / "דג" (two unit letters) are words, "כג"=23, "קיט"=119, "טו"=15.
const _SR_VAL = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400 };
function srHebNum(tok) {
  if (!tok) return null;
  if (/^\d{1,4}$/.test(tok)) return parseInt(tok, 10);
  if (tok.length > 5 || !/^[א-ת]+$/.test(tok)) return null;
  if (tok === 'טו') return 15;
  if (tok === 'טז') return 16;
  const cls = v => (v >= 100 ? 3 : v >= 10 ? 2 : 1);
  let sum = 0, lastClass = 4, tens = 0, units = 0;
  for (const ch of tok) {
    const v = _SR_VAL[ch]; if (!v) return null;
    const c = cls(v);
    if (c > lastClass) return null;             // must descend: hundreds, tens, units
    if (c === 2 && ++tens > 1) return null;
    if (c === 1 && ++units > 1) return null;
    lastClass = c; sum += v;
  }
  return sum || null;
}

// ── Query parsing ───────────────────────────────────────────────────────
const _srSet = arr => new Set(arr.map(srNormalize));
let _SR_VOC = null;
function _srVocab() {
  if (_SR_VOC) return _SR_VOC;
  const inv = map => { const o = {}; Object.keys(map).forEach(k => map[k].forEach(w => { o[srNormalize(w)] = k; })); return o; };
  const ord = {};
  Object.keys(SEARCH_ORDINALS).forEach(k => { ord[srNormalize(k)] = SEARCH_ORDINALS[k]; });
  _SR_VOC = {
    parashaViews: inv(SEARCH_PARASHA_VIEWS), commentaryViews: inv(SEARCH_COMMENTARY_VIEWS), ordinals: ord, hints: inv(SEARCH_HINTS),
    current: _srSet(SEARCH_CURRENT_WORDS), aliyaWords: _srSet(SEARCH_ALIYA_WORDS), numCtx: _srSet(SEARCH_NUMBER_CONTEXT),
  };
  return _SR_VOC;
}

// → { raw, norm, tokens, words[] (what is left to name something – numerals included), ctxNums{ctx:n},
//     current, aliya, pview, cview[], hints[] }
function srParse(query) {
  const V = _srVocab();
  const norm = srNormalize(query);
  const toks = norm ? norm.split(' ') : [];
  const out = { raw: String(query || ''), norm, tokens: toks, words: [], ctxNums: {}, current: false,
    aliya: null, pview: null, cview: [], hints: [] };
  const used = new Array(toks.length).fill(false);
  const take = i => { used[i] = true; };

  // 1. "עליה ג" / "עליה שלישית" / "שלישית עליה"
  toks.forEach((t, i) => {
    if (!V.aliyaWords.has(t)) return;
    take(i);
    const look = j => {
      if (j < 0 || j >= toks.length || used[j]) return false;
      const o = V.ordinals[toks[j]], n = srHebNum(toks[j]);
      if (o !== undefined) { out.aliya = o; take(j); return true; }
      if (n >= 1 && n <= 8) { out.aliya = n; take(j); return true; }
      return false;
    };
    if (!look(i + 1)) look(i - 1);
  });
  // an ordinal word on its own ("שלישית", "מפטיר") – only meaningful for a parasha; kept as a candidate
  toks.forEach((t, i) => { if (!used[i] && out.aliya == null && V.ordinals[t] !== undefined && /^(מפטיר|ראשונה|שנייה|שניה|שלישית|רביעית|חמישית|שישית|שביעית)$/.test(t)) { out.aliya = V.ordinals[t]; take(i); } });

  // 2. views, "current" words
  toks.forEach((t, i) => {
    if (used[i]) return;
    if (V.current.has(t)) { out.current = true; take(i); return; }
    if (V.parashaViews[t]) { out.pview = V.parashaViews[t]; if (V.commentaryViews[t] && !out.cview.includes(V.commentaryViews[t])) out.cview.push(V.commentaryViews[t]); take(i); return; }
    if (V.commentaryViews[t]) { if (!out.cview.includes(V.commentaryViews[t])) out.cview.push(V.commentaryViews[t]); take(i); }
  });
  // "הרב זקס" leaves a lone "הרב" behind
  if (out.pview === 'sacks') toks.forEach((t, i) => { if (t === 'הרב') take(i); });

  // 3. number after a context word: "תהילים כג", "פרק ב", "יום 5", "דף ג"
  toks.forEach((t, i) => {
    if (used[i] || !V.numCtx.has(t)) return;
    const n = srHebNum(toks[i + 1]);
    if (n != null && i + 1 < toks.length && !used[i + 1]) { out.ctxNums[t] = n; take(i + 1); if (t !== 'דף' && t !== 'משנה') take(i); }   // דף / משנה stay: they also name the tab
  });

  // 4. hint words (kept as words for scoring but recorded)
  toks.forEach((t, i) => { if (V.hints[t] && !out.hints.includes(V.hints[t])) out.hints.push(V.hints[t]); });

  // what is left names something; numerals stay in `words` – an entity that does not
  // contain them (בבא קמא + "ב" + "ע״ב") reads them as numbers (see _srMatchWords)
  toks.forEach((t, i) => { if (!used[i]) out.words.push(t); });
  return out;
}

// ── Index ───────────────────────────────────────────────────────────────
function _srTitleHe(t) { return String(t || '').replace(/[֑-ׇ]/g, ''); }

function _srEntry(kind, o) {
  const e = Object.assign({ kind, kw: [], hay: '', sub: '', icon: '', tag: '', boost: 0, go: null }, o);
  e._t = srNormalize(e.title).split(' ').filter(Boolean);
  e._k = srNormalize(e.kw.join(' ')).split(' ').filter(Boolean);
  e._h = srNormalize(e.hay + ' ' + e.sub).split(' ').filter(Boolean);
  return e;
}

function _srTabVisible(tab) { try { return typeof isTabVisible === 'function' ? isTabVisible(tab) : true; } catch (e) { return true; } }

function srBuildIndex() {
  const idx = [];
  SEARCH_TABS.forEach(t => {
    const vis = _srTabVisible(t.tab);
    if (!vis && (t.tab === 'logs' || t.tab === 'network' || t.tab === 'siddur')) return;   // dev / beta tabs stay hidden unless enabled
    idx.push(_srEntry('tab', { id: 'tab:' + t.tab, title: t.title, icon: t.icon, tag: 'טאב', kw: t.kw, tabKey: t.tab,
      sub: vis ? '' : 'טאב מוסתר – ייפתח בכל זאת', go: { kind: 'tab', tab: t.tab } }));
  });

  if (typeof ALL_PARASHIOT !== 'undefined') ALL_PARASHIOT.forEach(p => {
    idx.push(_srEntry('parasha', { id: 'parasha:' + p.ref, title: p.he, icon: '📜', tag: 'פרשה', tabKey: 'parasha', sub: '', go: { kind: 'parasha', ref: p.ref, name: p.he } }));
  });
  if (typeof TEFILOT !== 'undefined') Object.keys(TEFILOT).forEach(k => {
    idx.push(_srEntry('tefila', { id: 'tefila:' + k, title: TEFILOT[k].title, icon: '🤲', tag: 'תפילה', tabKey: 'tefilot', kw: ['תפילה', 'תפילות'], hay: TEFILOT[k].source || '', sub: '', go: { kind: 'tefila', key: k } }));
  });
  if (typeof BRACHOT !== 'undefined') Object.keys(BRACHOT).forEach(k => {
    idx.push(_srEntry('bracha', { id: 'bracha:' + k, title: BRACHOT[k].title, icon: '✨', tag: 'ברכה', tabKey: 'brachot', kw: ['ברכה', 'ברכות'], hay: BRACHOT[k].source || '', sub: '', go: { kind: 'bracha', key: k } }));
  });
  if (typeof EMUNA_BOOKS !== 'undefined') Object.keys(EMUNA_BOOKS).forEach(k => {
    const b = EMUNA_BOOKS[k];
    idx.push(_srEntry('emuna', { id: 'emuna:' + k, title: b.title, icon: b.icon || '🔯', tag: 'אמונה', tabKey: 'emuna', kw: ['אמונה', 'מוסר', 'ספר'], hay: (b.author || '') + ' ' + (b.description || ''), sub: b.author || '', go: { kind: 'emuna', book: k } }));
  });
  if (typeof BAVLI_TRACTATES !== 'undefined') BAVLI_TRACTATES.forEach(t => {
    idx.push(_srEntry('daf', { id: 'daf:' + t.name, title: 'מסכת ' + t.he, icon: '📚', tag: 'גמרא', tabKey: 'daf', kw: ['גמרא', 'דף', 'בבלי', 'תלמוד'], sub: 'עיון בדף של המסכת', go: { kind: 'daf', tractate: t.name, he: t.he } }));
  });
  if (typeof MISHNA_TRACTATES !== 'undefined') MISHNA_TRACTATES.forEach(t => {
    idx.push(_srEntry('mishna', { id: 'mishna:' + t.name, title: 'משנה – מסכת ' + t.he, icon: '⚖️', tag: 'משנה', tabKey: 'mishna', kw: ['משנה', 'משניות'], sub: 'עיון בפרק ובמשנה', go: { kind: 'mishna', tractate: t.name, he: t.he } }));
  });
  SEARCH_SETTINGS.forEach(s => idx.push(_srEntry('setting', { id: 'set:' + s.id, title: 'הגדרות · ' + s.title, icon: '⚙️', tag: 'הגדרות', kw: s.kw.concat(['הגדרות']), go: { kind: 'setting', el: s.el } })));
  SEARCH_ACTIONS.forEach(a => idx.push(_srEntry('action', { id: 'act:' + a.id, title: a.title, icon: a.icon, tag: 'פעולה', kw: a.kw, go: { kind: 'action', action: a.id } })));

  // personal: bookmarks and Tehilim favorites
  try {
    const bms = appState.bookmarks || {};
    Object.keys(bms).forEach(tab => {
      const b = bms[tab];
      if (!b) return;
      idx.push(_srEntry('bookmark', { id: 'bm:' + tab, title: 'סימניה: ' + (b.label || tab), icon: '🔖', tag: 'סימניה', kw: ['סימניה', 'סימניות', 'שמרתי'], hay: b.snip || '', go: { kind: 'bookmark', tab } }));
    });
  } catch (e) { /* no state yet */ }
  try {
    if (typeof getTehilimFavorites === 'function') getTehilimFavorites().forEach(f => {
      idx.push(_srEntry('favorite', { id: 'fav:' + f.id, title: f.name, icon: '⭐', tag: 'מועדף', tabKey: 'tehilim', kw: ['מועדף', 'מועדפים', 'תהילים', 'כוכב'], sub: 'רשימת תהילים שלי', go: { kind: 'favorite', id: f.id } }));
    });
  } catch (e) { /* none */ }
  return idx;
}

// ── Scoring ─────────────────────────────────────────────────────────────
function _srFieldBest(qt, toks, noTypos) { let b = 0; for (const f of toks) { let q = _srWordQuality(qt, f); if (noTypos && q === 1.1) q = 0; if (q > b) b = q; } return b; }

// words must ALL match something in the entry (title ×3, synonyms ×2, extra text ×1).
// allowNums: words that match nothing but are numerals are returned in `left` instead of failing.
function _srMatchWords(e, words, allowNums) {
  let total = 0; const left = [], hit = [];
  for (const w of words) {
    const t = _srFieldBest(w, e._t) * 3, k = _srFieldBest(w, e._k) * 2, h = _srFieldBest(w, e._h, true);
    const best = Math.max(t, k, h);
    if (!best) { if (allowNums && srHebNum(w) != null) { left.push(w); continue; } return { s: 0, left: [], hits: 0 }; }
    total += best; hit.push(w);
  }
  if (!hit.length) return { s: 0, left: [], hits: 0 };
  const titleNorm = e._t.join(' '), q = hit.join(' ');
  if (titleNorm === q) total += 8;
  else if (titleNorm.startsWith(q)) total += 3;
  return { s: total, left, hits: hit.length };
}
const _srScoreEntry = (e, words) => _srMatchWords(e, words, false).s;

// a whole synonym phrase typed exactly ("מצב בהיר", "הוסף סימניה") is a strong signal
function _srPhraseBonus(e, q) {
  return q.indexOf(' ') !== -1 && (e.kw || []).some(k => srNormalize(k) === q) ? 6 : 0;
}

// entries of one kind that matched the MOST words ("בבא קמא" → קמא only, not every בבא…)
function _srBest(entries, words, allowNums, limit) {
  const all = entries.map(e => ({ e, m: _srMatchWords(e, words, allowNums) })).filter(x => x.m.s > 0);
  const top = Math.max(0, ...all.map(x => x.m.hits));
  return all.filter(x => x.m.hits === top).sort((a, b) => b.m.s - a.m.s).slice(0, limit);
}

const _SR_AMUD = { 'עא': 'a', 'עב': 'b' };
function _srNameOf(go) { return go.name || go.he || ''; }

// ── Search ──────────────────────────────────────────────────────────────
const _SRK = { teh: srNormalize('תהילים'), tehl: srNormalize('תהלים'), miz: srNormalize('מזמור'), perek: 'פרק', yom: srNormalize('יום'), daf: srNormalize('דף'), mishna: 'משנה', seif: srNormalize('סעיף'), maamar: 'מאמר', psika: 'פסקה' };
const _srG = n => toGematria(n).replace(/[׳״]/g, '');      // 23 → כג
const _srTag = (kind, icon, tag) => ({ kind, icon, tag });

function srSearch(query, idx) {
  const P = srParse(query);
  if (!P.norm) return [];
  idx = idx || srBuildIndex();
  const res = [];
  const push = (e, o) => res.push(Object.assign({ kind: e.kind, icon: e.icon, tag: e.tag, toks: P.words }, o));
  const hasHint = h => P.hints.includes(h);
  const cn = P.ctxNums;
  const hasP = hasHint('parasha') || P.aliya != null || P.pview != null;
  const aliyaName = n => (n === 'all' ? 'כל העליות' : n === 8 ? 'מפטיר' : 'עליה ' + _srG(n));
  const pviewName = { rashi: 'רש"י', onkelos: 'אונקלוס', haftara: 'הפטרה', sacks: 'הרב זקס', text: 'פשט' };
  const cviewName = { rashi: 'רש"י', tosafot: 'תוספות', bartenura: 'ברטנורא', steinsaltz: 'שטיינזלץ' };
  const numsOf = left => left.map(srHebNum).filter(n => n != null);

  // 1. parasha: a named one, or "current" / modifiers only
  const parashot = P.words.length ? _srBest(idx.filter(e => e.kind === 'parasha'), P.words, true, 3) : [];
  const subParts = () => [P.aliya != null ? aliyaName(P.aliya) : '', P.pview && P.pview !== 'text' ? pviewName[P.pview] : ''].filter(Boolean).join(' · ');
  const parashaWord = w => ['פרשה', 'פרשת', 'שבוע', 'תורה', 'חומש'].some(x => _srWordQuality(w, x) > 0);
  if (parashot.length) {
    parashot.forEach((x, i) => push(x.e, { id: x.e.id + ':smart', title: 'פרשת ' + x.e.title, sub: subParts(), score: (hasP || x.m.s >= 6.6 ? 100 : 40) + x.m.s - i + (hasP ? 20 : 0),
      go: { kind: 'parasha', ref: x.e.go.ref, name: x.e.title, aliya: P.aliya, view: P.pview } }));
  } else if ((hasP || P.current) && !P.cview.filter(v => v !== P.pview).length && P.words.every(parashaWord) && (hasP || P.words.length)) {
    push(_srTag('parasha', '📜', 'פרשה'), { id: 'parasha:current', title: 'פרשת השבוע הנוכחית', sub: subParts(), score: 120,
      go: { kind: 'parasha', current: true, aliya: P.aliya, view: P.pview } });
  }

  // 2. Tehilim – chapter, monthly day, Psalm 119 halves
  const tehHint = hasHint('tehilim');
  const V = _srVocab();
  const tw = P.words.filter(w => V.hints[w] !== 'tehilim');          // the word תהילים itself is not a name
  const lone = tw.length === 1 ? srHebNum(tw[0]) : null;
  const loneIsDigits = tw.length === 1 && /^\d+$/.test(tw[0]);
  const chNum = cn[_SRK.teh] ?? cn[_SRK.tehl] ?? cn[_SRK.miz] ?? cn['פרק'] ?? lone;
  const noWords = !tw.length || lone != null;
  if (noWords && chNum >= 1 && chNum <= 150 && !hasP && !hasHint('daf') && !hasHint('mishna')) {
    const strong = tehHint || cn[_SRK.miz] != null || cn['פרק'] != null;
    push(_srTag('tehilim', '🙏', 'תהילים'), { id: 'teh:ch:' + chNum, title: 'תהילים פרק ' + _srG(chNum) + ' (' + chNum + ')', sub: 'קריאה בפרק הבודד', score: strong ? 115 : loneIsDigits ? 70 : 55, go: { kind: 'tehilim', chapter: chNum } });
    if (chNum === 119) {
      push(_srTag('tehilim', '🙏', 'תהילים'), { id: 'teh:119a', title: 'קי"ט – יום כ"ה (פסוקים 1–96, א–ל)', sub: 'חלוקה חודשית', score: strong ? 112 : 54, go: { kind: 'tehilim', day: 25 } });
      push(_srTag('tehilim', '🙏', 'תהילים'), { id: 'teh:119b', title: 'קי"ט – יום כ"ו (פסוקים 97–176, מ–ת)', sub: 'חלוקה חודשית', score: strong ? 111 : 53, go: { kind: 'tehilim', day: 26 } });
    }
  }
  const dn = cn[_SRK.yom];
  if (!tw.length && dn >= 1 && dn <= 30 && !hasP) {
    push(_srTag('tehilim', '🙏', 'תהילים'), { id: 'teh:day:' + dn, title: 'תהילים – יום ' + _srG(dn) + ' בחודש', sub: 'הפרקים של אותו יום', score: tehHint ? 118 : 95, go: { kind: 'tehilim', day: dn } });
  }

  // 3. daf / mishna – a tractate, optional daf + amud / chapter + mishna, optional commentary
  const dafHint = hasHint('daf'), mishHint = hasHint('mishna');
  const trWords = P.words.filter(w => w !== 'מסכת' && w !== _SRK.daf && w !== 'משנה');
  ['daf', 'mishna'].forEach(kind => {
    if (!trWords.length) return;
    _srBest(idx.filter(e => e.kind === kind), trWords, true, 2).forEach((x, i) => {
      const go = Object.assign({}, x.e.go); let sub = '';
      const left = x.m.left;
      if (kind === 'daf') {
        const amudTok = left.find(t => _SR_AMUD[t]);
        const plain = numsOf(left.filter(t => !_SR_AMUD[t]));
        const n = cn[_SRK.daf] != null ? cn[_SRK.daf] : plain[0];
        const second = cn[_SRK.daf] != null ? plain[0] : plain[1];
        const amud = amudTok ? _SR_AMUD[amudTok] : (second === 2 ? 'b' : 'a');
        const t = typeof BAVLI_TRACTATES !== 'undefined' && BAVLI_TRACTATES.find(z => z.name === go.tractate);
        if (n != null && n >= 2 && (!t || n <= t.dafim)) { go.num = n; go.amud = amud; sub = 'דף ' + _srG(n) + (amud === 'b' ? ' ע"ב' : ' ע"א'); }
        else sub = 'בחירת דף';
        const v = P.cview.includes('rashi') && P.cview.includes('tosafot') ? 'rashi_tosafot' : P.cview[0];
        if (v && ['rashi', 'tosafot', 'rashi_tosafot', 'steinsaltz'].includes(v)) { go.view = v; sub += ' · ' + (v === 'rashi_tosafot' ? 'רש"י ותוס\'' : cviewName[v]); }
      } else {
        const plain = numsOf(left);
        const ch = cn['פרק'] != null ? cn['פרק'] : plain[0];
        const m = cn['משנה'] != null ? cn['משנה'] : (cn['פרק'] != null ? plain[0] : plain[1]);
        const t = typeof MISHNA_TRACTATES !== 'undefined' && MISHNA_TRACTATES.find(z => z.name === go.tractate);
        if (ch != null && ch >= 1 && (!t || ch <= t.chapters)) { go.chapter = ch; sub = 'פרק ' + _srG(ch); if (m != null && m >= 1 && m <= 40) { go.num = m; sub += ' משנה ' + _srG(m); } }
        else sub = 'בחירת פרק ומשנה';
        if (P.cview.includes('bartenura')) { go.view = 'bartenura'; sub += ' · ברטנורא'; }
      }
      const amudy = P.words.some(w => _SR_AMUD[w]);
      const boost = kind === 'daf' ? (mishHint ? -5 : 3) : (mishHint ? 8 : amudy || dafHint ? -12 : 0);
      push(x.e, { id: x.e.id + ':smart', title: (kind === 'mishna' ? 'משנה ' : 'גמרא ') + 'מסכת ' + x.e.go.he, sub, score: 85 + x.m.s - i + boost + ((kind === 'daf' ? dafHint : mishHint) ? 20 : 0), go });
    });
  });

  // 4. the daily daf / mishna / rambam with a commentary view ("דף יומי רש"י")
  if (P.cview.length && !res.some(r => r.kind === 'daf' || r.kind === 'mishna') && !parashot.length) {
    const rambamWord = P.words.some(w => _srWordQuality(w, srNormalize('רמב"ם')) > 0);
    const dailyTab = dafHint ? 'daf' : mishHint ? 'mishna' : rambamWord ? 'rambam' : null;
    if (dailyTab) {
      const vv = dailyTab === 'daf' ? (P.cview.includes('rashi') && P.cview.includes('tosafot') ? 'rashi_tosafot' : P.cview[0])
        : dailyTab === 'mishna' ? (P.cview.includes('bartenura') ? 'bartenura' : null) : (P.cview.includes('steinsaltz') ? 'steinsaltz' : null);
      if (vv) push(_srTag('tab', dailyTab === 'daf' ? '📚' : dailyTab === 'mishna' ? '⚖️' : '📜', 'טאב'), { id: 'daily:' + dailyTab + ':' + vv, title: ({ daf: 'דף יומי', mishna: 'משנה יומי', rambam: 'רמב"ם יומי' })[dailyTab],
        sub: 'עם ' + (vv === 'rashi_tosafot' ? 'רש"י ותוספות' : cviewName[vv]), score: 110, go: { kind: 'tab', tab: dailyTab, daily: true, view: vv } });
    }
  }

  // 5. emuna book (+ chapter / maamar / section)
  if (P.words.length) {
    _srBest(idx.filter(e => e.kind === 'emuna'), P.words, true, 1).forEach(x => {
      const go = { kind: 'emuna', book: x.e.go.book }; let sub = x.e.sub;
      const plain = numsOf(x.m.left);
      const ch = cn[_SRK.maamar] ?? cn['פרק'] ?? plain[0];
      const sec = cn[_SRK.seif] ?? cn[_SRK.psika] ?? ((cn[_SRK.maamar] != null || cn['פרק'] != null) ? plain[0] : plain[1]);
      if (ch != null) { go.ch = ch; sub = (go.book === 'kuzari' ? 'מאמר ' : 'פרק ') + _srG(ch); if (sec != null) { go.par = sec; sub += ' סעיף ' + _srG(sec); } }
      push(x.e, { id: x.e.id + ':smart', title: x.e.title, sub, score: 80 + x.m.s + (ch != null ? 10 : 0), go });
    });
  }

  // 6. everything else by plain text (all words must match)
  if (P.words.length) idx.forEach(e => {
    if (['parasha', 'daf', 'mishna', 'emuna'].includes(e.kind)) return;
    let s = _srScoreEntry(e, P.words);
    if (!s) return;
    if (P.hints.includes(e.tabKey)) s += 6;
    if (e.kind === 'tab') s += 1;
    s += _srPhraseBonus(e, P.words.join(' '));
    if (e.kind === 'action') s += 6;                    // "מצב בהיר" → the action just before the settings row
    push(e, { id: e.id, title: e.title, sub: e.sub, score: s, go: e.go });
  });
  // nothing at all → anything that matches ANY word, weaker
  if (!res.length && P.words.length) idx.forEach(e => {
    if (['parasha', 'daf', 'mishna'].includes(e.kind)) return;
    const best = Math.max(...P.words.map(w => Math.max(_srFieldBest(w, e._t) * 3, _srFieldBest(w, e._k) * 2)));
    if (best > 2) push(e, { id: e.id + ':any', title: e.title, sub: e.sub, score: best / 2, go: e.go });
  });

  const seen = new Map();
  res.forEach(r => { const o = seen.get(r.id); if (!o || r.score > o.score) seen.set(r.id, r); });
  return Array.from(seen.values()).sort((a, b) => b.score - a.score).slice(0, 30);
}

// ── Highlighting ────────────────────────────────────────────────────────
const _SR_CLS = { 'כ': '[כך]', 'מ': '[מם]', 'נ': '[נן]', 'פ': '[פף]', 'צ': '[צץ]' };
function _srTokenRegex(tok) {
  const parts = [...tok].map(ch => (_SR_CLS[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + '[\\u0591-\\u05C7"\'\\u05F3\\u05F4]*');
  return new RegExp(parts.join(''), 'g');
}
function srHighlight(text, tokens) {
  const s = String(text == null ? '' : text);
  const ranges = [];
  (tokens || []).forEach(t => {
    if (!t || t.length < 2) return;
    [srStem(t), srStem(t.slice(1))].forEach(v => {
      if (!v || v.length < 2) return;
      let m; const re = _srTokenRegex(v);
      while ((m = re.exec(s))) {
        let end = m.index + m[0].length;
        while (end < s.length && /[\u05D0-\u05EA\u0591-\u05C7]/.test(s[end])) end++;      // the whole word, not just the stem
        ranges.push([m.index, end]); if (m[0].length === 0) re.lastIndex++;
      }
    });
  });
  if (!ranges.length) return escapeHtml(s);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  ranges.forEach(r => { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); });
  let out = '', pos = 0;
  merged.forEach(([a, b]) => { out += escapeHtml(s.slice(pos, a)) + '<mark>' + escapeHtml(s.slice(a, b)) + '</mark>'; pos = b; });
  return out + escapeHtml(s.slice(pos));
}

// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════
let _srGoToken = 0;
const _srSleep = ms => new Promise(r => setTimeout(r, ms));

// polls fn() until truthy; false on timeout or when a newer search navigation took over
async function _srWait(fn, ms, token) {
  const end = Date.now() + (ms || 20000);
  while (Date.now() < end) {
    if (token !== _srGoToken) return false;
    try { if (fn()) return true; } catch (e) { /* not ready */ }
    await _srSleep(120);
  }
  return false;
}

// "the tab's own load finished". For parasha that means the base text, not Rashi/Onkelos still
// arriving (the adapter's idle() would wait for those too, and a new navigation cancels them anyway).
async function _srIdle(tab, token) {
  const ad = typeof BM_ADAPTERS !== 'undefined' ? BM_ADAPTERS[tab] : null;
  if (!ad) { await _srSleep(250); return; }
  await _srSleep(60);
  const idle = tab === 'parasha'
    ? () => { const ld = document.getElementById('parasha-loading'); return !_parashaLoading && (!ld || ld.style.display === 'none' || /^שגיאה/.test((ld.textContent || '').trim())); }
    : () => ad.idle();
  await _srWait(idle, 20000, token);
}

async function _srOpenTab(tab, token) {
  if (typeof autoScrollStop === 'function' && typeof _asState !== 'undefined' && _asState !== 'idle') autoScrollStop();
  const first = !loaded[tab];
  const switching = currentTab !== tab;
  if (switching || first) showTab(tab);
  if (switching || first) await _srIdle(tab, token);       // already on a loaded tab: nothing to wait for
  return first;
}

function _srToast(msg) { if (typeof _bmToast === 'function') _bmToast(msg, null, 2600); }
const _srTop = () => window.scrollTo({ top: 0, behavior: 'instant' });

async function searchGo(go, title) {
  if (!go) return;
  closeSearch();
  const token = ++_srGoToken;
  const stale = () => token !== _srGoToken;            // a newer search took over: stop touching the UI
  try {
    switch (go.kind) {
      case 'tab': {
        await _srOpenTab(go.tab, token); if (stale()) return;
        if (go.daily) {
          if (go.tab === 'daf' && _dafMode !== 'daily') { setDafMode('daily'); await _srIdle('daf', token); }
          if (go.tab === 'mishna' && _mishnaMode !== 'daily') { setMishnaMode('daily'); await _srIdle('mishna', token); }
          if (stale()) return;
          if (go.view && go.tab === 'daf') await switchDafView(go.view);
          if (go.view && go.tab === 'mishna') await switchMishnaView(go.view);
          if (go.view && go.tab === 'rambam') await switchRambamView(go.view);
        }
        break;
      }
      case 'parasha': {
        const first = await _srOpenTab('parasha', token); if (stale()) return;
        if (go.current) {
          if (!first) { loaded['parasha'] = true; await loadParasha(); await _srIdle('parasha', token); }
        } else {
          await loadSpecificParasha(go.ref); if (stale()) return;
          const sel = document.getElementById('parasha-select');
          if (sel) { if (![...sel.options].some(o => o.value === go.ref)) populateParashaDropdown(go.ref); sel.value = go.ref; }
        }
        if (stale()) return;
        if (go.aliya != null) {
          const tabs = Array.from(document.querySelectorAll('#aliya-tabs .aliya-tab'));
          const real = tabs.length - 1;                                   // the last tab is "הכל"
          const i = go.aliya === 'all' ? real : Math.min(go.aliya - 1, Math.max(real - 1, 0));
          if (tabs[i]) await showAliya(go.aliya === 'all' ? 'all' : i, tabs[i]);
        }
        if (stale()) return;
        if (go.view) setParashaView(go.view);
        _srTop();
        break;
      }
      case 'tehilim': {
        await _srOpenTab('tehilim', token); if (stale()) return;
        if (go.day) selectTehilimDay(go.day); else viewTehilimManual(go.chapter);
        break;
      }
      case 'favorite': {
        await _srOpenTab('tehilim', token); if (stale()) return;
        viewTehilimFavorite(go.id, 0);
        break;
      }
      case 'tefila': await _srOpenTab('tefilot', token); if (stale()) return; showTefila(go.key); _srTop(); break;
      case 'bracha': await _srOpenTab('brachot', token); if (stale()) return; await showBracha(go.key); _srTop(); break;
      case 'emuna': {
        await _srOpenTab('emuna', token);
        await _srWait(() => !_loading, 15000, token); if (stale()) return;
        const book = EMUNA_BOOKS[go.book];
        if (go.ch != null && book) {
          const units = _getBookUnits(book);
          const exact = units.findIndex(x => x.ch === go.ch && (go.par == null || (x.par <= go.par && (x.parEnd || x.par) >= go.par)));
          const at = exact !== -1 ? exact : units.findIndex(x => x.ch === go.ch);
          if (at !== -1) _getBookState(go.book).currentUnit = at;
        }
        await openBook(go.book);
        _srTop();
        break;
      }
      case 'daf': {
        await _srOpenTab('daf', token); if (stale()) return;
        setDafMode('pick');
        selectDafTractate(go.tractate, go.he);
        _pickDafTractate = go.tractate; _pickDafNum = go.num || 2; _pickDafAmud = go.amud || 'a';
        if (go.num) { await _loadPickedDaf(); await _srIdle('daf', token); if (go.view && !stale()) await switchDafView(go.view); }
        break;
      }
      case 'mishna': {
        await _srOpenTab('mishna', token); if (stale()) return;
        setMishnaMode('pick');
        selectMishnaTractate(go.tractate, go.he);
        if (go.chapter) {
          const chSel = document.getElementById('mishna-chapter-sel'); if (chSel) chSel.value = go.chapter;
          await onMishnaChapterChange(); if (stale()) return;
          _pickMishnaTractate = go.tractate; _pickMishnaChapter = go.chapter; _pickMishnaNum = go.num || 1;
          await _loadPickedMishna(); await _srIdle('mishna', token);
          if (go.view && !stale()) await switchMishnaView(go.view);
        }
        break;
      }
      case 'setting': {
        openSettings();
        await _srSleep(120);
        const el = document.getElementById(go.el);
        const row = el && (el.closest('.settings-row') || el.parentElement) || el;
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'instant' });
          row.classList.remove('sr-flash'); void row.offsetWidth; row.classList.add('sr-flash');
          setTimeout(() => row.classList.remove('sr-flash'), 2400);
        }
        break;
      }
      case 'bookmark': await bookmarkGo(go.tab); break;
      case 'action': _srRunAction(go.action); break;
    }
  } catch (e) {
    console.warn('[Search] navigation failed:', e);
    if (!stale()) _srToast('לא הצלחתי לפתוח את התוצאה');
    return;
  }
  if (!stale() && title && go.kind !== 'setting' && go.kind !== 'action') _srToast('✓ ' + title);
}

function _srRunAction(a) {
  if (a === 'theme-light') setTheme('light');
  else if (a === 'theme-dark') setTheme('dark');
  else if (a === 'settings') openSettings();
  else if (a === 'reminders') openReminderModal();
  else if (a === 'bm-menu') { const b = document.getElementById('bm-menu-btn'); if (b && b.style.display !== 'none') b.click(); else _srToast('סימניות זמינות רק בטאב עם טקסט'); }
  else if (a === 'bm-add') { if (typeof startBookmarkPick === 'function') startBookmarkPick(); }
  else if (a === 'bm-go') { if (getBookmark(currentTab)) bookmarkGo(currentTab); else _srToast('אין סימניה בטאב הנוכחי'); }
  else if (a === 'autoscroll') { if (typeof autoScrollStart === 'function') autoScrollStart(); }
}

// ═══════════════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════════════
let _srIndex = null, _srResults = [], _srActive = -1, _srTimer = 0;
const _srEl = id => document.getElementById(id);
const _SR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

function _srEnsureUI() {
  if (_srEl('sr-panel')) return;
  const back = document.createElement('div');
  back.id = 'sr-backdrop'; back.className = 'sr-backdrop'; back.style.display = 'none';
  back.addEventListener('click', closeSearch);
  const panel = document.createElement('div');
  panel.id = 'sr-panel'; panel.className = 'sr-panel'; panel.style.display = 'none'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'חיפוש');
  panel.innerHTML = `
    <div class="sr-inputrow">
      <span class="sr-glass" aria-hidden="true">${_SR_SVG}</span>
      <input id="sr-input" class="sr-input" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"
        placeholder="חפש: פרשה נוכחית · בראשית עליה ג רש״י · תהילים כג · תפילה…" aria-label="חיפוש באפליקציה" aria-controls="sr-results" />
      <button id="sr-clear" type="button" class="sr-x" aria-label="נקה חיפוש" style="display:none">✕</button>
      <button id="sr-close" type="button" class="sr-x sr-close" aria-label="סגור חיפוש">סגור</button>
    </div>
    <div id="sr-results" class="sr-results" role="listbox"></div>`;
  document.body.appendChild(back);
  document.body.appendChild(panel);
  const input = _srEl('sr-input');
  input.addEventListener('input', () => { _srEl('sr-clear').style.display = input.value ? '' : 'none'; clearTimeout(_srTimer); _srTimer = setTimeout(_srRender, 70); });
  input.addEventListener('keydown', _srKey);
  _srEl('sr-clear').addEventListener('click', () => { input.value = ''; _srEl('sr-clear').style.display = 'none'; _srRender(); input.focus(); });
  _srEl('sr-close').addEventListener('click', closeSearch);
  _srEl('sr-results').addEventListener('click', e => {
    const row = e.target.closest('[data-sr-i]');
    if (row) _srChoose(parseInt(row.getAttribute('data-sr-i'), 10));
    const chip = e.target.closest('[data-sr-fill]');
    if (chip) { input.value = chip.getAttribute('data-sr-fill'); _srEl('sr-clear').style.display = ''; _srRender(); input.focus(); }
  });
}

function searchIsOpen() { const p = _srEl('sr-panel'); return !!p && p.style.display !== 'none'; }

function openSearch() {
  _srEnsureUI();
  if (searchIsOpen()) { _srEl('sr-input').focus(); return; }
  if (typeof closeBookmarkMenu === 'function') closeBookmarkMenu();
  _srIndex = srBuildIndex();
  const tb = _srEl('topbar');
  _srEl('sr-panel').style.top = (tb ? Math.round(tb.getBoundingClientRect().bottom) : 48) + 'px';
  _srEl('sr-backdrop').style.display = '';
  _srEl('sr-panel').style.display = '';
  const b = _srEl('search-btn'); if (b) b.setAttribute('aria-expanded', 'true');
  _srEl('sr-input').value = ''; _srEl('sr-clear').style.display = 'none';
  _srRender();
  setTimeout(() => _srEl('sr-input').focus(), 30);
}

function closeSearch() {
  const p = _srEl('sr-panel'); if (!p) return;
  p.style.display = 'none'; _srEl('sr-backdrop').style.display = 'none';
  const b = _srEl('search-btn'); if (b) b.setAttribute('aria-expanded', 'false');
  const i = _srEl('sr-input'); if (i) i.blur();
}

function toggleSearch() { if (searchIsOpen()) closeSearch(); else openSearch(); }

function _srRecents() { return Array.isArray(appState.searchRecent) ? appState.searchRecent : []; }
function _srRemember(q) {
  q = (q || '').trim(); if (!q) return;
  appState.searchRecent = [q].concat(_srRecents().filter(x => x !== q)).slice(0, 6);
  saveState();
}

function _srRender() {
  const box = _srEl('sr-results'); if (!box) return;
  const q = _srEl('sr-input').value;
  if (!srNormalize(q)) {
    _srResults = []; _srActive = -1;
    const rec = _srRecents();
    box.innerHTML = (rec.length ? `<div class="sr-label">חיפושים אחרונים</div><div class="sr-chips">${rec.map(r => `<button type="button" class="sr-chip" data-sr-fill="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('')}</div>` : '') +
      `<div class="sr-label">נסה לחפש</div><div class="sr-chips">${SEARCH_SUGGESTIONS.map(r => `<button type="button" class="sr-chip" data-sr-fill="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('')}</div>` +
      `<div class="sr-hint">אפשר לשלב: שם + עליה + רש״י · מסכת + דף + ע״ב · תהילים + פרק · "נוכחית" לפרשת השבוע</div>`;
    return;
  }
  _srResults = srSearch(q, _srIndex);
  _srActive = _srResults.length ? 0 : -1;
  if (!_srResults.length) { box.innerHTML = `<div class="sr-empty">לא נמצאו תוצאות עבור "<b>${escapeHtml(q.trim())}</b>"<br><span>נסה מילה אחרת, שם פרשה או מסכת</span></div>`; return; }
  const P = srParse(q);
  box.innerHTML = _srResults.map((r, i) =>
    `<div class="sr-row${i === 0 ? ' sr-top' : ''}${i === _srActive ? ' sr-active' : ''}" role="option" data-sr-i="${i}" id="sr-opt-${i}">
       <span class="sr-icon" aria-hidden="true">${r.icon || '•'}</span>
       <span class="sr-text"><span class="sr-title">${srHighlight(r.title, P.words)}</span>${r.sub ? `<span class="sr-sub">${srHighlight(r.sub, P.words)}</span>` : ''}</span>
       <span class="sr-tag">${escapeHtml(r.tag || '')}</span>
       <span class="sr-go" aria-hidden="true">‹</span>
     </div>`).join('');
}

function _srSetActive(i) {
  if (!_srResults.length) return;
  _srActive = (i + _srResults.length) % _srResults.length;
  document.querySelectorAll('#sr-results .sr-row').forEach((r, k) => r.classList.toggle('sr-active', k === _srActive));
  const el = _srEl('sr-opt-' + _srActive); if (el) el.scrollIntoView({ block: 'nearest' });
}

function _srKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); _srSetActive(_srActive + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _srSetActive(_srActive - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); if (_srActive >= 0) _srChoose(_srActive); }
  else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
}

function _srChoose(i) {
  const r = _srResults[i]; if (!r) return;
  _srRemember(_srEl('sr-input').value);
  searchGo(r.go, r.title + (r.sub ? ' · ' + r.sub : ''));
}

function initSearch() {
  _srEnsureUI();
  const b = _srEl('search-btn');
  if (b) b.addEventListener('click', toggleSearch);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchIsOpen()) { closeSearch(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '/' ) { e.preventDefault(); openSearch(); }
  });
}
