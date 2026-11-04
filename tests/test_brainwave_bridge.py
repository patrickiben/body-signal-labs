"""Optional bridge checks. No physical Bluetooth, pairing or device reads.

AUTONOMIC_ROOT=/path/to/autonomic-telemetry python3 -m unittest discover \
    -s tests -p test_brainwave_bridge.py -v

The HTTP checks exercise the actual external bridge handler; they are skipped
with an explicit reason when that optional checkout is absent.
"""
import http.client
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
import threading
import time
import types
import unittest
from unittest import mock
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("body_brainwave_bridge", ROOT / "brainwave_bridge.py")
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)
AUTONOMIC_ROOT = Path(os.environ.get("AUTONOMIC_ROOT", launcher.DEFAULT_AUTONOMIC_ROOT)).expanduser()


class ConfigurationTests(unittest.TestCase):
    def test_configuration_precedes_every_app_script_and_is_honest(self):
        hub = types.SimpleNamespace(session="private-session", simulated=True)
        source = "<html><head><script>firstBoot()</script></head><body><script>secondBoot()</script></body></html>"
        result = launcher.inject_config(source, hub, "private-token")
        self.assertLess(result.index("window.__BODY_EEG_RELAY__"), result.index("firstBoot"))
        encoded = re.search(r"window\.__BODY_EEG_RELAY__=(.*?);</script>", result).group(1)
        self.assertEqual(json.loads(encoded), {"base": "/private-token/", "session": "private-session", "simulated": True})
        self.assertEqual(result.count("window.__BODY_EEG_RELAY__"), 1)

    def test_injected_json_cannot_end_the_script(self):
        hub = types.SimpleNamespace(session="</script><script>alert(1)</script>", simulated=False)
        result = launcher.inject_config("<script>boot()</script>", hub, "private-token")
        self.assertEqual(result.count("<script>"), 2)
        self.assertIn("\\u003c/script\\u003e", result)
        self.assertIn('"simulated":false', result)

    def test_missing_checkout_is_actionable(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(launcher.SetupError, "--autonomic-root"):
                launcher.load_runtime(directory)

    def test_missing_bluetooth_dependency_explains_same_python_install(self):
        with mock.patch.object(launcher.importlib.util, "find_spec", return_value=None):
            with self.assertRaisesRegex(launcher.SetupError, "-m pip install -r"):
                launcher.require_bluetooth(AUTONOMIC_ROOT)

    def test_source_without_a_built_app_fails_before_serving(self):
        with self.assertRaisesRegex(launcher.SetupError, "Rebuild"):
            launcher.inject_config("<html><body>no scripts</body></html>", types.SimpleNamespace(session="s", simulated=False), "token")


class FakeEngine:
    def __init__(self, hub):
        self.hub, self.commands = hub, []

    def command(self, action, device=None, identifier=None):
        self.commands.append((action, device, identifier))


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.runtime = launcher.load_runtime(AUTONOMIC_ROOT)
        except launcher.SetupError as error:
            raise unittest.SkipTest(f"Optional HTTP integration needs AUTONOMIC_ROOT: {error}")
        cls.directory = tempfile.TemporaryDirectory()
        cls.body_root = Path(cls.directory.name)
        siblings = "<a href='../autonomic-telemetry/'>Autonomic</a><script>const sibling='../generative-av-labs/index.html';</script>"
        (cls.body_root / launcher.APP).write_text("<!doctype html><html><body><script>window.appBoot=true;</script>" + siblings + "</body></html>", encoding="utf-8")
        (cls.body_root / "index.html").write_text("<!doctype html><title>Body Signal Labs</title><a href='biofeedback-path-cockpit.html'>Biofeedback</a>" + siblings, encoding="utf-8")
        (cls.body_root / "docs").mkdir()
        (cls.body_root / "docs/EEG_SETUP.md").write_text("Local EEG setup instructions", encoding="utf-8")
        (cls.body_root / "secret.txt").write_text("must not escape", encoding="utf-8")
        cls.server = launcher.create_server(cls.runtime, port=0, simulated=True, body_root=cls.body_root, engine_factory=FakeEngine)
        cls.thread = threading.Thread(target=cls.server.serve_forever, kwargs={"poll_interval": .02}, daemon=True)
        cls.thread.start()
        url = urlsplit(cls.server.private_url)
        cls.authority, cls.prefix = url.netloc, url.path.rsplit("/", 1)[0] + "/"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        cls.directory.cleanup()

    def request(self, path, method="GET", payload=None, headers=None):
        connection = http.client.HTTPConnection(self.authority, timeout=3)
        try:
            connection.request(method, path, body=payload, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_opening_the_page_and_state_never_scans_or_connects(self):
        before = list(self.server.relay_engine.commands)
        code, headers, body = self.request(self.prefix + launcher.APP)
        self.assertEqual(code, 200)
        self.assertLess(body.index(b"window.__BODY_EEG_RELAY__"), body.index(b"window.appBoot"))
        code, _, state = self.request(self.prefix + "api/state")
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(state)["simulated"])
        self.assertEqual(self.server.relay_engine.commands, before)
        self.assertIn("no-store", headers["Cache-Control"])
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_private_root_keeps_normal_home_navigation(self):
        code, _, home = self.request(self.prefix)
        self.assertEqual(code, 200)
        self.assertIn(b"Body Signal Labs", home)
        self.assertNotIn(b"__BODY_EEG_RELAY__", home)
        self.assertTrue(self.server.private_url.endswith("/" + launcher.APP))

    def test_sibling_links_work_in_app_home_and_field_guide_without_other_checkouts(self):
        guide = self.body_root / "field-guide.html"
        original = "<a href='../autonomic-telemetry/docs/METHODS.md'>Methods</a><script>const href='../generative-av-labs/';</script><a href='biofeedback-path-cockpit.html'>Local cockpit</a>"
        guide.write_text(original, encoding="utf-8")
        try:
            for name in (launcher.APP, "", "field-guide.html"):
                code, headers, body = self.request(self.prefix + name)
                self.assertEqual(code, 200)
                self.assertNotIn(b"../autonomic-telemetry/", body)
                self.assertNotIn(b"../generative-av-labs/", body)
                self.assertIn(b"https://patrickiben.github.io/autonomic-telemetry/", body)
                self.assertIn(b"https://patrickiben.github.io/generative-av-labs/", body)
                self.assertEqual(headers["Referrer-Policy"], "no-referrer")
            self.assertEqual(guide.read_text(encoding="utf-8"), original)
            self.assertIn(b"href='biofeedback-path-cockpit.html'", self.request(self.prefix)[2])
        finally:
            guide.unlink()

    def test_private_token_and_static_allowlist_deny_traversal_and_source(self):
        denied = ["/", "/api/state", "/incorrect/api/state", "/" + self.prefix.strip("/") + "-other/api/state"]
        denied += [self.prefix + name for name in (
            "brainwave_bridge.py", "src/bio.js", "bridge/server.py", "bridge/client.js", ".git/config",
            "secret.txt", "../secret.txt", "docs/../secret.txt", "docs/%2e%2e/secret.txt",
            "docs/%252e%252e/secret.txt", "docs%5c..%5csecret.txt", "Autonomic_Telemetry_Console.html",
        )]
        for path in denied:
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)
        self.assertEqual(self.request(self.prefix + launcher.APP)[0], 200)
        self.assertEqual(self.request(self.prefix + "docs/EEG_SETUP.md")[0], 200)

    def test_whitelisted_symlink_cannot_escape_body_root(self):
        with tempfile.TemporaryDirectory() as outside:
            external = Path(outside) / "private.html"
            external.write_text("private", encoding="utf-8")
            link = self.body_root / "field-guide.html"
            link.symlink_to(external)
            try:
                self.assertEqual(self.request(self.prefix + "field-guide.html")[0], 404)
            finally:
                link.unlink()

    def test_wrong_host_is_rejected_even_with_matching_attacker_origin(self):
        for host in ("attacker.invalid", "127.0.0.1:1", "attacker.invalid:" + self.authority.split(":")[1]):
            with self.subTest(host=host):
                self.assertEqual(self.request(self.prefix, headers={"Host": host})[0], 403)
                headers = {"Host": host, "Origin": "http://" + host, "Content-Type": "application/json"}
                self.assertEqual(self.request(self.prefix + "api/control", "POST", '{"action":"scan"}', headers)[0], 403)

    def test_inherited_control_origin_and_content_checks_stay_intact(self):
        payload = '{"action":"scan","device":"muse"}'
        own = {"Origin": "http://" + self.authority, "Content-Type": "application/json"}
        for headers in ({"Content-Type": "application/json"}, {**own, "Origin": "https://example.invalid"}, {**own, "Sec-Fetch-Site": "cross-site"}):
            self.assertEqual(self.request(self.prefix + "api/control", "POST", payload, headers)[0], 403)
        self.assertEqual(self.request("/incorrect/api/control", "POST", payload, own)[0], 404)
        self.assertEqual(self.request(self.prefix + "api/control", "POST", payload, {**own, "Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request(self.prefix + "api/control", "POST", "x" * 2049, own)[0], 413)
        self.assertEqual(self.request(self.prefix + "api/control", "POST", "[]", own)[0], 400)
        self.assertEqual(self.request(self.prefix + "api/control", "POST", payload, own)[0], 202)
        self.assertEqual(self.server.relay_engine.commands[-1], ("scan", "muse", None))

    def test_events_use_the_same_private_session_and_synthetic_label(self):
        connection = http.client.HTTPConnection(self.authority, timeout=3)
        try:
            connection.request("GET", self.prefix + "api/events")
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.getheader("Content-Type"), "text/event-stream")
            hello = json.loads(response.readline()[6:])
            self.assertEqual(hello["kind"], "hello")
            self.assertEqual(hello["session"], self.server.relay_hub.session)
            self.assertTrue(hello["payload"]["simulated"])
        finally:
            connection.close()

    def test_each_launcher_gets_a_fresh_private_path_and_session(self):
        second = launcher.create_server(self.runtime, port=0, body_root=self.body_root, engine_factory=FakeEngine)
        try:
            self.assertNotEqual(urlsplit(second.private_url).path.rsplit("/", 1)[0] + "/", self.prefix)
            self.assertNotEqual(second.relay_hub.session, self.server.relay_hub.session)
        finally:
            second.server_close()

    def test_real_simulator_stays_idle_until_explicit_commands(self):
        # Reuse the real Engine and feature extractor. --simulate selects its
        # synthetic adapter, so no Bleak import or physical scan is needed.
        hub = self.runtime.Hub(simulated=True)
        engine = self.runtime.Engine(hub)
        engine.start()
        subscriber = hub.subscribe()
        try:
            time.sleep(.05)
            self.assertEqual(hub.snapshot()["sequence"], 0)
            self.assertTrue(subscriber.empty())
            engine.command("scan", "muse")
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline and not hub.snapshot()["discovery"]["devices"]:
                time.sleep(.01)
            self.assertTrue(any(d["id"] == "demo-muse" for d in hub.snapshot()["discovery"]["devices"]))
            self.assertEqual(hub.snapshot()["devices"]["muse"]["phase"], "idle")
            engine.command("connect", "muse", "demo-muse")
            deadline = time.monotonic() + 3
            raw = None
            while time.monotonic() < deadline:
                event = subscriber.get(timeout=3)
                if event["kind"] == "raw" and event["payload"]["type"] == "eeg":
                    raw = event["payload"]
                    break
            self.assertIsNotNone(raw)
            self.assertEqual(raw["source"], "synthetic")
            self.assertEqual(raw["device"], "muse")
        finally:
            hub.unsubscribe(subscriber)
            engine.close()
            engine.loop.close()


if __name__ == "__main__":
    unittest.main()
