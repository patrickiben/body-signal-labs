#!/usr/bin/env python3
"""Held manual pedaling must end when focus is lost, even without a key-up event."""
import http.server, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', args=['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'])
    for page in ('endless-cockpit', 'biofeedback-path-cockpit'):
        pg = browser.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'http://127.0.0.1:{server.server_port}/{page}.html')
        pg.wait_for_function('window.__app')
        if page.startswith('biofeedback'): pg.locator('[data-mode="ride"]').click()
        pg.locator('body').click(position={'x': 5, 'y': 250})
        pg.keyboard.down('Space'); assert pg.evaluate('__app.S.pedal')
        pg.evaluate("window.dispatchEvent(new Event('blur'))")
        assert not pg.evaluate('__app.S.pedal')
        assert not pg.locator('#pedal').evaluate("e => e.classList.contains('on')")
        pg.keyboard.up('Space')
        pg.locator('#pedal').dispatch_event('pointerdown', {'pointerId': 1})
        assert pg.evaluate('__app.S.pedal')
        pg.evaluate("Object.defineProperty(document, 'hidden', {configurable:true, value:true}); document.dispatchEvent(new Event('visibilitychange'))")
        assert not pg.evaluate('__app.S.pedal')
        pg.evaluate("delete document.hidden")
        if page.startswith('biofeedback'):
            pg.keyboard.down('Space'); assert pg.evaluate('__app.S.pedal')
            pg.locator('[data-mode="watch"]').click()
            assert not pg.evaluate('__app.S.pedal')
            pg.keyboard.up('Space')
        assert not errors, errors
        print(f'PASS {page}: key and pointer pedal release after focus/visibility loss')
        pg.close()
    browser.close()
server.shutdown()
