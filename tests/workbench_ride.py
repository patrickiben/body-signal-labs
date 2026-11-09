#!/usr/bin/env python3
"""The offline workbench's "Your ride" tab, checked against a ride whose answers are known.

The generated ride has cadence that sets heart rate through a first-order lag, then a hard effort, a stop,
and an exponential recovery with tau = 45 s. Opening it must name cadence as the net leader, fit tau near 45 s,
show a clear heart-rate recovery, and find the ride's five cadence changes (5:00 up, 10:00 down, 15:00 up, 19:00
the stop, 22:00 the restart) with heart rate answering the same way, one shaded stretch each. A ride without heart
rate, a ride without cadence and a broken file must each say so in plain words. The page's copy of
cadenceEffortChanges must match the validated engine's (autonomic/autonomic-math.js), and offline.html
must match its twin Body_Signal_Labs_Offline.html. Nothing here is hard-coded into the page.
"""
import http.server, math, os, random, re, sys, tempfile, threading
from datetime import datetime, timedelta, timezone
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
TRUE_TAU = 45.0


def make_ride(with_hr=True, with_cad=True):
    rnd = random.Random(20261108)
    start = datetime(2026, 11, 8, 18, 0, 0, tzinfo=timezone.utc)
    plan = [(300, 70), (300, 90), (300, 75), (240, 95), (180, 0), (120, 70)]
    cad_seq = [c for secs, c in plan for _ in range(secs)]
    hr, pts = 66.0, []
    for t, base in enumerate(cad_seq):
        cad = max(0.0, base + (rnd.uniform(-2, 2) if base else 0.0))
        target = 65 + 0.9 * cad
        tau = 25.0 if target > hr else TRUE_TAU
        hr += (target - hr) / tau
        pts.append((start + timedelta(seconds=t), cad, hr + rnd.uniform(-1.5, 1.5)))
    trk = ''.join(
        f"<Trackpoint><Time>{ts.isoformat().replace('+00:00', 'Z')}</Time>" + (f"<Cadence>{round(c)}</Cadence>" if with_cad else '')
        + (f"<HeartRateBpm><Value>{round(h)}</Value></HeartRateBpm>" if with_hr else '')
        + "</Trackpoint>" for ts, c, h in pts)
    return ('<?xml version="1.0" encoding="UTF-8"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">'
            f'<Activities><Activity Sport="Biking"><Lap><Track>{trk}</Track></Lap></Activity></Activities></TrainingCenterDatabase>')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def kpis(page, cid):
    return page.evaluate("""(id) => [...document.querySelectorAll('#' + id + ' .mw-kpi')].map(k => [
        k.querySelector('.mw-kpi-label').textContent.trim(), k.querySelector('.mw-kpi-val').textContent.trim()])""", cid)


def function_text(src, name):
    start = src.index(f'function {name}(')
    i = src.index(') {', start) + 2
    depth = 0
    while True:
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1


EXPECTED_CHANGES = [(300, '+', 18.0), (600, '\u2212', 13.5), (900, '+', 18.0), (1140, '\u2212', 85.5), (1320, '+', 63.0)]


def main():
    tmp = Path(tempfile.mkdtemp())
    (tmp / 'ride.tcx').write_text(make_ride(True))
    (tmp / 'no-hr.tcx').write_text(make_ride(False))
    (tmp / 'no-cad.tcx').write_text(make_ride(True, False))
    (tmp / 'broken.tcx').write_text('<TrainingCenterDatabase><Activities>')
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    fails, errors = [], []
    page_src = (ROOT / 'offline.html').read_text()
    if function_text(page_src, 'cadenceEffortChanges') != function_text((ROOT / 'autonomic' / 'autonomic-math.js').read_text(), 'cadenceEffortChanges'):
        fails.append("the page's cadenceEffortChanges differs from the validated engine's")
    if page_src != (ROOT / 'Body_Signal_Labs_Offline.html').read_text():
        fails.append('offline.html and Body_Signal_Labs_Offline.html differ')
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda e: errors.append(str(e)[:160]))
        page.goto(f'http://127.0.0.1:{srv.server_port}/offline.html')
        page.wait_for_timeout(1500)
        if page.locator('.mw-tab-btn, #mw-pane-crt, #mw-pane-lsa, #mw-pane-anl, #mw-pane-bio').count():
            fails.append('the sample-ride tabs are back; the workbench shows only the rider\'s own ride')

        page.set_input_files('#mw-ride-file', str(tmp / 'ride.tcx'))
        page.wait_for_timeout(1200)
        m2 = dict(kpis(page, 'mw-ride-m2'))
        if m2.get('Net leader') != 'Cadence':
            fails.append(f"net leader should be Cadence, got {m2.get('Net leader')}")
        c2h = float(m2.get('Cadence → heart rate', 'nan%').rstrip('%'))
        h2c = float(m2.get('Heart rate → cadence', 'nan%').rstrip('%'))
        if not c2h > h2c:
            fails.append(f'cadence → heart rate ({c2h}%) should exceed heart rate → cadence ({h2c}%)')
        rec = dict(kpis(page, 'mw-ride-hrr'))
        tau = float(re.sub(r'[^0-9.]', '', rec.get('Recovery time constant', '') or 'nan'))
        if not 30 <= tau <= 70:
            fails.append(f'tau_off should be near {TRUE_TAU:.0f} s, got {tau}')
        hrr = float(re.sub(r'[^0-9.]', '', rec.get('HRR60', '') or 'nan'))
        if not hrr > 15:
            fails.append(f'HRR60 should show a clear recovery (>15 bpm), got {hrr}')
        st = dict(kpis(page, 'mw-ride-states'))
        if st.get('Cadence changes') != str(len(EXPECTED_CHANGES)):
            fails.append(f"the ride has {len(EXPECTED_CHANGES)} cadence changes, the page shows {st.get('Cadence changes')}")
        items = page.eval_on_selector_all('#mw-ride-states-note li', 'els => els.map(e => e.textContent)')
        found = []
        for text in items:
            m = re.match(r'(\d+):(\d\d) \u00b7 cadence ([+\u2212])(\d+) rpm \u00b7 heart rate ([+\u2212])(\d+) bpm', text)
            if m:
                found.append((int(m.group(1)) * 60 + int(m.group(2)), m.group(3), m.group(5), int(m.group(6))))
        for t, sign, target in EXPECTED_CHANGES:
            hit = [f for f in found if abs(f[0] - t) <= 5 and f[1] == sign]
            if not hit:
                fails.append(f'no cadence change {sign} near {t // 60}:{t % 60:02d}; the page lists {items}')
            elif hit[0][2] != sign or not 0.6 * target <= hit[0][3] <= 1.1 * target:
                fails.append(f'heart rate should answer the {t // 60}:{t % 60:02d} change the same way, about {target:.0f} bpm or a little less; got {hit[0][2]}{hit[0][3]}')
        if page.locator('#mw-ride-chart svg rect').count() != len(EXPECTED_CHANGES):
            fails.append(f"the chart should shade one stretch per cadence change, got {page.locator('#mw-ride-chart svg rect').count()}")
        plain = page.inner_text('#mw-ride-plain')
        for phrase in ('Your pedaling led', 'bpm in one minute', 'You changed cadence by 5 rpm or more 5 times', 'None of this is a medical measurement'):
            if phrase not in plain:
                fails.append(f'the plain-words summary is missing "{phrase}"')
        if page.evaluate("document.getElementById('mw-ride-math').open") is not True:
            fails.append('the math section should be open on a wide screen')
        phone = browser.new_context(viewport={'width': 393, 'height': 852}, is_mobile=True, has_touch=True).new_page()
        phone.goto(f'http://127.0.0.1:{srv.server_port}/offline.html')
        phone.wait_for_timeout(1200)
        phone.set_input_files('#mw-ride-file', str(tmp / 'ride.tcx'))
        phone.wait_for_timeout(1200)
        if phone.evaluate("document.getElementById('mw-ride-math').open"):
            fails.append('the math section should start closed on a phone')
        if 'Your pedaling led' not in phone.inner_text('#mw-ride-plain'):
            fails.append('the plain-words summary is missing on a phone')
        if phone.evaluate('document.documentElement.scrollWidth > innerWidth'):
            fails.append('the ride tab scrolls sideways on a phone')
        if page.locator('#mw-ride-chart svg polyline').count() != 2:
            fails.append('the ride chart should draw heart rate and cadence')

        page.set_input_files('#mw-ride-file', str(tmp / 'no-cad.tcx'))
        page.wait_for_timeout(800)
        if 'no cadence' not in page.inner_text('#mw-ride-plain'):
            fails.append('a ride without cadence does not say its cadence changes cannot be read')
        page.set_input_files('#mw-ride-file', str(tmp / 'no-hr.tcx'))
        page.wait_for_timeout(600)
        if 'no heart rate' not in page.inner_text('#mw-ride-head'):
            fails.append('a ride without heart rate is not explained')
        page.set_input_files('#mw-ride-file', str(tmp / 'broken.tcx'))
        page.wait_for_timeout(600)
        if 'Could not read broken.tcx' not in page.inner_text('#mw-ride-head'):
            fails.append('a broken file is not explained')
        browser.close()
    srv.shutdown()
    if errors:
        fails.append('page errors: ' + '; '.join(errors[:3]))
    print(f'net leader {m2.get("Net leader")}, cadence→HR {c2h}%, HR→cadence {h2c}%, tau {tau} s, HRR60 {hrr} bpm, cadence changes {st.get("Cadence changes")}: {found}')
    for f in fails:
        print('FAIL:', f)
    print('workbench ride checks:', 'all passed' if not fails else f'{len(fails)} failed')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
