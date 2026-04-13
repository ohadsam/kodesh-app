"""
test_api_sefaria.py
Tests for all Sefaria API calls used in Kodesh App.
"""
import sys, requests
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

BASE = 'https://www.sefaria.org/api'
TIMEOUT = 15

def _get(url, params=None):
    r = requests.get(url, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()

def run() -> TestSuite:
    s = TestSuite('Sefaria API')

    # ── Calendars API ────────────────────────────────────────────────
    try:
        cal = _get(f'{BASE}/calendars', {'diaspora': '0', 'year': '2026', 'month': '4', 'day': '13'})
        items = cal.get('calendar_items', [])
        s.check('Calendars API returns items', len(items) > 0, f'{len(items)} items')

        # Daf Yomi
        daf = next((i for i in items if 'daf' in (i.get('title',{}).get('en','') or '').lower()), None)
        s.check('Daf Yomi item present', daf is not None,
                daf.get('ref','') if daf else 'NOT FOUND')

        # Rambam
        rambam = next((i for i in items if 'rambam' in (i.get('title',{}).get('en','') or '').lower()), None)
        s.check('Rambam Yomi item present', rambam is not None,
                rambam.get('ref','') if rambam else 'NOT FOUND')
        if rambam:
            s.check('Rambam ref is a chapter ref', ':' not in rambam.get('ref',''),
                    rambam.get('ref',''))

        # Mishna Yomi
        mishna = next((i for i in items if 'mishna' in (i.get('title',{}).get('en','') or '').lower()), None)
        s.check('Mishna Yomi item present', mishna is not None,
                mishna.get('ref','') if mishna else 'NOT FOUND')

    except Exception as e:
        s.fail('Calendars API reachable', str(e))

    # ── Text API – Siddur ────────────────────────────────────────────
    try:
        siddur_ref = 'Weekday_Siddur_Sefard_Linear,_The_Morning_Prayers,_Shemoneh_Esrei'
        data = _get(f'{BASE}/texts/{requests.utils.quote(siddur_ref)}',
                    {'lang': 'he', 'commentary': '0', 'context': '0'})
        he = data.get('he', [])
        s.check('Shmoneh Esrei text loads', len(he) > 50, f'{len(he)} verses')

        # Check verse 27 contains מוריד הטל (summer) or משיב הרוח (winter)
        flat = [v for v in he if v]
        seasonal_keywords = ['מוריד', 'משיב']
        has_seasonal = any(
            any(kw in str(v) for kw in seasonal_keywords)
            for v in flat
        )
        s.check('Shmoneh Esrei contains seasonal phrases', has_seasonal)

    except Exception as e:
        s.fail('Siddur Shmoneh Esrei loads', str(e))

    # ── Text API – Rambam + Steinsaltz ───────────────────────────────
    try:
        rambam_ref = 'Mishneh Torah, Prayer and the Priestly Blessing 4'
        data = _get(f'{BASE}/texts/{requests.utils.quote(rambam_ref)}',
                    {'lang': 'he', 'commentary': '0', 'context': '0'})
        he = data.get('he', [])
        s.check('Rambam chapter text loads', len(he) > 0, f'{len(he)} halachot/sentences')

        # Steinsaltz with range
        st_ref = f'Steinsaltz on {rambam_ref}:1-20'
        st = _get(f'{BASE}/texts/{requests.utils.quote(st_ref)}',
                  {'lang': 'he', 'commentary': '0', 'context': '0'})
        st_he = st.get('he', [])
        is_2d = isinstance(st_he[0], list) if st_he else False
        s.check('Steinsaltz range returns data', len(st_he) > 0,
                f'shape: {"2D" if is_2d else "1D"}, len={len(st_he)}')

        # Check each entry has bold keyword
        if st_he:
            sample = st_he[0] if not is_2d else (st_he[0][0] if st_he[0] else '')
            if isinstance(sample, list): sample = sample[0] if sample else ''
            s.check('Steinsaltz entries have bold keyword', '<b>' in str(sample),
                    str(sample)[:60])

    except Exception as e:
        s.fail('Rambam + Steinsaltz API', str(e))

    # ── Text API – Daf Yomi Commentaries ────────────────────────────
    try:
        daf_ref = 'Sanhedrin 2a'  # stable reference for testing
        rashi = _get(f'{BASE}/texts/{requests.utils.quote("Rashi on " + daf_ref)}',
                     {'lang': 'he', 'commentary': '0', 'context': '0'})
        s.check('Rashi on Daf returns data', len(rashi.get('he', [])) > 0,
                f'{len(rashi.get("he",[]))} entries')

        tosafot = _get(f'{BASE}/texts/{requests.utils.quote("Tosafot on " + daf_ref)}',
                       {'lang': 'he', 'commentary': '0', 'context': '0'})
        s.check('Tosafot on Daf returns data', len(tosafot.get('he', [])) > 0,
                f'{len(tosafot.get("he",[]))} entries')

    except Exception as e:
        s.fail('Daf Yomi commentary API', str(e))

    # ── Text API – Tehilim ───────────────────────────────────────────
    try:
        ps = _get(f'{BASE}/texts/Psalms.119',
                  {'lang': 'he', 'commentary': '0', 'context': '0'})
        he = ps.get('he', [])
        s.check('Psalm 119 has 176 verses', len(he) == 176, f'got {len(he)}')

        # Verify slicing for day 25 (verses 1-88) and day 26 (89-176)
        day25 = he[:88]
        day26 = he[88:]
        s.check('Day 25 slice has 88 verses', len(day25) == 88)
        s.check('Day 26 slice has 88 verses', len(day26) == 88)

    except Exception as e:
        s.fail('Tehilim Psalm 119 API', str(e))

    # ── Text API – Bartenura on Mishna ───────────────────────────────
    try:
        mishna_ref = 'Mishnah Berakhot 1:1'
        bt = _get(f'{BASE}/texts/{requests.utils.quote("Bartenura on " + mishna_ref)}',
                  {'lang': 'he', 'commentary': '0', 'context': '0'})
        he = bt.get('he', [])
        s.check('Bartenura on Mishna returns data', len(he) > 0, f'{len(he)} entries')
        if he:
            s.check('Bartenura has bold keywords', '<b>' in str(he[0]),
                    str(he[0])[:60] if he else '')

    except Exception as e:
        s.fail('Bartenura API', str(e))

    # ── Text API – Rabbi Sacks Parasha ───────────────────────────────
    try:
        sacks_ref = 'Covenant and Conversation, Bereshit 1'
        sr = _get(f'{BASE}/texts/{requests.utils.quote(sacks_ref)}',
                  {'lang': 'he', 'commentary': '0', 'context': '0'})
        he = sr.get('he', [])
        s.check('Rabbi Sacks article loads', len(he) > 0, f'{len(he)} paragraphs')

    except Exception as e:
        s.warn('Rabbi Sacks API (non-critical)', str(e))

    # ── Sefaria response structure sanity ────────────────────────────
    try:
        # All text responses should have 'he' field
        gen1 = _get(f'{BASE}/texts/Genesis.1.1',
                    {'lang': 'he', 'commentary': '0', 'context': '0'})
        s.check('Sefaria text response has he field', 'he' in gen1)
        s.check('Sefaria text response has ref field', 'ref' in gen1)

    except Exception as e:
        s.fail('Sefaria basic response structure', str(e))

    return s
