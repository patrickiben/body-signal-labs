#!/usr/bin/env python3
"""Drive every source state on the rendered Biofeedback Path Cockpit page.

  real      : a fresh visit, a refusal by the browser (a permissions policy), a plain http page, the demo,
              recording, replay, the Ghost Deck and reduced motion
  STUBBED   : any Bluetooth device. Headless Chrome closes when it opens its device list, and this Chrome has no
              Bluetooth emulation, so navigator.bluetooth is replaced by a fake that sends real packet bytes.
              The page's own parsers and states then run on them unchanged.

Screenshots go to the given folder. Exit 1 if any check fails.
"""
import http.server, json, sys, tempfile, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp())
OUT.mkdir(parents=True, exist_ok=True)
PAGE = 'biofeedback-path-cockpit.html'

class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass
    def end_headers(self):
        if 'refuse' in self.path: self.send_header('Permissions-Policy', 'bluetooth=()')
        super().end_headers()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Q)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_port}'
GPU = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl']
results, T0 = [], time.time()

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f'{time.time() - T0:6.1f}s ' + ('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

# A fake Bluetooth stack. Each device answers with the same bytes a real one sends.
FAKE = r"""
(() => {
  const listeners = {}, writes = [];
  let dev = null;
  const ch = (uuid) => ({ uuid, value: null, addEventListener: (ev, fn) => { (listeners[uuid] = listeners[uuid] || []).push(fn); },
    startNotifications: async () => {}, writeValue: async (b) => { writes.push(Array.from(new Uint8Array(b.buffer || b))); } });
  const chars = {};
  const svc = (uuid) => ({ getCharacteristic: async (c) => { if (!chars[c]) chars[c] = ch(c); return chars[c]; } });
  window.__fake = { mode: 'strap', writes,
    emit(c, bytes) { const dv = new DataView(new Uint8Array(bytes).buffer); (listeners[c] || []).forEach((fn) => fn({ target: { value: dv } })); },
    drop() { dev.gatt.connected = false; (dev.l || []).forEach((fn) => fn()); } };
  const bt = {
    getAvailability: async () => true,
    requestDevice: async (opts) => {
      const m = window.__fake.mode;
      if (m === 'cancel') throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError');
      if (m === 'adapter') throw new DOMException('Bluetooth adapter not available.', 'NotFoundError');
      const names = { strap: 'Test Strap', hume: 'Hume Band', csc: 'Test Crank', ftms: 'Test Trainer' };
      dev = { name: names[m], l: [], addEventListener: (ev, fn) => dev.l.push(fn),
        gatt: { connected: false, connect: async () => { dev.gatt.connected = true; return { getPrimaryService: async (s) => {
          if (m === 'ftms' && s === 'cycling_speed_and_cadence') throw new DOMException('No service', 'NotFoundError');
          return svc(s); } }; }, disconnect: () => { dev.gatt.connected = false; } } };
      return dev;
    },
  };
  Object.defineProperty(navigator, 'bluetooth', { value: bt, configurable: true });
})();
"""
HRM, CSC, FTMS, HUME = 'heart_rate_measurement', 'csc_measurement', 'indoor_bike_data', '0000fff7-0000-1000-8000-00805f9b34fb'

def read(pg):
    return pg.evaluate("""() => ({ src: document.getElementById('source-badge').dataset.source, label: document.getElementById('source-label').textContent,
      hr: __app.bio.hr.state, hrWhy: document.getElementById('hr-why').textContent, hrState: document.getElementById('hr-state').textContent,
      chipH: document.getElementById('chip-hr-text').textContent, cad: __app.bio.cadence.state, chipC: document.getElementById('chip-cad-text').textContent,
      cadWhy: document.getElementById('cad-why').textContent, rpm: __app.S.rpm, speed: __app.S.speed, phase: __app.bio.now.phase, idx: __app.bio.now.idx,
      tier: document.getElementById('read-tier').textContent, sub: document.getElementById('read-sub').textContent, nowHr: __app.bio.now.hr, rmssd: __app.bio.now.rmssd,
      hrBtn: document.getElementById('hr-connect').disabled, swing: __app.bio.now.swing, hold: __app.S.holdT, pulse: __app.S.pulse })""")

def session(p, path='', init=None, args=(), w=1440, h=900, rm=False, base=BASE):
    b = p.chromium.launch(channel='chrome', headless=True, args=[*GPU, *args])
    c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, reduced_motion='reduce' if rm else 'no-preference', accept_downloads=True)
    if init: c.add_init_script(init)
    pg = c.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:200]))
    pg.on('console', lambda m: errors.append(m.text[:200]) if m.type == 'error' else None)
    pg.goto(f'{base}/{PAGE}{path}'); pg.wait_for_timeout(1500)
    return b, pg, errors

def shot(pg, name): pg.screenshot(path=str(OUT / f'{name}.png'))
def connect(pg, which):
    if not pg.evaluate("document.getElementById('connect-sheet').open"): pg.click('#connect-button'); pg.wait_for_timeout(200)
    pg.click(which); pg.wait_for_timeout(500)

def motion(pg, samples=3):
    total = 0.0
    for _ in range(samples):
        a = pg.evaluate('__app.pixel()')['grid']; pg.wait_for_timeout(250); b = pg.evaluate('__app.pixel()')['grid']
        total += sum(abs(x - y) for x, y in zip(a, b)) / len(a)
    return total / samples

def strap_packet(bpm, rr=(), contact=True):
    flags = 0x04 | (0x02 if contact else 0) | (0x10 if rr else 0)
    out = [flags, bpm]
    for v in rr: n = round(v * 1024 / 1000); out += [n & 255, n >> 8]
    return out

with sync_playwright() as p:
    # 1. a fresh visit: nothing is claimed
    b, pg, err = session(p)
    r = read(pg)
    check('fresh visit reads as ambient', r['src'] == 'ambient' and 'not connected' in r['chipH'] and 'not connected' in r['chipC'], r['label'])
    lum = pg.evaluate('__app.pixel()')
    check('the picture is really drawn at rest', lum['mean'] > 8 and lum['max'] - lum['min'] > 20, f"mean {lum['mean']:.0f}")
    idle = motion(pg)
    check('the reading stays hidden with no source', pg.evaluate("document.getElementById('reading').hidden"))
    check('a fresh visit has no page errors', not err, '; '.join(err[:2]))
    shot(pg, '01-fresh'); b.close()

    # 2. real refusal: a permissions policy blocks Bluetooth, and Chrome refuses before any list opens
    b, pg, err = session(p, '?refuse=1')
    connect(pg, '#hr-connect'); r = read(pg)
    check('a browser refusal reads as permission denied (real)', r['hr'] == 'denied' and 'permission denied' in r['chipH'].lower(), r['hrWhy'])
    connect(pg, '#cad-connect'); r = read(pg)
    check('the cadence sensor reads the same refusal (real)', r['cad'] == 'denied' and 'permission denied' in r['chipC'].lower(), r['chipC'])
    shot(pg, '02-denied'); b.close()

    # 3. real: a plain http page, which is not a secure context
    b, pg, err = session(p, args=['--host-resolver-rules=MAP biotest.example 127.0.0.1'], base=f'http://biotest.example:{srv.server_port}')
    r = read(pg)
    check('a plain http page says it needs a secure page before any click (real)', r['hr'] == 'insecure' and 'needs a secure page' in r['chipH'].lower() and r['hrBtn'], r['chipH'])
    b.close()

    # 4. stubbed: a browser with no Web Bluetooth
    b, pg, err = session(p, init="Object.defineProperty(navigator,'bluetooth',{value:undefined,configurable:true})")
    r = read(pg)
    check('a browser with no Web Bluetooth says so before any click (stubbed)', r['hr'] == 'unsupported' and 'not supported' in r['chipH'].lower() and r['hrBtn'], r['chipH'])
    pg.click('#demo-button'); pg.wait_for_timeout(1500)
    check('the demo still runs there', read(pg)['src'] == 'demo')
    b.close()

    # 5. stubbed: the list is closed with nothing chosen, and the radio is off
    b, pg, err = session(p, init=FAKE)
    pg.evaluate("__fake.mode='cancel'"); connect(pg, '#hr-connect'); r = read(pg)
    check('no sensor chosen reads as no sensor found (stubbed)', r['hr'] == 'no-device' and 'no sensor found' in r['chipH'].lower() and 'chosen' in r['hrWhy'], r['hrWhy'])
    pg.evaluate("__fake.mode='adapter'"); pg.click('#hr-connect'); pg.wait_for_timeout(400); r = read(pg)
    check('Bluetooth switched off says so (stubbed)', r['hr'] == 'no-device' and 'Bluetooth is off' in r['hrWhy'], r['hrWhy'])
    b.close()

    # 6. stubbed strap: connected with no signal, no skin contact, live with beat intervals, silence, unplugged
    b, pg, err = session(p, init=FAKE)
    connect(pg, '#hr-connect'); r = read(pg)
    check('a connected strap with no reading says connected, no signal (stubbed)', r['hr'] == 'no-signal' and 'no signal' in r['chipH'] and 'Connected' in r['hrState'], r['hrState'])
    pg.evaluate(f"__fake.emit('{HRM}', {strap_packet(0, contact=False)})"); pg.wait_for_timeout(300)
    check('a strap that reports no skin contact says so (stubbed)', 'no skin contact' in read(pg)['hrWhy'], read(pg)['hrWhy'])
    pg.evaluate("document.getElementById('connect-sheet').close()")
    rr = [833, 845, 829, 851, 838, 826, 847, 836]
    for i in range(36):
        pg.evaluate(f"__fake.emit('{HRM}', {strap_packet(72, [rr[i % 8], rr[(i + 3) % 8]])})"); pg.wait_for_timeout(110)
    pg.wait_for_timeout(1200); r = read(pg)
    check('a live strap reads as live, with its rate on the chip (stubbed)', r['hr'] == 'live' and r['src'] == 'live' and '72 bpm' in r['chipH'], r['chipH'])
    check('beat intervals become RMSSD (stubbed)', r['rmssd'] is not None and 5 < r['rmssd'] < 40, f"{r['rmssd']}")
    check('the reference starts forming, and says so', r['phase'] == 'calibrating' and 'Forming your reference' in r['tier'], f"{r['phase']} / {r['tier']} / {r['sub']}")
    shot(pg, '06-strap-live')
    pg.wait_for_timeout(6200); r = read(pg)
    check('a strap that goes quiet goes back to no signal (stubbed)', r['hr'] == 'no-signal' and r['nowHr'] is None, r['hrState'])
    pg.evaluate('__fake.drop()'); pg.wait_for_timeout(300); r = read(pg)
    check('an unplugged strap reads as disconnected (stubbed)', r['hr'] == 'lost' and 'disconnected' in r['chipH'], r['chipH'])
    check('the strap run has no page errors', not err, '; '.join(err[:2]))
    b.close()

    # 7. stubbed Hume Band: the start command, warm-up, firmware/battery metadata, a reading, a refusal
    b, pg, err = session(p, init=FAKE)
    pg.evaluate("__fake.mode='hume'"); connect(pg, '#hume-connect'); r = read(pg)
    writes = pg.evaluate('__fake.writes')
    check('the Hume start command matches the bridge byte for byte', writes and writes[0] == [0x28, 2, 1] + [0] * 12 + [0x2B], str(writes[:1]))
    check('a warming Hume band says so (stubbed)', r['hr'] == 'no-signal' and 'warming up' in r['hrWhy'], r['hrWhy'])
    v2_fw = [0x27, 0, 0, 3, 9, 0x26, 0x07, 0x07, 0, 0, 0x19, 0x06, 0x06, 0, 9, 0x95]
    bat84 = [0x13, 84] + [0] * 13; bat84.append(sum(bat84) & 255)
    pg.evaluate(f"__fake.emit('{HUME}', {v2_fw}); __fake.emit('{HUME}', {bat84})"); pg.wait_for_timeout(150); r = read(pg)
    meta = pg.evaluate("({fw: __app.bio.hr.firmware, build: __app.bio.hr.firmwareBuildDate, bat: __app.bio.hr.battery})")
    check('Hume firmware and battery frames are decoded without claiming live HR', r['hr'] == 'no-signal' and meta == {'fw': '0.0.3.9', 'build': '2026-07-07', 'bat': 84}, str(meta))
    frame = [0x28, 2, 64] + [0] * 12; frame.append(sum(frame) & 255)
    pg.evaluate(f"__fake.emit('{HUME}', {frame})"); pg.wait_for_timeout(400); r = read(pg)
    check('a Hume reading reads as live, rate only (stubbed)', r['hr'] == 'live' and '64 bpm' in r['chipH'] and 'rate only' in r['hrWhy'], r['hrWhy'])
    pg.evaluate(f"__fake.emit('{HUME}', [0x28, 255])"); pg.wait_for_timeout(300); r = read(pg)
    check('a Hume refusal reads as could not connect (stubbed)', r['hr'] == 'failed' and 'refused' in r['hrWhy'], r['hrWhy'])
    b.close()

    # 8. stubbed cadence: crank events move the road in every mode, a stop reads as zero, speed-only says so
    b, pg, err = session(p, init=FAKE)
    pg.evaluate("__fake.mode='csc'"); connect(pg, '#cad-connect'); r = read(pg)
    check('a connected crank sensor with no reading says no signal (stubbed)', r['cad'] == 'no-signal' and 'Turn the cranks' in r['cadWhy'], r['cadWhy'])
    pg.evaluate("document.getElementById('connect-sheet').close()")
    rev, t = 0, 0
    for i in range(24):
        rev += 1; t = (t + 683) % 65536                    # 1.5 revolutions a second is 90 rpm; 683/1024 s per revolution
        pg.evaluate(f"__fake.emit('{CSC}', [2, {rev & 255}, {rev >> 8}, {t & 255}, {t >> 8}])"); pg.wait_for_timeout(160)
    pg.wait_for_timeout(1500); r = read(pg)
    check('crank events read as live cadence, and move the road in Watch (stubbed)', r['cad'] == 'live' and r['src'] == 'live' and 80 < r['rpm'] < 100 and r['speed'] > 3, f"{r['rpm']:.1f} rpm, {r['speed']:.1f} m/s")
    check('pedaling holds the index rather than reading exercise as arousal', pg.evaluate('__app.bio.pedaling'))
    for i in range(14):
        pg.evaluate(f"__fake.emit('{CSC}', [2, {rev & 255}, {rev >> 8}, {t & 255}, {t >> 8}])"); pg.wait_for_timeout(250)
    r = read(pg)
    check('a crank that stops reads as zero, not the last cadence (stubbed)', r['rpm'] < 10, f"{r['rpm']:.1f} rpm")
    pg.evaluate(f"__fake.emit('{CSC}', [1, 0, 0, 0, 0, 0, 0])"); pg.wait_for_timeout(300)
    check('a speed-only sensor says it has no crank data (stubbed)', 'wheel speed only' in read(pg)['cadWhy'], read(pg)['cadWhy'])
    b.close()

    # 9. stubbed smart trainer: cadence in half-rpm units
    b, pg, err = session(p, init=FAKE)
    pg.evaluate("__fake.mode='ftms'"); connect(pg, '#cad-connect')
    for i in range(10):
        pg.evaluate(f"__fake.emit('{FTMS}', [4, 0, 0, 0, 160, 0])"); pg.wait_for_timeout(250)
    pg.wait_for_timeout(1200); r = read(pg)
    check('a smart trainer reads as live cadence (stubbed)', r['cad'] == 'live' and 70 < r['rpm'] < 90 and 'smart trainer' in read(pg)['cadWhy'], f"{r['rpm']:.1f}")
    b.close()

    # 10. the demo, every mode, recording, replay and the Ghost Deck, all through real clicks
    b, pg, err = session(p)
    sky0 = pg.evaluate('__app.pixel()')['grid'][:32 * 9]
    pg.click('#demo-button'); pg.wait_for_timeout(3500); r = read(pg)
    check('the demo is labeled the whole time', r['src'] == 'demo' and 'synthetic' in r['label'], r['label'])
    check('the demo index is ready at once, through the real engine', r['phase'] == 'ready' and r['idx'] is not None, f"{r['idx']}")
    pg.wait_for_function('__app.S.load > 0.3', timeout=40000)
    sky1 = pg.evaluate('__app.pixel()')['grid'][:32 * 9]
    change = sum(abs(x - y) for x, y in zip(sky0, sky1)) / len(sky0)
    check('the sky really changes when the index rises', change > 4, f'mean change {change:.1f} of 255 in the upper half')
    pg.click('#session-button'); pg.click('#rec-toggle'); pg.click('#session-sheet [data-close]')
    pg.click('[data-mode=ride]'); pg.wait_for_timeout(9000); r = read(pg)
    check('Ride: demo cadence moves the road', r['rpm'] > 40 and r['speed'] > 1, f"{r['rpm']:.0f} rpm")
    ride = motion(pg)
    check('Ride: the picture moves more with cadence than at rest', ride > idle, f'rest {idle:.2f}, riding {ride:.2f}')
    check('Ride: the index is held while pedaling', r['phase'] in ('held', 'calibrating', 'waiting') or pg.evaluate('__app.bio.pedaling'), r['phase'])
    shot(pg, '10-ride')
    pg.click('#session-button')
    with pg.expect_download() as dl: pg.click('#rec-toggle')
    sess = json.loads(Path(dl.value.path()).read_text())
    check('a recorded demo session is marked synthetic and holds the lanes', sess['synthetic'] and len(sess['lanes'].get('rpm', [])) > 50 and 'dist' in sess['lanes'], f"{len(sess['lanes'].get('rpm', []))} rpm points")
    f = OUT / 'session.json'; f.write_text(json.dumps(sess))
    pg.click('#session-sheet [data-close]')
    pg.click('#demo-button'); pg.wait_for_timeout(500)
    pg.click('#session-button'); pg.set_input_files('#replay-file', str(f)); pg.wait_for_timeout(2500); r = read(pg)
    check('a replay is labeled as a recording of synthetic signals', r['src'] == 'replay' and 'synthetic' in r['label'], r['label'])
    check('the replay drives the road from the recorded cadence', r['rpm'] > 20, f"{r['rpm']:.0f}")
    pg.click('#session-button'); pg.click('#replay-stop'); pg.wait_for_timeout(300)
    pg.set_input_files('#ghost-file', str(f)); pg.wait_for_timeout(1500)
    check('the Ghost Deck races a session file in Ride', pg.evaluate("!!__app.S.ghost && !document.getElementById('g-ghost-wrap').hidden && document.body.dataset.mode==='ride'"))
    pg.evaluate("document.getElementById('steady').value=95; document.getElementById('steady').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(4000)
    check('the ghost gap is measured', pg.evaluate("__app.S.ghostGap!==null && isFinite(__app.S.ghostGap)"), str(pg.evaluate('__app.S.ghostGap')))
    pg.click('#demo-button'); pg.wait_for_timeout(300)
    pg.click('[data-mode=train]'); pg.wait_for_timeout(52000); r = read(pg)
    check('Train: the swing at pace is read and the hold counts', r['swing'] is not None and r['swing'] > 6 and r['hold'] > 3, f"swing {r['swing']}, hold {r['hold']:.1f}")
    shot(pg, '10-train')
    check('the demo run has no page errors', not err, '; '.join(err[:2]))
    b.close()

    # 11. reduced motion: no pulse, and the page still works
    b, pg, err = session(p, rm=True)
    pg.click('#demo-button'); pg.wait_for_timeout(4000)
    check('reduced motion removes the heart-rate pulse', pg.evaluate('__app.S.pulse') == 0)
    b.close()

    # 12. phone width: no sideways scroll, and the header holds one line
    b, pg, err = session(p, w=390, h=844)
    got = pg.evaluate("({sw: document.documentElement.scrollWidth, brand: document.querySelector('.brand').getBoundingClientRect().height, demo: document.getElementById('demo-button').getBoundingClientRect().height})")
    check('phone: no sideways scroll, and the header does not wrap', got['sw'] <= 390 and got['brand'] < 32 and got['demo'] < 44, str(got))
    pg.click('#demo-button'); pg.click('[data-mode=train]'); pg.wait_for_timeout(2500)
    box = pg.evaluate("(() => { const a = document.getElementById('breath-cue').getBoundingClientRect(), b = document.querySelector('.train-panel').getBoundingClientRect(); return {cue: a.bottom, panel: b.top}; })()")
    check('phone: the breath cue clears the Train panel', box['cue'] < box['panel'], str(box))
    shot(pg, '12-phone-train')
    b.close()

srv.shutdown()
bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)} of {len(results)} checks passed')
sys.exit(1 if bad else 0)
