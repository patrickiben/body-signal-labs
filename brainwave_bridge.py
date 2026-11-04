#!/usr/bin/env python3
"""Open Body Signal Labs with an optional, local Muse EEG connection.

The existing Autonomic Telemetry bridge owns Bluetooth, Muse decoding,
feature extraction and the HTTP event/control API. This launcher supplies
only the Body page and its same-origin relay configuration. Nothing scans
or pairs until the user requests it in the page.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.util
import json
from pathlib import Path
import re
import secrets
import signal
import sys
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent
APP = "biofeedback-path-cockpit.html"
DEFAULT_AUTONOMIC_ROOT = ROOT.parent / "autonomic-telemetry"
# The built pages have inline assets. Never expose Python, app source, a
# directory listing, or arbitrary files from either checkout.
STATIC_FILES = frozenset({
    "index.html", "field-guide.html", "endless-cockpit.html",
    "docs/EEG_SETUP.md", "docs/BIOFEEDBACK.md", "docs/METHODS.md",
    "docs/INPUTS.md", "docs/biofeedback-path-cockpit.jpg", "docs/biofeedback-brainwaves.jpg",
    "docs/endless-cockpit.jpg", "docs/tropical-preserve.jpg",
    "docs/rainbow-orbit.jpg", "docs/autonomic-telemetry.jpg",
})


class SetupError(RuntimeError):
    """A missing checkout or dependency with an actionable setup message."""


def load_runtime(autonomic_root):
    """Import the selected bridge as an isolated package, without copying it."""
    root = Path(autonomic_root).expanduser().resolve()
    package = root / "bridge"
    required = ("__init__.py", "server.py", "features.py", "muse.py", "requirements.txt")
    if any(not (package / name).is_file() for name in required):
        raise SetupError(
            f"Autonomic bridge not found at {root}. Clone the complete "
            "https://github.com/patrickiben/autonomic-telemetry repository beside "
            "body-signal-labs, or pass --autonomic-root /path/to/autonomic-telemetry. "
            "The checkout must include bridge/server.py, features.py and muse.py."
        )
    # Keep the reused checkout read-only, including on later Muse imports.
    sys.dont_write_bytecode = True
    name = "_body_autonomic_" + hashlib.sha256(str(root).encode()).hexdigest()[:16]
    try:
        if name not in sys.modules:
            spec = importlib.util.spec_from_file_location(
                name, package / "__init__.py", submodule_search_locations=[str(package)]
            )
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            spec.loader.exec_module(module)
        runtime = importlib.import_module(name + ".server")
    except (ImportError, OSError, SyntaxError) as error:
        raise SetupError(f"Could not load the Autonomic bridge at {root}: {error}. Use Python 3.10 or newer and a complete, current checkout.") from error
    if any(not callable(getattr(runtime, key, None)) for key in ("Hub", "Engine", "RelayServer", "handler_for")):
        raise SetupError("This Autonomic checkout lacks the local bridge API. Update that checkout, then retry.")
    return runtime


def require_bluetooth(autonomic_root):
    if importlib.util.find_spec("bleak") is None:
        requirements = Path(autonomic_root).expanduser().resolve() / "bridge/requirements.txt"
        raise SetupError(
            "Bluetooth dependency missing. In your Python environment run:\n"
            f'  "{sys.executable}" -m pip install -r "{requirements}"\n'
            "Then run this launcher with the same Python. --simulate needs no Bluetooth dependency."
        )


def inject_config(html, hub, token):
    config = json.dumps({"base": f"/{token}/", "session": hub.session, "simulated": bool(hub.simulated)}, separators=(",", ":"))
    config = config.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    script = "<script>window.__BODY_EEG_RELAY__=" + config + ";</script>\n"
    first_script = re.search(r"<script\b", html, re.IGNORECASE)
    if first_script is None:
        raise SetupError(f"{APP} has no app scripts. Rebuild it with python3 build.py.")
    # Configure the relay before any app module boots. Only this served copy
    # may connect locally; a restrictive published-page policy stays intact.
    html = html.replace("connect-src 'none'", "connect-src 'self'")
    first_script = re.search(r"<script\b", html, re.IGNORECASE)
    return html[:first_script.start()] + script + html[first_script.start():]


def public_sibling_links(html):
    # The private server contains only Body's files. Preserve the family's
    # navigation without leaking the private path or serving other checkouts.
    for repository in ("autonomic-telemetry", "generative-av-labs"):
        html = html.replace(f"../{repository}/", f"https://patrickiben.github.io/{repository}/")
    return html


def handler_for(runtime, hub, engine, token, body_root=ROOT):
    root = Path(body_root).resolve()
    parent = runtime.handler_for(hub, engine, token)

    class BodyHandler(parent):
        def valid_host(self):
            hosts = self.headers.get_all("Host", [])
            if len(hosts) != 1 or hosts[0].lower() not in self.server.allowed_authorities:
                self.reply(403, {"error": "Open the private link printed by this launcher."})
                return False
            return True

        def do_GET(self):
            if not self.valid_host():
                return
            relative = self.relative_path()
            if relative in {"api/state", "api/events"}:
                return super().do_GET()
            if relative == "":
                relative = "index.html"
            elif relative == APP:
                pass
            elif relative not in STATIC_FILES:
                return self.reply(404, {"error": "File not found. Open the private launcher link."})
            filename = (root / relative).resolve()
            if not filename.is_relative_to(root) or not filename.is_file():
                return self.reply(404, {"error": "File not found"})
            try:
                if filename.suffix == ".html":
                    body = public_sibling_links(filename.read_text(encoding="utf-8"))
                    if relative == APP:
                        body = inject_config(body, hub, token)
                else:
                    body = filename.read_bytes()
            except (OSError, UnicodeError, SetupError):
                return self.reply(503, {"error": "The built Body page is unavailable. Rebuild it with python3 build.py."})
            suffix = filename.suffix
            content_type = {".html": "text/html; charset=utf-8", ".md": "text/plain; charset=utf-8", ".jpg": "image/jpeg"}[suffix]
            return self.reply(200, body, content_type)

        def do_POST(self):
            if self.valid_host():
                # Preserve the bridge's exact Origin, Sec-Fetch-Site, JSON,
                # request-size and command checks; no CORS proxy is added.
                return super().do_POST()

    return BodyHandler


def create_server(runtime, host="127.0.0.1", port=8765, simulated=False, body_root=ROOT, engine_factory=None):
    root = Path(body_root).resolve()
    if not (root / APP).is_file():
        raise SetupError(f"Built page missing: {root / APP}. Run python3 build.py in Body Signal Labs first.")
    token = secrets.token_urlsafe(24)
    hub = runtime.Hub(simulated=simulated)
    engine = (engine_factory or runtime.Engine)(hub)
    try:
        server = runtime.RelayServer((host, port), handler_for(runtime, hub, engine, token, root))
    except OSError:
        # The engine has not started; closing its unused loop needs no relay
        # shutdown and cannot scan, connect, or wait for Bluetooth.
        if hasattr(engine, "loop"):
            engine.loop.close()
        raise
    actual_port = server.server_address[1]
    addresses = {host, server.server_address[0]}
    if host == "0.0.0.0":
        addresses.update(runtime.local_addresses())
        addresses.discard("0.0.0.0")
    if "127.0.0.1" in addresses:
        addresses.add("localhost")
    server.allowed_authorities = {f"{address}:{actual_port}".lower() for address in addresses}
    if actual_port == 80:
        server.allowed_authorities.update(address.lower() for address in addresses)
    browser_host = "127.0.0.1" if host == "0.0.0.0" else host
    server.private_url = f"http://{browser_host}:{actual_port}/{token}/{APP}"
    server.relay_engine, server.relay_hub = engine, hub
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--autonomic-root", type=Path, default=DEFAULT_AUTONOMIC_ROOT, help="Autonomic Telemetry checkout (default: sibling autonomic-telemetry)")
    parser.add_argument("--host", default="127.0.0.1", help="IPv4 bind address; default: this Mac only (127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", help="Open the private Body page in your browser")
    parser.add_argument("--simulate", action="store_true", help="Explicit synthetic Muse test; never accesses Bluetooth")
    args = parser.parse_args(argv)
    if sys.version_info < (3, 10):
        parser.error("Use Python 3.10 or newer.")
    if not 0 <= args.port <= 65535:
        parser.error("Port must be 0–65535 (0 chooses an available port).")
    try:
        runtime = load_runtime(args.autonomic_root)
        if not args.simulate:
            require_bluetooth(args.autonomic_root)
        server = create_server(runtime, args.host, args.port, args.simulate)
    except (SetupError, OSError) as error:
        parser.error(f"{error}\nIf the port is in use, choose another with --port 8766.")
    engine = server.relay_engine
    engine.start()
    print("\nBody Signal Labs · local brainwave bridge", flush=True)
    print("SYNTHETIC TEST — no wearable data" if args.simulate else "Ready. Bluetooth starts only after Connect and your device selection.", flush=True)
    print(server.private_url, flush=True)
    print("Choose Brainwaves, then Connect. Keep this private link and this Terminal window open. Ctrl+C stops the bridge.", flush=True)
    if args.host not in {"127.0.0.1", "localhost"}:
        print("This bind address permits local-network access. The link grants control; HTTP traffic is not encrypted. Use only a trusted network.", flush=True)
    if args.open:
        webbrowser.open(server.private_url)
    def stop_server(*_):
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGINT, stop_server)
    signal.signal(signal.SIGTERM, stop_server)
    try:
        server.serve_forever(poll_interval=.25)
    finally:
        engine.close()
        server.server_close()
        engine.loop.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
