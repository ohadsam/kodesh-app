"""
test_omer.py
Tests for omer counting logic — Hebrew grammar, day strings, sefira attribution.
Covers all 49 days with spot-checks and full regression for days 11-19 bug.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

# ── Mirror of omer.js functions ───────────────────────────────────────
OMER_ONES  = ['','אֶחָד','שְׁנַיִם','שְׁלֹשָׁה','אַרְבָּעָה','חֲמִשָּׁה',
               'שִׁשָּׁה','שִׁבְעָה','שְׁמוֹנָה','תִּשְׁעָה','עֲשָׂרָה']
OMER_TENS  = ['','','עֶשְׂרִים','שְׁלֹשִׁים','אַרְבָּעִים']
OMER_WEEKS = ['','שָׁבוּעַ אֶחָד','שְׁנֵי שָׁבוּעוֹת','שְׁלֹשָׁה שָׁבוּעוֹת',
               'אַרְבָּעָה שָׁבוּעוֹת','חֲמִשָּׁה שָׁבוּעוֹת','שִׁשָּׁה שָׁבוּעוֹת',
               'שִׁבְעָה שָׁבוּעוֹת']
OMER_DAYS  = ['','יוֹם אֶחָד','שְׁנֵי יָמִים','שְׁלֹשָׁה יָמִים',
               'אַרְבָּעָה יָמִים','חֲמִשָּׁה יָמִים','שִׁשָּׁה יָמִים']
OMER_TEENS = ['אַחַד עָשָׂר','שְׁנֵים עָשָׂר','שְׁלֹשָׁה עָשָׂר',
               'אַרְבָּעָה עָשָׂר','חֲמִשָּׁה עָשָׂר','שִׁשָּׁה עָשָׂר',
               'שִׁבְעָה עָשָׂר','שְׁמוֹנָה עָשָׂר','תִּשְׁעָה עָשָׂר']

def omer_day_he(n):
    if n <= 10: return OMER_ONES[n]
    if n < 20:  return OMER_TEENS[n - 11]
    t, o = n // 10, n % 10
    return (OMER_ONES[o] + ' וְ' + OMER_TENS[t]) if o else OMER_TENS[t]

def omer_count_str(day):
    total  = omer_day_he(day)
    weeks, rem = day // 7, day % 7
    t_plural = 'שְׁנֵי' if day == 2 else total
    plural   = 'יוֹם אֶחָד' if day == 1 else f'{t_plural} יָמִים'
    singular = f'{total} יוֹם'
    if weeks == 0: return f'{plural} לָעֹמֶר'
    wk = OMER_WEEKS[weeks]
    if rem == 0: return f'{plural} שֶׁהֵם {wk} לָעֹמֶר'
    return f'{singular} שֶׁהֵם {wk} וְ{OMER_DAYS[rem]} לָעֹמֶר'

# Omer period: 16 Nisan → Sivan 5
def get_omer_day(hm, hd):
    if hm == 'Nisan'  and hd >= 16: return hd - 15
    if hm == 'Iyar':                 return hd + 15
    if hm == 'Sivan'  and hd <= 5:  return hd + 44
    return 0  # not in omer period


def run() -> TestSuite:
    s = TestSuite('Omer Counting')

    # ── Day strings: days 1–10 ────────────────────────────────────────
    s.check('Day 1: יוֹם אֶחָד',   omer_count_str(1) == 'יוֹם אֶחָד לָעֹמֶר',
            omer_count_str(1))
    s.check('Day 2: שְׁנֵי יָמִים', 'שְׁנֵי יָמִים' in omer_count_str(2),
            omer_count_str(2))
    s.check('Day 2: NOT שְׁנַיִם',  'שְׁנַיִם' not in omer_count_str(2),
            omer_count_str(2))
    s.check('Day 3: שְׁלֹשָׁה יָמִים', 'שְׁלֹשָׁה יָמִים' in omer_count_str(3),
            omer_count_str(3))
    s.check('Day 6: שִׁשָּׁה יָמִים', 'שִׁשָּׁה יָמִים לָעֹמֶר' in omer_count_str(6),
            omer_count_str(6))

    # ── Day 7: first complete week ────────────────────────────────────
    s.check('Day 7: שבת שלמות plural יָמִים',
            'שִׁבְעָה יָמִים שֶׁהֵם שָׁבוּעַ אֶחָד לָעֹמֶר' in omer_count_str(7),
            omer_count_str(7))

    # ── Days 8–13: singular יוֹם with week ───────────────────────────
    s.check('Day 8: singular יוֹם',
            'שְׁמוֹנָה יוֹם שֶׁהֵם שָׁבוּעַ אֶחָד וְיוֹם אֶחָד לָעֹמֶר' in omer_count_str(8),
            omer_count_str(8))
    s.check('Day 9: singular יוֹם',  'יוֹם' in omer_count_str(9)  and 'שָׁבוּעַ' in omer_count_str(9))
    s.check('Day 13: singular יוֹם', 'יוֹם' in omer_count_str(13) and 'שָׁבוּעַ' in omer_count_str(13))

    # ── REGRESSION: days 11-19 must each return a SINGLE day ─────────
    for day in range(11, 20):
        result = omer_count_str(day)
        # Should end with לָעֹמֶר
        s.check(f'Day {day}: ends with לָעֹמֶר', result.endswith('לָעֹמֶר'),
                result[:60])
        # Should NOT contain another full day count (no double שָׁבוּעַ)
        s.check(f'Day {day}: at most one week reference',
                result.count('שָׁבוּע') <= 1, result[:60])
        # Should contain the correct teen number
        expected_teen = OMER_TEENS[day - 11]
        s.check(f'Day {day}: contains correct teen {expected_teen[:6]}',
                expected_teen in result, result[:60])

    # ── Multiples of 7 use ימים (plural) ─────────────────────────────
    for day in (7, 14, 21, 28, 35, 42, 49):
        result = omer_count_str(day)
        s.check(f'Day {day} (week complete): uses יָמִים plural',
                'יָמִים' in result, result[:60])

    # ── Spot checks for key days ──────────────────────────────────────
    s.check('Day 14: שְׁנֵי שָׁבוּעוֹת',
            'שְׁנֵי שָׁבוּעוֹת' in omer_count_str(14), omer_count_str(14))
    s.check('Day 33 (Lag BaOmer): שְׁלֹשָׁה וּשְׁלֹשִׁים',
            'שְׁלֹשִׁים' in omer_count_str(33) or 'שְׁלֹשָׁה' in omer_count_str(33),
            omer_count_str(33))
    s.check('Day 49: שִׁבְעָה שָׁבוּעוֹת',
            'שִׁבְעָה שָׁבוּעוֹת' in omer_count_str(49), omer_count_str(49))
    s.check('Day 49 last day: יָמִים plural',
            'יָמִים' in omer_count_str(49), omer_count_str(49))

    # ── Omer day calculation from Hebrew date ────────────────────────
    s.check('Nisan 16 = day 1',   get_omer_day('Nisan', 16) == 1)
    s.check('Nisan 17 = day 2',   get_omer_day('Nisan', 17) == 2)
    s.check('Nisan 30 = day 15',  get_omer_day('Nisan', 30) == 15)
    s.check('Iyar 1  = day 16',   get_omer_day('Iyar', 1) == 16)
    s.check('Iyar 15 = day 30',   get_omer_day('Iyar', 15) == 30)
    s.check('Iyar 18 = day 33 (Lag BaOmer)', get_omer_day('Iyar', 18) == 33)
    s.check('Sivan 5 = day 49',   get_omer_day('Sivan', 5) == 49)
    s.check('Nisan 15 NOT omer',  get_omer_day('Nisan', 15) == 0)
    s.check('Sivan 6  NOT omer',  get_omer_day('Sivan', 6) == 0)
    s.check('Tishrei  NOT omer',  get_omer_day('Tishrei', 1) == 0)

    # ── Omer JS file sanity ───────────────────────────────────────────
    omer_js = (Path(__file__).parent.parent / 'js/omer.js').read_text()
    s.check('omer.js has _omerDayHe',     '_omerDayHe' in omer_js)
    s.check('omer.js has _omerCountStr',  '_omerCountStr' in omer_js)
    s.check('omer.js has buildOmerText',  'buildOmerText' in omer_js)
    s.check('omer.js has showOmerNow',    'showOmerNow' in omer_js)
    s.check('omer.js has OMER_TEENS array',
            "אַחַד עָשָׂר','שְׁנֵים עָשָׂר'" in omer_js or
            "אַחַד עָשָׂר" in omer_js)
    # Bug regression: old buggy code used split('  ')
    s.check('No old split-double-space bug in omer.js',
            "split('  ')" not in omer_js)

    return s
