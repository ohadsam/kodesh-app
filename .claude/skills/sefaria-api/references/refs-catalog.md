# Refs catalog – every Sefaria ref the Itim app uses

Provenance tags — be strict about which one applies before relying on a line:
- **[prod]** used by the shipped app (worked on real devices when written; Sefaria was reachable then).
- **[test]** also asserted by `Tests/test_api_sefaria.py` (passes only with network).
- **[search]** exists per web search of sefaria.org URLs (Oct 2026) but NOT fetched – Hebrew availability and lengths unknown.
- **[unverified]** guess/expectation – verify with `scripts/sefaria_probe.py` first.
The sandbox that wrote this skill could not reach sefaria.org (egress policy), so nothing here was re-verified in Oct 2026.

## Daily-learning calendar `/api/calendars?diaspora=0&year=Y&month=M&day=D`
Items matched by `title.en`/`title.he` substring: Daf Yomi ([prod][test]), Mishnah Yomi ([prod][test]), Daily Rambam ([prod][test]; ref is a chapter ref, no `:`; may be a range `Book 5-6`), 929 ([prod]; Tanakh chapter ref). Other cycles Sefaria publishes (Halakhah Yomit, Tanya Yomi, Arukh HaShulchan Yomi, Daf-a-Week, Yerushalmi Yomi, Chofetz Chaim Yomi …) are **[unverified]** – list the day's `calendar_items` with `sefaria_probe.py calendar`.

## Tanakh
- Tehilim: `Psalms.{1..150}`; Psalm 119 is split in the app into verses 1-88 / 89-176 by slicing the flat verse list [prod]. Day-of-month schedule is static in `js/tehilim.js` (`TEHILIM_SCHEDULE`, 30 days).
- Torah aliyot: refs come from **Hebcal leyning** (`Leviticus 9:1-9:16`) or the static `PARASHA_ALIYOT` table in `js/content.js` [prod]; text = `Genesis.1` style or the range ref.
- Haftara: Hebcal `leyning.haftara` (`I Kings 18:46-19:21`) or static `HAFTARA_REFS` (Ashkenaz, Israel) [prod]. Normalise `\s*-\s*` → `-`.
- Onkelos: `Onkelos_Genesis.{ch}`, `Onkelos_Exodus`, `Onkelos_Leviticus`, `Onkelos_Numbers`, `Onkelos_Deuteronomy` – fetch per chapter, slice verses [prod].
- Rashi on Torah: `Rashi on Genesis {ch}` → fallback `…:start-end` range → fallback `texts/{Book ch}?commentary=1` [prod]. See pitfalls #7.
- Rabbi Sacks (Hebrew): `Covenant_and_Conversation;_Hebrew_Edition,_{Name},_{1..3}` with Name from `SACKS_REFS` (`Bereshit`, `Noach`, `Lech_Lecha`, `Vayeitze`, `Beha'alotcha`, `Sh'lach`, `Re_eh`, `Ki_Teitzei`, `Vezot_Habracha`…) [prod]; the test file uses a different, English spelling `Covenant and Conversation, Bereshit 1` [test] – the two are not the same string.

## Talmud / Mishnah / Rambam
- Daf: ref from calendar (`Chullin 2`, defaults to 2a); picker uses `Berakhot.5a`. Text `texts/{ref}` [prod][test]. Commentary via `/api/links/{ref}?with_text=1&lang=he` filter `Rashi`/`Tosafot` [prod]; `Rashi on Sanhedrin 2a`, `Tosafot on Sanhedrin 2a` text calls [test]. Steinsaltz view: `Steinsaltz on {ref}` [prod].
- Mishnah: calendar ref; commentary `Bartenura on {mishnaRef}` (e.g. `Bartenura on Mishnah Berakhot 1:1`) [prod][test].
- Rambam: `Mishneh Torah, Prayer and the Priestly Blessing 4` [prod][test]; Steinsaltz `Steinsaltz on Mishneh Torah, Prayer and the Priestly Blessing 4:1-{halachotCount}` [prod][test]; plain-chapter Steinsaltz ref returns a single halacha – use the range.

## Prayer (siddur engine, `js/siddur.js`, `js/siddur-inserts.js`)
Bases: Sfard `Weekday_Siddur_Sefard_Linear`, Ashkenaz `Siddur_Ashkenaz`, Edot HaMizrach `Siddur_Edot_HaMizrach`. Ref = `{Base},_{Path}` with underscores and commas, e.g.
- `Weekday_Siddur_Sefard_Linear,_The_Morning_Prayers,_Shemoneh_Esrei` [prod][test]
- `Weekday_Siddur_Sefard_Linear,_The_Morning_Prayers,_Upon_Arising_in_the_Morning` / `…,_Putting_On_the_Tallis` / `…,_Putting_on_the_Tefillin` (note lower-case "on") [prod]
- `Siddur_Ashkenaz,_Weekday,_Shacharit,_Preparatory_Prayers,_Modeh_Ani`, `…,_Tallit`, `…,_Tefillin`, `…,_Morning_Blessings`, `…,_Torah_Blessings` [prod]
- `Siddur_Edot_HaMizrach,_Preparatory_Prayers,_Modeh_Ani` / `…,_Morning_Blessings` / `…,_Torah_Blessings` [prod]
- Birkat HaMazon (tried in order): Sfard `Weekday_Siddur_Sefard_Linear,_Birkas_Hamazon,_Birkas_Hamazon` then `…,_Birkas_Hamazon`; Ashkenaz `Siddur_Ashkenaz,_Berachot,_Birkat_HaMazon` then `Siddur_Ashkenaz,_Birkat_HaMazon`; Mizrach falls back to Sfard [prod, multi-ref fallback because names are fragile].
- ~62 section refs live in `getSiddurSections()`; a path with no dedicated Ashkenaz/Mizrach ref falls back to Sfard automatically. Seasonal alternatives come as `<small>בחורף</small>`/`<small>בקיץ</small>` → markers. Some prayers (נטילת לולב, ברכות, parts of brachot) are static text, not from Sefaria, because the refs could not be verified (see AGENT.md).

## Musar / Emuna / study
- Iggeret HaRamban: `Iggeret_HaRamban` [prod].
- Lashon Hara (Chofetz Chaim): part 1 `Chafetz_Chaim,_Part_One,_The_Prohibition_Against_Lashon_Hara,_Principle_{1..10}`, part 2 `Chafetz_Chaim,_Part_Two,_The_Prohibition_Against_Rechilut,_Principle_{1..9}` [prod before v5.136; not re-fetched since – **TODO verify**, seif counts unknown].
- Kuzari: `Kuzari.{maamar}.{section}` with section counts 115/82/73/31/28 (static in `js/emuna.js`) [prod].
- Eight Chapters: `Eight_Chapters.{1..8}` [prod]. Mesilat Yesharim: `Mesillat_Yesharim,_Introduction` and `Mesillat_Yesharim.{1..26}` (two paragraphs per unit) [prod].
- 929 / Tanakh Yomi: calendar `929` item.

## Candidates found but NOT yet usable
- **Duties of the Heart / חובות הלבבות** `Duties_of_the_Heart` [search]: ten treatises — `Duties_of_the_Heart,_First_Treatise_on_Unity` (.1.7, .10.63 seen), `…,_Second_Treatise_on_Examination` (.1 seen), `…,_Fourth_Treatise_on_Trust` (.3 seen), `…,_Fifth_Treatise_on_Devotion` (.3 seen), `…,_Sixth_Treatise_on_Submission` (.1 seen), `…,_Tenth_Treatise_on_Devotion_to_God` (.5 seen); Third (Service of God), Seventh (Repentance), Eighth (Examining the Soul), Ninth (Abstinence) exact slugs **[unverified]**. Hebrew availability **[unverified]** (Sefaria's primary version appears to be an English translation).
- **Chovat HaTalmidim / חובת התלמידים** (R' Kalonymus Kalman Shapira, the Piaseczno Rebbe) `Chovat_HaTalmidim` [search]: `Chovat_HaTalmidim,_Introduction.{n}` (.8, .27 seen), `Chovat_HaTalmidim.{1,2,3,8,10}` seen; total chapters and Hebrew **[unverified]**.
- **Tanya** `Tanya` [search]: page exists; which commentaries are linked – run `sefaria_probe.py commentaries "Tanya,_Part_I;_Likkutei_Amarim.1"`. Outside Sefaria: Steinsaltz and "Lessons in Tanya" exist as print/Chabad.org works (not Sefaria links).

## Hebcal (companion API)
`hebcal.com/hebcal?v=1&cfg=json&s=on&i=on&start=…&end=…` (parasha + leyning; `i=on` = Israel, mandatory), `hebcal.com/converter?cfg=json&date=YYYY-MM-DD&g2h=1&strict=1`, `hebcal.com/zmanim?cfg=json&date=…&latitude=…&longitude=…&elevation=…&tzid=Asia/Jerusalem`. Validate fields exist before reading; Hebcal Hebrew names differ from Sefaria's.
