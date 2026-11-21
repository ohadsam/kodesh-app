# fonts/

`ItimStamAshkenaz.*` and `ItimStamSefarad.*` – Torah-scroll (sofer / "Stam") letters **with** nikud and ta'amim,
used by the "תיקון קוראים" view of the parasha tab.

They are **modified versions** of *Stam Ashkenaz CLM* and *Stam Sefarad CLM* (© Yoram Gnat, Culmus project),
whose point and accent glyphs are empty by design (a Torah scroll has none). The nikud/ta'amim outlines are
taken from *Keter YG* (© Yoram Gnat, Culmus, same licence) and attached to the Stam letters with a small
OpenType GPOS table. Rebuild with `python3 tools/build_stam_pointed.py <culmus font dir>` (see the script header).

Licence: GNU GPL v2 **with the font-embedding exception** (`LICENSE-Culmus.txt`, `LICENSE-GPL-2.0.txt`):
a document / web page that embeds the font is not itself covered by the GPL. The fonts are renamed because they are
modified; the original copyright notices are kept in the font's name table.
