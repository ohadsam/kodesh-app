"""
test_siddur_seasonal.py
Tests for siddur seasonal text logic:
- מוריד הטל / משיב הרוח switching
- ותן ברכה / ותן טל ומטר switching
- יעלה ויבוא detection
- עשי"ת additions
- תחנון skip rules
- Prayer status banner logic per prayer type
"""
import sys, re, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

# ── Mirrors of JS seasonal logic ─────────────────────────────────────

def is_winter_season(hm, hd):
    """True = say משיב הרוח / ותן טל ומטר."""
    if hm == 'Nisan' and hd >= 15: return False   # from Pesach
    if hm in ('Iyar','Sivan','Tamuz','Av','Elul'): return False
    if hm == 'Tishrei' and hd <= 22: return False  # until Shmini Atzeret
    return True

def is_aseret_yemei(hm, hd):
    return hm == 'Tishrei' and 1 <= hd <= 10

def skip_tachanun(hm, hd, prayer='shacharit', day_of_week=None, is_shabbat=False):
    """Returns True if tachanun is skipped for given prayer."""
    if prayer == 'arvit':  # NEVER tachanun in arvit
        return True        # (it's simply not part of arvit)
    if is_shabbat: return True
    if hm == 'Nisan': return True
    if hm == 'Tishrei' and hd in (1,2,10): return True
    if hm == 'Tishrei' and 15 <= hd <= 23: return True
    if hm == 'Kislev' and hd >= 25: return True
    if hm == 'Tevet' and hd <= 3: return True
    if hm == 'Shevat' and hd == 15: return True
    if hm in ('Adar','Adar II') and hd in (14,15): return True
    if hm == 'Sivan' and hd <= 12: return True
    if hm == 'Iyar' and hd in (5,18,28): return True
    if hm == 'Av' and hd == 15: return True
    if day_of_week == 0: return True  # Sunday (shacharit only)
    return False

def tachanun_text_for_prayer(prayer, hm, hd, day_of_week=None):
    """Returns what should appear in status banner for tachanun."""
    if prayer == 'arvit':
        return None  # not shown at all
    skipped = skip_tachanun(hm, hd, prayer, day_of_week)
    return 'skip' if skipped else 'say'

def yaaleh_occasion(is_rosh_chodesh, is_chol_hamoed, is_yom_tov):
    if is_rosh_chodesh: return 'ר"ח'
    if is_chol_hamoed: return 'חול המועד'
    if is_yom_tov: return 'יו"ט'
    return None

# ── Simulated seasonal paragraph processor ────────────────────────────

def process_seasonal_paragraph(plain_text, winter):
    """
    Given a plain paragraph text, returns what should be displayed.
    Mirrors _fixAmidaSeasonalWords logic.
    """
    has_tal    = 'מוריד הטל' in plain_text
    has_geshem = 'משיב הרוח' in plain_text
    has_bracha = 'ותן ברכה' in plain_text
    has_matar  = 'טל ומטר' in plain_text

    result = {}
    if has_tal or has_geshem:
        if winter:
            result['show'] = 'משיב הרוח ומוריד הגשם'
            result['hide'] = 'מוריד הטל'
        else:
            result['show'] = 'מוריד הטל'
            result['hide'] = 'משיב הרוח'

    if has_bracha or has_matar:
        if winter:
            result['bracha_show'] = 'ותן טל ומטר לברכה'
            result['bracha_hide'] = 'ותן ברכה'
        else:
            result['bracha_show'] = 'ותן ברכה'
            result['bracha_hide'] = 'ותן טל ומטר'

    return result


def run() -> TestSuite:
    s = TestSuite('Siddur Seasonal Logic')

    # ── מוריד הטל / משיב הרוח season boundaries ──────────────────────
    s.check('Summer starts Nisan 15 (Pesach)',
            not is_winter_season('Nisan', 15))
    s.check('Summer: Nisan 16',  not is_winter_season('Nisan', 16))
    s.check('Summer: Iyar 1',    not is_winter_season('Iyar', 1))
    s.check('Summer: Tishrei 1', not is_winter_season('Tishrei', 1))
    s.check('Summer: Tishrei 22 (Shmini Atzeret)',
            not is_winter_season('Tishrei', 22))
    s.check('Winter starts Tishrei 23 (motzei Shmini Atzeret)',
            is_winter_season('Tishrei', 23))
    s.check('Winter: Cheshvan',  is_winter_season('Cheshvan', 7))
    s.check('Winter: Nisan 14 (erev Pesach)',
            is_winter_season('Nisan', 14))
    s.check('Winter: Nisan 15 is NOT winter (Pesach begins)',
            not is_winter_season('Nisan', 15))

    # ── Paragraph processing ──────────────────────────────────────────
    # Sefaria sends verses 27+28+29 joined: מוריד הטל + משיב הרוח + ומוריד הגשם
    combined = 'מוריד הטל משיב הרוח ומוריד הגשם'
    summer_result = process_seasonal_paragraph(combined, winter=False)
    winter_result = process_seasonal_paragraph(combined, winter=True)

    s.check('Summer: show מוריד הטל',
            summer_result.get('show') == 'מוריד הטל', str(summer_result))
    s.check('Summer: hide משיב הרוח',
            summer_result.get('hide') == 'משיב הרוח', str(summer_result))
    s.check('Winter: show משיב הרוח',
            winter_result.get('show') == 'משיב הרוח ומוריד הגשם', str(winter_result))
    s.check('Winter: hide מוריד הטל',
            winter_result.get('hide') == 'מוריד הטל', str(winter_result))

    # ── ותן ברכה / טל ומטר logic ─────────────────────────────────────
    # Sefaria text: "ותן ברכה, טל ומטר לברכה" (both in one paragraph)
    bracha_both = 'ותן ברכה, טל ומטר לברכה'
    s_summer = process_seasonal_paragraph(bracha_both, winter=False)
    s_winter = process_seasonal_paragraph(bracha_both, winter=True)

    s.check('Summer ותן ברכה: show ותן ברכה',
            s_summer.get('bracha_show') == 'ותן ברכה', str(s_summer))
    s.check('Summer ותן ברכה: hide טל ומטר',
            s_summer.get('bracha_hide') == 'ותן טל ומטר', str(s_summer))
    s.check('Winter ותן ברכה: show ותן טל ומטר',
            s_winter.get('bracha_show') == 'ותן טל ומטר לברכה', str(s_winter))
    s.check('Winter ותן ברכה: hide ותן ברכה',
            s_winter.get('bracha_hide') == 'ותן ברכה', str(s_winter))

    # Edge: only ותן ברכה present (summer Sefaria nusach)
    bracha_only = 'ברך עלינו את השנה הזאת ותן ברכה על כל מעשי ידינו'
    res = process_seasonal_paragraph(bracha_only, winter=False)
    s.check('Only ותן ברכה present: summer shows it',
            res.get('bracha_show') == 'ותן ברכה')

    # ── תחנון rules ───────────────────────────────────────────────────
    # Arvit — tachanun not applicable
    s.check('Arvit: tachanun not shown',
            tachanun_text_for_prayer('arvit', 'Cheshvan', 5) is None)
    s.check('Arvit: tachanun not shown even in Nisan',
            tachanun_text_for_prayer('arvit', 'Nisan', 15) is None)

    # Shacharit — tachanun logic
    s.check('Shacharit Cheshvan 5: say tachanun',
            tachanun_text_for_prayer('shacharit', 'Cheshvan', 5) == 'say')
    s.check('Shacharit Nisan: skip tachanun',
            tachanun_text_for_prayer('shacharit', 'Nisan', 1) == 'skip')
    s.check('Shacharit Sunday: skip tachanun',
            tachanun_text_for_prayer('shacharit', 'Cheshvan', 5, day_of_week=0) == 'skip')
    s.check('Shacharit Monday: say tachanun',
            tachanun_text_for_prayer('shacharit', 'Cheshvan', 5, day_of_week=1) == 'say')
    s.check('Shacharit Yom Kippur: skip',
            tachanun_text_for_prayer('shacharit', 'Tishrei', 10) == 'skip')
    s.check('Shacharit Lag BaOmer: skip',
            tachanun_text_for_prayer('shacharit', 'Iyar', 18) == 'skip')
    s.check('Shacharit Tu BiShvat: skip',
            tachanun_text_for_prayer('shacharit', 'Shevat', 15) == 'skip')
    s.check('Shacharit Chanuka: skip',
            tachanun_text_for_prayer('shacharit', 'Kislev', 25) == 'skip')
    s.check('Shacharit Purim: skip',
            tachanun_text_for_prayer('shacharit', 'Adar', 14) == 'skip')
    s.check('Shacharit Shushan Purim: skip',
            tachanun_text_for_prayer('shacharit', 'Adar', 15) == 'skip')

    # ── עשי"ת additions ───────────────────────────────────────────────
    for d in range(1, 11):
        s.check(f'Aseret Yemei: Tishrei {d} is aseret',
                is_aseret_yemei('Tishrei', d))
    s.check('Tishrei 11 is NOT aseret', not is_aseret_yemei('Tishrei', 11))
    s.check('Nisan 1 is NOT aseret',   not is_aseret_yemei('Nisan', 1))

    # ── יעלה ויבוא occasions ──────────────────────────────────────────
    s.check('יעלה ויבוא: Rosh Chodesh',
            yaaleh_occasion(True, False, False) == 'ר"ח')
    s.check('יעלה ויבוא: Chol HaMoed',
            yaaleh_occasion(False, True, False) == 'חול המועד')
    s.check('יעלה ויבוא: Yom Tov',
            yaaleh_occasion(False, False, True) == 'יו"ט')
    s.check('יעלה ויבוא: regular weekday — not said',
            yaaleh_occasion(False, False, False) is None)

    # ── Prayer section consistency ────────────────────────────────────
    # Verify siddur.js contains required prayer types
    siddur_js = (Path(__file__).parent.parent / 'js/siddur.js').read_text()
    s.check('siddur.js has shacharit',  "'shacharit'" in siddur_js or '"shacharit"' in siddur_js)
    s.check('siddur.js has arvit',      "'arvit'" in siddur_js or '"arvit"' in siddur_js)
    s.check('siddur.js has mincha',     "'mincha'" in siddur_js or '"mincha"' in siddur_js)
    s.check('_fixAmidaSeasonalWords defined', '_fixAmidaSeasonalWords' in siddur_js)
    s.check('_updatePrayerStatusBanner defined', '_updatePrayerStatusBanner' in siddur_js)
    s.check('Banner receives prayer param',
            '_updatePrayerStatusBanner(allSections, sections, siddurPrayer)' in siddur_js)
    s.check('Pending reload mechanism exists', '_siddurPendingReload' in siddur_js)
    s.check('Load ID abort mechanism exists', '_siddurLoadId' in siddur_js)

    return s
