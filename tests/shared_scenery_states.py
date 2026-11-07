#!/usr/bin/env python3
"""Both cockpit renderers, matched cadence physics, and scene-aware sessions.

Uses actual built pages and real downloads. No physical sensors are accessed;
EEG uses the app's explicitly labeled demo and Train uses a recorded fixture.
"""
import http.server
import json
import math
from pathlib import Path
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="shared-scenes-"))
OUT.mkdir(parents=True, exist_ok=True)
SHARED, LEGACY = "cycling-scenes@1", "biofeedback-pathscene@1"
IDS = ["golden-coast", "tropical-preserve", "meadow-lanes", "new-england-autumn", "red-canyon", "rainbow-orbit", "misty-pines", "snake-way", "tron-grid"]
checks, errors, profiles, physics = [], [], {}, []


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass


def check(name, ok, detail=None):
    checks.append({"name": name, "pass": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (" " + json.dumps(detail) if detail is not None else ""), flush=True)
    assert ok, name


def settled_scene(page, index):
    page.evaluate("""i => {
      const a=__app, s=a.S;
      if(a.bio){a.bio.stopReplay();a.bio.stopDemo();a.chooseBiome(i);}
      else {a.ride.stopReplay();a.setAuto(false);a.setLook('clear',true);a.setTod(1,true);}
      a.setBiome(i,true); s.seed=7;s.vis=40;s.rpm=0;s.steady=0;s.pedal=false;s.auto=false;
      s.gradeLoad=0;s.dusk=.2;s.duskHold=.2;s.demo=false;
    }""", index)


def fixture(biome, catalog=SHARED, mode="ride"):
    session = {"schema": "body-signal-labs/biofeedback-session@1", "durationMs": 6000,
        "synthetic": True, "created": "2026-11-04T12:00:00Z", "distanceRelative": True,
        "start": {"vis": 700, "seed": 3, "biome": biome, "mode": mode, "drivePower": "cadence",
            "dist": 0, "rpm": 0, "map": {"idle": 25, "max": 95, "maxZoom": .018, "gamma": 1.6}},
        "lanes": {"biome": [[0, biome]], "rpm": [[0, 0]], "mode": [[0, mode]]}}
    if catalog is not None:
        session["sceneCatalog"] = catalog
    if mode == "train":
        session["lanes"].update({"hr": [[0, 70]], "swing": [[0, 8]], "clarity": [[0, .8]], "hold": [[0, 20]], "dawn": [[0, .4]]})
    return session


def import_bio(page, value, name="scene-fixture.json"):
    page.locator("#replay-file").set_input_files({"name": name, "mimeType": "application/json", "buffer": json.dumps(value).encode()})
    page.wait_for_function("s => __app.bio.replayOn && __app.S.biomeNext===s.start.biome && __app.S.sceneCatalog===(s.sceneCatalog||'biofeedback-pathscene@1')", arg=value)


server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=["--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist"])
        try:
            pages = {}
            for app in ("endless-cockpit", "biofeedback-path-cockpit"):
                page = browser.new_page(viewport={"width": 1100, "height": 760}, accept_downloads=True)
                page.on("pageerror", lambda error, app=app: errors.append(f"{app}: {error}"))
                page.goto(f"http://127.0.0.1:{server.server_port}/{app}.html")
                page.wait_for_function("window.__app && typeof __app.step === 'function'")
                pages[app] = page
            endless, bio = pages.values()
            catalogs = [pg.evaluate("__app.BIOMES.map(b=>b.id)") for pg in pages.values()]
            check("both cockpits expose the same nine stable scene IDs", catalogs == [IDS, IDS], catalogs)
            check("fresh Biofeedback starts on shared Misty pines", bio.evaluate("__app.S.biomeNext===6 && __app.S.sceneCatalog==='cycling-scenes@1'"))
            check("both scene controls expose all nine choices", endless.locator("#scene-tiles [data-b]").count() == 9 and bio.locator("#biome-row [data-b]").count() == 9)
            bio.locator('button[data-mode="ride"]').click()

            for app, page in pages.items():
                profiles[app] = []
                for index in range(9):
                    settled_scene(page, index)
                    page.wait_for_timeout(220)
                    profile = page.evaluate("""() => ({id:__app.BIOMES[__app.S.biomeNext].id,
                      route:[40,500,10000,100000].map(z=>[__app.pathX(z),__app.roadY(z),__app.gradeAt(z)])})""")
                    pixel = page.evaluate("__app.pixel()")
                    check(f"{app}: {profile['id']} renders a finite visible world", all(math.isfinite(v) for row in profile["route"] for v in row) and pixel["mean"] > 5 and pixel["max"] - pixel["min"] > 20)
                    profiles[app].append(profile)
                    if index in (3, 6, 7):
                        page.screenshot(path=str(OUT / f"{app}-{profile['id']}.png"))
            route_error = max(abs(x-y) for a,b in zip(*profiles.values()) for ar,br in zip(a["route"],b["route"]) for x,y in zip(ar,br))
            check("both rendered apps use identical route and grade functions in every world", route_error < 1e-10, route_error)

            # A synchronous block cannot interleave with RAF. Both actual app
            # step functions see identical initial conditions for 240 fixed
            # steps, so a passing comparison is independent of browser FPS.
            exercise = """i => {
              const a=__app,s=a.S;
              if(a.bio){a.bio.stopDemo();a.bio.stopReplay();a.bio.cadence.state='idle';a.bio.cadence.rpm=null;a.bio.now.hr=null;a.bio.now.baseHr=null;a.chooseBiome(i);}
              else {a.ride.stopReplay();a.setAuto(false);}
              a.setBiome(i,true);
              Object.assign(s,{mode:'ride',drivePower:'cadence',sceneCatalog:'cycling-scenes@1',seed:7,vis:10000,dist:0,rpm:0,speed:0,zoom:0,gradeLoad:0,
                steady:85,pedal:false,auto:false,demo:false,ble:null,replayRpm:null,motionVersion:CadenceMotion.VERSION});
              s.map={idle:25,max:95,maxZoom:.018,gamma:1.6};
              for(let n=0;n<240;n++)a.step();
              return Object.fromEntries(['rpm','speed','dist','vis','zoom','grade','gradeLoad'].map(k=>[k,s[k]]));
            }"""
            for index in range(8):
                a, b = [page.evaluate(exercise, index) for page in pages.values()]
                delta = max(abs(a[key] - b[key]) for key in a)
                physics.append({"scene": IDS[index], "endless": a, "biofeedback": b, "maxDelta": delta})
                check(f"matched actual cadence physics: {IDS[index]}", delta < 1e-8, delta)

            for app, page in pages.items():
                for start, end in ((6, 7), (7, 5), (3, 6)):
                    values = page.evaluate("""([start,end])=>{__app.setBiome(start,true);__app.setBiome(end);return Array.from({length:21},(_,i)=>{__app.S.biomeT=i/20;return [__app.pathX(100000),__app.roadY(100000)]})}""", [start, end])
                    good = all(sum(abs(values[n+1][axis]-values[n][axis]) for n in range(20)) <= abs(values[-1][axis]-values[0][axis])+1e-6 for axis in range(2))
                    check(f"{app}: late-route transition {start} to {end} stays bounded", good)

            for index, name in ((1, "Misty pines"), (2, "Neon forest")):
                import_bio(bio, fixture(index, catalog=None), f"legacy-{index}.json")
                bio.wait_for_timeout(180)
                legacy = bio.evaluate("({catalog:__app.S.sceneCatalog,biome:__app.S.biomeNext,name:document.getElementById('scene-name').textContent})")
                pixels = bio.evaluate("__app.pixel()")
                check(f"legacy {name} replay retains original renderer and ID", legacy == {"catalog": LEGACY, "biome": index, "name": name} and pixels["max"]-pixels["min"] > 20, legacy)
                bio.screenshot(path=str(OUT / f"legacy-{index}.png"))
            bio.evaluate("__app.chooseBiome(7)")
            check("choosing Snake Way leaves a legacy replay before reinterpreting IDs", bio.evaluate("!__app.bio.replayOn && __app.S.sceneCatalog==='cycling-scenes@1' && __app.S.biomeNext===7"))

            for current, incoming, from_scene in ((fixture(1, catalog=None), fixture(7), 1), (fixture(7), fixture(2, catalog=None), 7)):
                import_bio(bio, current)
                catalog = current.get("sceneCatalog", LEGACY)
                bio.locator("#session-button").click()
                bio.locator("#rec-video").uncheck()
                bio.locator("#rec-toggle").click()
                bio.locator("#replay-file").set_input_files({"name": "incompatible-replay.json", "mimeType": "application/json", "buffer": json.dumps(incoming).encode()})
                bio.wait_for_function("document.getElementById('rec-status').textContent.includes('Stop recording before loading')")
                bio.locator("#ghost-file").set_input_files({"name": "incompatible-ghost.json", "mimeType": "application/json", "buffer": json.dumps(incoming).encode()})
                bio.wait_for_function("document.getElementById('ghost-status').textContent.includes('Stop recording before loading')")
                if catalog == SHARED:
                    # The preceding saved take is legacy; Race last ride must
                    # handle the same guard without an uncaught event error.
                    bio.locator("#ghost-last").click()
                    bio.wait_for_function("document.getElementById('ghost-status').textContent.includes('Stop recording before loading')")
                check(f"{catalog}: incompatible replay and ghost imports preserve the active take", bio.evaluate("arg => __app.bio.recording && __app.bio.replayOn && __app.S.sceneCatalog===arg.catalog && __app.S.biomeNext===arg.scene", {"catalog": catalog, "scene": from_scene}))
                with bio.expect_download() as event:
                    bio.locator("#rec-toggle").click()
                protected_path = OUT / f"protected-{from_scene}.json"
                event.value.save_as(protected_path)
                check(f"{catalog}: protected recording remains valid", json.loads(protected_path.read_text())["sceneCatalog"] == catalog)
                bio.locator("#session-sheet").evaluate("node=>node.close()")
                bio.evaluate("__app.bio.stopReplay()")

            for app, page in pages.items():
                settled_scene(page, 7)
                page.locator("#session-button").click()
                page.locator("#rec-video").uncheck()
                page.locator("#rec-toggle").click()
                page.wait_for_timeout(850)
                with page.expect_download() as event:
                    page.locator("#rec-toggle").click()
                path = OUT / f"{app}-snake-session.json"
                event.value.save_as(path)
                saved = json.loads(path.read_text())
                check(f"{app}: actual Snake Way recording tags the shared catalog", saved["sceneCatalog"] == SHARED)
                if "start" in saved:
                    check("Biofeedback Snake Way start and scene lane agree", saved["start"]["biome"] == 7 and saved["lanes"]["biome"][0][1] == 7)
                else:
                    route = saved["lanes"]["routeStart"][0][1]
                    check("Endless Snake Way recording tags the shared motion law", route["biome"] == 7 and route["motionVersion"] == "biofeedback-cadence@1")
                page.locator("#session-sheet").evaluate("node=>node.close()")
                settled_scene(page, 1)
                # Extend the final hold so rendering can be inspected without
                # altering any actual recorded lane values or timestamps.
                saved["durationMs"] = 4000
                page.locator("#replay-file").set_input_files({"name": path.name, "mimeType": "application/json", "buffer": json.dumps(saved).encode()})
                page.wait_for_function("__app.S.biomeNext===7 && (__app.bio ? __app.bio.replayOn : __app.ride.replayOn)")
                check(f"{app}: Snake Way replays into the same shared world", page.evaluate("__app.BIOMES[__app.S.biomeNext].id==='snake-way'"))

            import_bio(bio, fixture(7, mode="train"), "shared-train-snake.json")
            bio.wait_for_timeout(250)
            check("Train replay retains clarity, hold and dawn in shared Snake Way", bio.evaluate("__app.S.mode==='train' && __app.S.holdT===20 && __app.S.dawn===.4 && !document.getElementById('breath').hidden"))
            pixel = bio.evaluate("__app.pixel()")
            check("Train haze and dawn render on the suspended cloud road", pixel["mean"] > 5 and pixel["max"]-pixel["min"] > 20)
            bio.screenshot(path=str(OUT / "snake-way-train.png"))
            bio.evaluate("__app.bio.stopReplay()")
            bio.locator('button[data-mode="ride"]').click()
            bio.locator('[data-power="brainwaves"]').click()
            bio.locator("#demo-button").click()
            for index in (6, 7):
                bio.evaluate("i=>{__app.chooseBiome(i);__app.setBiome(i,true);}", index)
                bio.wait_for_timeout(600)
                check(f"EEG synthetic drive works on {IDS[index]} without cadence", bio.evaluate("__app.S.eegSimulated && __app.S.eegValid && __app.S.rpm===0 && __app.S.speed>0 && __app.S.speed<=7 && __app.S.gradeLoad===0"))
            bio.screenshot(path=str(OUT / "snake-way-brainwaves-demo.png"))
            check("shared scenery, legacy playback and both drive modes have no browser exceptions", not errors, errors)
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)
    (OUT / "results.json").write_text(json.dumps({"checks": checks, "profiles": profiles, "physics": physics, "errors": errors}, indent=2))
print(f"{len(checks)} shared scenery checks passed.")
