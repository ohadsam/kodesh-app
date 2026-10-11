#!/usr/bin/env python3
"""Verify Sefaria refs/structure before hardcoding them (stdlib only).

  python3 sefaria_probe.py text  "Psalms.23" "Mishneh Torah, Prayer and the Priestly Blessing 4"
  python3 sefaria_probe.py calendar [YYYY-MM-DD] [--diaspora]
  python3 sefaria_probe.py index  Duties_of_the_Heart        # title, categories, schema nodes
  python3 sefaria_probe.py shape  Duties_of_the_Heart        # chapter lengths
  python3 sefaria_probe.py links  "Sanhedrin 2a" [CollectiveTitle]   # e.g. Rashi, Tosafot
  python3 sefaria_probe.py commentaries "Tanya,_Part_I;_Likkutei_Amarim.1"
  python3 sefaria_probe.py tocheck-all                       # the project's known refs (see references/refs-catalog.md)

Env: SEFARIA_BASE overrides https://www.sefaria.org/api/ (for mocks / sefaria.org.il).
Exit code 0 = every probed ref had Hebrew text; 1 = something failed (so it can gate CI).
"""
import json, os, sys, urllib.parse, urllib.request, datetime

BASE = os.environ.get('SEFARIA_BASE', 'https://www.sefaria.org/api/').rstrip('/') + '/'
failed = False


def get(path, timeout=30):
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception as e:
        return {'_error': f'{type(e).__name__}: {e}'}


def quote(ref):  # keep , _ . : ; - (Sefaria accepts spaces as %20 too)
    return urllib.parse.quote(ref, safe=",_.:;-")


def walk(x, out):
    if isinstance(x, list):
        for i in x: walk(i, out)
    elif isinstance(x, str) and x.strip():
        out.append(x)
    return out


def shape_of(he):
    """'flat' | '2d' | '3d+' | 'str' | 'empty' – branch on this, never trust len() (Sefaria shapes are unstable)."""
    if isinstance(he, str): return 'str'
    if not isinstance(he, list) or not he: return 'empty'
    depth, cur = 1, he
    while cur and isinstance(cur[0], list):
        depth += 1; cur = cur[0]
    return {1: 'flat', 2: '2d'}.get(depth, '3d+')


def cmd_text(refs):
    global failed
    for ref in refs:
        d = get(f'texts/{quote(ref)}?lang=he&commentary=0&context=0')
        if '_error' in d:
            print(f'FAIL {ref!r}: {d["_error"]}'); failed = True; continue
        if d.get('error'):
            print(f'FAIL {ref!r}: Sefaria error: {d["error"]}'); failed = True; continue
        segs = walk(d.get('he'), [])
        ok = bool(segs)
        failed |= not ok
        print(f'{"OK  " if ok else "FAIL"} {ref!r}: ref={d.get("ref")!r} heRef={d.get("heRef")!r} shape={shape_of(d.get("he"))} '
              f'segments={len(segs)} chars={sum(map(len, segs))} sections={d.get("sections")} toSections={d.get("toSections")} '
              f'warnings={d.get("warnings")}')
        if segs: print('     sample:', segs[0][:70].replace('\n', ' '))


def cmd_calendar(args):
    day = next((a for a in args if a[0].isdigit()), None)
    d = datetime.date.fromisoformat(day) if day else datetime.date.today()
    dia = '1' if '--diaspora' in args else '0'
    cal = get(f'calendars?diaspora={dia}&year={d.year}&month={d.month}&day={d.day}')
    if '_error' in cal: print(cal['_error']); sys.exit(1)
    for it in cal.get('calendar_items', []):
        print(f'{(it.get("title") or {}).get("en")!s:35} | {(it.get("title") or {}).get("he")!s:20} | ref={it.get("ref")!r} | heRef={it.get("heRef")!r} | {(it.get("displayValue") or {}).get("en")}')


def nodes(schema, depth=0):
    for n in schema.get('nodes', []) or []:
        print('  ' * depth + f'- {n.get("title") or n.get("key")} | {n.get("heTitle", "")}')
        nodes(n, depth + 1)


def cmd_index(titles):
    for t in titles:
        d = get(f'v2/index/{quote(t)}')
        if '_error' in d: print(t, d['_error']); continue
        print(t, '→', d.get('title'), '|', d.get('heTitle'), '| categories', d.get('categories'), '| lang', d.get('languages') or d.get('versionState'))
        nodes(d.get('schema', {}))


def cmd_shape(titles):
    for t in titles:
        print(t, json.dumps(get(f'shape/{quote(t)}'), ensure_ascii=False)[:1500])


def cmd_links(ref, title=None):
    d = get(f'links/{quote(ref)}?with_text=0')
    if not isinstance(d, list): print(d); return
    counts = {}
    for l in d:
        ct = (l.get('collectiveTitle') or {}).get('en') or l.get('index_title')
        if title and ct != title: continue
        counts[(l.get('category'), ct)] = counts.get((l.get('category'), ct), 0) + 1
    for (cat, ct), n in sorted(counts.items(), key=lambda kv: -kv[1]): print(f'{n:5}  {cat} / {ct}')
    print('total links', len(d))


def cmd_known():
    refs = [  # keep in sync with references/refs-catalog.md
        'Psalms.23', 'Genesis.1', 'Onkelos_Genesis.1', 'Rashi on Genesis 1', 'Iggeret_HaRamban',
        'Eight_Chapters.1', 'Mesillat_Yesharim,_Introduction', 'Mesillat_Yesharim.1', 'Kuzari.1.1',
        'Chafetz_Chaim,_Part_One,_The_Prohibition_Against_Lashon_Hara,_Principle_1',
        'Chafetz_Chaim,_Part_Two,_The_Prohibition_Against_Rechilut,_Principle_1',
        'Weekday_Siddur_Sefard_Linear,_The_Morning_Prayers,_Shemoneh_Esrei',
        'Mishneh Torah, Prayer and the Priestly Blessing 4', 'Steinsaltz on Mishneh Torah, Prayer and the Priestly Blessing 4:1-20',
        'Rashi on Sanhedrin 2a', 'Tosafot on Sanhedrin 2a', 'Bartenura on Mishnah Berakhot 1:1',
        'Covenant_and_Conversation;_Hebrew_Edition,_Bereshit,_1',
    ]
    cmd_text(refs)


if __name__ == '__main__':
    if len(sys.argv) < 2: print(__doc__); sys.exit(2)
    c, a = sys.argv[1], sys.argv[2:]
    {'text': lambda: cmd_text(a), 'calendar': lambda: cmd_calendar(a), 'index': lambda: cmd_index(a),
     'shape': lambda: cmd_shape(a), 'links': lambda: cmd_links(*a[:2]), 'commentaries': lambda: cmd_links(a[0]),
     'tocheck-all': cmd_known}.get(c, lambda: (print(__doc__), sys.exit(2)))()
    sys.exit(1 if failed else 0)
