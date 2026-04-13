"""
test_html_structure.py
Tests for index.html structure, UI elements, and CSS validity.
Verifies all required DOM elements exist and whats-new modal is correctly nested.
"""
import sys, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

HTML = (Path(__file__).parent.parent / 'index.html').read_text(encoding='utf-8')

def find_id(id_):
    return f'id="{id_}"' in HTML or f"id='{id_}'" in HTML

def run() -> TestSuite:
    s = TestSuite('HTML Structure & UI')

    # ── App version consistency ───────────────────────────────────────
    versions = re.findall(r"var V = '([\d.]+)'", HTML)
    sw_versions = re.findall(r"APP_VERSION\s*=\s*'([\d.]+)'", 
                             (Path(__file__).parent.parent / 'sw.js').read_text())
    util_versions = re.findall(r"APP_VERSION\s*=\s*'([\d.]+)'",
                               (Path(__file__).parent.parent / 'js/utils.js').read_text())
    all_v = versions + sw_versions + util_versions
    s.check('Version consistent across files', len(set(all_v)) == 1,
            f"versions found: {set(all_v)}")
    s.check('Version string present in HTML', len(versions) > 0,
            versions[0] if versions else 'MISSING')

    # ── Required DOM elements ─────────────────────────────────────────
    required_ids = [
        # Core layout
        'topbar', 'splash', 'main-content',
        # Navigation tabs
        'tab-calendar', 'tab-siddur', 'tab-parasha', 'tab-tehilim',
        # Siddur
        'siddur-content', 'siddur-status-banner',
        'tefila-type-buttons', 'nusach-buttons',
        # Parasha
        'parasha-content', 'parasha-name', 'parasha-select', 'aliya-tabs',
        # Tehilim
        'tehilim-content', 'tehilim-num-title', 'tehilim-select',
        # Calendar / Zmanim
        'zmanim-container',
        # Omer
        'omer-modal',
        # Reminders
        'reminder-modal', 'reminder-list',
        # Whats new
        'whats-new-overlay', 'whats-new-modal', 'whats-new-content',
        # Settings
        'settings-panel',
    ]
    for id_ in required_ids:
        s.check(f'DOM element #{id_} exists', find_id(id_), f'id="{id_}" not found')

    # ── Reminder toggles ──────────────────────────────────────────────
    for key in ['halacha', 'tehilim', 'lashon', 'parasha', 'igeret', 'omer']:
        s.check(f'Reminder toggle tog-{key} exists', find_id(f'tog-{key}'))
    for key in ['shema', 'tefila', 'noon', 'sunset', 'tzeit']:
        s.check(f'Zmanim toggle tog-{key}-auto exists', find_id(f'tog-{key}-auto'))

    # ── Whats-new modal nesting ───────────────────────────────────────
    modal_start = HTML.find('id="whats-new-modal"')
    modal_end   = HTML.find('<!-- TOP BAR -->', modal_start)
    if modal_start > 0 and modal_end > 0:
        modal_block = HTML[modal_start:modal_end]
        s.check('whats-new-modal contains הבנתי button', 'הבנתי' in modal_block)
        s.check('whats-new-modal contains closeWhatsNew()', 'closeWhatsNew()' in modal_block)
        # Button must be INSIDE the modal div (before its closing </div>)
        btn_pos     = modal_block.find('הבנתי')
        content_end = modal_block.rfind('</div>')
        s.check('הבנתי button is inside modal div', btn_pos < content_end,
                f'btn@{btn_pos} content_end@{content_end}')
        # Count open/close divs — must be balanced
        opens  = modal_block.count('<div')
        closes = modal_block.count('</div>')
        s.check('Whats-new modal divs balanced', opens == closes,
                f'<div={opens} </div>={closes}')
    else:
        s.fail('whats-new-modal block found in HTML')

    # ── Script tags order ─────────────────────────────────────────────
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', HTML)
    js_scripts = [s_ for s_ in scripts if 'js/' in s_]
    required_scripts = ['utils.js', 'app.js', 'siddur.js', 'content.js',
                        'tehilim.js', 'omer.js', 'settings.js']
    for rs in required_scripts:
        s.check(f'Script {rs} included', any(rs in sc for sc in js_scripts))

    # utils.js must come before other app scripts
    utils_idx = next((i for i,sc in enumerate(js_scripts) if 'utils.js' in sc), -1)
    app_idx   = next((i for i,sc in enumerate(js_scripts) if 'app.js' in sc), -1)
    s.check('utils.js loaded before app.js', utils_idx < app_idx,
            f'utils@{utils_idx} app@{app_idx}')

    # ── Service Worker registration ───────────────────────────────────
    s.check('Service Worker registration in HTML', 'serviceWorker' in HTML)
    s.check('SW cache version matches app version',
            sw_versions and util_versions and sw_versions[0] == util_versions[0],
            f'sw={sw_versions} utils={util_versions}')

    # ── RTL direction ─────────────────────────────────────────────────
    s.check('HTML has RTL direction', 'dir="rtl"' in HTML or "dir='rtl'" in HTML)

    # ── PWA manifest ─────────────────────────────────────────────────
    s.check('Manifest link present', 'manifest.json' in HTML)
    manifest = (Path(__file__).parent.parent / 'manifest.json').read_text()
    import json
    mf = json.loads(manifest)
    s.check('Manifest has name', bool(mf.get('name')))
    s.check('Manifest has icons', len(mf.get('icons', [])) >= 2)
    s.check('Manifest has start_url', bool(mf.get('start_url')))

    # ── No console.log in production? (warn only) ────────────────────
    log_count = HTML.count('console.log')
    s.warn('console.log in HTML (inline scripts)', f'{log_count} occurrences') if log_count > 5 else s.ok('console.log count reasonable in HTML')

    return s
