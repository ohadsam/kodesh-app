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

---

## Quick Reference

| Task | File |
|---|---|
| Project architecture & issues | `AGENT.md` |
| File map & entry points | `STRUCTURE.md` |
| Agent rules (this file) | `CLAUDE.md` |
| Deploy checklist | `AGENT.md` → Deploy Checklist |
| Run tests | `python3 Tests/test_runner.py` |
| Prayer texts | `js/tefilot.js`, `js/brachot.js` |
| Siddur pipeline | `js/siddur.js`, `js/siddur-inserts.js` |
| HTML structure | `index.html` (single-file app) |
