#!/usr/bin/env python3
"""Every control on screen, nothing overlapping, no sideways scroll: both cockpits at desktop, short laptop, phones upright and sideways."""
import http.server, threading, json, sys, tempfile, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Q)
threading.Thread(target=srv.serve_forever, daemon=True).start()
SIZES = [('desktop', 1440, 900, 1, False), ('laptop-short', 1280, 600, 1, False), ('iphone-15', 393, 852, 3, True), ('iphone-se', 375, 667, 2, True), ('android', 360, 800, 3, True), ('sideways', 852, 393, 3, True), ('se-sideways', 667, 375, 2, True)]
PAGES = ['endless-cockpit.html', 'biofeedback-path-cockpit.html']
JS = r"""() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const box = (sel) => { const e = document.querySelector(sel); if (!e || !vis(e)) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
  const out = [];
  for (const e of document.querySelectorAll('.dock button, #pedal, #source-badge, .chip, #demo-button, #fs-button, .scene-tile, .scene-row button, .mode-switch button')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    // Anything past an edge counts as cut off, even inside a row that could be swiped: a visitor has to see it.
    const off = r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1;
    if (off) out.push((e.innerText || e.id || '').trim().slice(0, 24) + ' is cut off');
  }
  const sb = box('.scenebar'), ms = box('.mode-switch'), hd = box('.header'), dw = box('.dock-wrap'), hud = box('#hud'), intro = box('.intro');
  const overlap = (a, b) => a && b && a.b > b.t && b.b > a.t && a.r > b.l && b.r > a.l;
  const top = sb || ms;
  if (top && dw && top.b > dw.t) out.push(`top controls (bottom ${top.b}) run into the bottom stack (top ${dw.t})`);
  if (sb && hd && sb.t < hd.b - 2 && innerWidth < 900) out.push(`scene bar (top ${sb.t}) under the header (bottom ${hd.b})`);
  const introOn = intro && getComputedStyle(document.querySelector('.intro')).opacity > 0.1;
  if (introOn && sb && overlap(intro, sb)) out.push('intro text overlaps the scene bar');
  if (introOn && dw && intro.b > dw.t) out.push(`intro text (bottom ${intro.b}) runs into the bottom stack (top ${dw.t})`);
  return { problems: out, scrollW: document.documentElement.scrollWidth, w: innerWidth, top: top && top.b, stackTop: dw && dw.t };
}"""
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', args=['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'])
    for page in PAGES:
        for name, w, h, dpr, mobile in SIZES:
            c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, is_mobile=mobile, has_touch=mobile)
            pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:120]))
            pg.goto(f'http://127.0.0.1:{srv.server_port}/{page}')
            if page == 'endless-cockpit.html' and 'LAYOUT_SCENE' in os.environ:
                pg.evaluate('(scene) => __app.setBiome(scene, true)', int(os.environ['LAYOUT_SCENE']))
            pg.wait_for_timeout(2600)
            r = pg.evaluate(JS)
            if r['scrollW'] > r['w']: r['problems'].append(f"page scrolls sideways ({r['scrollW']} > {r['w']})")
            if errs: r['problems'].append('page error: ' + errs[0])
            pg.screenshot(path=f'{OUT}/new-{page[:-5]}-{name}.png')
            bad += len(r['problems'])
            print(f"{page[:-5]:26s} {name:13s} top controls end {r['top']}, bottom stack starts {r['stackTop']} :", '; '.join(r['problems']) or 'ok')
            c.close()
    b.close()
srv.shutdown()
print('layout problems:', bad)
sys.exit(1 if bad else 0)
