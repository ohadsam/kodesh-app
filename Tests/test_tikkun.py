"""
test_tikkun.py
Offline checks for the "תיקון קוראים" view: the text layers (tikkunTransform), the ta'amim table
(js/taamim-data.js vs Unicode's own names and vs the accents that actually occur in the Torah text), the
recorded-reading parser, and the Torah-scroll fonts. Network-free.
"""
import json, subprocess, sys, unicodedata
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

ROOT = Path(__file__).parent.parent

NODE = r"""
const fs = require('fs'), vm = require('vm');
const ctx = { console, escapeHtml: s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), appState: {}, saveState(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/taamim-data.js','utf8') + ';this.T={TAAMIM_DISJUNCTIVE,TAAMIM_CONJUNCTIVE,TAAMIM_OTHER,taamimSign};', ctx);
const u = fs.readFileSync('js/utils.js','utf8'); const gi = u.indexOf('function toGematria'); let d = 0, k = u.indexOf('{', gi); const gs = k; for (; k < u.length; k++) { if (u[k] === '{') d++; else if (u[k] === '}') { d--; if (!d) { k++; break; } } }
vm.runInContext(u.slice(gi, k) + ';', ctx);                       // the real toGematria
vm.runInContext(fs.readFileSync('js/tikkun.js','utf8') + ';this.K={tikkunTransform};', ctx);
vm.runInContext(fs.readFileSync('js/tikkun-audio.js','utf8') + ';this.A={tikkunParseMedia,tikkunChunkRefs,tikkunDurAt,tikkunTotal,tikkunLocate,tikkunAbs,tikkunFmtTime,tikkunRefHe,tikkunJumpItems,tikkunJumpFilter,TK_RATES};', ctx);
const K = ctx.K, T = ctx.T, A = ctx.A, out = {};
const V = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
out.plain = K.tikkunTransform(V, {}).text; out.nikud = K.tikkunTransform(V, { nikud: true }).text; out.teamim = K.tikkunTransform(V, { teamim: true }).text; out.both = K.tikkunTransform(V, { nikud: true, teamim: true }).text; out.src = V;
const M = 'אֶת־הַשָּׁמַ֖יִם ׀ וְאֶת־הָאָֽרֶץ׃';
out.maqafPlain = K.tikkunTransform(M, {}).text; out.maqafNikud = K.tikkunTransform(M, { nikud: true }).text; out.paseq = K.tikkunTransform(M, { nikud: true }).text.includes('׀'); out.paseqT = K.tikkunTransform(M, { teamim: true }).text.includes('׀');
out.pe = K.tikkunTransform('וַיְכֻלּ֛וּ׃ <span class="mam-spi-pe">{פ}</span>', {}); out.se = K.tikkunTransform('וַיְכֻלּ֛וּ׃ {ס}', {}); out.none = K.tikkunTransform('וַיְכֻלּ֛וּ׃', {});
out.big = K.tikkunTransform('<big>בְּ</big>רֵאשִׁ֖ית<sup class="footnote-marker">1</sup><i class="footnote">הערה</i>', {}).html;
out.xss = K.tikkunTransform('<img src=x onerror=alert(1)>א &lt;script&gt; <b>ב</b>', {}).html;
out.sofNikud = K.tikkunTransform('הָאָֽרֶץ׃', { nikud: true }).text.includes('׃'); out.sofPlain = K.tikkunTransform('הָאָֽרֶץ׃', {}).text.includes('׃');
out.taamim = { dis: T.TAAMIM_DISJUNCTIVE, con: T.TAAMIM_CONJUNCTIVE, oth: T.TAAMIM_OTHER, sign: T.taamimSign([0x591]) };
// recorded reading parser (shape assumed from Sefaria's related API; unverified live)
const rel = { media: [
  { media_url: 'https://x.org/gen1_2.mp3', source: 'PocketTorah', anchorRef: 'Genesis 1:2' },
  { media_url: 'https://x.org/gen1_1.mp3', source: 'PocketTorah', anchorRef: 'Genesis 1:1' },
  { media_url: 'https://x.org/other.mp3', source: 'Some Podcast', anchorRef: 'Genesis 1:3' },
  { media_url: 'http://x.org/insecure.mp3', source: 'PocketTorah', anchorRef: 'Genesis 1:3' },
  { media_url: 'https://x.org/page.html', source: 'PocketTorah', anchorRef: 'Genesis 1:3' },
  { media_url: 'https://x.org/gen1_4.mp3', source: 'Torah Readings', anchorRef: 'Genesis 1:4' } ] };
out.media = A.tikkunParseMedia(rel, ['1:1', '1:2', '1:3', '1:4']);
// the REAL shape (verified 2026-11-22 via Sefaria's /api/related): one mp3 per aliya, each verse = a start/end slice of it
const real = { media: [14, 15, 16].map((v, j) => ({ media_url: 'https://raw.githubusercontent.com/rneiss/PocketTorah/master/data/audio/Lech-Lecha-2.mp3', source: 'PocketTorah', source_he: 'פוקט תורה', start_time: 2 * j + 0.5, end_time: 2 * j + 2.5, anchorRef: 'Genesis 12:' + v, source_site: 'http://www.pockettorah.com', license: 'CC-BY-SA', description: { en: 'Torah reading, Avery-Binder style.' } })).concat([{ media_url: 'https://x.org/Lech-Lecha-2-H.mp3', source: 'PocketTorah', start_time: 5, end_time: 5, anchorRef: 'Genesis 12:17' }]) };
out.real = A.tikkunParseMedia(real, ['12:14', '12:15', '12:16', '12:17']);
out.chunks = [A.tikkunChunkRefs(['12:14','12:15','12:16','12:17','12:18','12:19','12:20','13:1','13:2','13:3','13:4'], 'Genesis', 5), A.tikkunChunkRefs(['17:24'], 'Genesis'), A.tikkunChunkRefs(['5:1','5:3'], 'Genesis')];
// Hebcal leyning keys (real: "1".."7", "maftir", "haftarah"; holiday values carry " | Chanukah Day 1 (on Shabbat)")
const hsrc = fs.readFileSync('js/content.js','utf8'); const pick = n => { const i = hsrc.indexOf('function ' + n); let d = 0, k = hsrc.indexOf('{', i); for (; k < hsrc.length; k++) { if (hsrc[k] === '{') d++; else if (hsrc[k] === '}') { d--; if (!d) { k++; break; } } } return hsrc.slice(i, k); };
vm.runInContext(['_hebcalRef', '_readHebcalLeyning', '_hebcalHaftara'].map(pick).join('\n') + ';this.H={_hebcalRef,_readHebcalLeyning,_hebcalHaftara};', ctx);
const lv = { '1': 'Genesis 1:1-2:3', '2': 'Genesis 2:4-2:19', '3': 'Genesis 2:20-3:21', '4': 'Genesis 3:22-4:18', '5': 'Genesis 4:19-4:22', '6': 'Genesis 4:23-5:24', '7': 'Genesis 5:25-6:8', maftir: 'Genesis 6:5-6:8', haftarah: 'Isaiah 42:5-43:10', torah: 'Genesis 1:1-6:8' };
out.hl = { n: ctx.H._readHebcalLeyning(lv).length, m: ctx.H._readHebcalLeyning(lv)[7], h: ctx.H._hebcalHaftara(lv), partial: ctx.H._readHebcalLeyning({ '1': 'Genesis 1:1-2:3', maftir: 'x' }).length, hol: ctx.H._hebcalRef('Numbers 7:1-7:17 | Chanukah Day 1 (on Shabbat)'), bad: ctx.H._hebcalRef('Rosh Chodesh Day 1'), none: ctx.H._readHebcalLeyning(null).length, hnone: ctx.H._hebcalHaftara({}) };
out.mediaNone = A.tikkunParseMedia({ links: [] }, ['1:1']);
// timeline helpers
const durs = [2, 3, 0, 5];                                   // the third clip is not measured yet → the average (10/3)
out.tl = { n3: A.tikkunDurAt(durs, 2), total: A.tikkunTotal(durs, 4), loc: [0, 1.9, 2, 4.9, 5, 8.3, 8.4, 13.4, 999].map(s => A.tikkunLocate(durs, 4, s)), abs: A.tikkunAbs(durs, 3, 1.5), none: A.tikkunTotal([], 3), fmt: [0, 5, 65, 3599.6, -3, null].map(A.tikkunFmtTime) };
out.rates = A.TK_RATES;
out.refs = ['Genesis 17:24-17:27', 'Genesis 12:14-13:4', 'Leviticus 8:30-8:36', 'garbage'].map(A.tikkunRefHe);
const items = A.tikkunJumpItems({ aliyot: ['Genesis 1:1-2:3', 'Genesis 2:4-2:19', null, 'x', 'x', 'x', 'x', 'Genesis 6:5-6:8'], currentAliya: 1, verseKeys: ['2:4', '2:5', '2:6'], hasClip: { '2:4': true, '2:5': true }, texts: ['ויכלו השמים', 'ויהי ערב', 'ויקרא'] });
out.jump = { n: items.length, kinds: items.map(i => i.kind[0]).join(''), first: items[0].label, maftir: items.find(i => i.idx === 7).label, cur: items.filter(i => i.current).map(i => i.idx), noClip: items.filter(i => i.kind === 'verse' && !i.has).map(i => i.key),
  f1: A.tikkunJumpFilter(items, 'עליה ב').map(i => i.label), f2: A.tikkunJumpFilter(items, '2:5').map(i => i.key), f3: A.tikkunJumpFilter(items, 'ערב').map(i => i.key), f4: A.tikkunJumpFilter(items, 'מפטיר').map(i => i.idx), f5: A.tikkunJumpFilter(items, 'zzz').length, f6: A.tikkunJumpFilter(items, '').length };
console.log(JSON.stringify(out));
"""

def run() -> TestSuite:
    s = TestSuite('Tikkun Korim (תיקון קוראים)')
    r = subprocess.run(['node', '-e', NODE], cwd=ROOT, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        s.fail('node harness', r.stderr[:400]); return s
    d = json.loads(r.stdout)
    mark = lambda t: any(0x591 <= ord(c) <= 0x5C7 for c in t if c not in '־׃')
    nik = lambda t: any(0x5B0 <= ord(c) <= 0x5BC or ord(c) in (0x5C1, 0x5C2, 0x5C7) for c in t)
    tro = lambda t: any(0x591 <= ord(c) <= 0x5AF for c in t)
    s.check('letters only: no points, no accents, no sof pasuq', not mark(d['plain']) and '׃' not in d['plain'] and d['plain'] == 'בראשית ברא אלהים את השמים ואת הארץ', d['plain'])
    s.check('ניקוד layer: points yes, accents no', nik(d['nikud']) and not tro(d['nikud']), d['nikud'])
    s.check('טעמים layer: accents yes, points no (shin/sin dots count as points)', tro(d['teamim']) and not nik(d['teamim']), d['teamim'])
    s.check('both layers: the text is unchanged', d['both'] == d['src'], d['both'])
    s.check('maqaf: a space in the bare scroll text, kept when a layer is on', d['maqafPlain'] == 'את השמים ואת הארץ' and '־' in d['maqafNikud'], (d['maqafPlain'], d['maqafNikud']))
    s.check('paseq belongs to the ta\'amim layer only', (not d['paseq']) and d['paseqT'])
    s.check('sof pasuq: with a layer, not in the bare scroll', d['sofNikud'] and not d['sofPlain'])
    s.check('{פ} → petucha flag + marker removed; {ס} → setuma; plain verse → neither', d['pe']['pe'] and not d['pe']['se'] and '{' not in d['pe']['html'] and d['se']['se'] and not d['se']['pe'] and not d['none']['pe'] and not d['none']['se'])
    s.check('big letter kept as a styled span, footnote markers/notes dropped', 'class="tk-big"' in d['big'] and 'הערה' not in d['big'] and '1' not in d['big'], d['big'])
    s.check('foreign tags are stripped and text escaped (no element can be injected)', '<img' not in d['xss'] and '<b>' not in d['xss'] and '&lt;script&gt;' in d['xss'], d['xss'])
    # ── ta'amim table
    T = d['taamim']; allt = T['dis'] + T['con'] + T['oth']
    s.check('table sizes 18 disjunctive / 8 conjunctive / 7 other', (len(T['dis']), len(T['con']), len(T['oth'])) == (18, 8, 7), (len(T['dis']), len(T['con']), len(T['oth'])))
    names_ok, wrong = True, []
    for t in allt:
        for part, cp in zip(t['en'].split('+'), t['cps']):
            nm = unicodedata.name(chr(cp), '').lower()
            if part not in nm and not (part == 'segol' and 'segol' in nm) and not (part == 'sof pasuq' and 'sof pasuq' in nm):
                wrong.append((t['he'], t['en'], hex(cp), nm))
    s.check('each sign\'s English name occurs in its Unicode character name', not wrong, str(wrong[:3]))
    used_in_torah = list(range(0x591, 0x5A2)) + list(range(0x5A3, 0x5AB)) + [0x5AE]      # accents occurring in the (OSHB/WLC) Torah text
    covered = {c for t in allt for c in t['cps'] + t.get('alt', [])}
    s.check('every accent that occurs in the Torah text is in the table', all(c in covered for c in used_in_torah), [hex(c) for c in used_in_torah if c not in covered])
    s.check('names unique; the user\'s examples פשטא / מונח / זרקא / סגול are all there', len({t['he'] for t in allt}) == len(allt) and all(any(x in t['he'] for t in allt) for x in ['פשטא', 'מונח', 'זרקא', 'סגולתא']))
    s.check('sample sign = carrier letter + code points', T['sign'] == 'א֑')
    # ── recorded reading parser
    m = d['media']
    s.check('audio parser: only https audio files from Torah-reading sources, in reading order, others ignored, missing counted',
            [i['key'] for i in m['items']] == ['1:1', '1:2', '1:4'] and m['missing'] == 1 and m['items'][0]['url'].endswith('gen1_1.mp3'), m)
    s.check('audio parser: a response without media → no items', d['mediaNone']['items'] == [] and d['mediaNone']['missing'] == 1)
    r = d['real']
    s.check('audio parser (real Sefaria shape): slices kept, a zero-length slice is dropped to "whole file", same file for all verses',
            [(i['key'], i['start'], i['end']) for i in r['items']] == [('12:14', 0.5, 2.5), ('12:15', 2.5, 4.5), ('12:16', 4.5, 6.5), ('12:17', None, None)] and len({i['url'] for i in r['items'][:3]}) == 1 and r['source'] == 'PocketTorah', r)
    c = d['chunks']
    s.check('chunk refs: ≤5 consecutive verses of one chapter per request (long ranges 504 on Sefaria)',
            [x['ref'] for x in c[0]] == ['Genesis 12:14-12:18', 'Genesis 12:19-12:20', 'Genesis 13:1-13:4'] and c[1][0]['ref'] == 'Genesis 17:24' and [x['ref'] for x in c[2]] == ['Genesis 5:1', 'Genesis 5:3'], c)
    h = d['hl']
    s.check('Hebcal leyning: keys "1".."7"+"maftir" → 8 refs, holiday suffix stripped, haftarah read, a partial/garbled list is not padded with a bogus maftir, non-refs rejected',
            h['n'] == 8 and h['m'] == 'Genesis 6:5-6:8' and h['h'] == 'Isaiah 42:5-43:10' and h['partial'] == 1 and h['hol'] == 'Numbers 7:1-7:17' and h['bad'] is None and h['none'] == 0 and h['hnone'] is None, h)
    # ── timeline / jump helpers
    tl = d['tl']
    s.check('timeline: unmeasured clip = average of the measured ones; total adds up', abs(tl['n3'] - 10 / 3) < 1e-9 and abs(tl['total'] - (2 + 3 + 10 / 3 + 5)) < 1e-9 and tl['none'] == 12, tl)
    s.check('locate(second) → clip + offset (a boundary goes to the next clip, the end clamps to the last clip)',
            [(x['i'], round(x['t'], 2)) for x in tl['loc']] == [(0, 0), (0, 1.9), (1, 0), (1, 2.9), (2, 0), (2, 3.3), (3, 0.07), (3, 5.0), (3, 5.0)], [(x['i'], round(x['t'], 2)) for x in tl['loc']])
    s.check('absolute position = durations before + offset; mm:ss formatting incl. odd input', abs(tl['abs'] - (2 + 3 + 10 / 3 + 1.5)) < 1e-9 and tl['fmt'] == ['0:00', '0:05', '1:05', '60:00', '0:00', '0:00'], tl['fmt'])
    s.check('speed list: 0.5× … 2× in 11 steps, includes 1×, slower and faster', d['rates'][0] == 0.5 and d['rates'][-1] == 2 and 1 in d['rates'] and len(d['rates']) == 11, d['rates'])
    s.check('Hebrew reference text for the jump list', d['refs'] == ['בראשית י״ז:כ״ד–כ״ז', 'בראשית י״ב:י״ד–י״ג:ד׳', 'ויקרא ח׳:ל׳–ל״ו', 'garbage'], d['refs'])
    j = d['jump']
    s.check('jump list: 7 aliyot entries (the null one skipped, maftir labelled) then the 3 verses', j['kinds'] == 'aaaaaaavvv' and j['n'] == 10 and j['first'] == 'עליה א – בראשית א׳:א׳–ב׳:ג׳' and j['maftir'] == 'מפטיר – בראשית ו׳:ה׳–ח׳', j)
    s.check('jump list: current aliya marked, a verse without a clip flagged', j['cur'] == [1] and j['noClip'] == ['2:6'], j)
    s.check('jump filter: "עליה ב" → that aliya, "2:5" → the verse, words of the text, "מפטיר", no match → [], empty → everything',
            j['f1'] == ['עליה ב – בראשית ב׳:ד׳–י״ט'] and j['f2'] == ['2:5'] and j['f3'] == ['2:5'] and j['f4'] == [7] and j['f5'] == 0 and j['f6'] == j['n'], j)
    # ── fonts
    for f in ('ItimStamAshkenaz', 'ItimStamSefarad'):
        p = ROOT / 'fonts' / f'{f}.woff2'
        s.check(f'font {f}.woff2 present and small', p.exists() and 2000 < p.stat().st_size < 60000, p.stat().st_size if p.exists() else 'missing')
    s.check('font licence files shipped', (ROOT / 'fonts/LICENSE-Culmus.txt').exists() and (ROOT / 'fonts/LICENSE-GPL-2.0.txt').exists())
    sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
    s.check('service worker precaches the scroll fonts', 'fonts/ItimStamAshkenaz.woff2' in sw and 'fonts/ItimStamSefarad.woff2' in sw)
    return s
