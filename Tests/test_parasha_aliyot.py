"""
test_parasha_aliyot.py
The static PARASHA_ALIYOT table of js/content.js (used when a parasha is picked from the dropdown, i.e. when Hebcal's
live leyning is not at hand) must equal Hebcal's own aliyot data (Tests/data/hebcal_aliyot.json, from @hebcal/leyning,
the same data Hebcal returns as `leyning` for the current parasha): 7 aliyot + maftir per parasha, in the app's
"Book c:v-c:v" format. Before v5.142 about a dozen parshiot held a different division and many maftir ranges were wrong.
"""
import json, re, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

ROOT = Path(__file__).parent.parent
BOOKS = ['', 'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']

NODE = r"""
const fs = require('fs');
const src = fs.readFileSync('js/content.js', 'utf8');
const grab = (name, open) => { const i = src.indexOf('const ' + name + ' = '); let j = src.indexOf(open, i), d = 0, k = j; const cl = open === '{' ? '}' : ']';
  for (; k < src.length; k++) { if (src[k] === open) d++; else if (src[k] === cl) { d--; if (!d) { k++; break; } } } return eval('(' + src.slice(j, k) + ')'); };
console.log(JSON.stringify({ all: grab('ALL_PARASHIOT', '['), aliyot: grab('PARASHA_ALIYOT', '{') }));
"""

def parse(ref):
    m = re.match(r'^(\w+) (\d+):(\d+)-(\d+):(\d+)$', ref)
    return (m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))) if m else None

def run() -> TestSuite:
    s = TestSuite('Parasha aliyot table vs Hebcal')
    r = subprocess.run(['node', '-e', NODE], cwd=ROOT, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        s.fail('node harness', r.stderr[:300]); return s
    d = json.loads(r.stdout)
    hc = json.loads((ROOT / 'Tests/data/hebcal_aliyot.json').read_text(encoding='utf-8'))['parashiot']
    allp, table = d['all'], d['aliyot']
    s.check('54 parshiot, each has an entry in the table', len(allp) == 54 and all(p['ref'] in table for p in allp), len(table))
    bad = []
    for i, p in enumerate(allp):
        h = hc[str(i + 1)]
        exp = [f"{BOOKS[h['book']]} {h['fullkriyah'][k][0]}-{h['fullkriyah'][k][1]}" for k in '1234567M' if k in h['fullkriyah']]
        if table[p['ref']] != exp:
            bad.append((p['he'], table[p['ref']], exp))
    s.check('every parasha: aliyot 1-7 and maftir equal Hebcal\'s', not bad, fail_detail=str(bad[:2]))
    s.check('only Vezot Haberakhah has no maftir (7 entries), all others 8', [len(table[p['ref']]) for p in allp].count(7) == 1 and len(table[allp[-1]['ref']]) == 7)
    # structural sanity independent of Hebcal
    probs = []
    for p in allp:
        a = [parse(x) for x in table[p['ref']]]
        whole = parse(p['ref'])
        if None in a: probs.append((p['he'], 'unparsable')); continue
        if (a[0][1], a[0][2]) != (whole[1], whole[2]) or (a[6][3], a[6][4]) != (whole[3], whole[4]): probs.append((p['he'], 'ends'))
        for x, y in zip(a[:6], a[1:7]):                                 # aliya n+1 starts after aliya n starts
            if (y[1], y[2]) <= (x[1], x[2]): probs.append((p['he'], 'order'))
        if len(a) == 8:
            m, last = a[7], a[6]
            if not ((last[1], last[2]) <= (m[1], m[2]) and (m[3], m[4]) == (last[3], last[4])):   # the maftir repeats the END of the 7th aliya
                probs.append((p['he'], 'maftir not inside aliya 7'))
    s.check('aliyot start at the parasha start, aliya 7 ends at its end, order increasing, maftir ⊂ aliya 7', not probs, fail_detail=str(probs[:3]))
    return s
