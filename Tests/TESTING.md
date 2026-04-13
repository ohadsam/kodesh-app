# 🧪 Kodesh App — Test Suite

## Overview

The test suite is located in `tests/` and covers:
- **API** validation (Sefaria, Hebcal) — live network calls
- **Business logic** — pure logic, no network
- **HTML/UI structure** — DOM elements, nesting, versions
- **Siddur seasonal** — מוריד הטל, ותן ברכה, תחנון rules
- **Omer counting** — Hebrew grammar, all 49 days
- **Zmanim** — prayer times, compass bearing, API dates
- **Parasha** — combined parshiot, fuzzy matching, aliyot

---

## Running Tests

### Run all tests
```bash
cd /path/to/kodesh-app
python3 tests/test_runner.py
```

### Run with verbose output (show all passes)
```bash
python3 tests/test_runner.py --verbose
```

### Run a single module
```bash
python3 tests/test_runner.py --module test_omer
python3 tests/test_runner.py --module test_siddur_seasonal
python3 tests/test_runner.py --module test_business_logic
python3 tests/test_runner.py --module test_html_structure
python3 tests/test_runner.py --module test_api_sefaria
python3 tests/test_runner.py --module test_api_hebcal
python3 tests/test_runner.py --module test_zmanim
python3 tests/test_runner.py --module test_parasha
```

### Install dependencies
```bash
pip3 install requests
```

---

## Test Modules

| Module | Type | Network | Description |
|--------|------|---------|-------------|
| `test_business_logic.py` | Logic | ❌ | Omer, compass, gematria, seasonal, tachanun |
| `test_html_structure.py` | UI | ❌ | DOM elements, version consistency, whats-new nesting |
| `test_siddur_seasonal.py` | Logic | ❌ | מוריד הטל/ותן ברכה rules, arvit tachanun, יעלה ויבוא |
| `test_omer.py` | Logic | ❌ | All 49 days, grammar (יוֹם/יָמִים), teen regression |
| `test_zmanim.py` | Logic + API | ✅ | Compass bearings, Hebcal zmanim API on multiple dates |
| `test_parasha.py` | Logic + API | ✅ | Combined parasha fuzzy match, Hebcal leyning API |
| `test_api_sefaria.py` | API | ✅ | Sefaria text API, calendars, Steinsaltz, Rambam |
| `test_api_hebcal.py` | API | ✅ | Hebcal converter, zmanim, events |

---

## Key Test Cases

### 🌾 Omer (regression tests)
- Days 11-19 each return a **single** day string (regression for old split-bug)
- Day 2 uses `שְׁנֵי יָמִים` (not `שְׁנַיִם`)
- Days with weeks use `יוֹם` (singular), days without use `יָמִים` (plural)
- Day 7, 14, 21... use `יָמִים` (plural) since they're complete

### 📕 Siddur Seasonal
- Summer (Nisan 15 → Tishrei 22): show מוריד הטל, hide משיב הרוח
- Winter (Tishrei 23 → Nisan 14): show משיב הרוח, hide מוריד הטל
- ותן ברכה: Sefaria sends both phrases; correct one shown, other removed
- **Arvit never shows תחנון** in banner (not applicable to that prayer)
- Race condition: pending reload mechanism tested in code inspection

### 🧭 Compass
- Petah Tikva → Kotel: ~136° (SE) ±8°
- New York → Kotel: east direction (50-90°)
- London → Kotel: ESE (~115°)

### 📜 Combined Parashiot
- `"מצרע"` fuzzy-matches `"מצורע"` (matres lectionis stripping)
- `"בחקתי"` fuzzy-matches `"בחוקותי"`
- Combined ref built from start of first + end of second parasha

### 🏗️ HTML Structure
- All required DOM elements present
- `whats-new-modal` has correct nesting (button inside modal)
- APP_VERSION consistent across `utils.js`, `sw.js`, and `index.html`
- All reminder toggles have DOM elements

---

## Adding New Tests

1. Create `tests/test_TOPIC.py`
2. Implement `def run() -> TestSuite:`
3. Add module name to `test_runner.py` `test_files` list
4. Run to verify

### Template
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_runner import TestSuite

def run() -> TestSuite:
    s = TestSuite('My Topic')
    s.check('Some condition', 1 + 1 == 2, 'detail on failure')
    s.ok('Always passes', 'optional detail')
    s.fail('Always fails — use for TODO')
    s.warn('Warning only', 'non-fatal')
    return s
```

---

## Continuous Regression Checklist

Before each release, run:
```bash
python3 tests/test_runner.py --verbose 2>&1 | tee tests/last_run.txt
```

Critical tests that must pass:
- [ ] All HTML structure tests (version consistency, DOM elements)
- [ ] Omer days 11-19 regression
- [ ] Siddur seasonal boundaries
- [ ] Compass bearing for Petah Tikva
- [ ] Combined parasha מצרע→מצורע matching
- [ ] Arvit has no tachanun in banner
