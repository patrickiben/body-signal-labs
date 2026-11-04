#!/usr/bin/env python3
"""Native video/session save and route restore regression; no real sensors."""
import json, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp())
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800}, accept_downloads=True)
    errors, downloads = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('download', lambda d: downloads.append(d))
    page.goto((ROOT / 'biofeedback-path-cockpit.html').as_uri())
    page.wait_for_function('window.__app')
    page.click('[data-mode=ride]')
    page.evaluate("__app.S.vis=700;__app.S.dist=1609;__app.S.seed=3;__app.S.map.idle=30;__app.S.steady=75")
    page.click('#session-button'); page.check('#rec-video'); page.click('#rec-toggle')
    page.click('#session-sheet [data-close]'); page.click('#demo-button'); page.wait_for_timeout(2200)
    page.click('#session-button'); page.click('#rec-toggle')
    deadline = time.time() + 15
    while len(downloads) < 2 and time.time() < deadline: page.wait_for_timeout(100)
    assert len(downloads) == 2, f'Expected JSON and native video, received {len(downloads)}'
    saved = []
    for d in downloads:
        target = OUT / d.suggested_filename; d.save_as(target); saved.append(target)
    session_file = next(f for f in saved if f.suffix == '.json')
    video = next(f for f in saved if f.suffix in ('.webm', '.mp4'))
    session = json.loads(session_file.read_text())
    assert session['synthetic'] and session['distanceRelative']
    assert 680 < session['start']['vis'] < 730 and session['start']['seed'] == 3
    assert session['start']['map']['idle'] == 30
    assert session['lanes']['dist'][0][1] == 0 and 0 <= session['lanes']['dist'][-1][1] < 100
    assert video.stat().st_size > 1000
    print(f'PASS native video save: {video.stat().st_size} bytes; mixed-source JSON correctly labeled', flush=True)
    malformed = OUT / 'malformed-session.json'; malformed.write_text(json.dumps({'schema': session['schema'], 'durationMs': 1000, 'lanes': {'biome': [[0, 999]]}}))
    assert page.evaluate('__app.bio.demoOn')
    page.set_input_files('#replay-file', str(malformed)); page.wait_for_timeout(150)
    assert page.evaluate('__app.bio.demoOn && !__app.bio.replayOn')
    assert 'could not be replayed' in page.locator('#rec-status').inner_text()
    print('PASS invalid replay preserves the running demo', flush=True)
    page.evaluate('__app.S.vis=9000;__app.S.seed=19;__app.S.map.idle=55')
    page.set_input_files('#replay-file', str(session_file)); page.wait_for_timeout(150)
    state = page.evaluate('({vis:__app.S.vis,seed:__app.S.seed,idle:__app.S.map.idle,replay:__app.bio.replayOn,dist:__app.S.dist})')
    assert state['replay'] and state['seed'] == 3 and state['idle'] == 30 and state['dist'] < 100
    assert abs(state['vis'] - session['start']['vis']) < 12
    print('PASS replay restores route start and cadence mapping', flush=True)
    page.click('#session-button'); page.click('#replay-stop'); page.set_input_files('#ghost-file', str(session_file)); page.wait_for_timeout(150)
    ghost = page.evaluate('({first:__app.S.ghost.dist[0][1],total:__app.S.ghost.total,vis:__app.S.vis,seed:__app.S.seed})')
    assert ghost['first'] == 0 and ghost['total'] < 100 and ghost['seed'] == 3
    assert abs(ghost['vis'] - session['start']['vis']) < 12
    assert not errors, errors
    print('PASS ghost starts at zero on the recorded route; no page errors', flush=True)
    page.screenshot(path=str(OUT / 'bio-session-replay.png'))
    (OUT / 'results.json').write_text(json.dumps({'state': state, 'ghost': ghost, 'videoBytes': video.stat().st_size, 'errors': errors}, indent=2))
    browser.close()
