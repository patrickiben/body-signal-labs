"""Customize scenery, with a stand-in for the desktop app's painter (window.nativeScenery). The stand-in returns a test
painting with an unmistakable magenta sky, an orange horizon and green ground, so the screen itself shows whether the
painting arrived. The real painter (FLUX.2-klein on the Mac) is checked in the app window, not here."""
import pathlib, sys, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
PAINTER = """
(() => {
  const listeners = []; let n = 0;
  const paint = () => { const c = document.createElement('canvas'); c.width = 768; c.height = 320; const g = c.getContext('2d');
    g.fillStyle = 'rgb(255,0,200)'; g.fillRect(0, 0, 768, 200); g.fillStyle = 'rgb(255,140,0)'; g.fillRect(0, 200, 768, 60);
    g.fillStyle = 'rgb(0,160,40)'; g.fillRect(0, 260, 768, 60); return c.toDataURL('image/jpeg', 0.92); };
  window.nativeScenery = { available: (cb) => cb(true), done: { connect: (f) => listeners.push(f) },
    generate: (text, cb) => { const job = 'job' + (++n); cb(job); setTimeout(() => listeners.forEach((f) => f(job, paint(), '')), 400); } };
})();
"""
fails = checks = 0
def check(cond, msg):
    global fails, checks
    checks += 1; print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails += 1
def sky_patch(pg, save=None):
    # the share of magenta-looking pixels in the upper part of the screen, and their mean colour
    png = pg.screenshot(clip={"x": 0, "y": 230, "width": 1280, "height": 230})
    if save: open(save, "wb").write(png)
    from PIL import Image; import io
    im = Image.open(io.BytesIO(png)).convert("RGB"); px = list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())
    mag = [q for q in px if q[0] > 110 and q[2] > 80 and q[1] < 0.6 * q[0]]
    mean = tuple(round(sum(q[k] for q in mag) / len(mag)) for k in range(3)) if mag else (0, 0, 0)
    return round(len(mag) / len(px), 3), mean
def run(b, page_name, label, keeps_choice):
    ctx = b.new_context(viewport={"width": 1280, "height": 800}); pg = ctx.new_page()
    pg.goto((ROOT / page_name).as_uri()); time.sleep(3)
    check(pg.evaluate("document.getElementById('scenery-button').hidden"), f"{label}: in a plain browser (no painter) the button stays hidden")
    ctx.close()
    ctx = b.new_context(viewport={"width": 1280, "height": 800}); ctx.add_init_script(PAINTER); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto((ROOT / page_name).as_uri()); time.sleep(4)
    pg.evaluate("__app.setTod(1, true)"); time.sleep(2)
    before = sky_patch(pg)
    check(not pg.evaluate("document.getElementById('scenery-button').hidden"), f"{label}: with the desktop painter the button shows")
    pg.click("#scenery-button"); time.sleep(0.6)
    check(pg.evaluate("document.getElementById('scenery-sheet').open"), f"{label}: the button opens the Customize scenery sheet")
    tod0 = pg.evaluate("__app.S.tod")
    pg.fill("#scenery-text", ""); pg.type("#scenery-text", "a magenta test sky over orange hills", delay=5)
    check(pg.evaluate("__app.S.tod") == tod0, f"{label}: typing in the box does not trigger the shortcut keys (the t key)")
    pg.click("#scenery-paint"); time.sleep(0.15)
    check("Painting" in pg.inner_text("#scenery-status"), f"{label}: while painting it says so")
    pg.wait_for_function("__app.S.scenery && __app.S.backT >= 1", timeout=15000)
    st = pg.evaluate("({ prompt: __app.S.scenery.prompt, auto: __app.S.autoScene, list: __app.sceneryList.length, active: document.getElementById('scenery-button').dataset.active, caption: document.getElementById('route-caption').textContent })")
    check(st["prompt"] == "a magenta test sky over orange hills" and st["list"] == 1 and st["active"] == "true", f"{label}: the painting is in use and listed")
    check(st["caption"].startswith("Your scenery · a magenta test sky"), f"{label}: the caption says so: \"{st['caption']}\"")
    check(st["auto"] is False, f"{label}: new scenery every mile is switched off, so a mile does not take it away")
    pg.keyboard.press("Escape"); time.sleep(2.5)
    after = sky_patch(pg, f"/tmp/custom_scenery_{label}.png")
    check(before[0] < 0.02 and after[0] > 0.2, f"{label}: the sky on screen is the painting's magenta: share before {before[0]}, after {after[0]} {after[1]}")
    pg.evaluate("__app.setTod(4, true)"); time.sleep(2.6)
    night = sky_patch(pg)
    lit = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    check(night[0] < 0.05 or (night[1] != (0, 0, 0) and lit(night[1]) < 0.7 * lit(after[1])), f"{label}: at night the painting dims: {after[0]} {after[1]} to {night[0]} {night[1]}")
    pg.evaluate("__app.setTod(1, true)"); time.sleep(2)
    pg.reload(); time.sleep(4)
    if keeps_choice:
        check(pg.evaluate("!!__app.S.scenery && __app.S.scenery.prompt.startsWith('a magenta')"), f"{label}: after a reload your scenery is still in use")
    check(pg.evaluate("__app.sceneryList.length") == 1, f"{label}: after a reload your painting is still in the list")
    if not keeps_choice:
        pg.click("#scenery-button"); time.sleep(0.5); pg.click(".scenery-item"); time.sleep(2); pg.keyboard.press("Escape")
    pg.click('.scene-tile[data-b="1"]'); time.sleep(2.2)
    off = pg.evaluate("({ on: !!__app.S.scenery, caption: document.getElementById('route-caption').textContent, active: document.getElementById('scenery-button').dataset.active })")
    check(not off["on"] and off["active"] == "false" and "Your scenery" not in off["caption"], f"{label}: picking a built-in landscape leaves your scenery {off}")
    pg.click("#scenery-button"); time.sleep(0.5); pg.click(".scenery-item"); time.sleep(2)
    check(pg.evaluate("!!__app.S.scenery"), f"{label}: your painting can be picked again from the list")
    pg.click("#scenery-off")
    try: pg.wait_for_function("!__app.S.scenery && __app.S.backT === 0", timeout=12000); gone = True
    except Exception: gone = False
    check(gone, f"{label}: This landscape's own sky turns it off {pg.evaluate('({ on: !!__app.S.scenery, backT: __app.S.backT })')}")
    pg.keyboard.press("Escape")
    for w, h in ((390, 844), (844, 390), (320, 568)):
        pg.set_viewport_size({"width": w, "height": h}); time.sleep(0.8)
        fit = pg.evaluate("""() => { const r = document.getElementById('scenery-button').getBoundingClientRect();
          return { scroll: document.documentElement.scrollWidth > innerWidth + 1, inView: r.width === 0 || (r.left >= -1 && r.right <= innerWidth + 1) }; }""")
        check(not fit["scroll"] and fit["inView"], f"{label}: {w}x{h}: no sideways scroll, the button inside the screen")
    check(not errs, f"{label}: no page errors {errs[:1]}")
    ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    run(b, "endless-cockpit.html", "Endless", True)
    run(b, "biofeedback-path-cockpit.html", "Biofeedback", False)
    b.close()
print(f"{checks - fails} of {checks} custom scenery checks passed.")
sys.exit(1 if fails else 0)
