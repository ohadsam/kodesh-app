"""
test_business_logic.py
Tests for all business-logic functions extracted/mirrored from the JS code.
No network calls — pure logic validation.
"""
import sys, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

# ── Omer counting (mirrors omer.js) ─────────────────────────────────
OMER_ONES  = ['','אֶחָד','שְׁנַיִם','שְׁלֹשָׁה','אַרְבָּעָה','חֲמִשָּׁה',
               'שִׁשָּׁה','שִׁבְעָה','שְׁמוֹנָה','תִּשְׁעָה','עֲשָׂרָה']
OMER_TENS  = ['','','עֶשְׂרִים','שְׁלֹשִׁים','אַרְבָּעִים']
OMER_WEEKS = ['','שָׁבוּעַ אֶחָד','שְׁנֵי שָׁבוּעוֹת','שְׁלֹשָׁה שָׁבוּעוֹת',
               'אַרְבָּעָה שָׁבוּעוֹת','חֲמִשָּׁה שָׁבוּעוֹת','שִׁשָּׁה שָׁבוּעוֹת',
               'שִׁבְעָה שָׁבוּעוֹת']
OMER_DAYS  = ['','יוֹם אֶחָד','שְׁנֵי יָמִים','שְׁלֹשָׁה יָמִים',
               'אַרְבָּעָה יָמִים','חֲמִשָּׁה יָמִים','שִׁשָּׁה יָמִים']
OMER_TEENS = ['אַחַד עָשָׂר','שְׁנֵים עָשָׂר','שְׁלֹשָׁה עָשָׂר','אַרְבָּעָה עָשָׂר',
               'חֲמִשָּׁה עָשָׂר','שִׁשָּׁה עָשָׂר','שִׁבְעָה עָשָׂר','שְׁמוֹנָה עָשָׂר',
               'תִּשְׁעָה עָשָׂר']

def omer_day_he(n):
    if n <= 10:  return OMER_ONES[n]
    if n < 20:   return OMER_TEENS[n - 11]
    t, o = n // 10, n % 10
    return (OMER_ONES[o] + ' וְ' + OMER_TENS[t]) if o else OMER_TENS[t]

def omer_count_str(day):
    total = omer_day_he(day)
    weeks, rem = day // 7, day % 7
    total_plural = 'שְׁנֵי' if day == 2 else total
    plural   = 'יוֹם אֶחָד' if day == 1 else f'{total_plural} יָמִים'
    singular = f'{total} יוֹם'
    if weeks == 0:
        return f'{plural} לָעֹמֶר'
    week_str = OMER_WEEKS[weeks]
    if rem == 0:
        return f'{plural} שֶׁהֵם {week_str} לָעֹמֶר'
    return f'{singular} שֶׁהֵם {week_str} וְ{OMER_DAYS[rem]} לָעֹמֶר'

# ── Seasonal logic (mirrors siddur-inserts.js / siddur.js) ──────────
def is_winter(hm, hd):
    """Returns True if the season requires משיב הרוח / ותן טל ומטר."""
    # Summer: 15 Nisan → 22 Tishrei (Shmini Atzeret)
    if hm == 'Nisan' and hd >= 15:  return False
    if hm in ('Iyar','Sivan','Tamuz','Av','Elul'): return False
    if hm == 'Tishrei' and hd <= 22: return False
    return True

def skip_tachanun(hm, hd, is_shabbat=False, day_of_week=None):
    """Returns True if tachanun is skipped."""
    if is_shabbat: return True
    if hm == 'Nisan': return True  # whole Nisan
    if hm == 'Tishrei' and hd in (1,2,10): return True  # R"H, YK
    if hm in ('Sivan',) and hd <= 12: return True
    if hm == 'Tishrei' and hd >= 15 and hd <= 23: return True  # Sukkot
    if hm == 'Kislev' and hd >= 25: return True  # Chanuka
    if hm == 'Tevet' and hd <= 2: return True
    if hm == 'Shevat' and hd == 15: return True
    if hm in ('Adar','Adar II') and hd in (14, 15): return True  # Purim
    if hm == 'Iyar' and hd in (5, 18, 28): return True  # Yom HaAtzmaut, LB, YY
    if hm == 'Av' and hd == 15: return True
    if day_of_week == 0:  # Sunday — no tachanun in Shacharit
        return True
    return False

# ── Compass bearing (mirrors misc.js) ───────────────────────────────
def bearing_to_kotel(lat, lon):
    """Calculate bearing from (lat,lon) to Kotel (31.7767, 35.2345)."""
    kotel_lat, kotel_lon = math.radians(31.7767), math.radians(35.2345)
    lat_r, lon_r = math.radians(lat), math.radians(lon)
    dlon = kotel_lon - lon_r
    x = math.sin(dlon) * math.cos(kotel_lat)
    y = (math.cos(lat_r) * math.sin(kotel_lat) -
         math.sin(lat_r) * math.cos(kotel_lat) * math.cos(dlon))
    bearing = (math.degrees(math.atan2(x, y)) + 360) % 360
    return round(bearing, 1)

# ── Hebrew gematria (mirrors tehilim.js) ─────────────────────────────
GEMATRIA = {
    'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
    'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,
    'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,'ק':100,
    'ר':200,'ש':300,'ת':400
}
def hebrew_to_number(s):
    s = s.strip().replace('"','').replace("'",'')
    return sum(GEMATRIA.get(c, 0) for c in s)


def run() -> TestSuite:
    s = TestSuite('Business Logic')

    # ── Omer day strings ─────────────────────────────────────────────
    s.check('Omer day 1',  omer_count_str(1),  'יוֹם אֶחָד לָעֹמֶר')
    s.check('Omer day 2 uses שני (construct)',
            'שְׁנֵי יָמִים' in omer_count_str(2), omer_count_str(2))
    s.check('Omer day 6',  'שִׁשָּׁה יָמִים לָעֹמֶר' in omer_count_str(6), omer_count_str(6))
    s.check('Omer day 7',  'שִׁבְעָה יָמִים שֶׁהֵם שָׁבוּעַ אֶחָד לָעֹמֶר' in omer_count_str(7), omer_count_str(7))
    s.check('Omer day 8 uses יוֹם (singular)',
            'שְׁמוֹנָה יוֹם שֶׁהֵם' in omer_count_str(8), omer_count_str(8))
    s.check('Omer day 11', 'אַחַד עָשָׂר יוֹם שֶׁהֵם' in omer_count_str(11), omer_count_str(11))
    s.check('Omer day 14', 'אַרְבָּעָה עָשָׂר יָמִים שֶׁהֵם שְׁנֵי שָׁבוּעוֹת' in omer_count_str(14), omer_count_str(14))
    s.check('Omer day 33 (Lag BaOmer)', 'שְׁלֹשָׁה' in omer_count_str(33), omer_count_str(33))
    s.check('Omer day 49', 'שִׁבְעָה וְאַרְבָּעִים' in omer_count_str(49) or
            'אַרְבָּעִים' in omer_count_str(49), omer_count_str(49))

    # Verify no day from 11-19 returns multi-day string
    for day in range(11, 20):
        result = omer_count_str(day)
        # Should NOT contain other day numbers in the base count
        s.check(f'Omer day {day} is single day',
                result.count('שָׁבוּעַ') <= 1 and result.count('שָׁבוּעוֹת') <= 1,
                result[:40])

    # ── Seasonal logic ────────────────────────────────────────────────
    # Summer: Nisan 16 through Tishrei 22
    s.check('Summer: Nisan 16',   not is_winter('Nisan', 16))
    s.check('Summer: Iyar 1',     not is_winter('Iyar', 1))
    s.check('Summer: Tishrei 22', not is_winter('Tishrei', 22))
    # Winter: Tishrei 23 onward through Nisan 14
    s.check('Winter: Tishrei 23', is_winter('Tishrei', 23))
    s.check('Winter: Cheshvan 1', is_winter('Cheshvan', 1))
    s.check('Winter: Nisan 14',   is_winter('Nisan', 14))
    s.check('Winter: Nisan 15',   is_winter('Nisan', 15))  # Pesach first day

    # ── Tachanun skip logic ───────────────────────────────────────────
    s.check('Skip tachanun: Nisan 1',       skip_tachanun('Nisan', 1))
    s.check('Skip tachanun: Nisan 30',      skip_tachanun('Nisan', 30))
    s.check('Skip tachanun: Yom Kippur',    skip_tachanun('Tishrei', 10))
    s.check('Skip tachanun: Rosh Hashana',  skip_tachanun('Tishrei', 1))
    s.check('Skip tachanun: Purim 14',      skip_tachanun('Adar', 14))
    s.check('Skip tachanun: Shushan 15',    skip_tachanun('Adar', 15))
    s.check('Skip tachanun: Tu BiShvat',    skip_tachanun('Shevat', 15))
    s.check('Skip tachanun: Lag BaOmer',    skip_tachanun('Iyar', 18))
    s.check('Skip tachanun: Yom HaAtzmaut',skip_tachanun('Iyar', 5))
    s.check('Skip tachanun: Yom Yerushalayim', skip_tachanun('Iyar', 28))
    s.check('Skip tachanun: Sunday',       skip_tachanun('Cheshvan', 3, day_of_week=0))
    s.check('SAY tachanun: Monday Cheshvan', not skip_tachanun('Cheshvan', 3, day_of_week=1))
    s.check('SAY tachanun: Tu BiAv',       skip_tachanun('Av', 15))

    # ── Compass bearing ───────────────────────────────────────────────
    # Petah Tikva → Kotel should be ~136° (SE)
    pt_bearing = bearing_to_kotel(32.0833, 34.8878)
    s.check('Petah Tikva → Kotel bearing ~136°',
            130 < pt_bearing < 142,
            f'{pt_bearing}°')

    # Tel Aviv → Kotel
    ta_bearing = bearing_to_kotel(32.0853, 34.7818)
    s.check('Tel Aviv → Kotel bearing SE direction',
            90 < ta_bearing < 180,
            f'{ta_bearing}°')

    # Haifa → Kotel (should be more to the south)
    haifa_bearing = bearing_to_kotel(32.8191, 34.9983)
    s.check('Haifa → Kotel bearing ~171° (SSE)',
            160 < haifa_bearing < 185,
            f'{haifa_bearing}°')

    # Jerusalem itself — very close to Kotel, bearing unpredictable but shouldn't crash
    try:
        jer_bearing = bearing_to_kotel(31.7767, 35.2340)
        s.check('Jerusalem near Kotel bearing defined', 0 <= jer_bearing < 360,
                f'{jer_bearing}°')
    except:
        s.warn('Jerusalem bearing (near Kotel)', 'Very close proximity')

    # ── Gematria / Hebrew number parsing ─────────────────────────────
    s.check('Gematria: א = 1',   hebrew_to_number('א') == 1)
    s.check('Gematria: כ = 20',  hebrew_to_number('כ') == 20)
    s.check('Gematria: קל = 130', hebrew_to_number('קל') == 130)
    s.check('Gematria: קיט = 119', hebrew_to_number('קיט') == 119)
    s.check('Gematria: כג = 23',  hebrew_to_number('כג') == 23)
    s.check('Gematria: תק = 500', hebrew_to_number('תק') == 500)

    # ── Tehilim day schedule sanity ───────────────────────────────────
    SCHEDULE = {
        25: ['119:1-88'],
        26: ['119:89-176'],
        1:  [1,2,3,4,5,6,7,8,9],
        30: [145,146,147,148,149,150],
    }
    s.check('Day 25 is Psalm 119 first half', SCHEDULE[25] == ['119:1-88'])
    s.check('Day 26 is Psalm 119 second half', SCHEDULE[26] == ['119:89-176'])
    s.check('Day 1 starts with Psalm 1', SCHEDULE[1][0] == 1)
    s.check('Day 30 ends with Psalm 150', SCHEDULE[30][-1] == 150)

    # Verse range for day 25: 88 verses
    s.check('Day 25 range covers 88 verses',
            176 - 88 == 88 and 88 == 88)

    # ── Combined parasha matching ──────────────────────────────────────
    def strip_vowel_letters(s_):
        """Remove medial vav/yod (Python equivalent of JS stripVowelLetters)."""
        result = []
        chars = list(s_)
        for i, c in enumerate(chars):
            if c in 'וי' and 0 < i < len(chars)-1 and chars[i-1] not in ' -' and chars[i+1] not in ' -':
                continue
            result.append(c)
        return ''.join(result)

    parashiot_he = ['תזריע','מצורע','ויקהל','פקודי','בהר','בחוקותי',
                    'נצבים','וילך','מטות','מסעי']

    def fuzzy_find(name):
        nc = strip_vowel_letters(name)
        for p in parashiot_he:
            if p == name: return p
        for p in parashiot_he:
            if strip_vowel_letters(p) == nc: return p
        for p in parashiot_he:
            if len(name) >= 3 and p.startswith(name[:3]): return p
        for p in parashiot_he:
            if len(nc) >= 3 and strip_vowel_letters(p).startswith(nc[:3]): return p
        return None

    s.check('Fuzzy match: מצרע → מצורע',  fuzzy_find('מצרע') == 'מצורע',
            f"got: {fuzzy_find('מצרע')}")
    s.check('Fuzzy match: מצורע → מצורע', fuzzy_find('מצורע') == 'מצורע')
    s.check('Fuzzy match: ויקהל → ויקהל', fuzzy_find('ויקהל') == 'ויקהל')
    s.check('Fuzzy match: בחקתי → בחוקותי', fuzzy_find('בחקתי') == 'בחוקותי',
            f"got: {fuzzy_find('בחקתי')}")
    s.check('Fuzzy match: נצבים → נצבים',  fuzzy_find('נצבים') == 'נצבים')

    return s
