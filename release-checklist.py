#!/usr/bin/env python3
"""
release-checklist.py — Kodesh App release gate

Runs every check CLAUDE.md requires before a merge to main, in one command:
  1. Version consistency across utils.js / sw.js / index.html (all script
     tags, splash text, inline HEAD guard, what's-new modal title).
  2. AGENT.md is current (header version + a "Recently Fixed" entry for it).
  3. What's-new modal actually has content for the current version.
  4. Full test suite (Tests/test_runner.py), with network-only failures
     downgraded to warnings — CLAUDE.md §10 says network tests "may fail in
     offline environments"; test_siddur_seasonal / test_omer /
     test_html_structure must pass with ZERO failures of any kind.
  5. `node --check` syntax validation on every js/*.js file.
  6. Git status summary (uncommitted changes, current branch) — informational.

Usage:
  python3 release-checklist.py            # run all checks, exit 0/1
  python3 release-checklist.py --verbose  # show passing checks too

This does not replace human judgement (UI/UX on a real device, halachic
accuracy) — see AGENT.md → Deploy Checklist for the manual steps that come
after this passes.
"""
import sys, os, re, subprocess, argparse, importlib
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / 'Tests'))

GREEN, RED, YELLOW, CYAN, BOLD, RESET = (
    '\033[92m', '\033[91m', '\033[93m', '\033[96m', '\033[1m', '\033[0m'
)

# Failure-detail substrings that indicate the sandbox's network egress policy
# blocked the call (403 from the local agent proxy), not a real app/test bug.
NETWORK_MARKERS = (
    'ProxyError', 'Forbidden', 'Max retries exceeded', 'ConnectionError',
    'Timeout', 'HTTPSConnectionPool', ' 403', 'getaddrinfo failed',
    'Name or service not known',
)

# Suites that must pass with ZERO failures — none of them make network calls,
# so any failure here is a real regression, never a sandbox artifact.
REQUIRED_CLEAN_SUITES = {'Siddur Seasonal Logic', 'Omer Counting', 'HTML Structure & UI'}


class Report:
    def __init__(self):
        self.checks = []   # (name, passed, detail, blocking)

    def add(self, name, passed, detail='', blocking=True):
        self.checks.append((name, passed, detail, blocking))

    def ok(self, name, detail=''):
        self.add(name, True, detail)

    def fail(self, name, detail='', blocking=True):
        self.add(name, False, detail, blocking)

    def hard_failures(self):
        return [c for c in self.checks if not c[1] and c[3]]

    def soft_failures(self):
        return [c for c in self.checks if not c[1] and not c[3]]


def _read(path):
    return (ROOT / path).read_text(encoding='utf-8')


# ── 1. Version consistency ──────────────────────────────────────────────
def check_versions(r: Report):
    html = _read('index.html')
    utils_js = _read('js/utils.js')
    sw_js = _read('sw.js')
    agent_md = _read('AGENT.md')

    v_head = re.findall(r"var V = '([\d.]+)'", html)
    v_splash = re.findall(r'גרסה\s+([\d.]+)</p>', html)
    v_footer = re.findall(r'גרסה\s+([\d.]+)\s*·', html)
    v_whatsnew = re.findall(r'מה חדש בגרסה\s+([\d.]+)', html)
    v_script_tags = re.findall(r'<script src="js/[^"]+\?v=([\d.]+)"', html)
    v_utils = re.findall(r"APP_VERSION\s*=\s*'([\d.]+)'", utils_js)
    v_sw = re.findall(r"APP_VERSION\s*=\s*'([\d.]+)'", sw_js)
    v_agent = re.findall(r'\*\*Last updated:\*\*\s*v([\d.]+)', agent_md)

    all_groups = {
        'index.html var V (HEAD guard)': v_head,
        'index.html splash גרסה': v_splash,
        'index.html footer גרסה': v_footer,
        "index.html what's-new modal title": v_whatsnew,
        'index.html script ?v= tags': v_script_tags,
        'js/utils.js APP_VERSION': v_utils,
        'sw.js APP_VERSION': v_sw,
    }
    for label, found in all_groups.items():
        if not found:
            r.fail(f'{label} present', 'no version string found')
        else:
            r.ok(f'{label} present', f'{len(found)} occurrence(s)')

    all_versions = set()
    for found in all_groups.values():
        all_versions.update(found)
    r.check_version_set = all_versions

    r.check('All version strings match', len(all_versions) == 1,
            f'found: {sorted(all_versions)}' if len(all_versions) != 1 else '')

    if v_agent:
        r.check('AGENT.md header version matches', set(v_agent) == all_versions,
                f'AGENT.md says v{v_agent[0]}, code says {sorted(all_versions)}')
    else:
        r.fail('AGENT.md header version present', 'no "**Last updated:** vX.X" line found')

    return next(iter(all_versions)) if len(all_versions) == 1 else None


def _add_check_method(r: Report):
    def check(name, condition, detail='', blocking=True):
        r.add(name, bool(condition), detail, blocking)
    r.check = check


# ── 2. AGENT.md has a "Recently Fixed" entry for the current version ────
def check_agent_md_entry(r: Report, version):
    agent_md = _read('AGENT.md')
    if version is None:
        r.fail('AGENT.md "Recently Fixed" entry for current version',
               'version is ambiguous (see version-consistency failures above)')
        return
    pattern = rf'###\s*v{re.escape(version)}\b'
    found = re.search(pattern, agent_md)
    r.check(f'AGENT.md has "### v{version}" Recently Fixed entry', found is not None,
            '' if found else f'no "### v{version}" heading found — add one describing this release')


# ── 3. What's-new modal has real content ─────────────────────────────────
def check_whatsnew_content(r: Report):
    html = _read('index.html')
    m = re.search(
        r'id="whats-new-content"[^>]*>(.*?)</div>\s*<button onclick="closeWhatsNew\(\)"',
        html, re.DOTALL)
    if not m:
        r.fail("what's-new-content block found", 'could not locate the block')
        return
    body = m.group(1)
    bullet_count = body.count('<div')
    r.check("what's-new modal has at least one bullet", bullet_count >= 1,
            f'{bullet_count} inner <div> found')
    # Per CLAUDE.md §9: delete all previous bullets, replace with only the
    # current version's changes — so it should be short, not an accumulated
    # changelog. A long list is a sign old bullets were never cleared.
    r.check("what's-new modal isn't an accumulated changelog (<=6 bullets)",
            bullet_count <= 6, f'{bullet_count} bullets — clear old ones per CLAUDE.md §9',
            blocking=False)


# ── 4. Test suite ─────────────────────────────────────────────────────────
def check_tests(r: Report, verbose):
    test_files = [
        'test_api_sefaria', 'test_api_hebcal', 'test_business_logic',
        'test_html_structure', 'test_siddur_seasonal', 'test_omer',
        'test_zmanim', 'test_parasha',
    ]
    for name in test_files:
        try:
            mod = importlib.import_module(name)
        except ImportError as e:
            r.fail(f'test module {name} importable', str(e))
            continue
        try:
            suite = mod.run()
        except Exception as e:
            r.fail(f'suite {name} ran without crashing', str(e))
            continue

        for res in suite.results:
            if res.passed and not res.warn:
                if verbose:
                    r.ok(f'[{suite.name}] {res.name}', res.detail)
                continue
            if res.warn:
                if verbose:
                    r.ok(f'[{suite.name}] {res.name} (warn)', res.detail, )
                continue
            # A genuine failure — classify network vs real.
            is_network = any(marker in (res.detail or '') for marker in NETWORK_MARKERS)
            must_be_clean = suite.name in REQUIRED_CLEAN_SUITES
            if is_network and not must_be_clean:
                r.add(f'[{suite.name}] {res.name}', False, res.detail + '  (network — sandbox egress blocked, non-blocking)',
                      blocking=False)
            else:
                r.fail(f'[{suite.name}] {res.name}', res.detail, blocking=True)


# ── 5. JS syntax ───────────────────────────────────────────────────────────
def check_js_syntax(r: Report):
    node = subprocess.run(['which', 'node'], capture_output=True, text=True)
    if node.returncode != 0:
        r.fail('node available for syntax check', 'node not found on PATH')
        return
    js_files = sorted((ROOT / 'js').glob('*.js'))
    for f in js_files:
        res = subprocess.run(['node', '--check', str(f)], capture_output=True, text=True)
        r.check(f'syntax OK: js/{f.name}', res.returncode == 0,
                res.stderr.strip().splitlines()[-1] if res.stderr else '')


# ── 6. Git status (informational) ──────────────────────────────────────────
def check_git_status(r: Report):
    branch = subprocess.run(['git', 'branch', '--show-current'], cwd=ROOT,
                             capture_output=True, text=True).stdout.strip()
    status = subprocess.run(['git', 'status', '--short'], cwd=ROOT,
                             capture_output=True, text=True).stdout.strip()
    r.ok('current branch', branch or '(detached HEAD)')
    if status:
        n = len(status.splitlines())
        r.add('working tree clean', False, f'{n} changed file(s) — expected before a commit',
              blocking=False)
    else:
        r.ok('working tree clean', 'no uncommitted changes')


def print_report(r: Report, verbose):
    print(f"\n{BOLD}{CYAN}{'═'*60}{RESET}")
    print(f"{BOLD}{CYAN}  Kodesh App — Release Checklist{RESET}")
    print(f"{BOLD}{CYAN}{'═'*60}{RESET}\n")

    for name, passed, detail, blocking in r.checks:
        if passed and not verbose:
            continue
        if passed:
            icon = f'{GREEN}✓{RESET}'
        elif blocking:
            icon = f'{RED}✗{RESET}'
        else:
            icon = f'{YELLOW}⚠{RESET}'
        line = f'  {icon} {name}'
        if detail:
            line += f'  {YELLOW}{detail}{RESET}'
        print(line)

    hard = r.hard_failures()
    soft = r.soft_failures()
    total = len(r.checks)
    passed = sum(1 for c in r.checks if c[1])

    print(f"\n{BOLD}{'─'*60}{RESET}")
    print(f"  {passed}/{total} checks passed"
          f"  ({len(hard)} blocking failure(s), {len(soft)} warning(s))")
    if hard:
        print(f"\n{RED}{BOLD}❌ NOT READY TO RELEASE{RESET} — fix the blocking failures above:")
        for name, _, detail, _ in hard:
            print(f"    {RED}✗{RESET} {name}" + (f" — {detail}" if detail else ''))
    else:
        print(f"\n{GREEN}{BOLD}✅ READY TO RELEASE{RESET} (blocking checks all pass)")
        if soft:
            print(f"{YELLOW}   {len(soft)} warning(s) above — review, not blocking.{RESET}")
        print(f"\n{CYAN}Manual steps still required (AGENT.md → Deploy Checklist):{RESET}")
        print(f"   • Push → GitHub Pages auto-deploys")
        print(f"   • Hard reload on device OR press \"💥 איפוס מוחלט\" in settings")
        print(f"   • Spot-check the actual feature changed, on a real device")
    print(f"{BOLD}{'═'*60}{RESET}\n")
    return len(hard) == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--verbose', '-v', action='store_true')
    args = ap.parse_args()

    r = Report()
    _add_check_method(r)

    version = check_versions(r)
    check_agent_md_entry(r, version)
    check_whatsnew_content(r)
    check_tests(r, args.verbose)
    check_js_syntax(r)
    check_git_status(r)

    ok = print_report(r, args.verbose)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
