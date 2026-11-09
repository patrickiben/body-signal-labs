// Stage 3, step 1: the two-state steady / fast-change filter with its settings learned from the record (EM).
// Run: node tests/autonomic_regime_qc.cjs [engine path]
// Known answers: exact posteriors by listing every state path; the fixed-settings filter (computeAutonomicRegimeFilter)
// reproduced exactly; EM never lowers the likelihood; settings recovered from simulated records with known steady and
// fast stretches; one answer whichever way the states are labeled; units do not matter; head-to-head with the fixed
// settings; records with no fast stretches. Pass criteria were written before the first run. INFO lines are findings.
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const info = (name, evidence) => out.push(`INFO  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261109), randn = M.makeNormal(rng);
const med = a => M.quantile(a, 0.5);
const pc = x => `${(100 * x).toFixed(1)}%`;
const f3 = x => x.toFixed(3);
const t0 = Date.now();

// A simulated record: a two-state Markov chain started from its long-run shares; each step is N(0, s_k^2).
function simulate(T, { p00, p11, s0, s1 }) {
  const share = (1 - p00) / ((1 - p00) + (1 - p11));
  let k = rng() < share ? 1 : 0;
  const x = new Array(T), st = new Array(T);
  for (let t = 0; t < T; t++) {
    if (t > 0) k = k === 0 ? (rng() < p00 ? 0 : 1) : (rng() < p11 ? 1 : 0);
    st[t] = k;
    x[t] = (k ? s1 : s0) * randn();
  }
  return { x, st };
}

// The fixed settings computeAutonomicRegimeFilter derives from a record (its own formula, copied here).
function fixedSettings(x) {
  const absR = x.map(Math.abs);
  const q55 = M.quantile(absR, 0.55), q82 = M.quantile(absR, 0.82), s = M.sd(absR, 1);
  const mu0 = Math.max(0.002, q55 * 0.72), sig0 = Math.max(0.003, s * 0.65);
  const mu1 = Math.max(mu0 * 1.8, q82 * 1.35), sig1 = Math.max(sig0 * 1.6, s * 1.45);
  const P = [[0.965, 0.035], [0.085, 0.915]];
  // It starts from (0.8, 0.2) and moves one step before the first change.
  const pi = [0.8 * P[0][0] + 0.2 * P[1][0], 0.8 * P[0][1] + 0.2 * P[1][1]];
  return { P, pi, mu: [mu0, mu1], sig: [sig0, sig1] };
}

// R1. Exact answers by listing all 2^9 state paths, both emissions, one step missing.
{
  const dens = (v, prm, k, em) => {
    if (!Number.isFinite(v)) return 1;
    if (em === 'half-normal') return 2 / (prm.s[k] * Math.sqrt(2 * Math.PI)) * Math.exp(-v * v / (2 * prm.s[k] * prm.s[k]));
    return Math.exp(-((v - prm.mu[k]) ** 2) / (2 * prm.sig[k] * prm.sig[k])) / (prm.sig[k] * Math.sqrt(2 * Math.PI));
  };
  function enumerate(y, prm, em) {
    const T = y.length, post = new Array(T).fill(0);
    let L = 0;
    for (let mask = 0; mask < (1 << T); mask++) {
      let p = 1;
      for (let t = 0; t < T; t++) {
        const k = (mask >> t) & 1;
        p *= t === 0 ? prm.pi[k] : prm.P[(mask >> (t - 1)) & 1][k];
        p *= dens(y[t], prm, k, em);
      }
      L += p;
      for (let t = 0; t < T; t++) if ((mask >> t) & 1) post[t] += p;
    }
    return { L, smoothed: post.map(v => v / L) };
  }
  const x = [0.4, -2.9, 3.6, -0.2, NaN, 0.7, -4.1, 1.2, -0.3];
  const y = x.map(v => Math.abs(v));
  const cases = [
    ['half-normal', { P: [[0.9, 0.1], [0.2, 0.8]], pi: [0.6, 0.4], s: [1, 3] }],
    ['abs-gaussian', { P: [[0.9, 0.1], [0.2, 0.8]], pi: [0.6, 0.4], mu: [0.8, 2.4], sig: [0.6, 1.8] }]
  ];
  let worst = 0, worstL = 0;
  for (const [em, prm] of cases) {
    const fit = M.fitRegimeSwitching(x, { emission: em, params: prm, minSteps: 5 });
    const ex = enumerate(y, prm, em);
    worstL = Math.max(worstL, Math.abs(fit.logLik - Math.log(ex.L)));
    for (let t = 0; t < y.length; t++) {
      worst = Math.max(worst, Math.abs(fit.smoothed[t] - ex.smoothed[t]));
      worst = Math.max(worst, Math.abs(fit.filtered[t] - enumerate(y.slice(0, t + 1), prm, em).smoothed[t]));
    }
  }
  rec(worst <= 1e-12 && worstL <= 1e-12, 'Filter, smoother and likelihood equal the exact answers from listing all 512 state paths (both emissions, one step missing)',
    `largest probability gap ${worst.toExponential(1)}, log-likelihood gap ${worstL.toExponential(1)}`);
}

// R2. Given the fixed settings, the new code gives computeAutonomicRegimeFilter's answers.
{
  let worst = 0, worstL = 0;
  for (let i = 0; i < 20; i++) {
    const { x } = simulate(720, { p00: 0.98, p11: 0.95, s0: 1, s1: 3 });
    const old = M.computeAutonomicRegimeFilter(x, []);
    const fit = M.fitRegimeSwitching(x, { emission: 'abs-gaussian', params: fixedSettings(x) });
    for (let t = 0; t < x.length; t++) worst = Math.max(worst, Math.abs(fit.filtered[t] - old.filteredProbCrisis[t]));
    worstL = Math.max(worstL, Math.abs(fit.logLik - old.logLikelihood) / Math.abs(old.logLikelihood));
  }
  rec(worst <= 1e-12 && worstL <= 1e-12, "The existing fixed-settings filter is an exact special case (20 one-hour records)",
    `largest P(fast change) gap ${worst.toExponential(1)}, relative log-likelihood gap ${worstL.toExponential(1)}`);
}

// R3. EM never lowers the likelihood, at any iteration (50 records, both emissions).
{
  let worstDrop = 0, maxIt = 0, notConv = 0;
  for (let i = 0; i < 50; i++) {
    const { x } = simulate(720, { p00: 0.97, p11: 0.9, s0: 1, s1: 2.5 });
    for (const em of ['half-normal', 'abs-gaussian']) {
      const fit = M.fitRegimeSwitching(x, { emission: em, trace: true });
      for (let k = 1; k < fit.trace.length; k++) worstDrop = Math.max(worstDrop, (fit.trace[k - 1] - fit.trace[k]) / Math.abs(fit.trace[k - 1]));
      maxIt = Math.max(maxIt, fit.iterations);
      notConv += !fit.converged;
    }
  }
  rec(worstDrop <= 1e-10 && notConv === 0, 'EM never lowers the likelihood and converges (100 fits)',
    `largest relative drop ${worstDrop.toExponential(1)} (rounding only if under 1e-10); ${notConv} fits not converged; at most ${maxIt} iterations`);
}

// R4. Settings recovered from simulated one-hour records (720 five-second steps), 200 records per case.
function recovery(truth, nrep) {
  const est = { s0: [], s1: [], p00: [], p11: [] };
  for (let i = 0; i < nrep; i++) {
    const f = M.fitRegimeSwitching(simulate(720, truth).x);
    est.s0.push(f.settings.s[0]); est.s1.push(f.settings.s[1]);
    est.p00.push(f.settings.P[0][0]); est.p11.push(f.settings.P[1][1]);
  }
  const r = {};
  for (const k of Object.keys(est)) r[k] = { med: med(est[k]), lo: M.quantile(est[k], 0.1), hi: M.quantile(est[k], 0.9) };
  return r;
}
const show = (r, truth) => ['s0', 's1', 'p00', 'p11'].map(k => `${k} ${f3(r[k].med)} (true ${truth[k]}; 80% of records ${f3(r[k].lo)}-${f3(r[k].hi)})`).join('; ');
{
  const A = { p00: 0.98, p11: 0.95, s0: 1, s1: 3 };
  const rA = recovery(A, 200);
  rec(Math.abs(rA.s0.med - 1) <= 0.05 && Math.abs(rA.s1.med - 3) / 3 <= 0.05 && Math.abs(rA.p00.med - 0.98) <= 0.01 && Math.abs(rA.p11.med - 0.95) <= 0.02,
    'Settings recovered: fast steps 3x larger, steady stretches ~50 steps, fast ~20 (spreads within 5%, steady within 0.01, fast within 0.02)', show(rA, A));
  const B = { p00: 0.97, p11: 0.9, s0: 1, s1: 2 };
  const rB = recovery(B, 200);
  rec(Math.abs(rB.s0.med - 1) <= 0.08 && Math.abs(rB.s1.med - 2) / 2 <= 0.08 && Math.abs(rB.p00.med - 0.97) <= 0.015 && Math.abs(rB.p11.med - 0.9) <= 0.04,
    'Settings recovered, harder case: fast steps 2x larger, fast stretches ~10 steps (spreads within 8%, steady within 0.015, fast within 0.04)', show(rB, B));
}

// R5. One answer whichever way the states are labeled: EM from a start and from the same start with the states swapped.
{
  let worst = 0;
  for (let i = 0; i < 20; i++) {
    const { x } = simulate(720, { p00: 0.98, p11: 0.95, s0: 1, s1: 3 });
    const a = M.fitRegimeSwitching(x, { init: { P: [[0.95, 0.05], [0.1, 0.9]], pi: [0.7, 0.3], s: [0.8, 2.5] } });
    const b = M.fitRegimeSwitching(x, { init: { P: [[0.9, 0.1], [0.05, 0.95]], pi: [0.3, 0.7], s: [2.5, 0.8] } });
    for (let t = 0; t < x.length; t++) worst = Math.max(worst, Math.abs(a.smoothed[t] - b.smoothed[t]), Math.abs(a.filtered[t] - b.filtered[t]));
    worst = Math.max(worst, ...[0, 1].map(k => Math.abs(a.settings.s[k] - b.settings.s[k])), ...[0, 1].map(k => Math.abs(a.settings.P[k][k] - b.settings.P[k][k])));
  }
  rec(worst <= 1e-6, 'Swapping which state is called fast at the start gives the same answer (20 records)', `largest gap ${worst.toExponential(1)}`);
}

// R6. Units do not matter: steps x 7.3 give the same probabilities and transitions, and spreads x 7.3.
{
  let worst = 0;
  for (let i = 0; i < 10; i++) {
    const { x } = simulate(720, { p00: 0.98, p11: 0.95, s0: 1, s1: 3 });
    const a = M.fitRegimeSwitching(x), b = M.fitRegimeSwitching(x.map(v => 7.3 * v));
    for (let t = 0; t < x.length; t++) worst = Math.max(worst, Math.abs(a.smoothed[t] - b.smoothed[t]), Math.abs(a.filtered[t] - b.filtered[t]));
    worst = Math.max(worst, ...[0, 1].map(k => Math.abs(b.settings.s[k] / 7.3 - a.settings.s[k]) / a.settings.s[k]), ...[0, 1].map(k => Math.abs(a.settings.P[k][k] - b.settings.P[k][k])));
  }
  rec(worst <= 1e-6, 'Units do not matter (bpm or any scale): same probabilities and transitions, spreads scale with the unit', `largest gap ${worst.toExponential(1)}`);
}

// R7. Head-to-head with the fixed settings on records with known stretches: fast share 10%, 30%, 50%; fast stretches
// average 20 steps; fast steps 3x larger. Both filters read P(fast change) > 0.5 from the steps so far; the EM smoother
// also uses the steps after. 100 one-hour records per share.
{
  const lines = [];
  let smoothOk = true, filterOk = true;
  for (const share of [0.1, 0.3, 0.5]) {
    const p11 = 0.95, p00 = 1 - (1 - p11) * share / (1 - share);
    let accOld = 0, accF = 0, accS = 0, oldFast = 0, steps = 0;
    for (let i = 0; i < 100; i++) {
      const { x, st } = simulate(720, { p00, p11, s0: 1, s1: 3 });
      const old = M.computeAutonomicRegimeFilter(x, []).filteredProbCrisis;
      const f = M.fitRegimeSwitching(x);
      for (let t = 0; t < x.length; t++) {
        accOld += (old[t] > 0.5 ? 1 : 0) === st[t];
        accF += (f.filtered[t] > 0.5 ? 1 : 0) === st[t];
        accS += (f.smoothed[t] > 0.5 ? 1 : 0) === st[t];
        oldFast += old[t] > 0.6;
      }
      steps += x.length;
    }
    if (accS / steps < 0.9) smoothOk = false;
    if (accF < accOld) filterOk = false;
    lines.push(`share ${pc(share)}: fixed ${pc(accOld / steps)} (marks ${pc(oldFast / steps)} as fast change), EM filter ${pc(accF / steps)}, EM smoother ${pc(accS / steps)}`);
  }
  rec(filterOk, 'Step by step, the EM filter classifies at least as well as the fixed settings at every share', lines.join('; '));
  rec(smoothOk, 'Looking back over a whole record, the EM smoother classifies at least 90% of steps correctly at every share', lines.join('; '));
}

// R8. Records with no fast stretches at all (one state). Gaussian steps; then heavy-tailed steps (t, 4 df), where
// occasional big steps come one at a time and never cluster into stretches.
{
  const tStep = () => { let c = 0; for (let j = 0; j < 4; j++) { const z = randn(); c += z * z; } return randn() / Math.sqrt(c / 4) / Math.SQRT2; };
  for (const [label, draw, gate] of [['Gaussian steps', randn, true], ['heavy-tailed steps (t, 4 df)', tStep, false]]) {
    let oldFast = 0, oldTrans = 0, steps = 0, bic = 0;
    const persist = [], share = [];
    for (let i = 0; i < 200; i++) {
      const x = Array.from({ length: 720 }, draw);
      const old = M.computeAutonomicRegimeFilter(x, []).filteredProbCrisis;
      for (const p of old) { oldFast += p > 0.6; oldTrans += p >= 0.3 && p <= 0.6; }
      steps += x.length;
      const f = M.fitRegimeSwitching(x);
      bic += f.twoStatesByBic;
      persist.push(f.persistence); share.push(f.fastShare);
    }
    info(`No fast stretches, ${label}: the fixed settings`, `mark ${pc(oldFast / steps)} of steps fast change and ${pc(oldTrans / steps)} transition`);
    const emLine = `BIC says two states in ${pc(bic / 200)} of 200 records; EM persistence p00+p11-1 median ${f3(med(persist))} (0 = big steps do not cluster), fast share median ${pc(med(share))}`;
    if (gate) rec(bic / 200 <= 0.05, `No fast stretches, ${label}: BIC calls two states in at most 5% of records (provisional; step 2 sets the rule)`, emLine);
    else info(`No fast stretches, ${label}: EM`, emLine);
  }
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
