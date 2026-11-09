"""Put the heart-and-breathing-guide math into the Console, copied word for word from the Autonomic engine
(autonomic-math.js), so there is one source of the math. Only the functions Rest uses are copied: the
whole engine would also ship its comments and labels, which do not belong in the page.
Run after editing the engine. `--check` exits 1 if the Console's copy differs from the engine (for CI)."""
import re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
engine = (root / "autonomic-math.js").read_text(encoding="utf-8")
console_path = root / "Autonomic_Telemetry_Console.html"
START, END = "<!-- GUIDE_MATH_START -->", "<!-- GUIDE_MATH_END -->"
CONSTS = ["EPS", "clamp"]
FUNCS = ["mean", "variance", "sd", "median", "solveLinearSystem", "invertMatrix", "matMul", "matTranspose",
         "powerIterationSpectralRadius", "chiSquareSurvivalEven", "fitVarxNonneg", "breathingGuideInputs",
         "guideResponse", "standardizeColumns", "fitGuideAwareNetwork", "guidePhaseLocking", "gfevd"]

def const_line(name):
    hits = [l for l in engine.split("\n") if l.startswith(f"  const {name} = ")]
    assert len(hits) == 1, (name, len(hits))
    return hits[0]

def function_text(name):
    starts = [m.start() for m in re.finditer(rf"^  function {name}\(", engine, flags=re.M)]
    assert len(starts) == 1, (name, len(starts))
    a = starts[0]
    b = engine.index("\n  }\n", a) + len("\n  }")
    # include a comment block that sits directly above the function
    above = engine[:a].rstrip("\n").split("\n")
    lead = []
    if above and above[-1].strip().endswith("*/"):
        while above:
            line = above.pop()
            lead.insert(0, line)
            if line.strip().startswith("/*"):
                break
    if lead and "=====" in lead[0]:   # a section banner, not the function's own comment
        lead = []
    return ("\n".join(lead) + "\n" if lead else "") + engine[a:b]

body = "\n".join(const_line(c) for c in CONSTS) + "\n\n" + "\n\n".join(function_text(f) for f in FUNCS)
for word in ("anuscript", "zenodo", "doi:", "paper"):
    assert word not in body.lower(), f"copied math contains '{word}'"
block = (START + "\n<script>\n/* Heart-and-breathing-guide math for Rest, copied word for word from the Autonomic engine by\n"
         "   scripts/embed-guide-math.py. Edit the engine, then rerun the script. */\n"
         "(function (root) {\n  'use strict';\n" + body + "\n\n  root.AutonomicGuideMath = { fitGuideAwareNetwork, guidePhaseLocking };\n"
         "})(typeof globalThis !== 'undefined' ? globalThis : this);\n</script>\n" + END)
assert "</script" not in body.lower()
html = console_path.read_text(encoding="utf-8")
if START in html:
    assert html.count(START) == html.count(END) == 1
    a, b = html.index(START), html.index(END) + len(END)
    current = html[a:b]
    if "--check" in sys.argv:
        sys.exit(0 if current == block else print("Console guide math differs from the engine; run scripts/embed-guide-math.py") or 1)
    html = html[:a] + block + html[b:]
else:
    if "--check" in sys.argv:
        sys.exit(print("Console has no guide math block") or 1)
    anchor = "<!-- REST_LATTICE_END -->"
    assert html.count(anchor) == 1
    html = html.replace(anchor, anchor + "\n" + block)
console_path.write_text(html, encoding="utf-8")
print(f"guide math embedded: {len(FUNCS)} functions, {block.count(chr(10))} lines")
