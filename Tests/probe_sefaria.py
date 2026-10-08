#!/usr/bin/env python3
"""Network probe for Sefaria content we might add (NOT part of test_runner.py).

Run on a machine that can reach sefaria.org:   python3 Tests/probe_sefaria.py
Prints, for each candidate book: whether a Hebrew text exists, the section
structure (so unit lengths can be planned) and, for Tanya, which commentaries
are linked. Also lists the daily-learning calendars Sefaria publishes.
Paste the output back so the data tables in js/ can be written from verified refs
(CLAUDE.md §1: never hardcode an unverified Sefaria ref).
"""
import json, sys, urllib.parse, urllib.request

API = 'https://www.sefaria.org/api/'


def get(path, timeout=25):
    try:
        with urllib.request.urlopen(API + path, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception as e:  # network blocked, 404, bad JSON …
        return {'_error': f'{type(e).__name__}: {e}'}


def q(ref):
    return urllib.parse.quote(ref, safe=',_.:')


def he_len(ref):
    d = get(f'texts/{q(ref)}?lang=he&commentary=0&context=0')
    if '_error' in d:
        return d['_error']
    he = d.get('he')
    flat = []
    def walk(x):
        if isinstance(x, list):
            for i in x: walk(i)
        elif isinstance(x, str) and x.strip():
            flat.append(x)
    walk(he)
    return f'{len(flat)} Hebrew segments, {sum(map(len, flat))} chars, top-level len={len(he) if isinstance(he, list) else "str"}'


def nodes(schema, prefix=''):
    for n in schema.get('nodes', []) or []:
        yield prefix + n.get('title', n.get('key', '?')), n.get('heTitle', '')
        yield from nodes(n, prefix)


print('== daily-learning calendars ==')
cal = get('calendars')
for it in cal.get('calendar_items', []) or []:
    print(' ', (it.get('title') or {}).get('en'), '|', (it.get('title') or {}).get('he'), '|', it.get('ref'), '|', (it.get('displayValue') or {}).get('en'))
if '_error' in cal: print(' ', cal['_error'])

for title in ('Duties_of_the_Heart', 'Chovat_HaTalmidim', 'Tanya'):
    print(f'\n== {title} ==')
    idx = get(f'v2/index/{title}')
    if '_error' in idx:
        print(' index:', idx['_error']); continue
    print(' title:', idx.get('title'), '|', idx.get('heTitle'), '| categories:', idx.get('categories'))
    for en, he in nodes(idx.get('schema', {})):
        print('   node:', en, '|', he)
    shape = get(f'shape/{title}')
    print(' shape:', json.dumps(shape, ensure_ascii=False)[:800])

print('\n== Hebrew availability / size per candidate ref ==')
for ref in ('Duties_of_the_Heart,_First_Treatise_on_Unity', 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust',
            'Duties_of_the_Heart,_Third_Treatise_on_Service_of_God', 'Duties_of_the_Heart,_Seventh_Treatise_on_Repentance',
            'Chovat_HaTalmidim,_Introduction', 'Chovat_HaTalmidim.1', 'Chovat_HaTalmidim.10', 'Chovat_HaTalmidim.11'):
    print(' ', ref, '→', he_len(ref))

print('\n== Tanya commentaries (links on Likkutei Amarim 1) ==')
links = get('links/' + q('Tanya,_Part_I;_Likkutei_Amarim.1') + '?with_text=0')
if isinstance(links, list):
    counts = {}
    for l in links:
        if l.get('category') == 'Commentary':
            k = l.get('collectiveTitle', {}).get('en') or l.get('index_title')
            counts[k] = counts.get(k, 0) + 1
    for k, v in sorted(counts.items(), key=lambda kv: -kv[1]): print(' ', k, v)
    print('  total links:', len(links))
else:
    print(' ', links)
