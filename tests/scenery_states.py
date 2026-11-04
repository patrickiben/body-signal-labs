#!/usr/bin/env python3
"""Render every landscape and exercise route changes at several travel positions.

Screenshots are evidence for visual review, not a claim of photographic realism.
The runtime assertions catch black canvases, shader failures, stale route profiles,
invalid grade values and the old same-route/different-palette implementation.
"""
import http.server, json, math, sys, tempfile, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()); OUT.mkdir(parents=True, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Q)
threading.Thread(target=srv.serve_forever, daemon=True).start()
bad, profiles, errors = [], [], []
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True, args=['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width':1440, 'height':900})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{srv.server_port}/endless-cockpit.html')
    pg.wait_for_function("window.__app && document.querySelectorAll('.scene-tile').length === 5")
    pg.evaluate("__app.setTod(1,true);__app.setLook('clear',true);__app.setAuto(false);__app.S.steady=75")
    for i in range(5):
        pg.evaluate('(i)=>{__app.setBiome(i,true);__app.S.vis=40;__app.S.dusk=.18;}', i)
        pg.wait_for_timeout(1000)
        profile = pg.evaluate("""() => ({name:__app.BIOMES[__app.S.biomeNext].name,
          width:__app.BIOMES[__app.S.biomeNext].width,
          path:[40,120,280,650].map(z=>[__app.pathX(z),__app.roadY(z),__app.gradeAt(z)]),
          caption:document.getElementById('route-caption').textContent})""")
        if not all(math.isfinite(v) for row in profile['path'] for v in row): bad.append(f'{i}: nonfinite route')
        pixels = pg.evaluate('__app.pixel()')
        if pixels['mean'] < 10 or pixels['max']-pixels['min'] < 35: bad.append(f'{i}: blank or flat frame')
        profiles.append(profile)
        pg.screenshot(path=str(OUT / f'world-{i}.png'))
        print(json.dumps({'scene':profile['name'],'mean':pixels['mean'],'range':pixels['max']-pixels['min']}), flush=True)
        for z in (600, 1800, 4000):
            pg.evaluate('(z)=>{__app.S.vis=z}',z);pg.wait_for_timeout(150)
            pix=pg.evaluate('__app.pixel()')
            if pix['mean'] < 8 or pix['max']-pix['min'] < 25: bad.append(f'{i} at {z}: blank frame')
    if len({json.dumps(p['path']) for p in profiles}) != 5: bad.append('route profiles are not distinct')
    if len({p['width'] for p in profiles}) < 4: bad.append('path widths do not vary')
    # At long distances, transitions must interpolate positions without frequency sweeps.
    for z in (1600,10000,100000):
        values=pg.evaluate("""(z)=>{__app.setBiome(3,true);__app.setBiome(4);
          return Array.from({length:51},(_,i)=>{__app.S.biomeT=i/50;return [__app.pathX(z),__app.roadY(z)]})}""",z)
        for axis in range(2):
            variation=sum(abs(values[i+1][axis]-values[i][axis]) for i in range(50))
            if variation > abs(values[-1][axis]-values[0][axis])+.001: bad.append(f'route oscillates during transition at {z}')
    # Interrupted transitions must start from the current route, not jump back to a prior route.
    pg.evaluate('__app.setBiome(0,true);__app.setBiome(1);__app.S.biomeT=.35')
    before=pg.evaluate('[__app.pathX(150),__app.roadY(150)]')
    pg.evaluate('__app.setBiome(3)')
    after=pg.evaluate('[__app.pathX(150),__app.roadY(150)]')
    if max(abs(a-b) for a,b in zip(before,after)) > .02: bad.append('interrupted scenery change jumps route')
    pg.wait_for_timeout(1000)
    replay = pg.evaluate("""()=>{
      __app.setBiome(3,true);__app.S.seed=7;__app.S.vis=1234;__app.S.dist=456;__app.S.map.gamma=2;
      __app.ride.startRecording('endless-cockpit');const file=__app.ride.stopRecording();
      __app.setBiome(0,true);__app.S.seed=1;__app.S.vis=9;__app.S.dist=1;__app.S.map.gamma=1;
      __app.ride.startReplay({...file,durationMs:1000});__app.ride.tick(performance.now()+20);
      const out=[__app.S.biomeNext,__app.S.seed,__app.S.vis,__app.S.dist,__app.S.map.gamma];
      __app.ride.stopReplay();return out;
    }""")
    if replay != [3,7,1234,456,2]: bad.append(f'replay did not restore initial route: {replay}')
    # Real MediaRecorder download: its onstop callback runs after the UI clears recorder.
    pg.click('#session-button',force=True);pg.check('#rec-video');pg.click('#rec-toggle');pg.wait_for_timeout(1200)
    with pg.expect_download(predicate=lambda d:d.suggested_filename.endswith(('.webm','.mp4')),timeout=30000) as download:
        pg.click('#rec-toggle')
    video=download.value;video.save_as(str(OUT/video.suggested_filename))
    if (OUT/video.suggested_filename).stat().st_size < 1000: bad.append('video download is empty')
    if errors: bad.extend(errors)
    b.close()
srv.shutdown()
(OUT/'scenery-results.json').write_text(json.dumps({'profiles':profiles,'errors':bad},indent=2))
print('\n'.join(bad) or 'scenery checks passed')
sys.exit(bool(bad))
