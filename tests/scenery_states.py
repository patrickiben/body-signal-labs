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
SCENES = ['Golden coast', 'Tropical preserve', 'Meadow lanes', 'New England Autumn', 'Red canyon', 'Rainbow orbit', 'Misty pines', 'Snake Way']
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Q)
threading.Thread(target=srv.serve_forever, daemon=True).start()
bad, profiles, errors, transitions, replays = [], [], [], [], []
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True, args=['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width':1440, 'height':900})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{srv.server_port}/endless-cockpit.html')
    pg.wait_for_function("window.__app && document.querySelectorAll('.scene-tile').length === __app.BIOMES.length")
    scene_count = pg.evaluate('__app.BIOMES.length')
    orbit = pg.evaluate("__app.BIOMES.findIndex(b=>b.name==='Rainbow orbit')")
    names = pg.evaluate('__app.BIOMES.map(b=>b.name)')
    if names != SCENES: bad.append(f'expected shared eight-scene catalog: {names}')
    misty, snake = SCENES.index('Misty pines'), SCENES.index('Snake Way')
    pg.evaluate("__app.setTod(1,true);__app.setLook('clear',true);__app.setAuto(false);__app.S.steady=75")
    for i in range(scene_count):
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
    if len({json.dumps(p['path']) for p in profiles}) != scene_count: bad.append('route profiles are not distinct')
    if len({p['width'] for p in profiles}) < 4: bad.append('path widths do not vary')
    # At long distances, transitions must interpolate positions without frequency sweeps.
    pairs = [(3,4),(3,misty),(misty,snake),(snake,orbit),(snake,3),(orbit,misty)] + ([(4,orbit),(orbit,0),(1,orbit),(orbit,3)] if orbit >= 0 else [])
    for start, end in pairs:
        for z in (1600,10000,100000):
            values=pg.evaluate("""([start,end,z])=>{__app.setBiome(start,true);__app.setBiome(end);
              return Array.from({length:51},(_,i)=>{__app.S.biomeT=i/50;return [__app.pathX(z),__app.roadY(z)]})}""",[start,end,z])
            transitions.append({'from':start,'to':end,'z':z,'start':values[0],'end':values[-1]})
            for axis in range(2):
                if not all(math.isfinite(v[axis]) for v in values): bad.append(f'nonfinite route during {start}->{end} at {z}')
                variation=sum(abs(values[i+1][axis]-values[i][axis]) for i in range(50))
                if variation > abs(values[-1][axis]-values[0][axis])+.001: bad.append(f'route oscillates during {start}->{end} at {z}')
    # Interrupted transitions must start from the current route, not jump back to a prior route.
    triples = [(0,1,3),(3,misty,snake),(snake,orbit,misty),(misty,snake,0)] + ([(1,orbit,4),(orbit,0,orbit)] if orbit >= 0 else [])
    for start, mid, end in triples:
        delta=pg.evaluate("""([start,mid,end])=>{
          __app.setBiome(start,true);__app.setBiome(mid);__app.S.biomeT=.35;
          const before=[__app.pathX(10000),__app.roadY(10000)];__app.setBiome(end);
          return Math.max(...before.map((v,i)=>Math.abs(v-[__app.pathX(10000),__app.roadY(10000)][i])));
        }""",[start,mid,end])
        if not math.isfinite(delta) or delta > .02: bad.append(f'interrupted {start}->{mid}->{end} jumps route: {delta}')
    # The suspended road must also render during mixed land/space transitions,
    # when CPU route interpolation alone cannot catch a missing shader weight.
    if orbit >= 0:
        for start, end, z in ((1,orbit,1600),(orbit,3,10000),(3,misty,1600),(misty,snake,10000),(snake,0,1600),(snake,orbit,10000)):
            pg.evaluate("""([start,end,z])=>{
              __app.S.steady=null;__app.S.rpm=0;__app.S.ambient=0;
              __app.setBiome(start,true);__app.setBiome(end);__app.S.biomeT=.5;__app.S.vis=z;
            }""",[start,end,z])
            pg.wait_for_timeout(150)
            pix=pg.evaluate('__app.pixel()')
            if pix['mean'] < 8 or pix['max']-pix['min'] < 25: bad.append(f'blank mixed land/space frame {start}->{end} at {z}')
            pg.screenshot(path=str(OUT/f'blend-{start}-{end}-{z}.png'))
    pg.wait_for_timeout(1000)
    for initial_scene in [3,orbit,misty,snake]:
        replay = pg.evaluate("""(scene)=>{
          __app.setBiome(scene,true);__app.setTod(3,true);__app.S.seed=7;__app.S.vis=1234;__app.S.dist=456;__app.S.map.gamma=2;
          __app.ride.startRecording('endless-cockpit');const file=__app.ride.stopRecording();
          __app.setBiome(0,true);__app.setTod(1,true);__app.S.seed=1;__app.S.vis=9;__app.S.dist=1;__app.S.map.gamma=1;
          __app.ride.startReplay({...file,durationMs:1000});__app.ride.tick(performance.now()+20);
          const out={route:[__app.S.biomeNext,__app.S.seed,__app.S.vis,__app.S.dist,__app.S.map.gamma,__app.S.tod],
            catalog:file.sceneCatalog,motion:__app.S.motionVersion};
          __app.ride.stopReplay();return out;
        }""",initial_scene)
        replays.append(replay)
        if replay['route'] != [initial_scene,7,1234,456,2,3] or replay['catalog'] != 'cycling-scenes@1' or replay['motion'] != 'biofeedback-cadence@1':
            bad.append(f'replay did not restore initial route/catalog/motion: {replay}')
    # Old files lack a motion marker; their nominal replay scale stays 7 m/s.
    # The same file with the current marker must use the shared 18 m/s scale.
    scales = pg.evaluate("""() => {
      const route={biome:5,seed:7,tod:1,vis:1234,dist:0,map:{idle:25,max:95,maxZoom:.018,gamma:1.6}};
      const file={schema:'body-signal-labs/ride-session@1',durationMs:1000,synthetic:false,
        lanes:{routeStart:[[0,route]],rpm:[[0,95]]}};
      const read=f=>{__app.ride.startReplay(f);__app.ride.tick(performance.now()+20);__app.S.rpm=95;
        const factor=CadenceMotion.gradeFactor(__app.gradeAt(__app.S.vis));__app.step();
        const speed=__app.S.speed/factor;__app.ride.stopReplay();return speed;};
      return [read(file),read({...file,sceneCatalog:'cycling-scenes@1',
        lanes:{...file.lanes,routeStart:[[0,{...route,motionVersion:'biofeedback-cadence@1'}]]}})];
    }""")
    if not all(math.isclose(value, expected, abs_tol=1e-8) for value, expected in zip(scales, [7,18])):
        bad.append(f'legacy/current replay speed scales changed: {scales}')
    # Real MediaRecorder download: its onstop callback runs after the UI clears recorder.
    pg.click('#session-button',force=True);pg.check('#rec-video');pg.click('#rec-toggle');pg.wait_for_timeout(1200)
    with pg.expect_download(predicate=lambda d:d.suggested_filename.endswith(('.webm','.mp4')),timeout=30000) as download:
        pg.click('#rec-toggle')
    video=download.value;video.save_as(str(OUT/video.suggested_filename))
    if (OUT/video.suggested_filename).stat().st_size < 1000: bad.append('video download is empty')
    if errors: bad.extend(errors)
    b.close()
srv.shutdown()
(OUT/'scenery-results.json').write_text(json.dumps({'profiles':profiles,'transitions':transitions,'replays':replays,'errors':bad},indent=2))
print('\n'.join(bad) or 'scenery checks passed')
sys.exit(bool(bad))
