// Stage 3, step 3a-iii: are there stretches of fast change (climbs, falls, or jumpy stretches) beyond ordinary momentum?
// fastStretchTest: drift persistence (lags 3-20 against synthetic records from the record's own momentum and residuals)
// or jumpy stretches (regimeStretchTest on the momentum residuals), each at half of 1%.
// Run: node tests/autonomic_fast_stretch_qc.cjs [engine path]
//
// Written before this file's first run (2026-11-09). The rule was chosen after a 50-record probe (seed 31337); these
// records use a new seed, so the rule is not checked on the records that shaped it.
//   Records with NO stretches (one hour of 5-second steps, 150 each): independent steps, Gaussian and heavy-tailed (t4);
//   momentum 0.5 Gaussian, 0.5 t4, 0.8 Gaussian, an oscillation (0.5, -0.3), 0.5 t3. False "stretches" at most 3.3% in
//   each and 2% pooled (stated level 1%).
//   Records WITH stretches (120 each): steady climbs and falls (+-1.5 a step); jumpy stretches 3x with momentum 0.5; 2x
//   and short (~10 steps) with momentum 0.5; 3x without momentum. Found in at least 90% of each.
//   Known limit, accepted 2026-11-09: climbs and falls carried by momentum (drift +-0.75 with
//   momentum 0.5, so +-1.5 a step once under way) were found in 58% of the probe's records. Guard: at least 45% here.
//   The synthetic-record p-value must not overstate: drift p < 0.05 in at most 7.5% of the records without stretches.
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261114), randn = M.makeNormal(rng);
const pc = x => `${(100 * x).toFixed(1)}%`;
const t0 = Date.now();
const T = 720, BURN = 200;

const tDraw = df => () => { let c = 0; for (let j = 0; j < df; j++) { const z = randn(); c += z * z; } return randn() / Math.sqrt(c / df); };
const momentum = (phi, draw = randn) => () => {
  const r = [];
  for (let t = 0; t < T + BURN; t++) { let v = draw(); for (let j = 0; j < phi.length; j++) v += phi[j] * (r[t - 1 - j] ?? 0); r.push(v); }
  return r.slice(BURN);
};
const switching = (P, c, phi, sigma) => () => {
  let k = 0;
  const r = [];
  for (let t = 0; t < T + BURN; t++) {
    if (t > 0) { const u = rng(); let acc = 0, j = 0; for (; j < P[k].length - 1; j++) { acc += P[k][j]; if (u < acc) break; } k = j; }
    let v = c[k] + sigma[k] * randn();
    for (let j = 0; j < phi.length; j++) v += phi[j] * (r[t - 1 - j] ?? 0);
    r.push(v);
  }
  return r.slice(BURN);
};
const s30 = 1 - 0.05 * 0.3 / 0.7;
const CLIMB3 = [[s30, (1 - s30) / 2, (1 - s30) / 2], [0.05, 0.95, 0], [0.05, 0, 0.95]];

const NULLS = [
  ['independent, Gaussian', momentum([])],
  ['independent, heavy tails t4', momentum([], tDraw(4))],
  ['momentum 0.5', momentum([0.5])],
  ['momentum 0.5, t4', momentum([0.5], tDraw(4))],
  ['momentum 0.8', momentum([0.8])],
  ['oscillation 0.5 -0.3', momentum([0.5, -0.3])],
  ['momentum 0.5, t3', momentum([0.5], tDraw(3))]
];
const ALTS = [
  ['steady climbs and falls +-1.5', switching(CLIMB3, [0, 1.5, -1.5], [], [1, 1, 1])],
  ['jumpy 3x, momentum 0.5', switching([[s30, 1 - s30], [0.05, 0.95]], [0, 0], [0.5], [1, 3])],
  ['jumpy 2x short, momentum 0.5', switching([[0.97, 0.03], [0.1, 0.9]], [0, 0], [0.5], [1, 2])],
  ['jumpy 3x, no momentum', switching([[s30, 1 - s30], [0.05, 0.95]], [0, 0], [], [1, 3])]
];
const LIMIT = ['climbs and falls carried by momentum', switching([[0.97, 0.015, 0.015], [0.05, 0.95, 0], [0.05, 0, 0.95]], [0, 0.75, -0.75], [0.5], [1, 1.2, 1.2])];

// No stretches.
{
  const lines = [];
  let pooled = 0, n = 0, over = false, drift05 = 0;
  for (const [label, draw] of NULLS) {
    let hit = 0;
    for (let i = 0; i < 150; i++) { const s = M.fastStretchTest(draw(), { fit: false }); hit += s.stretches; drift05 += s.pDrift < 0.05; }
    if (hit / 150 > 10 / 300) over = true;
    pooled += hit; n += 150;
    lines.push(`${label} ${pc(hit / 150)}`);
  }
  rec(!over && pooled / n <= 0.02, 'No stretches: false "stretches" at most 3.3% in each of 7 kinds and 2% pooled', `${lines.join('; ')}; pooled ${pc(pooled / n)}`);
  rec(drift05 / n <= 0.075, 'The synthetic-record p-value does not overstate: drift p < 0.05 in at most 7.5% of records without stretches', `${pc(drift05 / n)} of ${n}`);
}

// Stretches present.
{
  const lines = [];
  let ok = true;
  for (const [label, draw] of ALTS) {
    let hit = 0;
    for (let i = 0; i < 120; i++) hit += M.fastStretchTest(draw(), { fit: false }).stretches;
    if (hit / 120 < 0.9) ok = false;
    lines.push(`${label} ${pc(hit / 120)}`);
  }
  rec(ok, 'Stretches found in at least 90% of each of 4 kinds', lines.join('; '));
}

// The accepted limit, guarded.
{
  let hit = 0;
  for (let i = 0; i < 120; i++) hit += M.fastStretchTest(LIMIT[1](), { fit: false }).stretches;
  rec(hit / 120 >= 0.45, `Known limit (accepted 2026-11-09): ${LIMIT[0]} found in at least 45% (probe: 58%)`, `${pc(hit / 120)} of 120`);
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
