#!/usr/bin/env python3
"""Measure flicker on the rendered page with the WCAG 2.2 general flash definition.

A flash is a pair of opposing changes of at least 10% of maximum relative luminance, where the darker
image is below 0.80. The limit is three in any one second over no more than 25% of a 10 degree field.
At 1024 by 768 that field is about 341 by 256 pixels, so each third of the screen stands in for one here.
The grid is a true area average, so a few moving sparks do not read as a flashing region.
A strict screen, not a certificate: it has no red-flash test, and only a person can judge comfort.
"""
import http.server, json, os, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Q)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else f'http://127.0.0.1:{srv.server_port}'
W, H = 64, 36

def rel(v):
    c = v / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def flashes_per_second(series, times):
    """Worst one-second count of opposing 10% pairs in one cell's luminance series."""
    turns, ref, direction = [], series[0], 0
    for v, t in zip(series, times):
        if direction >= 0 and v - ref >= 0.1 and min(v, ref) < 0.8:
            if direction == 0 or direction < 0: pass
            turns.append(t); direction = -1; ref = v
        elif direction <= 0 and ref - v >= 0.1 and min(v, ref) < 0.8:
            turns.append(t); direction = 1; ref = v
        else:
            ref = max(ref, v) if direction == -1 else min(ref, v) if direction == 1 else ref
    best = 0
    for i, t in enumerate(turns):
        n = sum(1 for x in turns[i:] if x < t + 1000)
        best = max(best, n // 2)                # two opposing changes make one flash
    return best

def analyze(frames):
    times = [f['t'] for f in frames]
    grids = [[rel(v) for v in f['grid']] for f in frames]
    worst_region, worst_cells = 0.0, 0
    per_cell = [flashes_per_second([g[c] for g in grids], times) for c in range(W * H)]
    for ry in range(3):
        for rx in range(3):
            cells = [x + y * W for y in range(ry * H // 3, (ry + 1) * H // 3) for x in range(rx * W // 3, (rx + 1) * W // 3)]
            over = sum(1 for c in cells if per_cell[c] > 3) / len(cells)
            worst_region = max(worst_region, over)
    means = [sum(g) / len(g) for g in grids]
    mean_pct = [v * 100 for v in means]
    return {'frames': len(frames), 'fps': round(len(frames) / ((times[-1] - times[0]) / 1000), 1), 'worstRegionOver3PerSec': round(worst_region, 3), 'worstCell': max(per_cell),
            'wholeFrame': flashes_per_second(means, times), 'meanLuminancePct': [round(min(mean_pct), 1), round(max(mean_pct), 1)]}

# Capture first, analyze after all browser intervals have stopped. Python analysis may
# take seconds; leaving a scene-cycling interval running would choose an arbitrary
# final biome for the next check and make failures depend on the test computer.
records, bad = [], []
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True, args=['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl'])
    for page in (os.environ.get('FLASH_PAGES') or 'endless-cockpit.html biofeedback-path-cockpit.html').split():
        for motion in ('no-preference', 'reduce'):
            ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, reduced_motion=motion)
            pg = ctx.new_page()
            pg.goto(f'{BASE}/{page}'); pg.wait_for_function('window.__app'); pg.wait_for_timeout(1500)
            def capture(name, ms=6000):
                frames = pg.evaluate(f'__app.recordLuma({ms})')
                records.append((page, motion, name, frames))
                print(f'captured {page} {motion} {name}: {len(frames)} frames', flush=True)
            pg.click('#demo-button'); pg.wait_for_timeout(1500)
            capture('demo', 9000)
            if page == 'endless-cockpit.html':
                scene_names = pg.evaluate('__app.BIOMES.map(b=>b.name)')
                pg.click('#demo-button')
                pg.evaluate("__app.setAuto(false); __app.S.steady=130; __app.setLook('wild'); window.__cyc=setInterval(()=>__app.nextBiome(),2000)")
                pg.wait_for_function('__app.S.rpm > 125')
                # Include the last world and its return to the first at top cadence.
                capture('hardest', max(9000, len(scene_names) * 2000 + 1000))
                pg.evaluate('clearInterval(window.__cyc)')
                # Check each world explicitly: a single final scene can miss the dense
                # canopy, narrow rails or farm silhouettes that carry the most contrast.
                for biome in range(len(scene_names)):
                    pg.evaluate(f"__app.setBiome({biome},true); __app.S.vis=240; __app.S.steady=100; __app.setTod(1,true)")
                    pg.wait_for_timeout(1500)
                    pg.evaluate("window.__tod=setInterval(()=>__app.setTod(__app.S.tod===1?3:1,true),1500)")
                    capture(f'time flips scene {biome}')
                    pg.evaluate('clearInterval(window.__tod)')
                # A slower time transition must not hide flicker from moving foliage
                # under sustained illumination. Test the dense canopy at both ends.
                for look in ('wild', 'clear'):
                    pg.evaluate(f"__app.setLook('{look}')")
                    for tod, label in ((1, 'golden'), (4, 'night')):
                        pg.evaluate(f'__app.setBiome(1,true); __app.S.vis=240; __app.setTod({tod},true)')
                        pg.wait_for_function(f'Math.abs(__app.S.dusk-({0.18 if tod == 1 else 1}))<.015', timeout=20000)
                        capture(f'tropical {look} held {label}')
                # Rainbow orbit uses a bright suspended road against space. Cover
                # its sharp Clear daylight and feedback-heavy Wild night at top
                # cadence; the time-flip case above already exercises both light
                # states continuously, without multiplying every setting pair.
                orbit = scene_names.index('Rainbow orbit')
                for look, tod, label in (('clear', 1, 'golden'), ('wild', 4, 'night')):
                    pg.evaluate(f"__app.setLook('{look}');__app.setBiome({orbit},true);__app.S.vis=240;__app.S.steady=130;__app.setTod({tod},true)")
                    pg.wait_for_function(f'Math.abs(__app.S.dusk-({0.18 if tod == 1 else 1}))<.015 && __app.S.rpm>125', timeout=20000)
                    capture(f'Rainbow orbit {look} held {label}')
                # New dense autumn foliage, Snake Way's raised edges, and Tron grid's neon light walls also need
                # steady-light coverage at the shared, faster cadence mapping.
                for name in ('Autumn Lake', 'Snake Way', 'Tron grid'):
                    biome = scene_names.index(name)
                    pg.evaluate(f"__app.setLook('clear');__app.setBiome({biome},true);__app.S.vis=240;__app.S.steady=130;__app.setTod(1,true)")
                    pg.wait_for_function('Math.abs(__app.S.dusk-.18)<.015 && __app.S.rpm>125', timeout=20000)
                    capture(f'{name} clear top cadence')
            else:
                for mode in ('ride', 'train'):
                    pg.click(f'[data-mode={mode}]'); pg.wait_for_timeout(2500)
                    capture(mode, 9000)
                pg.click('#demo-button')
                pg.click('[data-mode=ride]')
                pg.evaluate('__app.S.steady=130;__app.S.dream=.9;__app.S.wild=1;__app.S.duskHold=.18')
                for biome, name in enumerate(pg.evaluate('__app.BIOMES.map(b=>b.name)')):
                    pg.evaluate('(i)=>{__app.setBiome(i,true);__app.S.vis=240}', biome)
                    pg.wait_for_timeout(1200)
                    capture(f'{name} cadence Ride high feedback')
            ctx.close()
    b.close()
srv.shutdown()
for page, motion, name, frames in records:
    x = analyze(frames)
    print(page, motion, name, json.dumps(x), flush=True)
    if x['worstRegionOver3PerSec'] > 0.25:
        bad.append(f'{page} {motion} {name}: {x["worstRegionOver3PerSec"]:.0%} of a region flashes more than 3 times a second')
    if x['wholeFrame'] > 3:
        bad.append(f'{page} {motion} {name}: the whole frame flashes {x["wholeFrame"]} times in a second')
print('\n'.join(bad) or 'flicker check passed')
sys.exit(1 if bad else 0)
