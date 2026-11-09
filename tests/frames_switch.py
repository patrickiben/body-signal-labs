"""Rainbow orbit's light frames: one switch in the scene row, shown only while Rainbow orbit is chosen (no lone section in
the Scenery sheet), it turns the frames on and off, Endless remembers it, and phones still fit the row with it showing."""
import pathlib, sys, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
fails = checks = 0
def check(cond, msg):
    global fails, checks
    checks += 1; print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails += 1
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for page_name, label in (("endless-cockpit.html", "Endless"), ("biofeedback-path-cockpit.html", "Biofeedback")):
        ctx = b.new_context(viewport={"width": 1280, "height": 800}); pg = ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto((ROOT / page_name).as_uri()); time.sleep(4)
        rainbow = pg.evaluate("__app.BIOMES.findIndex(b => b.id === 'rainbow-orbit')")
        check(pg.evaluate("!document.getElementById('space-lattice')"), f"{label}: no lone Rainbow orbit section in the Scenery sheet")
        check(pg.evaluate("document.getElementById('frames-button').hidden"), f"{label}: the switch is hidden on another landscape")
        pg.evaluate("(i) => __app.setBiome(i, true)", rainbow); time.sleep(0.5)
        check(not pg.evaluate("document.getElementById('frames-button').hidden"), f"{label}: the switch shows on Rainbow orbit")
        pg.click("#frames-button"); time.sleep(0.3)
        check(pg.evaluate("__app.S.spaceLattice === true && document.getElementById('frames-button').getAttribute('aria-pressed') === 'true'"), f"{label}: pressing it turns the frames on")
        if label == "Endless":
            pg.reload(); time.sleep(4)
            check(pg.evaluate("__app.S.spaceLattice === true && !document.getElementById('frames-button').hidden"), f"{label}: it is remembered after a reload")
        pg.click("#frames-button"); time.sleep(0.3)
        check(pg.evaluate("__app.S.spaceLattice === false"), f"{label}: pressing it again turns them off")
        pg.evaluate("(i) => __app.S.spaceLattice = true", 0)
        for w, h in ((390, 844), (844, 390), (320, 568)):
            pg.set_viewport_size({"width": w, "height": h}); time.sleep(0.8)
            fit = pg.evaluate("""() => { const b = document.getElementById('frames-button').getBoundingClientRect();
              return { scroll: document.documentElement.scrollWidth > innerWidth + 1, inView: b.width === 0 || (b.left >= -1 && b.right <= innerWidth + 1) }; }""")
            check(not fit["scroll"] and fit["inView"], f"{label}: {w}x{h} with the switch showing: no sideways scroll, switch inside the screen {fit}")
        check(not errs, f"{label}: no page errors {errs[:1]}")
        ctx.close()
    b.close()
print(f"{checks - fails} of {checks} light-frames checks passed.")
sys.exit(1 if fails else 0)
