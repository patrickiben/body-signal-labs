#!/usr/bin/env python3
"""Every page the Pages deploy ships may only link to local files the deploy also ships.

The deploy copies an explicit list of files (.github/workflows/pages.yml). A page added to the site but left off
that list would build, pass every browser test, and still 404 on the live site. This replays every cp line of the
deploy to get the shipped set (folders and globs included), then resolves every relative href and src in every
shipped page, from that page's own folder, and checks it is shipped. Links that leave the site (http, or ../ above
the site root to a sibling site) are not this deploy's files and are skipped.
"""
import glob, posixpath, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
pages_yml = (ROOT / '.github/workflows/pages.yml').read_text()


def staged():
    out = set()
    for line in pages_yml.splitlines():
        m = re.match(r'\s*cp\s+(.*)$', line)
        if not m:
            continue
        toks = m.group(1).split()
        rec = toks[0] == '-R'
        if rec:
            toks = toks[1:]
        dest = re.sub(r'^_site/?', '', toks[-1])
        for src in toks[:-1]:
            for f in sorted(glob.glob(str(ROOT / src))) or [str(ROOT / src)]:
                rel = Path(f).relative_to(ROOT).as_posix()
                if rec:
                    for g in Path(f).rglob('*'):
                        if g.is_file():
                            out.add(posixpath.join(dest, g.relative_to(f).as_posix()))
                elif dest and not dest.endswith('/'):
                    out.add(dest)
                else:
                    out.add(posixpath.join(dest, posixpath.basename(rel)))
    return out


shipped = staged()
bad = []
pages = sorted(f for f in shipped if f.endswith('.html'))
for page in pages:
    html = (ROOT / page).read_text(encoding='utf-8', errors='replace')
    for href in sorted(set(re.findall(r'''(?:href|src)\s*=\s*["']([^"'${}]+)["']''', html))):
        t = href.split('#')[0].split('?')[0].strip()
        if not t or re.match(r'^(https?:|mailto:|data:|javascript:|blob:|//)', t):
            continue
        target = posixpath.normpath(posixpath.join(posixpath.dirname(page), t))
        if target.startswith('..'):
            continue
        if target not in shipped:
            bad.append(f'{page} links to {href}, which the Pages deploy does not ship')
if not shipped:
    bad.append('could not read the file list from .github/workflows/pages.yml')
print('shipped pages:', ' '.join(pages))
for b in bad:
    print('FAIL:', b)
print('site links:', 'all shipped' if not bad else f'{len(bad)} missing')
sys.exit(1 if bad else 0)
