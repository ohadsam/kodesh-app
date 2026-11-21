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
vm.runInContext(fs.readFileSync('js/tikkun.js','utf8') + ';this.K={tikkunTransform,tikkunParseMedia};', ctx);
const K = ctx.K, T = ctx.T, out = {};
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
out.media = K.tikkunParseMedia(rel, ['1:1', '1:2', '1:3', '1:4']);
out.mediaNone = K.tikkunParseMedia({ links: [] }, ['1:1']);
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
    # ── fonts
    for f in ('ItimStamAshkenaz', 'ItimStamSefarad'):
        p = ROOT / 'fonts' / f'{f}.woff2'
        s.check(f'font {f}.woff2 present and small', p.exists() and 2000 < p.stat().st_size < 60000, p.stat().st_size if p.exists() else 'missing')
    s.check('font licence files shipped', (ROOT / 'fonts/LICENSE-Culmus.txt').exists() and (ROOT / 'fonts/LICENSE-GPL-2.0.txt').exists())
    sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
    s.check('service worker precaches the scroll fonts', 'fonts/ItimStamAshkenaz.woff2' in sw and 'fonts/ItimStamSefarad.woff2' in sw)
    return s
