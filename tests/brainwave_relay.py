#!/usr/bin/env python3
"""Actual launcher HTTP/SSE -> browser -> EEG ride -> saved/replayed session.

Only the relay engine is replaced by explicitly SYNTHETIC, eligible feature
fixtures with the Athena field shape. HTTP, Origin checks, config injection,
fetch/EventSource, controller time/calibration, canvas and UI are real. This
does not validate a physical headset or physiological interpretation.

AUTONOMIC_ROOT=/path/to/autonomic-telemetry python3 tests/brainwave_relay.py [output]
"""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("body_brainwave_bridge", ROOT / "brainwave_bridge.py")
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="body-eeg-relay-"))
OUT.mkdir(parents=True, exist_ok=True)
runtime = launcher.load_runtime(os.environ.get("AUTONOMIC_ROOT", launcher.DEFAULT_AUTONOMIC_ROOT))
results = []


class SyntheticFeatureEngine:
    """No BLE methods or physical data. Publish only after explicit pairing."""
    def __init__(self, hub):
        self.hub = hub
        self.commands = []
        self.ratio = 1.0
        self.pause_features = False
        self.stopping = threading.Event()
        self.worker = None

    def command(self, action, device=None, identifier=None):
        self.commands.append((action, device, identifier))
        if action == "scan":
            self.hub.publish("devices", {"scanning": False, "error": "", "devices": [
                {"id": "synthetic-athena-fixture", "kind": "muse", "name": "Synthetic Athena test fixture"},
                {"id": "synthetic-hume-fixture", "kind": "hume", "name": "Synthetic Hume test fixture"},
            ]})
        elif action == "connect" and device == "muse" and identifier == "synthetic-athena-fixture":
            self.hub.publish("status", {"device": "muse", "phase": "streaming", "deviceName": "Synthetic Athena test fixture", "message": "Synthetic eligible-feature fixture; no physical headset."})
            self.worker = threading.Thread(target=self.publish, daemon=True)
            self.worker.start()
        elif action == "disconnect" and device == "muse":
            self.stopping.set()
            self.hub.publish("status", {"device": "muse", "phase": "disconnected", "message": "Synthetic fixture stopped."})
        else:
            raise ValueError("Unsupported synthetic test command")

    def publish(self):
        while not self.stopping.is_set():
            if not self.pause_features:
                stamp = int(time.time() * 1000)
                self.hub.publish("features", {"type": "features", "received_at": stamp,
                    "eeg_beta_alpha": self.ratio,
                    # Deliberately conflicting non-EEG fields must not drive
                    # the brainwave ride or populate physiological readings.
                    "heart_rate_bpm": 220, "pulse_rmssd_ms": 180, "cadence_rpm": 250,
                    "quality": {"eeg_beta_alpha": {"valid": True, "reason": "Synthetic eligible Athena-shaped feature fixture.",
                        "source": "muse:athena:eeg:0,1", "source_kind": "synthetic", "channels": [0, 1],
                        "received_at": stamp, "sample_rate_hz": 256, "window_seconds": 4,
                        "contact_verified": False, "timing_assumed": True}}})
                self.hub.publish("raw", {"device": "hume", "type": "heart_rate", "heart_rate_bpm": 220, "received_at": stamp})
            self.stopping.wait(1.01)

    def close(self):
        self.stopping.set()
        if self.worker:
            self.worker.join(timeout=2)


def check(name, passed, detail=None):
    results.append({"name": name, "pass": bool(passed), "detail": detail})
    print(("PASS " if passed else "FAIL ") + name + (" " + json.dumps(detail) if detail is not None else ""), flush=True)
    if not passed:
        raise AssertionError(name)


def reading(page):
    return page.evaluate("""() => ({phase: __app.eeg.state.phase, progress: __app.eeg.state.progress,
      score: __app.S.eegScore, ratio: __app.S.eegRatio, valid: __app.S.eegValid, drive: __app.S.eegDrive,
      speed: __app.S.speed, rpm: __app.S.rpm, hr: __app.bio.now.hr, rmssd: __app.bio.now.rmssd,
      power: __app.S.drivePower, label: document.getElementById('source-label').textContent,
      source: document.getElementById('source-badge').dataset.source,
      replay: __app.bio.replayOn, simulated: __app.S.eegSimulated})""")


server = launcher.create_server(runtime, port=0, simulated=True, engine_factory=SyntheticFeatureEngine)
thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .02}, daemon=True)
thread.start()
engine = server.relay_engine
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=["--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist"])
        try:
            context = browser.new_context(viewport={"width": 1100, "height": 760}, accept_downloads=True)
            page = context.new_page()
            errors, requests = [], []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url) if "/api/" in request.url else None)
            page.goto(server.private_url)
            page.wait_for_function("window.__app && __app.eeg")
            page.wait_for_timeout(600)
            check("launcher page boots without network or pairing", not requests and not engine.commands)
            config = page.evaluate("window.__BODY_EEG_RELAY__")
            check("actual injected config matches this synthetic relay session", config["session"] == server.relay_hub.session and config["simulated"] is True)
            page.locator('button[data-mode="ride"]').click()
            page.locator('[data-power="brainwaves"]').click()
            page.wait_for_timeout(200)
            check("selecting Brainwaves alone makes no relay request", not requests and not engine.commands)
            page.locator("#connect-button").click()
            page.locator("#eeg-start").click()
            page.wait_for_function("document.querySelector('#eeg-device option[value=\"synthetic-athena-fixture\"]')")
            choices = page.locator("#eeg-device option").evaluate_all("options => options.map(option => option.value).filter(Boolean)")
            check("real same-origin scan exposes Muse choices only", choices == ["synthetic-athena-fixture"] and len(engine.commands) == 1 and engine.commands[0][0] == "scan", choices)
            page.locator("#eeg-device").select_option("synthetic-athena-fixture")
            paired = time.monotonic()
            page.locator("#eeg-pair").click()
            page.wait_for_function("__app.eeg.state.progress > 0")
            page.wait_for_timeout(1500)
            initial = reading(page)
            check("calibration holds movement and labels synthetic provenance", initial["progress"] < 1 and initial["speed"] == 0 and initial["simulated"] and initial["source"] == "demo", initial)
            page.wait_for_function("__app.eeg.state.phase === 'ready' && __app.S.eegValid", timeout=30000)
            elapsed = time.monotonic() - paired
            check("20 distinct eligible windows calibrate over real elapsed time", elapsed >= 18 and page.evaluate("__app.eeg.state.baseline.samples") == 20, round(elapsed, 2))
            page.wait_for_timeout(2000)
            baseline = reading(page)
            check("EEG-only speed ignores unrelated heart and cadence fixture fields", baseline["speed"] > 1 and baseline["rpm"] == 0 and baseline["hr"] is None and baseline["rmssd"] is None and baseline["power"] == "brainwaves", baseline)
            # Zero beta is an accepted finite controller input. Its recording
            # must remain readable even though the logarithm uses a floor.
            engine.ratio = 0.0
            page.wait_for_function("__app.S.eegScore === 1 && __app.S.eegRatio === 0")
            page.wait_for_timeout(2000)
            high = reading(page)
            check("lower EEG ratio changes speed through the live relay", high["speed"] > baseline["speed"] and high["rpm"] == 0, high)
            page.locator("#connect-sheet").evaluate("element => element.close()")
            page.screenshot(path=str(OUT / "synthetic-relay-ready.png"))
            page.locator("#session-button").click()
            page.locator("#rec-video").uncheck()
            page.locator("#rec-toggle").click()
            page.wait_for_timeout(2200)
            with page.expect_download() as download_info:
                page.locator("#rec-toggle").click()
            saved_path = OUT / "synthetic-eeg-session.json"
            download_info.value.save_as(saved_path)
            saved = json.loads(saved_path.read_text())
            controls = [point[1] for point in saved["lanes"]["eeg"]]
            check("saved EEG session keeps drive choice and honest synthetic provenance", saved["synthetic"] is True and saved["start"]["drivePower"] == "brainwaves" and controls and all(v["simulated"] for v in controls) and any(v["ratio"] == 0 for v in controls))
            page.locator("#session-sheet").evaluate("element => element.close()")
            engine.pause_features = True
            page.wait_for_function("!__app.S.eegValid && __app.eeg.state.phase === 'stale'", timeout=8000)
            page.wait_for_timeout(1800)
            stale = reading(page)
            check("SSE heartbeats cannot keep an old EEG window live", stale["score"] is None and not stale["valid"] and stale["speed"] < high["speed"] * .5, stale)
            page.locator("#session-button").click()
            page.locator("#replay-file").set_input_files(str(saved_path))
            page.wait_for_function("__app.bio.replayOn && __app.S.eegValid && __app.S.eegRatio === 0")
            replay = reading(page)
            check("saved zero-ratio EEG replay works without a fresh sensor", replay["source"] == "replay" and replay["simulated"] and replay["rpm"] == 0 and replay["speed"] > 1, replay)
            page.wait_for_function("!__app.bio.replayOn", timeout=6000)
            page.locator("#connect-button").click()
            page.locator("#eeg-disconnect").click()
            page.wait_for_function("__app.eeg.state.phase === 'disconnected'")
            check("Disconnect reaches the actual same-origin control handler", engine.commands[-1] == ("disconnect", "muse", None))
            origin = urlsplit(server.private_url).netloc
            check("all relay requests stay on the same private origin and path", requests and all(urlsplit(url).netloc == origin and urlsplit(url).path.startswith(config["base"] + "api/") for url in requests))
            check("no browser exceptions in real relay, recording and replay flow", not errors, errors)
            context.close()
        finally:
            browser.close()
finally:
    engine.close()
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)
    (OUT / "results.json").write_text(json.dumps(results, indent=2))
print(f"{len(results)} actual relay/browser checks passed.")
