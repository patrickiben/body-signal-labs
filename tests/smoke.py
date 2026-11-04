#!/usr/bin/env python3
"""A short check for CI: each cockpit boots, says it is ambient, runs its demo, and the demo really moves it.
The home page and the field guide load with the suite bar and no page errors."""
import http.server, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Q)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_port}'
SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
bad = []
with sync_playwright() as p:
    for page, moving in (('endless-cockpit.html', 'Math.round(__app.S.rpm)'), ('biofeedback-path-cockpit.html', 'Math.round(__app.S.speed * 10)')):
        # a browser of its own for each page: under software rendering, a page left running starves the next one
        b = p.chromium.launch(args=SOFT)
        pg = b.new_page(); errors = []
        pg.set_default_timeout(120000)            # software rendering on the CI runner can hold a frame for many seconds
        pg.on('pageerror', lambda e: errors.append(str(e)[:200]))
        pg.goto(f'{BASE}/{page}', timeout=120000); pg.wait_for_timeout(2500)
        if pg.get_attribute('#source-badge', 'data-source') != 'ambient': bad.append(f'{page}: not ambient at load')
        pg.click('#demo-button'); pg.wait_for_timeout(4000)
        if pg.get_attribute('#source-badge', 'data-source') != 'demo': bad.append(f'{page}: demo is not labeled')
        if page == 'biofeedback-path-cockpit.html':
            pg.click('[data-mode=ride]')
        # Motion runs on frames, and software rendering on the CI runner can take seconds per frame, so wait for it
        try:
            pg.wait_for_function(f'{moving} >= 3', polling=500, timeout=90000)
        except Exception:
            pass
        v = pg.evaluate(moving)
        if v < 3: bad.append(f'{page}: the demo did not move it ({v})')
        # Moving readouts do not prove that the shared WebGL output rendered.
        # Catch black/flat canvases after postprocessing changes as well.
        try:
            # Readback waits for a rendered frame and image decoding; use the same
            # software-rendering allowance as the page's other browser operations.
            pixels = pg.evaluate("Promise.race([__app.pixel(), new Promise((_, reject) => setTimeout(() => reject(new Error('canvas readback timed out')), 120000))])")
            if pixels['mean'] < 3 or pixels['max'] - pixels['min'] < 10:
                bad.append(f'{page}: blank or flat canvas')
        except Exception as e:
            bad.append(f'{page}: canvas readback failed: {str(e)[:160]}')
        info = pg.evaluate('__app.renderInfo')
        if info['softwareRenderer'] and info['width'] * info['height'] > 82000:
            bad.append(f'{page}: software rendering exceeds its responsive scenery budget: {info}')
        scenes = pg.evaluate('__app.BIOMES.map(b=>b.name)')
        if scenes != ['Golden coast', 'Tropical preserve', 'Meadow lanes', 'New England Autumn', 'Red canyon', 'Rainbow orbit', 'Misty pines', 'Snake Way']:
            bad.append(f'{page}: shared scenery choices differ: {scenes}')
        if pg.evaluate("typeof createKit !== 'undefined' || typeof mountShell !== 'undefined'"): bad.append(f'{page}: a drum engine is on the page')
        if len(pg.query_selector_all('nav.family a')) != 4: bad.append(f'{page}: the suite bar is missing')
        if errors: bad.append(f'{page}: {errors[0]}')
        print(f'{page}: moved {v}, {len(errors)} page errors')
        b.close()
    b = p.chromium.launch(args=SOFT)
    for page in ('index.html', 'field-guide.html'):
        pg = b.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)[:200]))
        pg.goto(f'{BASE}/{page}'); pg.wait_for_timeout(500)
        if len(pg.query_selector_all('nav.family a')) != 4: bad.append(f'{page}: the suite bar is missing')
        if errors: bad.append(f'{page}: {errors[0]}')
        print(f'{page}: {len(errors)} page errors')
        pg.close()
    b.close()
srv.shutdown()
print('\n'.join(bad) or 'smoke passed')
sys.exit(1 if bad else 0)
