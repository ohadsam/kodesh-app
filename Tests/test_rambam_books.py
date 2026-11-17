"""
test_rambam_books.py
Offline checks for the "ספרי הרמב"ם" sub-tab: js/rambam-data.js against Hebcal's Mishneh Torah table
(Tests/data/hebcal_mishnehTorah.json, from @hebcal/learning, which builds Sefaria links
"Mishneh_Torah,_<name>.<perek>"), navigation across sets, and the Steinsaltz placement logic.
Network-free: Sefaria itself is verified with `sefaria_probe.py rambam-check` on a networked machine.
"""
import json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

ROOT = Path(__file__).parent.parent

NODE = r"""
const fs = require('fs'), vm = require('vm');
const ctx = { console, deepFlat: a => a.flat(Infinity) };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/rambam-data.js','utf8') + ';this.D={RAMBAM_SEFARIM,RAMBAM_HIL,rambamRef,rambamSteinsaltzRef,rambamNeighbor,rambamTotalChapters,rambamDoneKey};', ctx);
const src = fs.readFileSync('js/rambam-books.js','utf8').split('// STATE / PERSISTENCE')[0];
vm.runInContext(src + ';this.A={rambamAlignSteinsaltz,rambamHalachotFrom,_rbCleanHtml,_rbStrip};', ctx);
const D = ctx.D, A = ctx.A, out = {};
out.hil = D.RAMBAM_HIL.map(h => [h.en, h.ch, h.slug, h.he, h.seferHe]);
out.sefarim = D.RAMBAM_SEFARIM.map(s => [s.he, s.hil.length]);
out.total = D.rambamTotalChapters();
out.refs = [D.rambamRef(D.RAMBAM_HIL[12], 3), D.rambamSteinsaltzRef(D.RAMBAM_HIL[6], 4, 20), D.rambamDoneKey(D.RAMBAM_HIL[38], 2)];
const nb = (h, c, d) => D.rambamNeighbor(h, c, d);
out.nb = [nb(0,1,-1), nb(0,1,1), nb(0,10,1), nb(1,1,-1), nb(83,12,1), nb(83,12,-1), nb(83,1,-1)];
// alignment scenarios
const H = ['מַעֲשֶׂה בְּאָדָם שֶׁבָּא לִפְנֵי הַדַּיָּן וְאָמַר אֵין לִי עֵדִים', 'הַשּׁוֹחֵט חַיָּב לִבְדּוֹק אֶת הַסַּכִּין קֹדֶם הַשְּׁחִיטָה', 'וְכֵן הַמְגַדֵּל שֵׂעָר לֹא יַעֲבֹר עַל הַמִּצְוָה'];
const E = (kw, t) => `<b>${kw}</b> ${t}`;
const sc = {};
sc.struct = A.rambamAlignSteinsaltz(H, { he: [[E('מעשה באדם','פירוש א')], [E('השוחט','פירוש ב'), E('הסכין','פירוש ג')], []], sections: [4,1], toSections: [4,3] });
sc.structTrim = A.rambamAlignSteinsaltz(H, { he: [[E('מעשה באדם','א')], [E('השוחט','ב')]], sections: [4,1] });       // right-trimmed
sc.shifted = A.rambamAlignSteinsaltz(H, { he: [[], [E('מעשה באדם','א')], [E('השוחט','ב')]], sections: [4,1] });     // one slot late
sc.startsAt2 = A.rambamAlignSteinsaltz(H, { he: [[E('השוחט','ב')], [E('המגדל','ג')]], sections: [4,2] });
sc.flat = A.rambamAlignSteinsaltz(H, { he: [E('מעשה באדם','א'), E('הסכין','ב'), E('המגדל שער','ג'), E('דבר שאינו כתוב','ד')] });
sc.empty = A.rambamAlignSteinsaltz(H, { he: [] });
sc.noKw = A.rambamAlignSteinsaltz(H, { he: [['טקסט בלי מילת פתיחה'], ['עוד טקסט']], sections: [4,1] });
sc.ellipsis = A.rambamAlignSteinsaltz(H, { he: [E('השוחט ... קודם','ב')] });
sc.beyond = A.rambamAlignSteinsaltz(H, { he: [[], [], [], [E('דבר אחר לגמרי','x')]], sections: [4,1] });
const sh = r => ({ mode: r.mode, by: r.by.map(a => a.map(e => e.html.replace(/<[^>]+>/g,'').slice(0,12) + (e.approx ? '~' : ''))), total: r.total, approx: r.approx, shift: r.shift });
out.sc = Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, sh(v)]));
out.clean = A._rbCleanHtml('<b class="x" onclick="evil()">א</b><script>alert(1)</script><i>ב</i><a href="x">ג</a><br/>');
out.halachot = [A.rambamHalachotFrom({ he: ['א', ['ב', 'ג'], '', null] }), A.rambamHalachotFrom({ he: 'שלם' }), A.rambamHalachotFrom({})];
console.log(JSON.stringify(out));
"""

def run_node():
    r = subprocess.run(['node', '-e', NODE], cwd=ROOT, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:500])
    return json.loads(r.stdout)

def run() -> TestSuite:
    s = TestSuite('Rambam Books (ספרי הרמב"ם)')
    try:
        d = run_node()
    except Exception as e:
        s.fail('node harness', str(e)); return s
    hebcal = json.loads((ROOT / 'Tests/data/hebcal_mishnehTorah.json').read_text(encoding='utf-8'))['chapters']
    items = list(hebcal.items())[4:]            # the first four are the introductory items, not hilchot sets
    mine = [(h[0], h[1]) for h in d['hil']]
    s.check('84 sets of hilchot in 14 sefarim', len(mine) == 84 and len(d['sefarim']) == 14, f'{len(mine)} / {len(d["sefarim"])}')
    s.check('English titles + chapter counts equal Hebcal\'s Mishneh Torah table, in the same order', mine == items,
            fail_detail=str([(a, b) for a, b in zip(mine, items) if a != b][:3]))
    s.check('total chapters == Hebcal total minus the 12 intro items', d['total'] == sum(hebcal.values()) - 12, d['total'])
    slugs = [h[2] for h in d['hil']]
    s.check('slugs unique and ASCII-only (safe in onclick / ids)', len(set(slugs)) == 84 and all(x.isascii() and x.replace('_', '').isalnum() for x in slugs), slugs[:3])
    s.check('every set has a Hebrew name starting הלכות (or סדר תפילות כל השנה)', all(h[3].startswith('הלכות ') or h[3] == 'סדר תפילות כל השנה' for h in d['hil']))
    s.check('sefarim sizes 5,7,10,5,3,4,7,9,6,8,5,5,5,5', [x[1] for x in d['sefarim']] == [5, 7, 10, 5, 3, 4, 7, 9, 6, 8, 5, 5, 5, 5], d['sefarim'])
    s.check('refs have the Sefaria form (Mishneh Torah, <title> <n>; Steinsaltz uses a halacha RANGE)',
            d['refs'][0] == 'Mishneh Torah, Sabbath 3' and d['refs'][1] == 'Steinsaltz on Mishneh Torah, Prayer and the Priestly Blessing 4:1-20' and d['refs'][2] == "rb_second_tithes_and_fourth_year_s_fruit_2", d['refs'])
    nb = d['nb']
    s.check('neighbors: none before the first chapter / after the last', nb[0] is None and nb[5] is not None and nb[4] is None and nb[6] == {'hIdx': 82, 'ch': 14})
    s.check('neighbors cross from the last chapter of a set into the next set and back', nb[2] == {'hIdx': 1, 'ch': 1} and nb[3] == {'hIdx': 0, 'ch': 10} and nb[1] == {'hIdx': 0, 'ch': 2})
    sc = d['sc']
    s.check('structure: he[i] ↔ halacha i (2 comments land under halacha 2)', sc['struct']['mode'] == 'structure' and [len(x) for x in sc['struct']['by']] == [1, 2, 0] and sc['struct']['approx'] == 0, sc['struct'])
    s.check('structure: right-trimmed response keeps positions', [len(x) for x in sc['structTrim']['by']] == [1, 1, 0])
    s.check('structure repaired when it is shifted by one (lemmata disagree)', sc['shifted']['mode'] == 'structure-shifted' and sc['shifted']['shift'] == -1 and [len(x) for x in sc['shifted']['by']] == [1, 1, 0], sc['shifted'])
    s.check('structure honours data.sections start (starts at halacha 2)', [len(x) for x in sc['startsAt2']['by']] == [0, 1, 1], sc['startsAt2'])
    s.check('flat response: placed by lemma, unmatched flagged approximate', sc['flat']['mode'] == 'keyword' and [len(x) for x in sc['flat']['by']] == [1, 1, 2] and sc['flat']['approx'] == 1 and sc['flat']['by'][2][1].endswith('~'), sc['flat'])
    s.check('no commentary → mode none, nothing placed', sc['empty']['mode'] == 'none' and sc['empty']['total'] == 0)
    s.check('structure without lemmata is trusted as-is', sc['noKw']['mode'] == 'structure' and [len(x) for x in sc['noKw']['by']] == [1, 1, 0])
    s.check('lemma with an ellipsis matches on its first piece', sc['ellipsis']['by'][1] and sc['ellipsis']['approx'] == 0, sc['ellipsis'])
    s.check('entries beyond the known chapter are kept but flagged', sc['beyond']['total'] == 1 and sc['beyond']['approx'] == 1)
    s.check('HTML cleaner keeps b/i/br only, strips attributes and scripts/links', d['clean'] == '<b>א</b>alert(1)<i>ב</i>ג<br>', d['clean'])
    s.check('halachot extraction: nested paragraphs joined, blanks dropped, string accepted, missing → []', d['halachot'] == [['א', 'ב ג'], ['שלם'], []], d['halachot'])
    return s
