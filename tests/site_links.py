#!/usr/bin/env python3
"""Every page the Pages deploy ships may only link to local pages the deploy also ships.

The deploy copies an explicit list of files (.github/workflows/pages.yml). A page added to the site but left off
that list would build, pass every browser test, and still 404 on the live site. This reads the list and checks every
relative .html link in the shipped pages against it.
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
pages_yml = (ROOT / '.github/workflows/pages.yml').read_text()
cp = re.search(r'^\s*cp ([^\n]*) _site/\s*$', pages_yml, re.M)
shipped = set(cp.group(1).split()) if cp else set()
bad = []
for page in sorted(f for f in shipped if f.endswith('.html')):
    html = (ROOT / page).read_text(encoding='utf-8', errors='replace')
    for href in sorted(set(re.findall(r'href="([^"#?:]+\.html)(?:[#?][^"]*)?"', html))):
        target = href.split('/')[-1] if '/' not in href.strip('./') else href
        if href.startswith(('http', '//')) or '/' in href.strip('./'):
            continue
        if target not in shipped:
            bad.append(f'{page} links to {href}, which the Pages deploy does not ship')
if not shipped:
    bad.append('could not read the file list from .github/workflows/pages.yml')
print('shipped pages:', ' '.join(sorted(f for f in shipped if f.endswith('.html'))))
for b in bad:
    print('FAIL:', b)
print('site links:', 'all shipped' if not bad else f'{len(bad)} missing')
sys.exit(1 if bad else 0)
