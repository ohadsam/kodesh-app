# Pitfalls that actually shipped (Itim app)

1. **`data.he` shape is unstable**: flat array, array-of-arrays (one per chapter), deeper, or a plain string. Branch on `Array.isArray(he[0])`; derive chapter bounds from a Torah-text response, not from `he.length`.
2. **Mid-chapter range → whole chapter.** Use `data.sections` for the real first verse.
3. **`ch === endCh` ≠ "aliya ends at the chapter's last verse".** Only multi-chapter aliyot get chapter lengths from the text response.
4. **Async loaders race** (Rashi/Onkelos): re-check `_currentAliyaRef` before writing shared state.
5. **"Strategy succeeded" must mean data was found**, not "fetch returned 200". Never accept an empty response as final without a retry.
6. **Per-strategy retries**: a strategy that judged the data structurally insufficient will judge it the same way again – retry only on exceptions/timeouts.
7. **Rashi on a Torah chapter**: `Rashi on Genesis 1` (small) → range ref → `commentary=1` (huge, last resort, 35 s timeout). `Steinsaltz on Mishneh Torah, X N` is treated as a *halacha* ref – use `…N:1-{halachaCount}` for the whole chapter.
8. **Daf commentary**: use `/api/links/{daf}?with_text=1&lang=he`, filter by `collectiveTitle.en` and `anchorRef`'s amud; the text API returns only line 1.
9. **Ref spelling**: underscores in book titles for siddur/Chofetz Chaim/Mesilat/Iggeret/Eight Chapters/Onkelos; spaces for `Mishneh Torah, …`, `Rashi on …`, `Bartenura on …`, `Steinsaltz on …`. Both are accepted by Sefaria for many books, but copy what was verified.
10. **Hebcal ≠ Sefaria spellings** of parashot (`בהעלתך` vs `בהעלותך`); Hebcal uses a hyphen in multi-word single parashot (`כי-תצא`). Hebcal needs `&i=on` for Israel.
11. **Empty Hebrew with HTTP 200** happens for English-only works. Treat as failure with a clear message.
12. **Don't cache** calendar/Hebcal responses persistently; cache only non-empty text.
13. **Day-of-year modulo schedules** repeat quickly and jump every Jan 1 – use a continuous day number.
14. Siddur seasonal text: Sefaria marks winter/summer alternatives with `<small>בחורף</small>` – convert to markers before rendering.
