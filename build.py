#!/usr/bin/env python3
"""Inline src/ into self-contained pages, so each one opens by double-click and needs no other file."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
SITE_NAME = "Body Signal Labs"
REPO_URL = "https://github.com/patrickiben/body-signal-labs"


def fill(text):
    out = text.replace("__SITE_NAME__", SITE_NAME).replace("__REPO_URL__", REPO_URL)
    if "__BSL_MANUSCRIPT_MATH_JS__" in out:
        out = out.replace("__BSL_MANUSCRIPT_MATH_JS__", (SRC / "bsl-manuscript-math.js").read_text())
    return out


HEAD = """<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="{theme}">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="icon" href="data:image/svg+xml,{icon}">
<style>
{css}
</style>
</head>
"""
ICON = "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23101525'/%3E%3Cpath d='M5 17h6l2.5-6 4 11 2.5-5H27' fill='none' stroke='%23b8b7ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"

ONLY = set(sys.argv[1:])     # build.py name.html rebuilds just that page


def script(*names):
    return "\n".join(f"<script>\n{(SRC / n).read_text()}\n</script>" for n in names)


def page(out, title, description, scripts, theme="#101525", extra_css="", base=("family.js", "chrome.js", "gl.js")):
    if ONLY and out not in ONLY:
        return
    css = (SRC / "shell.css").read_text() + (SRC / "family.css").read_text() + extra_css
    html = HEAD.format(title=title, description=description, theme=theme, icon=ICON, css=css)
    html += '<body>\n<main class="scene" id="scene" aria-label="' + title + '">\n'
    html += '<canvas id="stage" role="img" aria-label="' + description + '"></canvas>\n</main>\n'
    html += script(*base, *scripts) + "\n</body>\n</html>\n"
    html = fill(html)
    (ROOT / out).write_text(html)
    print(f"{out}: {len(html) // 1024} KB")


def static(out, src, title, description):
    if ONLY and out not in ONLY:
        return
    css = (SRC / "shell.css").read_text() + (SRC / "family.css").read_text() + (SRC / "site.css").read_text()
    html = HEAD.format(title=title, description=description, theme="#101525", icon=ICON, css=css)
    html += (SRC / src).read_text()
    html = fill(html)
    (ROOT / out).write_text(html)
    print(f"{out}: {len(html) // 1024} KB")


if __name__ == "__main__":
    page("endless-cockpit.html", "Endless Cockpit", "Nine procedural cycling routes: Golden coast, Tropical, Meadow lanes, Autumn Lake, Red canyon, Rainbow orbit, Misty ridges, Snake Way above golden clouds and Tron grid, moving at your cadence.", ["ride.js", "cadence-motion.js", "cyclingscene.js", "endless.js"], extra_css=(SRC / "endless.css").read_text())
    page("biofeedback-path-cockpit.html", "Biofeedback Path Cockpit", "Nine cycling scenes whose weather, grade and fog follow your body, with cadence-powered riding or an optional Muse S Athena EEG balance game control. Not a medical device.", ["vendor/autonomic/research-math.js", "vendor/autonomic/multivariate-engine.js", "bio.js", "eeg-drive.js", "cadence-motion.js", "pathscene.js", "cyclingscene.js", "midi-drive.js", "biofeedback.js"], extra_css=(SRC / "biofeedback.css").read_text())
    static("index.html", "index.src.html", "Body Signal Labs", "Autonomic Telemetry, Endless Cockpit and Biofeedback Path Cockpit: immersive scenes that follow signals from your body, in the browser.")
    static("field-guide.html", "field-guide.src.html", "Field Guide", "How to connect a cadence or heart-rate sensor to these pages, what each status means, and what is measured or inferred.")
    static("Body_Signal_Labs_Offline.html", "offline.src.html", "Workbench · Body Signal Labs", "The math from three research papers, run in your browser on sample rides and on a ride you export from the Biofeedback Path Cockpit.")
    static("offline.html", "offline.src.html", "Workbench · Body Signal Labs", "The math from three research papers, run in your browser on sample rides and on a ride you export from the Biofeedback Path Cockpit.")
