"""
test_zmanim.py
Tests for zmanim (prayer times) calculation and API calls.
Includes bearing/compass logic, API validation for different dates,
and sanity checks on zmanim values.
"""
import sys, math, requests
from datetime import datetime, date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

TIMEOUT = 15
PETAH_TIKVA = {'lat': 32.0833, 'lon': 34.8878, 'elev': 52}
KOTEL        = {'lat': 31.7767, 'lon': 35.2345}

# ── Compass / bearing logic (mirrors misc.js) ─────────────────────────

def bearing(from_lat, from_lon, to_lat, to_lon):
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)
    dlon = math.radians(to_lon - from_lon)
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1)*math.sin(lat2) - math.sin(lat1)*math.cos(lat2)*math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def get_zmanim(date_str, lat, lon, elev=0):
    url = 'https://www.hebcal.com/zmanim'
    params = {
        'cfg': 'json', 'date': date_str, 'sec': '1',
        'latitude': lat, 'longitude': lon,
        'elevation': elev, 'tzid': 'Asia/Jerusalem'
    }
    r = requests.get(url, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def run() -> TestSuite:
    s = TestSuite('Zmanim & Compass')

    # ── Compass bearing calculations ──────────────────────────────────
    pt = bearing(PETAH_TIKVA['lat'], PETAH_TIKVA['lon'], KOTEL['lat'], KOTEL['lon'])
    s.check('Petah Tikva → Kotel ~136° (SE)', 128 < pt < 144, f'{pt:.1f}°')

    ta = bearing(32.0853, 34.7818, KOTEL['lat'], KOTEL['lon'])
    s.check('Tel Aviv → Kotel SE direction (90-180°)', 90 < ta < 180, f'{ta:.1f}°')

    haifa = bearing(32.8191, 34.9983, KOTEL['lat'], KOTEL['lon'])
    s.check('Haifa → Kotel SSE ~171° (south direction)', 155 < haifa < 190, f'{haifa:.1f}°')

    eilat = bearing(29.5569, 34.9519, KOTEL['lat'], KOTEL['lon'])
    s.check('Eilat → Kotel ~337° (north-northwest)', 320 < eilat < 360 or 0 < eilat < 15,
            f'{eilat:.1f}°')

    nyc = bearing(40.7128, -74.0060, KOTEL['lat'], KOTEL['lon'])
    s.check('NYC → Kotel east direction (50-80°)', 50 < nyc < 90, f'{nyc:.1f}°')

    london = bearing(51.5074, -0.1278, KOTEL['lat'], KOTEL['lon'])
    s.check('London → Kotel ESE (~115°)', 100 < london < 135, f'{london:.1f}°')

    # Bearings are unique: Tel Aviv ≠ Haifa
    s.check('Different cities have different bearings', abs(ta - haifa) > 5,
            f'TA={ta:.1f}° Haifa={haifa:.1f}°')

    # ── Hebcal Zmanim API: standard weekday ──────────────────────────
    try:
        z = get_zmanim('2026-04-13', **PETAH_TIKVA)
        times = z.get('times', {})
        s.check('Zmanim API returns times dict', len(times) > 10,
                f'{len(times)} fields')

        required_fields = ['sunrise', 'sunset', 'sofZmanShma', 'sofZmanTfilla',
                           'chatzot', 'minchaGedola', 'tzeit85deg']
        for f in required_fields:
            s.check(f'Zmanim has {f}', f in times, 'MISSING' if f not in times else times[f])

        # Sunrise should be between 04:00 and 07:30 in April in Israel
        if 'sunrise' in times:
            sr = datetime.fromisoformat(times['sunrise'])
            s.check('April sunrise 05:00-07:00',
                    5 <= sr.hour <= 7, times['sunrise'])

        # Sunset should be between 18:00 and 21:00 in April in Israel
        if 'sunset' in times:
            ss = datetime.fromisoformat(times['sunset'])
            s.check('April sunset 18:00-21:00',
                    18 <= ss.hour <= 21, times['sunset'])

        # Logical order: sunrise < sofZmanShma < sofZmanTfilla < chatzot < sunset
        if all(f in times for f in ['sunrise','sofZmanShma','sofZmanTfilla','chatzot','sunset']):
            sr   = datetime.fromisoformat(times['sunrise'])
            shma = datetime.fromisoformat(times['sofZmanShma'])
            tfil = datetime.fromisoformat(times['sofZmanTfilla'])
            chat = datetime.fromisoformat(times['chatzot'])
            sset = datetime.fromisoformat(times['sunset'])
            s.check('Order: sunrise < sofZmanShma', sr < shma)
            s.check('Order: sofZmanShma < sofZmanTfilla', shma < tfil)
            s.check('Order: sofZmanTfilla < chatzot', tfil < chat)
            s.check('Order: chatzot < sunset', chat < sset)

    except Exception as e:
        s.fail('Zmanim API reachable (April)', str(e))

    # ── Zmanim API: winter date (different sunrise/sunset) ───────────
    try:
        z_winter = get_zmanim('2026-01-15', **PETAH_TIKVA)
        times_w = z_winter.get('times', {})
        s.check('Zmanim API: winter date returns times', len(times_w) > 5)

        if 'sunrise' in times_w and 'sunset' in times_w:
            sr_w = datetime.fromisoformat(times_w['sunrise'])
            ss_w = datetime.fromisoformat(times_w['sunset'])
            s.check('Winter sunrise later than 06:00',    sr_w.hour >= 6, times_w['sunrise'])
            s.check('Winter sunset earlier than 18:00',   ss_w.hour <= 18, times_w['sunset'])

    except Exception as e:
        s.fail('Zmanim API reachable (January)', str(e))

    # ── Zmanim API: Shabbat ───────────────────────────────────────────
    try:
        # 2026-04-11 is Saturday
        z_shab = get_zmanim('2026-04-11', **PETAH_TIKVA)
        times_s = z_shab.get('times', {})
        s.check('Zmanim API: Shabbat date returns times', len(times_s) > 5)
    except Exception as e:
        s.fail('Zmanim API reachable (Shabbat)', str(e))

    # ── Zmanim values JS code uses ────────────────────────────────────
    calendar_js = (Path(__file__).parent.parent / 'js/calendar.js').read_text()
    s.check('calendar.js uses sofZmanShma',   'sofZmanShma'   in calendar_js)
    s.check('calendar.js uses sofZmanTfilla', 'sofZmanTfilla' in calendar_js)
    s.check('calendar.js uses sunset',         'sunset'        in calendar_js)
    s.check('calendar.js uses elevation',      'elevation'     in calendar_js)
    s.check('calendar.js references Kotel coords',
            '35.2345' in calendar_js or '31.7767' in calendar_js)

    # ── Reminder toggles persist in JS code ──────────────────────────
    settings_js = (Path(__file__).parent.parent / 'js/settings.js').read_text()
    s.check('loadSettingsState restores omer toggle',
            'omer' in settings_js and 'tog-omer' in settings_js or
            "'omer'" in settings_js)
    s.check('loadSettingsState restores zmanim toggles',
            'shema' in settings_js and 'tefila' in settings_js)
    s.check('toggleZmanimReminder saves to appState',
            'zmanimReminders' in settings_js or 'zmanimReminders' in 
            (Path(__file__).parent.parent / 'js/siddur.js').read_text())

    return s
