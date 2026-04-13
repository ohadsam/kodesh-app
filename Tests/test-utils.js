// ── Test Framework ───────────────────────────────────────────────────
const TEST_REGISTRY = [];
let _currentSuite = null;

function suite(name, fn) {
  _currentSuite = name;
  fn();
  _currentSuite = null;
}

function test(name, fn, tags = []) {
  TEST_REGISTRY.push({ suite: _currentSuite, name, fn, tags, status: 'pending', detail: '' });
}

// ── Assertions ────────────────────────────────────────────────────────
function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'Expected equal') + `: got "${a}", expected "${b}"`);
}

function assertContains(str, sub, msg) {
  if (!String(str).includes(sub))
    throw new Error((msg || 'Expected to contain') + `: "${sub}" not in "${String(str).slice(0,80)}"`);
}

function assertMatch(str, re, msg) {
  if (!re.test(String(str)))
    throw new Error((msg || 'Expected match') + `: ${re} did not match "${String(str).slice(0,80)}"`);
}

function assertRange(val, min, max, msg) {
  if (val < min || val > max)
    throw new Error((msg || 'Expected in range') + `: ${val} not in [${min}, ${max}]`);
}

function assertOk(val, msg) {
  if (!val) throw new Error((msg || 'Expected truthy') + `: got ${val}`);
}

// ── HTTP helpers ──────────────────────────────────────────────────────
async function httpGet(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Date helpers ─────────────────────────────────────────────────────
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateFromParts(y, m, d) {
  return new Date(y, m - 1, d);
}

// Sefaria base URL
const SEFARIA = 'https://www.sefaria.org/api';
const HEBCAL  = 'https://www.hebcal.com';

console.log('[TestUtils] loaded', TEST_REGISTRY.length, 'tests');
