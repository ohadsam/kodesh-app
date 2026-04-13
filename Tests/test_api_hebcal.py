"""
test_api_hebcal.py
Tests for all Hebcal API calls used in Kodesh App.
"""
import sys, requests
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

TIMEOUT = 15

def _get(url, params=None):
    r = requests.get(url, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()

# Test with a known Shabbat (תזריע-מצורע 2026)
TEST_DATE_SHABBAT = '2026-04-11'   # Shabbat Tazria-Metzora
TEST_DATE_WEEKDAY = '2026-04-13'   # Monday in Nisan
TEST_DATE_YOM_TOV = '2026-04-13'   # Pesach VIII still? Let's use a clear one
TEST_DATE_ROSH_CHODESH = '2026-05-19'  # 1 Sivan

def run() -> TestSuite:
    s = TestSuite('Hebcal API')

    # ── Hebrew Date Converter ────────────────────────────────────────
    try:
        conv = _get('https://www.hebcal.com/converter',
                    {'cfg': 'json', 'date': TEST_DATE_WEEKDAY, 'g2h': '1', 'strict': '1'})
        s.check('Converter returns hm (month)', 'hm' in conv, conv.get('hm',''))
        s.check('Converter returns hd (day)',   'hd' in conv, str(conv.get('hd','')))
        s.check('Converter returns hy (year)',  'hy' in conv, str(conv.get('hy','')))
        s.check('Converter returns hebrew string', 'hebrew' in conv, conv.get('hebrew',''))
        s.check('Test date is Nisan', conv.get('hm') == 'Nisan',
                f"got {conv.get('hm')}")

    except Exception as e:
        s.fail('Hebrew Date Converter API', str(e))

    # ── Zmanim API ───────────────────────────────────────────────────
    try:
        zmanim = _get('https://www.hebcal.com/zmanim',
                      {'cfg': 'json', 'date': TEST_DATE_WEEKDAY, 'sec': '1',
                       'latitude': '32.0833', 'longitude': '34.8878',
                       'elevation': '52', 'tzid': 'Asia/Jerusalem'})

        times = zmanim.get('times', {})
        s.check('Zmanim times field exists', bool(times), f'{len(times)} fields')

        required_fields = ['sunrise', 'sunset', 'sofZmanShma', 'sofZmanTfilla', 'chatzot']
        for f in required_fields:
            s.check(f'Zmanim has {f}', f in times, times.get(f,'MISSING')[:19] if f in times else 'MISSING')

        # Sanity: sunrise should be before sunset
        if 'sunrise' in times and 'sunset' in times:
            from datetime import datetime
            sr = datetime.fromisoformat(times['sunrise'])
            ss = datetime.fromisoformat(times['sunset'])
            s.check('Sunrise < Sunset', sr < ss,
                    f"{times['sunrise'][11:16]} < {times['sunset'][11:16]}")

        # Sanity: sofZmanShma should be after sunrise but before chatzot
        if all(f in times for f in ['sofZmanShma', 'sunrise', 'chatzot']):
            from datetime import datetime
            shma = datetime.fromisoformat(times['sofZmanShma'])
            sr   = datetime.fromisoformat(times['sunrise'])
            noon = datetime.fromisoformat(times['chatzot'])
            s.check('sofZmanShma is between sunrise and chatzot',
                    sr < shma < noon,
                    f"{times['sofZmanShma'][11:16]}")

    except Exception as e:
        s.fail('Zmanim API', str(e))

    # ── Hebcal Calendar Events ────────────────────────────────────────
    try:
        hb = _get('https://www.hebcal.com/hebcal',
                  {'v': '1', 'cfg': 'json', 'maj': 'on', 'min': 'on',
                   'nx': 'on', 'mf': 'on', 'ss': 'on',
                   'start': TEST_DATE_WEEKDAY, 'end': TEST_DATE_WEEKDAY,
                   'c': 'off', 'i': '1'})
        items = hb.get('items', [])
        s.check('Calendar events returns items', len(items) > 0, f'{len(items)} events')

        categories = {i.get('category','') for i in items}
        s.check('Events have category field', bool(categories), str(categories)[:60])

    except Exception as e:
        s.fail('Calendar Events API', str(e))

    # ── Parasha API (weekly portion) ──────────────────────────────────
    try:
        ds = TEST_DATE_SHABBAT
        ds3w = (date.fromisoformat(ds) + timedelta(days=21)).isoformat()
        hb = _get('https://www.hebcal.com/hebcal',
                  {'v': '1', 'cfg': 'json', 's': 'on',
                   'start': ds, 'end': ds3w})
        items = hb.get('items', [])
        parashaEvent = next((i for i in items if i.get('category') == 'parashat'), None)
        s.check('Parasha event found', parashaEvent is not None,
                parashaEvent.get('hebrew','') if parashaEvent else 'NOT FOUND')

        if parashaEvent:
            # Combined parasha check
            title = parashaEvent.get('title', '')
            hebrew = parashaEvent.get('hebrew', '')
            is_combined = '-' in title or '-' in hebrew
            s.check('Tazria-Metzora is combined parasha', is_combined,
                    f"title='{title}', hebrew='{hebrew}'")

            # Leyning should have aliyot
            leyning = parashaEvent.get('leyning', {})
            has_aliyot = any(str(k) in leyning for k in range(1, 8))
            s.check('Leyning has aliyot for combined parasha', has_aliyot,
                    f"keys: {list(leyning.keys())[:5]}")

            # All aliyot should reference Leviticus
            if has_aliyot:
                aliyot_refs = [leyning.get(str(k),'') for k in range(1,8) if str(k) in leyning]
                all_leviticus = all('Leviticus' in r for r in aliyot_refs if r)
                s.check('All aliyot in Leviticus (for Tazria-Metzora)',
                        all_leviticus, str(aliyot_refs[:2]))

    except Exception as e:
        s.fail('Parasha API', str(e))

    # ── Rosh Chodesh detection ────────────────────────────────────────
    try:
        hb = _get('https://www.hebcal.com/hebcal',
                  {'v': '1', 'cfg': 'json', 'maj': 'on', 'min': 'on',
                   'nx': 'on', 'start': TEST_DATE_ROSH_CHODESH,
                   'end': TEST_DATE_ROSH_CHODESH, 'c': 'off', 'i': '1'})
        items = hb.get('items', [])
        rosh_chodesh = next((i for i in items
                            if 'Rosh' in (i.get('title','')) and 'Chodesh' in (i.get('title',''))), None)
        s.check('Rosh Chodesh detected on 1 Sivan',
                rosh_chodesh is not None,
                rosh_chodesh.get('title','') if rosh_chodesh else 'NOT FOUND')

    except Exception as e:
        s.fail('Rosh Chodesh detection API', str(e))

    # ── Date navigation consistency ───────────────────────────────────
    try:
        # Fetch same Rambam for two consecutive days — should be different chapters
        def get_rambam_ref(d):
            from requests import utils as ru
            cal = _get('https://www.sefaria.org/api/calendars',
                       {'diaspora': '0',
                        'year': d.year, 'month': d.month, 'day': d.day})
            items = cal.get('calendar_items', [])
            r = next((i for i in items if 'rambam' in (i.get('title',{}).get('en','') or '').lower()), None)
            return r.get('ref','') if r else ''

        d1 = date(2026, 4, 13)
        d2 = date(2026, 4, 14)
        ref1 = get_rambam_ref(d1)
        ref2 = get_rambam_ref(d2)
        s.check('Different Rambam ref for consecutive days',
                ref1 != ref2 and ref1 and ref2,
                f"d1={ref1}, d2={ref2}")

    except Exception as e:
        s.fail('Date navigation consistency', str(e))

    return s
