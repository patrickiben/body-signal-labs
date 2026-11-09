#!/usr/bin/env python3
"""Customize route, on the rendered Endless Cockpit, with real clicks and keys.

Expected answers, written before the first run:
  Golden coast's own road reads 5.3% steepest, 191 m tightest bend, 4.5 m across.
  Hills at the end of its range reads 16.7%, and the page's own road then measures 16.7% steepest (within 1%).
  Bends at the start of its range reads "straight", and the road never turns. Width at its start reads 2.0 m.
  The custom route holds on Red canyon, survives a reload and a ride file, and "This landscape's own road" restores it.
Exit 1 if any check fails.
"""
import http.server, io, json, sys, tempfile, threading
from functools import partial
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()); OUT.mkdir(parents=True, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(Q, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_port}/endless-cockpit.html'
GPU = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl']
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)
READ = """() => { const S = __app.S, m = __app.sceneNow(), t = (id) => document.getElementById(id).textContent;
  return { custom: S.custom, active: document.getElementById('custom-button').dataset.active, next: S.biomeNext, t: S.biomeT,
    climb: m.climb, bend: m.bend, width: m.width, grade: t('cr-grade-v'), bendv: t('cr-bend-v'), widthv: t('cr-width-v'),
    own: [t('cr-grade-own'), t('cr-bend-own'), t('cr-width-own')], caption: t('route-caption') }; }"""
# the steepest grade and the most the road turns over 20 km at 14 layouts, on the road the page is drawing now
MEASURE = """() => { const sc = __app.sceneNow(); let g = 0, x = 0;
  for (let seed = 0; seed < 40; seed += 3) for (let z = 0; z < 20000; z += 2.5) { g = Math.max(g, Math.abs(CyclingScene.gradeAt(z, seed, sc))); x = Math.max(x, Math.abs(CyclingScene.pathX(z, seed, sc))); }
  return { grade: g, maxX: x }; }"""
PIN = "() => { window.__pin = 60; if (!window.__pinned) { window.__pinned = 1; const f = () => { if (window.__pin != null) __app.S.vis = window.__pin; requestAnimationFrame(f); }; requestAnimationFrame(f); } }"
def grab(pg):
    png = pg.screenshot(type='png'); return np.asarray(Image.open(io.BytesIO(png)).convert('L').resize((160, 90), Image.BOX), dtype=np.float32), png
def key(pg, sel, k):
    pg.focus(sel); pg.keyboard.press(k)

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True, args=GPU)
    c = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, reduced_motion='no-preference')
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    pg.goto(URL); pg.wait_for_function('window.__app && window.__app.S'); pg.wait_for_timeout(1500)
    r = pg.evaluate("() => ({ active: document.getElementById('custom-button').dataset.active, open: document.getElementById('custom-sheet').open })")
    check('a fresh visit shows Customize route, off, with the panel closed', r == {'active': 'false', 'open': False}, json.dumps(r))
    pg.click('#custom-button'); pg.wait_for_timeout(400)
    r = pg.evaluate(READ)
    check('the panel opens on Golden coast\'s own road: 5.3%, 191 m, 4.5 m', [r['grade'], r['bendv'], r['widthv']] == ['5.3%', '191 m', '4.5 m'] and r['own'][0] == "Golden coast's own: 5.3%", json.dumps([r['grade'], r['bendv'], r['widthv'], r['own']]))

    key(pg, '#cr-grade', 'End'); pg.wait_for_timeout(2200)
    r = pg.evaluate(READ); m = pg.evaluate(MEASURE)
    check('Hills to the end reads 16.7% and the road measures 16.7% steepest', r['grade'] == '16.7%' and abs(m['grade'] - .167) / .167 < .01 and r['active'] == 'true', json.dumps([r['grade'], m['grade'], r['active']]))
    key(pg, '#cr-bend', 'Home'); key(pg, '#cr-width', 'Home'); pg.wait_for_timeout(2200)
    r = pg.evaluate(READ); m = pg.evaluate(MEASURE)
    check('Bends to the start reads straight and the road never turns', r['bendv'] == 'straight' and m['maxX'] == 0, json.dumps([r['bendv'], m['maxX']]))
    check('Road width to the start reads 2.0 m and the road is 2 m across', r['widthv'] == '2.0 m' and r['width'] == 1, json.dumps([r['widthv'], r['width']]))
    check('the caption under the tiles names your route', r['caption'] == 'Golden coast · your route: steepest 16.7%, straight, 2.0 m wide', r['caption'])
    side = pg.evaluate("() => { const c = document.getElementById('cr-top').getContext('2d').getImageData(0, 0, 880, 120).data; let lit = 0; for (let i = 3; i < c.length; i += 4) if (c[i] > 0) lit++; return lit; }")
    check('the previews are drawn', side > 500, side)

    # the picture: your route against the landscape's own road, camera pinned at the same spot
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.add_style_tag(content='body.shot *{visibility:hidden !important} body.shot #stage{visibility:visible !important}')
    pg.evaluate(PIN); pg.evaluate("() => document.body.classList.add('shot')"); pg.wait_for_timeout(1800)
    mine, png = grab(pg); (OUT / 'custom-golden-coast.png').write_bytes(png)
    pg.evaluate("() => document.body.classList.remove('shot')")
    pg.click('#custom-button'); pg.wait_for_timeout(300); pg.click('#cr-own'); pg.keyboard.press('Escape')
    pg.evaluate("() => document.body.classList.add('shot')"); pg.wait_for_timeout(2600)
    owned, png = grab(pg); (OUT / 'own-golden-coast.png').write_bytes(png)
    pg.evaluate("() => { document.body.classList.remove('shot'); window.__pin = null; }")
    d = np.abs(mine - owned)
    check('the picture changes: your route differs from the landscape\'s own road', d.mean() > 2 and (d > 6).mean() > .05, f'{d.mean():.2f} levels, {(d > 6).mean() * 100:.0f}% of the picture')
    r = pg.evaluate(READ)
    check('This landscape\'s own road puts it back exactly', r['custom'] == {'grade': None, 'curv': None, 'width': None} and r['climb'] == 1 and r['bend'] == 1 and r['width'] == 2.25 and r['active'] == 'false' and not r['caption'].startswith('Golden coast · your route'), json.dumps(r))

    # it holds across landscapes
    pg.click('#custom-button'); pg.wait_for_timeout(300); key(pg, '#cr-grade', 'End'); pg.keyboard.press('Escape')
    pg.click('.scene-tile[data-b="4"]'); pg.wait_for_timeout(6800)
    r = pg.evaluate(READ); m = pg.evaluate(MEASURE)
    check('the custom route holds on Red canyon: still 16.7% steepest', r['next'] == 4 and abs(m['grade'] - .167) / .167 < .01 and r['caption'].startswith('Red canyon · your route: steepest 16.7%'), json.dumps([r['next'], m['grade'], r['caption']]))

    # it survives a reload
    pg.reload(); pg.wait_for_function('window.__app && window.__app.S'); pg.wait_for_timeout(1200)
    r = pg.evaluate(READ)
    check('the custom route comes back on the next visit', r['custom']['grade'] == .167 and r['active'] == 'true' and r['next'] == 4, json.dumps([r['custom'], r['active'], r['next']]))

    # a ride file keeps it and replays it
    rec = pg.evaluate("""async () => { __app.ride.startRecording('endless-cockpit', false); __app.setCustom({ grade: .05, curv: 1 / 60, width: 3.8 });
        await new Promise((r) => setTimeout(r, 400)); const s = JSON.parse(JSON.stringify(__app.ride.stopRecording()));
        __app.setCustom({ grade: null, curv: null, width: null }); __app.ride.startReplay(s); await new Promise((r) => setTimeout(r, 2500));
        return { start: s.lanes.routeStart[0][1].custom, lane: s.lanes.custom && s.lanes.custom.slice(-1)[0][1], now: __app.S.custom, width: __app.sceneNow().width }; }""")
    check('a ride file holds the custom route and replays it', rec['lane'] == {'grade': .05, 'curv': 1 / 60, 'width': 3.8} and rec['now'] == rec['lane'] and rec['width'] == 3.8, json.dumps(rec))
    pg.evaluate("() => __app.ride.stopReplay()")
    check('no page errors', not errs, json.dumps(errs))
    b.close()

    # phones: the button shows, and the panel's controls fit across the screen
    for size, label in (((393, 852), 'upright'), ((852, 393), 'held sideways'), ((375, 667), 'small upright')):
        b = p.chromium.launch(channel='chrome', headless=True, args=GPU)
        c = b.new_context(viewport={'width': size[0], 'height': size[1]}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = c.new_page(); pg.goto(URL); pg.wait_for_function('window.__app && window.__app.S'); pg.wait_for_timeout(1200)
        if label == 'held sideways':      # sideways phones start with the controls hidden; a tap on the scenery brings them back
            pg.tap('#stage', position={'x': size[0] / 2, 'y': size[1] * .3}); pg.wait_for_timeout(600)
        across = "(s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1; }"
        btn = pg.evaluate(across, '#custom-button') and pg.evaluate("() => { const r = document.getElementById('custom-button').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }")
        pg.tap('#custom-button'); pg.wait_for_timeout(500)
        fits = [pg.evaluate(across, s) for s in ('#cr-grade', '#cr-bend', '#cr-width', '#cr-side', '#cr-top', '#cr-own')]
        sideways = pg.evaluate("() => document.documentElement.scrollWidth > innerWidth")
        pg.screenshot(path=str(OUT / f'phone-{label.replace(" ", "-")}.png'))
        check(f'a phone {label}: the button shows, and every control fits across', btn and all(fits) and not sideways, json.dumps([btn, fits, sideways]))
        b.close()

print(f"{sum(results)} of {len(results)} checks passed. Screenshots in {OUT}")
sys.exit(0 if all(results) else 1)
