#!/usr/bin/env python3
"""Build the "Itim Stam" web fonts: Culmus' Stam Ashkenaz / Stam Sefarad CLM (letters in sofer script)
plus nikud + ta'amim, so a Torah-scroll style text can show those layers in the SAME font.

Why: the Stam CLM fonts have empty glyphs for every point and accent (a Torah scroll has none), and a
browser cannot mix a letter from one font with the marks of another. So the mark OUTLINES are copied
from Keter YG (also Culmus, the same GPL-2 + font-embedding exception) and a small GPOS table
(mark-to-base + mark-to-mark) positions them on the Stam letters.

Inputs (not in the repo; both ship in the Debian/Ubuntu package `culmus`):
    apt-get download culmus && dpkg-deb -x culmus_*.deb out/   # → out/usr/share/fonts/truetype/culmus/
Usage:
    python3 tools/build_stam_pointed.py <dir with StamAshkenazCLM.ttf, StamSefaradCLM.ttf, KeterYG-Medium.ttf> [outdir=fonts]
Needs fontTools (pip install fonttools brotli).
"""
import sys, os
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
import unicodedata

NIKUD_BELOW = [0x5B0, 0x5B1, 0x5B2, 0x5B3, 0x5B4, 0x5B5, 0x5B6, 0x5B7, 0x5B8, 0x5BB, 0x5C7]
NIKUD_ABOVE = [0x5B9, 0x5BA, 0x5BF, 0x5C4]
DAGESH, METEG, SHINDOT, SINDOT = 0x5BC, 0x5BD, 0x5C1, 0x5C2
TAAMIM = list(range(0x591, 0x5B0))
MARKS = TAAMIM + NIKUD_BELOW + NIKUD_ABOVE + [DAGESH, METEG, SHINDOT, SINDOT, 0x5C5]
# Keter YG draws marks for a letter whose body is ~y -75…1140 centred at x=0; the Stam letters are taller
# (bet 0…1410, lamed 0…2254) so the "above" marks are lifted by the letter's extra height.
KETER_TOP, KETER_MID = 1140.0, 520.0
GAP_ABOVE = 70
MARK_SCALE = 1.2          # Keter's marks are sized for its smaller letters; the Stam letters are ~25% bigger

def bounds(gs, g):
    p = BoundsPen(gs); gs[g].draw(p); return p.bounds

def build(stam_path, keter_path, out_path, family):
    S, K = TTFont(stam_path), TTFont(keter_path)
    sc, kc = S.getBestCmap(), K.getBestCmap()
    sg, kg = S.getGlyphSet(), K.getGlyphSet()
    glyf, hmtx = S['glyf'], S['hmtx']
    names = {}
    for cp in MARKS:
        if cp not in kc or cp not in sc:
            continue
        pen = TTGlyphPen(kg)
        kg[kc[cp]].draw(TransformPen(pen, (MARK_SCALE, 0, 0, MARK_SCALE, 0, 0)))
        g = sc[cp]
        glyf[g] = pen.glyph()
        glyf[g].recalcBounds(glyf)
        hmtx[g] = (0, getattr(glyf[g], 'xMin', 0))
        names[cp] = g
    # --- base letters (incl. finals) and their reference points
    letters = {cp: sc[cp] for cp in range(0x5D0, 0x5EB) if cp in sc}
    fea = ['languagesystem DFLT dflt;', 'languagesystem hebr dflt;']
    fea.append('@LETTERS = [%s];' % ' '.join(letters.values()))
    allmarks = [names[c] for c in MARKS if c in names]
    fea.append('table GDEF { GlyphClassDef @LETTERS, , [%s], ; } GDEF;' % ' '.join(allmarks))
    classes = {  # class → code points; every mark in a class shares the class's base anchor
        'ABOVE': [c for c in TAAMIM if unicodedata.combining(chr(c)) in (228, 230, 232)] + NIKUD_ABOVE,
        'BELOW': [c for c in TAAMIM if unicodedata.combining(chr(c)) in (218, 220, 222)] + NIKUD_BELOW + [METEG, 0x5C5],
        'DAGESH': [DAGESH], 'SHINDOT': [SHINDOT], 'SINDOT': [SINDOT],
    }
    for cls, cps in classes.items():
        for c in cps:
            if c in names:
                fea.append('markClass %s <anchor 0 0> @M_%s;' % (names[c], cls))
    base = ['feature mark {']
    for cp, g in letters.items():
        b = bounds(sg, g)
        if not b: continue
        x0, y0, x1, y1 = b
        cx = (x0 + x1) / 2.0
        if cp in (0x5DC,):                        # lamed: the hook sticks out left, centre the body
            cx = (x0 + 300 + x1) / 2.0
        top = y1 - KETER_TOP + GAP_ABOVE if y1 > KETER_TOP else 0
        top = max(top, 0)
        bottom = min(0, y0)
        mid = (min(y1, 1410) / 2.0) - KETER_MID
        base.append('  pos base %s <anchor %d %d> mark @M_ABOVE;' % (g, cx, top))
        base.append('  pos base %s <anchor %d %d> mark @M_BELOW;' % (g, cx, bottom))
        base.append('  pos base %s <anchor %d %d> mark @M_DAGESH;' % (g, cx, mid))
        if cp == 0x5E9:                           # shin: the dots sit over the right / left prong
            base.append('  pos base %s <anchor %d %d> mark @M_SHINDOT;' % (g, cx, top))
            base.append('  pos base %s <anchor %d %d> mark @M_SINDOT;' % (g, cx, top))
    base.append('} mark;')
    fea += base
    # trop below a vowel below: hang it under the vowel, not through it
    vb = [names[c] for c in NIKUD_BELOW if c in names]
    tb = [names[c] for c in classes['BELOW'] if c in names and c in TAAMIM]
    fea.append('markClass [%s] <anchor 0 -20> @MM_TROP_BELOW;' % ' '.join(tb))
    mk = ['feature mkmk {']
    for c in NIKUD_BELOW:
        if c not in names: continue
        b = bounds(kg, kc[c]); ymin = b[1] * MARK_SCALE if b else -400
        mk.append('  pos mark %s <anchor 0 %d> mark @MM_TROP_BELOW;' % (names[c], int(ymin) - 120))
    mk.append('} mkmk;')
    fea += mk
    # remove the old (empty) layout tables, then compile ours
    for t in ('GPOS', 'GDEF'):
        if t in S: del S[t]
    addOpenTypeFeaturesFromString(S, '\n'.join(fea), tables=['GPOS', 'GDEF'])
    # naming (the fonts are modified versions: a new family name, original credits kept)
    for rec in list(S['name'].names):
        if rec.nameID in (1, 16): rec.string = family
        elif rec.nameID == 4: rec.string = family + ' Regular'
        elif rec.nameID == 6: rec.string = family.replace(' ', '') + '-Regular'
        elif rec.nameID == 3: rec.string = family + ' 1.0'
    S['name'].setName('Modified for the Itim app: nikud and ta\'amim outlines from Keter YG (Yoram Gnat) positioned on the Stam letters. GPL-2 with font exception; see fonts/LICENSE-Culmus.txt.', 10, 3, 1, 0x409)
    S['OS/2'].usWeightClass = 400
    S.save(out_path)
    if out_path.endswith('.ttf'):
        try:
            from fontTools.ttLib import woff2  # noqa: F401  (needs brotli)
            S.flavor = 'woff2'; S.save(out_path[:-4] + '.woff2')
        except Exception as e:
            print('woff2 skipped:', e)
    print('wrote', out_path, os.path.getsize(out_path), 'bytes')

if __name__ == '__main__':
    src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'fonts'
    os.makedirs(out, exist_ok=True)
    keter = os.path.join(src, 'KeterYG-Medium.ttf')
    build(os.path.join(src, 'StamAshkenazCLM.ttf'), keter, os.path.join(out, 'ItimStamAshkenaz.ttf'), 'Itim Stam Ashkenaz')
    build(os.path.join(src, 'StamSefaradCLM.ttf'), keter, os.path.join(out, 'ItimStamSefarad.ttf'), 'Itim Stam Sefarad')
