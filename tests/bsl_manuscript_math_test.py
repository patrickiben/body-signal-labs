#!/usr/bin/env python3
"""Air-gapped E2E & mathematical verification for Body_Signal_Labs_Offline.html, offline.html, and biofeedback-path-cockpit.html."""
import http.server
import subprocess
import sys
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def main():
    # 1. Run Node mathematical unit test suite
    res = subprocess.run(
        ["node", "--test", str(ROOT / "tests" / "bsl-manuscript-math.test.mjs")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    print(res.stdout.strip())
    if res.returncode != 0:
        print(res.stderr, file=sys.stderr)
        sys.exit(res.returncode)

    # 2. Run Air-Gapped Playwright E2E Verification
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{srv.server_port}"
    soft_args = [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
    ]
    bad = []

    with sync_playwright() as p:
        browser = p.chromium.launch(args=soft_args)
        for page_name in ("Body_Signal_Labs_Offline.html", "offline.html"):
            pg = browser.new_page(viewport={"width": 1440, "height": 900})
            errors = []
            external_reqs = []
            pg.on("pageerror", lambda e: errors.append(str(e)[:200]))
            pg.on("console", lambda m: errors.append(m.text[:200]) if m.type == "error" else None)

            def handle_route(route):
                url = route.request.url
                if url.startswith(base_url) or url.startswith("data:") or url.startswith("blob:"):
                    route.continue_()
                else:
                    external_reqs.append(url)
                    route.abort()

            pg.route("**/*", handle_route)
            pg.goto(f"{base_url}/{page_name}", wait_until="domcontentloaded")
            pg.wait_for_timeout(400)

            if len(pg.query_selector_all("nav.family a")) != 4:
                bad.append(f"{page_name}: suite bar does not have 4 links")

            state_check = pg.evaluate("""() => {
                const M = window.BSLManuscriptMath;
                const C = window.BSLManuscriptController;
                if (!M || !C) return { ok: false, reason: 'Missing BSLManuscriptMath or Controller' };
                const st = C.getState();
                return {
                    ok: Boolean(st && st.crt && st.lsa && st.anl && st.bio),
                    version: M.version,
                    anchorHash: st.anl.anchorHash,
                    fullBoundEp: st.anl.m3Recurrence.fullBoundEpisode,
                    dfaAlpha1: st.bio.hrvMastery.dfaAlpha1,
                    hrr60Bpm: st.bio.hrvMastery.hrr60Bpm,
                    hrvtZone: st.bio.hrvMastery.hrvtZone,
                    svgCount: document.querySelectorAll('#manuscript-workbench svg').length,
                    tableRows: document.querySelectorAll('#manuscript-workbench tbody tr').length
                };
            }""")

            if not state_check.get("ok"):
                bad.append(f"{page_name}: state check failed ({state_check})")
            if state_check.get("anchorHash") != "5c29a381eb7e":
                bad.append(f"{page_name}: wrong anchorHash {state_check.get('anchorHash')}")
            if state_check.get("fullBoundEp") != 280:
                bad.append(f"{page_name}: expected fullBoundEp 280, got {state_check.get('fullBoundEp')}")
            if state_check.get("svgCount", 0) < 8:
                bad.append(f"{page_name}: expected >= 8 SVGs, got {state_check.get('svgCount')}")
            if state_check.get("tableRows", 0) < 40:
                bad.append(f"{page_name}: expected >= 40 table rows, got {state_check.get('tableRows')}")

            # Switch through all 4 tabs and test regime switching
            for tab_key in ("lsa", "anl", "bio", "crt"):
                pg.click(f'#manuscript-workbench [data-mw-tab="{tab_key}"]')
                is_active = pg.evaluate(
                    f"document.getElementById('mw-pane-{tab_key}').classList.contains('active')"
                )
                if not is_active:
                    bad.append(f"{page_name}: tab {tab_key} did not activate")

            pg.select_option("#mw-regime-select", "threshold_grade_climb")
            pg.evaluate("document.getElementById('mw-regime-select').dispatchEvent(new Event('input'))")
            thresh_zone = pg.evaluate("window.BSLManuscriptController.getState().bio.hrvMastery.hrvtZone")
            if "Threshold Transition" not in thresh_zone:
                bad.append(f"{page_name}: expected Threshold Transition zone, got {thresh_zone}")

            pg.select_option("#mw-regime-select", "hiit_cadence_surge")
            pg.evaluate("document.getElementById('mw-regime-select').dispatchEvent(new Event('input'))")
            new_reg = pg.evaluate("window.BSLManuscriptController.getState().regimeKey")
            hiit_zone = pg.evaluate("window.BSLManuscriptController.getState().bio.hrvMastery.hrvtZone")
            if new_reg != "hiit_cadence_surge":
                bad.append(f"{page_name}: regime did not update to hiit_cadence_surge")
            if "Above HRVT2" not in hiit_zone:
                bad.append(f"{page_name}: expected Above HRVT2 zone, got {hiit_zone}")

            # Verify zero horizontal overflow at desktop (1440x900) and mobile (375x667)
            for vw, vh in ((1440, 900), (375, 667)):
                pg.set_viewport_size({"width": vw, "height": vh})
                pg.wait_for_timeout(100)
                overflow = pg.evaluate(
                    "document.documentElement.scrollWidth - document.documentElement.clientWidth"
                )
                if overflow > 1:
                    bad.append(f"{page_name}: horizontal overflow {overflow}px at {vw}x{vh}")

            if external_reqs:
                bad.append(f"{page_name}: external requests attempted: {external_reqs}")
            if errors:
                bad.append(f"{page_name}: console/page errors: {errors[0]}")

            print(
                f"{page_name}: {state_check.get('svgCount')} SVGs, "
                f"{state_check.get('tableRows')} table rows, "
                f"DFA alpha1={state_check.get('dfaAlpha1'):.2f}, "
                f"HRR60={state_check.get('hrr60Bpm'):.1f} bpm, "
                f"{len(external_reqs)} external reqs, {len(errors)} errors"
            )
            pg.close()

        # The cockpit never calls the manuscript engine, so it stays out of the cockpit page (phones would download
        # it for nothing). The engine lives in the offline workbench only; the cockpit must still load cleanly.
        pg = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)[:200]))
        pg.goto(f"{base_url}/biofeedback-path-cockpit.html", wait_until="domcontentloaded")
        pg.wait_for_timeout(600)
        has_math = pg.evaluate("Boolean(window.BSLManuscriptMath)")
        if has_math:
            bad.append("biofeedback-path-cockpit.html: the manuscript engine is inlined but the cockpit never calls it")
        if errors:
            bad.append(f"biofeedback-path-cockpit.html: {errors[0]}")
        print(f"biofeedback-path-cockpit.html: engine kept out={not has_math}, {len(errors)} errors")
        pg.close()
        browser.close()

    srv.shutdown()
    if bad:
        print("\n".join(bad), file=sys.stderr)
        sys.exit(1)
    print("All Body Signal Labs manuscript & biophysics E2E checks passed!")


if __name__ == "__main__":
    main()
