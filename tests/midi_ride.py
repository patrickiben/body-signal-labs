#!/usr/bin/env python3
"""MIDI input in the Biofeedback Path Cockpit, end to end in a real browser.

A fake MIDI device replaces the browser's MIDI access. After Connect, notes played four times a second must
move the bike, show the MIDI chip with a note rate, name MIDI as the motion source and set the playing flag that
holds the heart shift. When the notes stop, the bike must slow and the playing flag must clear. Controllers and
note-offs alone must not move it.
"""
import http.server, sys, threading
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FAKE_MIDI = """(() => {
  const input = { id: 'fake-1', name: 'Test MIDI', state: 'connected', onmidimessage: null };
  const access = { inputs: new Map([['fake-1', input]]), outputs: new Map(), onstatechange: null };
  navigator.requestMIDIAccess = () => Promise.resolve(access);
  window.__fakeMidi = { send: (a, b, c) => { if (input.onmidimessage) input.onmidimessage({ data: Uint8Array.from([a, b, c]) }); } };
})();"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    fails, errors = [], []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        except Exception:
            browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('pageerror', lambda e: errors.append(str(e)[:200]))
        page.add_init_script(FAKE_MIDI)
        page.goto(f'http://127.0.0.1:{srv.server_port}/biofeedback-path-cockpit.html')
        page.wait_for_timeout(2500)
        state = lambda: page.evaluate('({ mode: __app.S.mode, rpm: __app.S.rpm, speed: __app.S.speed, dist: __app.S.dist, playing: __app.bio.playing })')
        if state()['mode'] != 'ride':
            page.evaluate("[...document.querySelectorAll('.mode-switch button')].find(b => /ride/i.test(b.innerText)).click()")
            page.wait_for_timeout(300)
        page.evaluate("document.getElementById('midi-connect').click()")
        page.wait_for_timeout(500)
        if 'Test MIDI' not in page.inner_text('#midi-state'):
            fails.append('the Connect sheet does not show the MIDI device: ' + page.inner_text('#midi-state'))

        # controllers and note-offs alone must not move the bike
        for _ in range(12):
            page.evaluate('__fakeMidi.send(0xB0, 7, 100); __fakeMidi.send(0x89, 38, 64)')
            page.wait_for_timeout(100)
        quiet = state()
        if quiet['rpm'] > 2 or quiet['playing']:
            fails.append(f"controllers and note-offs moved the bike: rpm {quiet['rpm']:.1f}, playing {quiet['playing']}")

        before = state()
        for _ in range(24):   # 6 s at 4 notes a second, channel 10, velocity 90
            page.evaluate('__fakeMidi.send(0x99, 38, 90)')
            page.wait_for_timeout(250)
        play = state()
        chip_hidden = page.evaluate("document.getElementById('chip-midi').hidden")
        chip = page.inner_text('#chip-midi-text')
        source = page.inner_text('#source-label')
        if play['rpm'] < 40:
            fails.append(f"playing should ride near a comfortable cadence, rpm {play['rpm']:.1f}")
        if not play['dist'] > before['dist']:
            fails.append('the bike did not move forward while playing')
        if not play['playing']:
            fails.append('the playing flag (which holds the heart shift) was not set')
        if chip_hidden or 'notes/min' not in chip:
            fails.append(f'the MIDI chip should show a note rate, got hidden={chip_hidden} "{chip}"')
        if 'motion from MIDI' not in source:
            fails.append(f'the source badge should name MIDI, got "{source}"')

        page.wait_for_timeout(6000)   # stop playing
        after = state()
        if not after['rpm'] < 0.25 * play['rpm']:
            fails.append(f"after stopping, cadence should fall away: {play['rpm']:.1f} -> {after['rpm']:.1f}")
        if after['playing']:
            fails.append('the playing flag did not clear after stopping')
        browser.close()
    srv.shutdown()
    if errors:
        fails.append('page errors: ' + '; '.join(errors[:3]))
    print(f"quiet rpm {quiet['rpm']:.1f} | playing rpm {play['rpm']:.1f}, speed {play['speed']:.2f}, chip \"{chip}\" | after stop rpm {after['rpm']:.1f}")
    print(f'source: {source}')
    for f in fails:
        print('FAIL:', f)
    print('MIDI ride checks:', 'all passed' if not fails else f'{len(fails)} failed')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
