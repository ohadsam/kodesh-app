# CLAUDE.md – Kodesh App Agent Instructions

This file is read by Claude Code at the start of every session.
Follow all rules below for **every** code change, no exceptions.

---

## 1. API Verification Before Use

- Before using any external API call, verify the endpoint is reachable and the response shape matches expectations.
- For Sefaria: test the exact `ref` string in the API URL before hardcoding it. Sefaria ref names are fragile.
- For Hebcal: validate that required fields exist in the JSON response before reading them.
- When adding a new API ref, add a comment with the verified date: `// verified YYYY-MM-DD`.
- If an API call fails at runtime, **always** provide a graceful fallback (static text, alternate ref, or a clear error message in Hebrew).

## 2. Keep AGENT.md Current

After **every** code change:
- Update `AGENT.md` → "Recently Fixed" section with version and description.
- Update `AGENT.md` → "Known Issues / Open Items" if anything was resolved or discovered.
- Update the `Last updated` header with the current version.
- If a new file or function is added, add it to the File Structure section.

## 3. Orthodox Jewish Content Standards

This is an Orthodox Jewish app. Content rules:
- Only use halachically reliable sources: **Sefaria** (for Torah texts), **Hebcal** (for dates/zmanim), **Chabad.org** texts, or well-known print siddurim.
- Do **not** add content from non-Orthodox denominations or heterodox sources.
- Prayer texts must match established nusachim (Sfard, Ashkenaz, Edot HaMizrach).
- When in doubt about halachic accuracy, add a `// TODO: verify source` comment and flag it in AGENT.md Known Issues.
- All Hebrew text must be properly vowelized (מנוקד) where applicable.

## 4. Code Efficiency and Reuse

- Before writing new code, search existing files for a similar function (e.g., `_renderBrachaLines`, `buildParagraphs`, `heFlat`, `cleanSefariaHtml`).
- Do **not** duplicate rendering logic — extend or reuse existing helpers.
- Keep functions small and single-purpose.
- Static data (prayer texts, parasha tables) belongs in dedicated `.js` data files, not inline in rendering functions.
- Avoid deeply nested callbacks; prefer async/await.

## 5. Memory and Caching Efficiency

- The service worker (`sw.js`) caches all static assets. When adding new static files, make sure they are included in the SW cache list.
- Session-level API responses should be cached in `window._cache` or similar in-memory map — never refetch the same Sefaria ref twice per session.
- Do **not** store large text blobs in `localStorage` — use session memory only.
- When bumping `APP_VERSION`, the SW automatically clears old caches. Do not add manual cache-clearing logic elsewhere.

## 6. Token Efficiency

- Before reading a file, check STRUCTURE.md for the relevant function/section location to avoid full-file reads.
- Read only the lines you need using `offset` + `limit` parameters.
- When searching for a function, use `grep` before opening the whole file.
- Prefer targeted edits over full file rewrites.
- Use AGENT.md and STRUCTURE.md as memory so you do not need to re-scan the codebase repeatedly.

## 7. Maintain Supporting MD Files

Keep these files accurate and up to date:
- **AGENT.md** – architecture, known issues, version history, recently fixed
- **STRUCTURE.md** – file map, entry points, key functions (use as reference to avoid re-scanning)
- **CLAUDE.md** – this file; update if project conventions change

If a new architectural pattern is introduced (new tab, new data format, new API), document it in AGENT.md immediately.

## 8. STRUCTURE.md as Code Map

`STRUCTURE.md` contains the definitive map of files, entry points, and key functions.
- **Always consult STRUCTURE.md first** before scanning files.
- After adding or renaming functions/files, update STRUCTURE.md in the same commit.
- Format: file path → key exports/functions → brief description.

## 9. What's New – Always Current

After every user-visible change:
- Update the `whats-new-modal` content in `index.html` (around line 254).
- **Delete all previous bullet points** and replace with only the current version's changes.
- Update the version number in the modal title: `מה חדש בגרסה X.XX`.
- Keep bullets concise and in Hebrew, aimed at the end user.

## 10. Tests Before Every Commit

- Run `python3 Tests/test_runner.py` before committing.
- All pre-existing passing tests must continue to pass.
- If a test needs to change because of a legitimate code change, update the test and note it explicitly in the commit message and PR description: `[test updated: <test name> – reason]`.
- Network-dependent tests (Sefaria API, Hebcal API) may fail in offline environments — this is expected. Focus on the local logic tests.
- The following suites must always pass: `test_siddur_seasonal`, `test_omer`, `test_html_structure` (for the non-network checks).
- **Before a merge to main, run `python3 release-checklist.py`** — it runs the full
  test suite plus every other check in this file (version consistency across all 7
  places it appears, AGENT.md currency, what's-new content, JS syntax) as one gate,
  auto-classifying network failures as non-blocking warnings. `--verbose` shows
  passing checks too. Exit code 1 means something in THIS file's rules was violated.

---

## 11. What This Project Is

**עיתים (Itim)** — an Orthodox Jewish daily-learning and prayer PWA.
Vanilla JS, no build step, no framework, no bundler. `index.html` loads a fixed list of
`js/*.js` files in order; every function is a global. Deployed on GitHub Pages straight
from `main` — **pushing to `main` IS the deploy.** Users are Hebrew-speaking, in Israel,
on phones, often offline.

Tabs: לוח שנה (zmanim), סידור, פרשת שבוע, תהילים, דף יומי, משנה יומי, רמב"ם, ברכות,
ספירת העומר, מצפן.

### The three constraints that shape everything

1. **No build step.** Do not introduce imports/exports, TypeScript, JSX, or npm
   dependencies. New file ⇒ add a `<script src="js/x.js?v=VERSION">` tag to index.html
   in dependency order, and add it to the SW cache list.
2. **Aggressive caching.** A change is invisible to users until `APP_VERSION` is bumped
   in **both** `utils.js` and `sw.js` **and** every `?v=` in index.html is updated.
   Skipping the bump is the single most common way a "fix" appears not to work.
3. **Halachic correctness outranks code elegance.** A wrong prayer text or a wrong
   parasha is a real-world failure, not a cosmetic bug.

## 12. Working Rhythm for a Fix

1. `AGENT.md` → Known Issues + Recently Fixed; `STRUCTURE.md` → find the function.
2. Reproduce from the user's description before editing. The Hebrew report usually
   names the exact tab, parasha and aliya — use it.
3. Fix, then **verify the maths numerically** (`node -e` / a scratch script) rather than
   reasoning in prose. Compass bearings, verse-index mapping and Hebrew-date arithmetic
   have all shipped bugs that "looked right".
4. `python3 Tests/test_runner.py`. `test_siddur_seasonal` (54) and `test_omer` (63) must
   stay green. Network suites 403 in the sandbox — expected, ignore.
5. Bump the version everywhere (see §2 above and AGENT.md → Deploy Checklist).
6. Rewrite the what's-new modal (§9) — delete the old bullets, don't append.
7. Update AGENT.md / STRUCTURE.md in the same commit.
8. `python3 release-checklist.py` — final gate before merging to main.

### Version bumping — use Python, not sed
`sed` has corrupted the version string in this repo (`5.109` → `5.100`). Use:
```bash
python3 - <<'PY'
for p in ['index.html','js/utils.js','sw.js']:
    c=open(p,encoding='utf-8').read()
    open(p,'w',encoding='utf-8').write(c.replace('5.109','5.110'))
PY
```
Then confirm: `grep -c "5\.110" index.html js/utils.js sw.js` → 20, 1, 1.

## 13. Landmines (each of these has caused a real bug)

- **`calcBearing()` takes RADIANS.** `calcDistanceKm()` takes DEGREES. Same file.
- **CSS `rotate()` is clockwise.** A positive needle angle means turn RIGHT (ימינה).
- **Sefaria `data.he` shape is unstable.** Flat array, array-of-arrays (one per chapter),
  or deeper. Always branch on `Array.isArray(data.he[0])`. Never trust its length as a
  chapter length — derive chapter bounds from the Torah text response (`_torahChLengths`).
- **Sefaria may return a whole chapter for a mid-chapter range.** Read `data.sections`
  for the real starting verse.
- **Hebcal needs `&i=on`** (Israel) on every call, or the diaspora parasha schedule leaks
  in and the parasha is a week off after a festival.
- **Hebcal Hebrew spellings differ** from `ALL_PARASHIOT` (בהעלתך vs בהעלותך) — match
  through the `_stripVL` fallback chain.
- **Hebcal writes multi-word single parasha names with a HYPHEN, not a space**
  (`כי-תצא`, `לך-לך`) — visually identical to a genuinely combined pair
  (`תזריע-מצורע`). Try a space-normalized match BEFORE any hyphen-split combined-
  parasha logic, or a single 2-word name gets cut in half and mismatched.
- **`ch === endCh` is NOT the same as "this aliya ends at its chapter's true last
  verse."** Most aliyot end mid-chapter. `_torahChLengths` (the one reliable
  source that could tell the two cases apart) is only populated for multi-chapter
  aliyot — never for a single-chapter one, which is exactly when this distinction
  matters most for Rashi's coverage checks in `loadRashiForRef`.
- **Async loaders race.** `loadRashiForRef` / `loadOnkelosForRef` must re-check
  `_currentAliyaRef` **before** writing shared state, not after.
- **A "strategy succeeded" flag must depend on actually finding data**, not just on
  the fetch completing without an HTTP error. `loadRashiForRef`'s Strategy 3 once
  set `success = true` after every run regardless of whether it found any Rashi —
  a single empty response was silently accepted as final with no retry.
- **The inline `<head>` script is the only version guard.** A second one anywhere causes
  an infinite reload loop.

## Quick Reference

| Task | File |
|---|---|
| Project architecture & issues | `AGENT.md` |
| File map & entry points | `STRUCTURE.md` |
| Agent rules (this file) | `CLAUDE.md` |
| Deploy checklist | `AGENT.md` → Deploy Checklist |
| Run tests | `python3 Tests/test_runner.py` |
| Run the merge gate | `python3 release-checklist.py` |
| Prayer texts | `js/tefilot.js`, `js/brachot.js` |
| Siddur pipeline | `js/siddur.js`, `js/siddur-inserts.js` |
| Parasha / Rashi / daily study | `js/content.js` |
| Compass / Qibla | `js/misc.js` |
| HTML structure | `index.html` (single-file app) |
