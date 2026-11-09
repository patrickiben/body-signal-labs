// Stage 3, step 2: are there stretches of fast change at all, or only scattered big steps? (regimeStretchTest)
// Run: node tests/autonomic_regime_stretch_qc.cjs [engine path]
//
// Written before the first run, and not changed after it:
//   Records with NO fast stretches (one hour of 5-second steps, 200 each): N1 Gaussian steps; N2 heavy tails (t, 4 df);
//   N3 heavier tails (t, 3 df); N4 big steps that come one at a time (each step 3x larger with chance 0.2, independently).
//   Records WITH stretches (150 each): A1 steps 3x larger in stretches averaging 20 steps, 30% of the hour; A2 2x larger,
//   stretches ~10 steps; A3 3x larger, 20 steps, only 10% of the hour; A1 over 30 minutes.
//   A rule qualifies when its false "stretches" are at most 3.3% in every N case and at most 2% pooled (stated level 1%),
//   and it finds the stretches in at least 90% of A1 and A2 records. If both rules qualify, the one with the higher
//   pooled detection over the A cases is chosen; within 1 point, rank-clustering, which assumes nothing about the shape
//   of the steps. If neither qualifies, no rule is chosen and the check fails. The engine's default must be the choice.
//   INFO lines report, without a pass bar: smoothly moving steps (AR 1, which step 3 handles with device smoothing)
//   and variability that drifts over the hour.
//
// Run 1 (2026-11-09, seed 20261110): neither rule qualified. persistence-lr: 3.5% false on t4, A2 found in 85%;
// rank-clustering: A2 found in 63%. A diagnostic showed the two-sizes gate cut A2 detection and that ranks lose most of
// the size difference. Rule 'fast-clustering' was added after run 1: the shuffle test on each step's P(fast | size) from
// the fit without memory, no gate. From run 2 on, records use a new seed (20261111), so no rule is checked on the records
// that shaped it, against the same bar. Selection among qualifying rules: the highest pooled detection over the A cases;
// within 1 point, the rule assuming least about the steps, in the order rank-clustering, fast-clustering, persistence-lr.
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const info = (name, evidence) => out.push(`INFO  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261111), randn = M.makeNormal(rng);   // run 1 used 20261110
const pc = x => `${(100 * x).toFixed(1)}%`;
const t0 = Date.now();

const tDraw = df => () => { let c = 0; for (let j = 0; j < df; j++) { const z = randn(); c += z * z; } return randn() / Math.sqrt(c / df); };
function markov(T, { p00, p11, s0, s1 }) {
  let k = rng() < (1 - p00) / ((1 - p00) + (1 - p11)) ? 1 : 0;
  const x = new Array(T);
  for (let t = 0; t < T; t++) {
    if (t > 0) k = k === 0 ? (rng() < p00 ? 0 : 1) : (rng() < p11 ? 1 : 0);
    x[t] = (k ? s1 : s0) * randn();
  }
  return x;
}
const share = (s, p11) => ({ p00: 1 - (1 - p11) * s / (1 - s), p11 });

// S1. The normal curve and ranks.
{
  const known = [[0, 0.5], [1.959964, 0.025], [2.326348, 0.01], [-1.644854, 0.95], [3.090232, 0.001]];
  const worst = Math.max(...known.map(([z, q]) => Math.abs(M.normalSurvival(z) - q)));
  const ranks = JSON.stringify(M.averageRanks([3, 1, 3, 2, 3]));
  rec(worst <= 2e-7 && ranks === '[4,1,4,2,4]', 'The normal curve matches its tables; tied steps share their average rank',
    `largest gap ${worst.toExponential(1)} over z = 0, 1.96, 2.33, -1.64, 3.09; ranks of [3,1,3,2,3] = ${ranks}`);
}

// S2. The fit without memory: never lowers the likelihood, recovers independent big steps, persistence exactly 0.
{
  let drop = 0, maxPers = 0;
  const q = [], s0 = [], s1 = [];
  for (let i = 0; i < 100; i++) {
    const x = Array.from({ length: 720 }, () => (rng() < 0.2 ? 3 : 1) * randn());
    const f = M.fitRegimeSwitching(x, { memory: false, trace: true });
    for (let k = 1; k < f.trace.length; k++) drop = Math.max(drop, (f.trace[k - 1] - f.trace[k]) / Math.abs(f.trace[k - 1]));
    maxPers = Math.max(maxPers, Math.abs(f.persistence));
    q.push(f.settings.P[0][1]); s0.push(f.settings.s[0]); s1.push(f.settings.s[1]);
  }
  const mq = M.quantile(q, 0.5), m0 = M.quantile(s0, 0.5), m1 = M.quantile(s1, 0.5);
  rec(drop <= 1e-10 && maxPers < 1e-12 && Math.abs(mq - 0.2) <= 0.03 && Math.abs(m0 - 1) <= 0.05 && Math.abs(m1 - 3) / 3 <= 0.05,
    'Without memory: EM never lowers the likelihood, recovers independent big steps (20% at 3x), persistence exactly 0 (100 records)',
    `largest drop ${drop.toExponential(1)}; share ${mq.toFixed(3)} (true 0.2), spreads ${m0.toFixed(3)} and ${m1.toFixed(3)} (true 1 and 3); largest |persistence| ${maxPers.toExponential(1)}`);
}

// S5-S6. The stretch test on records without and with stretches.
const NULLS = [
  { key: 'N1', label: 'Gaussian steps', draw: () => Array.from({ length: 720 }, randn) },
  { key: 'N2', label: 'heavy tails (t, 4 df)', draw: () => Array.from({ length: 720 }, tDraw(4)) },
  { key: 'N3', label: 'heavier tails (t, 3 df)', draw: () => Array.from({ length: 720 }, tDraw(3)) },
  { key: 'N4', label: 'big steps one at a time (20% at 3x)', draw: () => Array.from({ length: 720 }, () => (rng() < 0.2 ? 3 : 1) * randn()) }
];
const ALTS = [
  { key: 'A1', label: '3x, stretches ~20 steps, 30% of the hour', draw: () => markov(720, { ...share(0.3, 0.95), s0: 1, s1: 3 }) },
  { key: 'A2', label: '2x, stretches ~10 steps', draw: () => markov(720, { p00: 0.97, p11: 0.9, s0: 1, s1: 2 }) },
  { key: 'A3', label: '3x, stretches ~20 steps, 10% of the hour', draw: () => markov(720, { ...share(0.1, 0.95), s0: 1, s1: 3 }) },
  { key: 'A1h', label: 'as A1 over 30 minutes', draw: () => markov(360, { ...share(0.3, 0.95), s0: 1, s1: 3 }) }
];
let nestDrop = 0, clust05 = 0, fast05 = 0, nullN = 0;
const tally = {};
function runCase(c, n) {
  const r = { n, pers: 0, clust: 0, fast: 0, distinct: 0 };
  for (let i = 0; i < n; i++) {
    const s = M.regimeStretchTest(c.draw());
    nestDrop = Math.max(nestDrop, (s.noMemory.logLik - s.fit.logLik) / Math.abs(s.noMemory.logLik));
    r.pers += s.stretchesByPersistence; r.clust += s.stretchesByClustering; r.fast += s.stretchesByFastClustering; r.distinct += s.distinct;
    if (c.key.startsWith('N')) { nullN++; clust05 += s.pClustering < 0.05; fast05 += s.pFastClustering < 0.05; }
  }
  tally[c.key] = r;
  return r;
}
NULLS.forEach(c => runCase(c, 200));
ALTS.forEach(c => runCase(c, 150));
const rate = (key, rule) => tally[key][rule] / tally[key].n;

rec(nestDrop <= 1e-9, 'The fit with memory never has a lower likelihood than the fit without (every record)', `largest relative shortfall ${nestDrop.toExponential(1)} (0 or rounding)`);
rec([clust05, fast05].every(c => c / nullN >= 0.035 && c / nullN <= 0.065), 'Both shuffle p-values are exact for independent steps, whatever their shape: p < 0.05 in 3.5-6.5% of the 800 records without stretches',
  `ranks ${pc(clust05 / nullN)}, P(fast | size) ${pc(fast05 / nullN)} (before any gate)`);

const RULES = [['persistence-lr', 'pers'], ['rank-clustering', 'clust'], ['fast-clustering', 'fast']];
const verdict = {};
for (const [name, k] of RULES) {
  const nullRates = NULLS.map(c => rate(c.key, k)), pooled = NULLS.reduce((s, c) => s + tally[c.key][k], 0) / NULLS.reduce((s, c) => s + tally[c.key].n, 0);
  const det = ALTS.map(c => rate(c.key, k)), detPooled = ALTS.reduce((s, c) => s + tally[c.key][k], 0) / ALTS.reduce((s, c) => s + tally[c.key].n, 0);
  const falseOk = nullRates.every(x => x <= 10 / 300) && pooled <= 0.02, detOk = det[0] >= 0.9 && det[1] >= 0.9;
  verdict[name] = { qualifies: falseOk && detOk, detPooled };
  info(`Rule ${name}: false "stretches" on records without them`, NULLS.map((c, i) => `${c.key} ${c.label} ${pc(nullRates[i])}`).join('; ') + `; pooled ${pc(pooled)}${falseOk ? '' : ' (OVER THE BAR)'}`);
  info(`Rule ${name}: stretches found`, ALTS.map((c, i) => `${c.key} ${c.label} ${pc(det[i])}`).join('; ') + `${detOk ? '' : ' (UNDER THE BAR)'}`);
}
info('Two step sizes found (the gate) on records without stretches', NULLS.map(c => `${c.key} ${pc(tally[c.key].distinct / tally[c.key].n)}`).join('; '));

// S7. The preset selection, and the engine's default.
{
  const q = Object.keys(verdict).filter(k => verdict[k].qualifies);
  // Highest pooled detection; within 1 point, the rule assuming least about the steps.
  const leastAssuming = ['rank-clustering', 'fast-clustering', 'persistence-lr'];
  let chosen = null;
  if (q.length) {
    const top = Math.max(...q.map(k => verdict[k].detPooled));
    chosen = leastAssuming.find(k => q.includes(k) && verdict[k].detPooled >= top - 0.01);
  }
  const engineDefault = M.regimeStretchTest(Array.from({ length: 200 }, randn), { permutations: 9 }).rule;
  rec(chosen !== null, 'At least one rule meets the preset bar (false alarms and detection)', `qualifying: ${q.join(', ') || 'none'}; chosen by the preset rule: ${chosen || 'none'}`);
  rec(chosen !== null && engineDefault === chosen, "The engine's default rule is the one the preset selection chose", `engine default ${engineDefault}, selection ${chosen}`);
}

// S8. The looser stopping used inside the test changes no decision.
{
  let changed = 0, worstP = 0, n = 0;
  const sample = [...NULLS.slice(0, 2), NULLS[3], ALTS[1]];
  for (const c of sample) for (let i = 0; i < 10; i++) {
    const x = c.draw(), a = M.regimeStretchTest(x), b = M.regimeStretchTest(x, { tol: 1e-10, maxIter: 500 });
    n++;
    if (a.distinct !== b.distinct || a.stretchesByPersistence !== b.stretchesByPersistence || a.stretchesByClustering !== b.stretchesByClustering || a.stretchesByFastClustering !== b.stretchesByFastClustering) changed++;
    if (b.distinct) worstP = Math.max(worstP, Math.abs(a.pPersistence - b.pPersistence));
  }
  rec(changed === 0 && worstP <= 1e-3, 'Stopping EM at a gain under 1e-8 per step changes no decision against the strict 1e-10 (40 records)',
    `${changed} decisions changed; largest p change where two sizes differ ${worstP.toExponential(1)}`);
}

// INFO. Smoothly moving steps (each step half the last plus a new one), and variability drifting over the hour.
{
  const ar = (draw) => () => { const x = new Array(720); let prev = 0; for (let t = 0; t < 720; t++) { prev = 0.5 * prev + draw(); x[t] = prev; } return x; };
  const drift = () => Array.from({ length: 720 }, (_, t) => Math.exp(0.5 * Math.sin(2 * Math.PI * t / 720)) * randn());
  for (const [label, draw] of [['smoothly moving steps (AR 0.5, Gaussian)', ar(randn)], ['smoothly moving steps (AR 0.5, heavy tails t4)', ar(tDraw(4))], ['variability drifting up and down once over the hour', drift]]) {
    let p = 0, c = 0, f = 0;
    for (let i = 0; i < 100; i++) { const s = M.regimeStretchTest(draw()); p += s.stretchesByPersistence; c += s.stretchesByClustering; f += s.stretchesByFastClustering; }
    info(`No two-state stretches, ${label}`, `persistence-lr says stretches in ${p}%, rank-clustering in ${c}%, fast-clustering in ${f}% of 100 records`);
  }
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
