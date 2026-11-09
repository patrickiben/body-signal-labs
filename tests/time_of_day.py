"""Time of day, on real frames in both cockpits: a step to a later time only lowers the sun and darkens the sky,
a step back only raises and brightens them, nothing passes through other hours on the way, each step lands
exactly on the chosen time's look, and changing your mind halfway does not jump. Run: python3 tests/time_of_day.py"""
import pathlib, sys, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
NAMES = {1: "Golden hour", 2: "Sunset", 3: "Dusk", 4: "Night"}
STEPS = [(1, 2), (2, 3), (3, 4), (4, 3), (3, 2), (2, 1)]
SAMPLE = """([to, ms, back, backAt]) => new Promise((res) => {
  const out = []; const t0 = performance.now(); let turned = false;
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const tick = (now) => {
    const l = __app.S.lastLand; if (l) out.push([now - t0, l.uSunDir[1], lum(l.uSkyTop), lum(l.uSkyHz)]);
    if (back != null && !turned && now - t0 > backAt) { turned = true; __app.setTod(back, true); }
    if (now - t0 < ms) requestAnimationFrame(tick); else res(out);
  };
  __app.setTod(to, true); requestAnimationFrame(tick);
})"""
fails = checks = 0
def check(cond, msg):
    global fails, checks
    checks += 1
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails += 1

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for page_name, label in (("endless-cockpit.html", "Endless"), ("biofeedback-path-cockpit.html", "Biofeedback")):
        pg = b.new_page(viewport={"width": 1280, "height": 800})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto((ROOT / page_name).as_uri()); time.sleep(5)
        for i in (1, 4, 1):   # warm up: the first changes also compile and redraw the scene thumbnails
            pg.evaluate("(i) => __app.setTod(i, true)", i); time.sleep(2.5)
        for a, z in STEPS:
            pg.evaluate("(i) => __app.setTod(i, true)", a); time.sleep(2.2)
            start = pg.evaluate("() => { const l = __app.S.lastLand; const lum = (c) => 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; return [l.uSunDir[1], lum(l.uSkyTop), lum(l.uSkyHz)]; }")
            frames = pg.evaluate(SAMPLE, [z, 2400, None, 0])
            end = frames[-1][1:]
            later = z > a
            ok_range = all(min(start[k], end[k]) - 1e-9 <= f[k + 1] <= max(start[k], end[k]) + 1e-9 for f in frames for k in range(3))
            seq = [f[1] for f in frames]
            ok_one_way = all((y - x) * (end[0] - start[0]) >= -1e-9 for x, y in zip(seq, seq[1:]))
            check(ok_range and ok_one_way and len(frames) > 8,
                  f"{label}: {NAMES[a]} to {NAMES[z]} ({'later' if later else 'earlier'}): sun {start[0]:.3f} to {end[0]:.3f}, highest on the way {max(seq):.3f}, {len(frames)} frames")
        # change of mind: Dusk to Night, then back to Dusk 0.6 s in
        pg.evaluate("(i) => __app.setTod(i, true)", 3); time.sleep(2.2)
        frames = pg.evaluate(SAMPLE, [4, 2600, 3, 600])
        jump = max(max(abs(y[k] - x[k]) for k in (1, 2, 3)) for x, y in zip(frames, frames[1:]))
        check(jump < 0.06, f"{label}: changing your mind halfway does not jump (largest step between frames {jump:.4f})")
        check(not errs, f"{label}: no page errors {errs[:1]}")
        pg.close()
    b.close()
print(f"{checks - fails} of {checks} time-of-day checks passed.")
sys.exit(1 if fails else 0)
