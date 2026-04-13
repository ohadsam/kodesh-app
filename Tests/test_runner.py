"""
Kodesh App Test Runner
Runs all test modules and produces a unified report.
Usage: python3 tests/test_runner.py [--module MODULE] [--verbose]
"""
import sys, os, time, json, argparse
from pathlib import Path

# ── Colour helpers ───────────────────────────────────────────────────
GREEN  = '\033[92m'
RED    = '\033[91m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
BOLD   = '\033[1m'
RESET  = '\033[0m'

class TestResult:
    def __init__(self, name, passed, detail='', warn=False):
        self.name   = name
        self.passed = passed
        self.detail = detail
        self.warn   = warn   # warning (not fatal fail)

class TestSuite:
    def __init__(self, name):
        self.name    = name
        self.results = []
        self._t0     = time.time()

    def ok(self, name, detail=''):
        self.results.append(TestResult(name, True, detail))

    def fail(self, name, detail=''):
        self.results.append(TestResult(name, False, detail))

    def warn(self, name, detail=''):
        self.results.append(TestResult(name, True, detail, warn=True))

    def check(self, name, condition, ok_detail='', fail_detail=''):
        if condition:
            self.ok(name, ok_detail)
        else:
            self.fail(name, fail_detail)

    def summary(self):
        passed = sum(1 for r in self.results if r.passed)
        total  = len(self.results)
        elapsed = time.time() - self._t0
        return passed, total, elapsed

def print_suite(suite, verbose=False):
    passed, total, elapsed = suite.summary()
    status = f"{GREEN}✅ PASS{RESET}" if passed == total else f"{RED}❌ FAIL{RESET}"
    print(f"\n{BOLD}{CYAN}── {suite.name} ──{RESET}  {status}  ({passed}/{total})  {elapsed:.1f}s")
    for r in suite.results:
        if r.warn:
            icon = f"{YELLOW}⚠ {RESET}"
        elif r.passed:
            icon = f"{GREEN}✓ {RESET}"
        else:
            icon = f"{RED}✗ {RESET}"
        if not r.passed or verbose or r.warn:
            detail = f"  {YELLOW}{r.detail}{RESET}" if r.detail else ''
            print(f"  {icon}{r.name}{detail}")

def run_all(modules, verbose=False):
    all_passed = 0
    all_total  = 0
    failed_suites = []

    for mod in modules:
        try:
            suite = mod.run()
            print_suite(suite, verbose)
            p, t, _ = suite.summary()
            all_passed += p
            all_total  += t
            if p < t:
                failed_suites.append(suite.name)
        except Exception as e:
            print(f"\n{RED}💥 {mod.__name__} crashed: {e}{RESET}")
            import traceback; traceback.print_exc()

    print(f"\n{BOLD}{'='*50}")
    colour = GREEN if all_passed == all_total else RED
    print(f"{colour}TOTAL: {all_passed}/{all_total} tests passed{RESET}")
    if failed_suites:
        print(f"{RED}Failed suites: {', '.join(failed_suites)}{RESET}")
    print(f"{'='*50}{RESET}")
    return all_passed == all_total

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--module', help='Run only this module (e.g. test_api_sefaria)')
    parser.add_argument('--verbose', '-v', action='store_true')
    args = parser.parse_args()

    # Add tests dir to path
    sys.path.insert(0, str(Path(__file__).parent))

    import importlib
    test_files = [
        'test_api_sefaria',
        'test_api_hebcal',
        'test_business_logic',
        'test_html_structure',
        'test_siddur_seasonal',
        'test_omer',
        'test_zmanim',
        'test_parasha',
    ]

    if args.module:
        test_files = [f for f in test_files if args.module in f]

    modules = []
    for name in test_files:
        try:
            modules.append(importlib.import_module(name))
        except ImportError as e:
            print(f"{YELLOW}⚠ Could not load {name}: {e}{RESET}")

    success = run_all(modules, args.verbose)
    sys.exit(0 if success else 1)
