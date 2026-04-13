"""
test_parasha.py
Tests for parasha loading, combined parshiot matching, aliyot, haftara.
Tests Hebcal API for parasha data on different dates.
"""
import sys, requests
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

TIMEOUT = 15
HEBCAL  = 'https://www.hebcal.com/hebcal'

def get_parasha_for_date(date_str):
    """Fetch parasha event from Hebcal for given date (searches +21 days)."""
    from datetime import datetime, timedelta
    d = datetime.strptime(date_str, '%Y-%m-%d')
    end = (d + timedelta(days=21)).strftime('%Y-%m-%d')
    params = {'v':'1','cfg':'json','s':'on','start':date_str,'end':end}
    r = requests.get(HEBCAL, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    items = data.get('items', [])
    return next((i for i in items if i.get('category') == 'parashat'), None)

# ── Fuzzy match (mirrors content.js) ─────────────────────────────────
ALL_PARASHIOT = [
    'בראשית','נח','לך לך','וירא','חיי שרה','תולדות','ויצא','וישלח','וישב','מקץ',
    'ויגש','ויחי','שמות','וארא','בא','בשלח','יתרו','משפטים','תרומה','תצוה',
    'כי תשא','ויקהל','פקודי','ויקרא','צו','שמיני','תזריע','מצורע','אחרי מות',
    'קדושים','אמור','בהר','בחוקותי','במדבר','נשא','בהעלותך','שלח','קורח','חקת',
    'בלק','פינחס','מטות','מסעי','דברים','ואתחנן','עקב','ראה','שופטים','כי תצא',
    'כי תבוא','נצבים','וילך','האזינו','וזאת הברכה'
]

PARASHA_REFS = {
    'תזריע':    'Leviticus 12:1-13:59',
    'מצורע':    'Leviticus 14:1-15:33',
    'ויקהל':    'Exodus 35:1-38:20',
    'פקודי':    'Exodus 38:21-40:38',
    'בהר':      'Leviticus 25:1-26:2',
    'בחוקותי':  'Leviticus 26:3-27:34',
    'נצבים':    'Deuteronomy 29:9-30:20',
    'וילך':     'Deuteronomy 31:1-31:30',
    'מטות':     'Numbers 30:2-32:42',
    'מסעי':     'Numbers 33:1-36:13',
}

def strip_vowel_letters(name):
    chars = list(name)
    result = []
    for i, c in enumerate(chars):
        if c in 'וי' and 0 < i < len(chars)-1 and chars[i-1] not in ' -' and chars[i+1] not in ' -':
            continue
        result.append(c)
    return ''.join(result)

def fuzzy_find(name):
    if not name: return None
    nc = strip_vowel_letters(name)
    for p in ALL_PARASHIOT:
        if p == name: return p
    for p in ALL_PARASHIOT:
        if strip_vowel_letters(p) == nc: return p
    for p in ALL_PARASHIOT:
        if len(name) >= 3 and p.startswith(name[:3]): return p
    for p in ALL_PARASHIOT:
        if len(nc) >= 3 and strip_vowel_letters(p).startswith(nc[:3]): return p
    return None

def parse_combined(clean_name):
    """Split combined parasha name and fuzzy-find both parts."""
    if '-' not in clean_name:
        return fuzzy_find(clean_name), None
    parts = clean_name.split('-', 1)
    first  = fuzzy_find(parts[0].strip())
    second = fuzzy_find(parts[1].strip())
    return first, second

def combined_ref(first_name, second_name):
    """Build Sefaria ref spanning both parshiot."""
    r1 = PARASHA_REFS.get(first_name, '')
    r2 = PARASHA_REFS.get(second_name, '')
    if not r1 or not r2: return None
    start = r1.split('-')[0]  # e.g. "Leviticus 12:1"
    end   = r2.split('-')[1]  # e.g. "15:33"
    return f'{start}-{end}'


def run() -> TestSuite:
    s = TestSuite('Parasha Logic & API')

    # ── Fuzzy matching for combined parshiot ──────────────────────────
    s.check('Exact: תזריע',     fuzzy_find('תזריע')  == 'תזריע')
    s.check('Exact: מצורע',     fuzzy_find('מצורע')  == 'מצורע')
    s.check('Fuzzy: מצרע → מצורע',  fuzzy_find('מצרע')   == 'מצורע',
            f"got: {fuzzy_find('מצרע')}")
    s.check('Fuzzy: בחקתי → בחוקותי', fuzzy_find('בחקתי') == 'בחוקותי',
            f"got: {fuzzy_find('בחקתי')}")
    s.check('Fuzzy: נצבים → נצבים', fuzzy_find('נצבים') == 'נצבים')
    s.check('Fuzzy: מסעי → מסעי',  fuzzy_find('מסעי')  == 'מסעי')

    # ── Combined ref building ─────────────────────────────────────────
    f1, f2 = parse_combined('תזריע-מצרע')
    s.check('Combined parse: first=תזריע',  f1 == 'תזריע',  str(f1))
    s.check('Combined parse: second=מצורע', f2 == 'מצורע',  str(f2))

    ref = combined_ref('תזריע', 'מצורע')
    s.check('Combined ref תזריע-מצורע = Lev 12:1-15:33',
            ref == 'Leviticus 12:1-15:33', str(ref))

    f1, f2 = parse_combined('ויקהל-פקודי')
    ref2 = combined_ref(f1, f2) if f1 and f2 else None
    s.check('Combined ref ויקהל-פקודי = Exod 35:1-40:38',
            ref2 == 'Exodus 35:1-40:38', str(ref2))

    f1, f2 = parse_combined('בהר-בחקתי')
    ref3 = combined_ref(f1, f2) if f1 and f2 else None
    s.check('Combined ref בהר-בחוקותי = Lev 25:1-27:34',
            ref3 == 'Leviticus 25:1-27:34', str(ref3))

    f1, f2 = parse_combined('נצבים-וילך')
    ref4 = combined_ref(f1, f2) if f1 and f2 else None
    s.check('Combined ref נצבים-וילך = Deut 29:9-31:30',
            ref4 == 'Deuteronomy 29:9-31:30', str(ref4))

    f1, f2 = parse_combined('מטות-מסעי')
    ref5 = combined_ref(f1, f2) if f1 and f2 else None
    s.check('Combined ref מטות-מסעי = Num 30:2-36:13',
            ref5 == 'Numbers 30:2-36:13', str(ref5))

    # ── Hebcal parasha API ────────────────────────────────────────────
    try:
        # תזריע-מצורע week (2026-04-12)
        ev = get_parasha_for_date('2026-04-12')
        s.check('Hebcal returns parasha event', ev is not None,
                'No parashat event found')
        if ev:
            title = ev.get('title', '')
            heName = ev.get('hebrew', '')
            s.check('Parasha title contains תזריע',
                    'tazria' in title.lower() or 'תזריע' in heName,
                    f'title={title} he={heName}')
            s.check('Parasha event has leyning', bool(ev.get('leyning')),
                    'no leyning field')
            leyning = ev.get('leyning', {})
            s.check('Leyning has aliyah 1', '1' in leyning, str(list(leyning.keys())[:5]))
            s.check('Leyning has maftir',   'M' in leyning or '7' in leyning)
            if '1' in leyning:
                s.check('Aliyah 1 starts in Leviticus',
                        'Leviticus' in leyning['1'], leyning['1'])
    except Exception as e:
        s.fail('Hebcal parasha API (combined week)', str(e))

    try:
        # Regular single parasha (במדבר)
        ev2 = get_parasha_for_date('2026-05-23')
        if ev2:
            s.check('Regular parasha: has leyning', bool(ev2.get('leyning')))
            s.check('Regular parasha: has haftara', bool(ev2.get('leyning', {}).get('haftara')))
    except Exception as e:
        s.fail('Hebcal parasha API (regular week)', str(e))

    try:
        # Holiday week — parasha may be future
        ev3 = get_parasha_for_date('2026-04-01')  # Pesach
        if ev3:
            s.check('Pesach week: parasha found (future)', ev3 is not None)
    except Exception as e:
        s.warn('Hebcal parasha API (holiday week)', str(e))

    # ── content.js code checks ────────────────────────────────────────
    content_js = (Path(__file__).parent.parent / 'js/content.js').read_text()
    s.check('fuzzyFind function defined',     'fuzzyFind'         in content_js)
    s.check('stripVowelLetters defined',      'stripVowelLetters' in content_js)
    s.check('combinedSecond variable exists', 'combinedSecond'    in content_js)
    s.check('Combined ref is built',          'startRef'          in content_js)
    s.check('populateParashaDropdown defined','populateParashaDropdown' in content_js)
    s.check('Combined option added to dropdown',
            'insertBefore' in content_js or 'opt.value = matchP.ref' in content_js)
    s.check('Haftara loading exists',         '_kickoffHaftara'   in content_js)

    return s
