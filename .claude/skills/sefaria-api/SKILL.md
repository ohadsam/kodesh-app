---
name: sefaria-api
description: How to use the Sefaria REST API (texts, calendars, links, index, shape) correctly for Hebrew/Jewish-text apps, with the known-good refs and the pitfalls learned building the Itim (עיתים) PWA. Use whenever you are about to fetch, hardcode, schedule or render Sefaria text — Tanakh, Talmud, Mishnah, Rambam, siddur, Tehilim, Chofetz Chaim, Mesilat Yesharim, Kuzari, commentaries (Rashi, Tosafot, Bartenura, Steinsaltz, Onkelos), daily-learning calendars — or when a Sefaria ref returns empty/wrong text.
---

# Sefaria API – practical guide

Base: `https://www.sefaria.org/api/` (no key, CORS open, JSON). Hebrew-first apps want `lang=he`.
Companion files: `references/refs-catalog.md` (every ref the Itim app uses, with provenance),
`references/pitfalls.md` (shape/range/race bugs that really shipped), `scripts/sefaria_probe.py` (verifier).

## The one rule
**Never hardcode a ref you have not just fetched.** Ref names are fragile (underscores vs spaces,
`Principle_1` vs `Principle 1`, `Mesillat_Yesharim` vs `Mesilat Yesharim`). Run
`python3 scripts/sefaria_probe.py text "<ref>"` (exit 1 = no Hebrew) and only then write it into code,
with a comment `// verified YYYY-MM-DD`. If you cannot reach Sefaria (sandbox egress policy blocks
sefaria.org, sefaria.org.il, and also WebFetch), say so, mark the ref `TODO: verify`, and give the
user the probe command to run — do not guess and do not route around the block.

## Endpoints that matter

| Need | Call | Notes |
|---|---|---|
| Text | `GET /api/texts/{ref}?lang=he&commentary=0&context=0` | `he` = string, flat list, list-of-lists… (see pitfalls). Use `encodeURI(ref)` – it keeps `,` and `;` (siddur and Sacks refs need them); `encodeURIComponent` breaks them. |
| Daily learning | `GET /api/calendars?diaspora=0&year=Y&month=M&day=D` | `calendar_items[]` with `title.en/he`, `ref`, `heRef`, `displayValue`. Use `diaspora=0` for Israel. Add `&_=Date.now()` only when you need to bypass caches; don't cache this endpoint persistently (it's date-keyed and tiny). |
| Commentary on a range | `GET /api/links/{ref}?with_text=1&lang=he` | Filter `l.category==='Commentary'` and `l.collectiveTitle.en` (`Rashi`, `Tosafot`). Match the amud via `anchorRef` (`Chullin 2a:3`). The text API for "Rashi on X" often returns only line 1 — links is the reliable route for a whole daf. |
| Structure / titles | `GET /api/v2/index/{Title}` | `schema.nodes[].title / heTitle`, nested for complex books. Titles use underscores. |
| Lengths | `GET /api/shape/{Title}` | Chapter lengths – use it to plan daily units instead of guessing. (Shape of the reply differs for complex texts; print it first.) |
| Is there Hebrew? | text call, then check the flattened `he` is non-empty | An English-only book returns `he: []` with HTTP 200 – an empty list is a *failure*, not "no more text". |

Daily-cycle calendar titles the app matches (case-insensitive substring on `title.en`, or Hebrew substring):
`daf yomi`→דף, `mishnah yomi`/`mishna yomi`→משנה יומי, `daily rambam`/`rambam`→רמב"ם, `929`/`tanakh`→929.
Always `find(...)` and throw a clear Hebrew error if missing – titles can change.
Rambam daily refs may be a range (`Mishneh Torah, Prayer and the Priestly Blessing 5-6`) → expand to per-chapter refs yourself.

## Reading `he` safely
```js
function heFlat(data){                       // never trust length / depth
  let t = data?.he;                          // fallback: data.versions[].text for v3-style replies
  if (!t) return [];
  const flat = Array.isArray(t) ? deepFlat(t) : [t];
  return flat.filter(Boolean);
}
```
- Branch on `Array.isArray(he[0])`. For per-chapter structure (Rambam halachot) keep the 2-D shape and join inner paragraphs per halacha.
- A mid-chapter range can come back as the **whole chapter** – read `data.sections` for the real start verse.
- Clean HTML before display (`<small>` seasonal labels, `&thinsp;`, `&nbsp;`, nikud-less `<i>`), escape anything user-typed.

## Fetch hygiene (what the app does)
- Small delay between calls (100–400 ms) and serial loops for chapter-by-chapter loads; `Promise.all` is fine for ≈20 tiny requests, then cache.
- In-memory cache per session (`window._cache`-style map) so the same ref is never fetched twice; persistent cache (IndexedDB) only for **non-empty** text responses, never errors/empties.
- Always give a graceful Hebrew fallback and a retry button; an async loader must re-check "is this still the current ref?" **before** writing shared state.
- Offline/phone use: network-first with cache fallback in the service worker.

## Adding a new book / daily plan (checklist)
1. `index` → exact title, node titles, Hebrew title. 2. `text` on a leaf and on a whole node → confirm `he` non-empty and note its shape.
3. `shape` or measure lengths from real text, then pack units by **characters** (≈1000 chars ≈ 2–3 min) inside one chapter – see the Lashon plan below. 4. Use a continuous day counter (`days since fixed epoch`), not `dayOfYear % N` (year-end seam, short cycles).
5. Static tables in their own data file; cache key = tab id; mark unverified refs `TODO: verify source` and put them in the project's known-issues file.

Lashon plan (Itim `js/lashon-data.js`): 19 klalim fetched once → `lashonBuildPlan` greedy-packs consecutive seifim up to 1000 chars (never crossing a klal) → `plan[((dayNumber % n)+n)%n]`.

## Sources policy (Orthodox apps)
Only Sefaria / Hebcal / Chabad.org / well-known print siddurim; prayer texts must match the chosen nusach; Hebrew with nikud where applicable. Sefaria hosts some non-Orthodox material — pick refs deliberately.

## When the network is blocked
Org egress policy 403 on `CONNECT www.sefaria.org` (curl/urllib) and `EGRESS_BLOCKED` (WebFetch) means you cannot verify. WebSearch still returns Sefaria page titles/URLs (confirms a ref *exists*, not that it has Hebrew or its lengths). Say exactly what was and was not verified.
