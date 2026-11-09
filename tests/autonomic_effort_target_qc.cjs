// Effort target, step 1 of 2: the model (effortTargetFilter), the jump detector (findTargetJumps, Willsky-Jones GLR) and
// learning the noise levels, on known answers. Step 2 runs the realistic rides.
// Run: node tests/autonomic_effort_target_qc.cjs [engine path]
//
// Written before this file's first run (2026-11-09). Threshold 20, window 12 steps, tau 40 s at 5-s steps, all set before.
//   E1 the filter equals the exact Gaussian answer (every state and observation jointly Gaussian, conditioned by matrix
//      algebra) on 8 steps with a missing step and a known jump: means, covariances and log-likelihood within 1e-9.
//   E2 a noise-free jump (+12 at step 30): found at step 30 with size 12 within 1e-6, and nothing else.
//   E3 the statistic is honest: with no jump and the true noise levels, l at a fixed candidate (theta 200, 7 steps of
//      data) passes the 1% chi-square level (6.635) in 0.55-1.45% of 2000 records.
//   E4 detection with the true noise levels, 100 one-hour records of the model with 12 jumps of +-8 to 20 bpm each:
//      at least 95% found within 1 step with the right sign; median size within 10%; extra jumps at most 0.1 an hour;
//      100 records without jumps: false jumps at most 0.1 an hour.
//   E5 the same records with the noise levels learned from each record: medians of qH, qG and R within 25%; at least 90%
//      of jumps found; extra at most 0.2 an hour. (A smoke run found the target drift qG learned far too large.)
//
// Run 1: E1-E3 passed; E4 found 93.1% within 1 step with 0.42 extra/h; E5 learned qG about 150x too large (74% found).
// Fixed after run 1: the detector waits 3 steps after the threshold before deciding and merges a
// same-direction jump within 6 steps; learning puts the jumps inside the likelihood (effortTargetJumpLogLik, jump chance
// learned). Bars unchanged; from run 2, E4-E5 use new records (seed 20261119). Added as INFO: where each true jump's
// nearest detection falls, and detections far (over 6 steps) from any true jump.
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261118), randn = M.makeNormal(rng);
const rng2 = M.makeRng(20261119), randn2 = M.makeNormal(rng2);   // E4-E5 records from run 2 on
const pc = x => `${(100 * x).toFixed(1)}%`;
const t0 = Date.now();
const rho = Math.exp(-5 / 40), F = [[rho, 1 - rho], [0, 1]];
const mm = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, _, k) => s + A[i][k] * B[k][j], 0)));
const tr = A => A[0].map((_, j) => A.map(r => r[j]));
const mv = (A, v) => A.map(r => r.reduce((s, a, k) => s + a * v[k], 0));

// E1. The filter against the exact joint Gaussian.
{
  const prm = { rho, qH: 0.3, qG: 0.05, R: 0.2, m0: [130, 132], P0: [[0.5, 0.1], [0.1, 2]] };
  const jumps = new Map([[4, 3]]), y = [130.2, 131.0, 130.7, NaN, 131.9, 133.1, 133.8, 134.0], T = y.length;
  const Q = [[prm.qH, 0], [0, prm.qG]], mu = [prm.m0], Sig = [prm.P0];
  for (let t = 1; t < T; t++) {
    const m = mv(F, mu[t - 1]); if (jumps.has(t)) m[1] += jumps.get(t); mu.push(m);
    const S = mm(mm(F, Sig[t - 1]), tr(F)); Sig.push([[S[0][0] + Q[0][0], S[0][1]], [S[1][0], S[1][1] + Q[1][1]]]);
  }
  const Fpow = k => { let A = [[1, 0], [0, 1]]; for (let i = 0; i < k; i++) A = mm(F, A); return A; };
  const cov = (t, s) => (t >= s ? mm(Fpow(t - s), Sig[s]) : tr(mm(Fpow(s - t), Sig[t])));
  const f = M.effortTargetFilter(y, prm, jumps);
  let worst = 0;
  for (let t = 0; t < T; t++) {
    const obs = []; for (let s = 0; s <= t; s++) if (Number.isFinite(y[s])) obs.push(s);
    const V = obs.map((a, i) => obs.map((b, j) => cov(a, b)[0][0] + (i === j ? prm.R : 0))), Vi = M.invertMatrix(V);
    const Cxy = [0, 1].map(i => obs.map(s => cov(t, s)[i][0]));
    const resid = obs.map(s => y[s] - mu[s][0]);
    const mean = [0, 1].map(i => mu[t][i] + Cxy[i].reduce((acc, c, k) => acc + c * Vi[k].reduce((a2, v, l) => a2 + v * resid[l], 0), 0));
    const varM = [0, 1].map(i => [0, 1].map(j => Sig[t][i][j] - Cxy[i].reduce((acc, c, k) => acc + c * Vi[k].reduce((a2, v, l) => a2 + v * Cxy[j][l], 0), 0)));
    worst = Math.max(worst, ...mean.map((v, i) => Math.abs(v - f.mf[t][i])), ...[0, 1].flatMap(i => [0, 1].map(j => Math.abs(varM[i][j] - f.Pf[t][i][j]))));
  }
  const obsAll = []; for (let s = 0; s < T; s++) if (Number.isFinite(y[s])) obsAll.push(s);
  const V = obsAll.map((a, i) => obsAll.map((b, j) => cov(a, b)[0][0] + (i === j ? prm.R : 0))), Vi = M.invertMatrix(V);
  const r = obsAll.map(s => y[s] - mu[s][0]);
  let quad = 0; for (let i = 0; i < r.length; i++) for (let j = 0; j < r.length; j++) quad += r[i] * Vi[i][j] * r[j];
  const A = V.map(row => row.slice()); let logDet = 0;
  for (let k = 0; k < A.length; k++) { logDet += Math.log(A[k][k]); for (let i = k + 1; i < A.length; i++) { const fct = A[i][k] / A[k][k]; for (let j = k; j < A.length; j++) A[i][j] -= fct * A[k][j]; } }
  const ll = -0.5 * (r.length * Math.log(2 * Math.PI) + logDet + quad);
  worst = Math.max(worst, Math.abs(ll - f.logLik));
  rec(worst <= 1e-9, 'The filter equals the exact Gaussian answer (8 steps, a missing step, a known jump): states, covariances, likelihood', `largest gap ${worst.toExponential(1)}`);
}

// E2. A noise-free jump.
{
  let H = 135, G = 135;
  const y = [];
  for (let t = 0; t < 80; t++) { if (t > 0) H = rho * H + (1 - rho) * G; if (t === 30) G += 12; y.push(H); }
  const f = M.findTargetJumps(y, { params: { qH: 0, qG: 0, R: 1e-8, m0: [135, 135], P0: [[1e-10, 0], [0, 1e-10]] } });
  const j = f.jumps;
  rec(j.length === 1 && j[0].at === 30 && Math.abs(j[0].size - 12) <= 1e-6, 'A noise-free jump of +12 at step 30 is found exactly, and nothing else',
    `found ${JSON.stringify(j.map(v => ({ at: v.at, size: +v.size.toFixed(9) })))}`);
}

// E3. The statistic at a fixed candidate is chi-square(1) with no jump.
{
  const prm = { rho, qH: 0.25, qG: 0.0025, R: 0.16 };
  let over = 0;
  for (let i = 0; i < 2000; i++) {
    let H = 135, G = 135;
    const y = [];
    for (let t = 0; t < 207; t++) { if (t > 0) { H = rho * H + (1 - rho) * G + 0.5 * randn(); G += 0.05 * randn(); } y.push(H + 0.4 * randn()); }
    const f = M.effortTargetFilter(y, prm);
    let D = [0, 1], Phat = [0, 0], d = 0, C = 0;
    for (let t = 200; t <= 206; t++) {
      if (t > 200) { D = mv(F, D); }
      const g = D[0] - Phat[0];
      d += g * f.gamma[t] / f.S[t]; C += g * g / f.S[t];
      const Ehat = [Phat[0] + f.K[t][0] * g, Phat[1] + f.K[t][1] * g];
      Phat = mv(F, Ehat);
    }
    over += d * d / C > 6.635;
  }
  rec(over / 2000 >= 0.0055 && over / 2000 <= 0.0145, 'The jump statistic is honest: with no jump it passes the 1% level in 0.55-1.45% of records (fixed candidate)', `${pc(over / 2000)} of 2000`);
}

// E4-E5. Detection on the model's own records.
function record(withJumps) {
  let H = 135, G = 135;
  const y = [], truth = [];
  for (let t = 0; t < 720; t++) {
    if (t > 0) { H = rho * H + (1 - rho) * G + 0.5 * randn2(); G += 0.05 * randn2(); }
    if (withJumps && t % 60 === 30) { const nu = (rng2() < 0.5 ? 1 : -1) * (8 + 12 * rng2()); G += nu; truth.push({ at: t, size: nu }); }
    y.push(H + 0.4 * randn2());
  }
  return { y, truth };
}
function score(records, opts) {
  let found = 0, total = 0, extra = 0, far = 0;
  const ratio = [], est = { qH: [], qG: [], R: [] }, offset = {};
  for (const { y, truth } of records) {
    const f = M.findTargetJumps(y, opts);
    total += truth.length;
    for (const tr0 of truth) { const j = f.jumps.find(v => Math.abs(v.at - tr0.at) <= 1 && Math.sign(v.size) === Math.sign(tr0.size)); if (j) { found++; ratio.push(j.size / tr0.size); } }
    extra += f.jumps.filter(v => !truth.some(tr0 => Math.abs(v.at - tr0.at) <= 2)).length;
    far += f.jumps.filter(v => !truth.some(tr0 => Math.abs(v.at - tr0.at) <= 6)).length;
    for (const tr0 of truth) {
      const near = f.jumps.filter(v => Math.sign(v.size) === Math.sign(tr0.size)).map(v => Math.abs(v.at - tr0.at)).sort((a, b) => a - b)[0];
      const k = near === undefined || near > 6 ? 'over 6' : near <= 1 ? '0-1' : near <= 3 ? '2-3' : '4-6';
      offset[k] = (offset[k] || 0) + 1;
    }
    est.qH.push(f.params.qH); est.qG.push(f.params.qG); est.R.push(f.params.R);
  }
  return { found: total ? found / total : null, ratioMed: ratio.length ? M.quantile(ratio, 0.5) : null, extraPerHour: extra / records.length, farPerHour: far / records.length, offset, total, est };
}
{
  const withJ = Array.from({ length: 100 }, () => record(true)), noJ = Array.from({ length: 100 }, () => record(false));
  const known = { params: { qH: 0.25, qG: 0.0025, R: 0.16 } };
  const a = score(withJ, known), b = score(noJ, known);
  rec(a.found >= 0.95 && Math.abs(a.ratioMed - 1) <= 0.1 && a.extraPerHour <= 0.1 && b.extraPerHour <= 0.1,
    'Detection with the true noise levels: jumps found within 1 step, sizes right, few extras; records without jumps stay quiet',
    `found ${pc(a.found)}; median size ${(100 * a.ratioMed).toFixed(0)}% of true; extra ${a.extraPerHour.toFixed(2)}/h; no-jump records ${b.extraPerHour.toFixed(2)} false/h`);
  const fmtOff = r => ['0-1', '2-3', '4-6', 'over 6'].map(k => `${k} steps ${pc((r.offset[k] || 0) / r.total)}`).join(', ');
  out.push(`INFO  True noise levels: nearest same-direction detection to each true jump  |  ${fmtOff(a)}; detections over 6 steps from any true jump ${a.farPerHour.toFixed(2)}/h`);
  const c = score(withJ, {});
  const m = k => M.quantile(c.est[k], 0.5);
  const okEst = Math.abs(m('qH') / 0.25 - 1) <= 0.25 && Math.abs(m('qG') / 0.0025 - 1) <= 0.25 && Math.abs(m('R') / 0.16 - 1) <= 0.25;
  rec(okEst && c.found >= 0.9 && c.extraPerHour <= 0.2, 'Learned noise levels: qH, qG and R within 25% (medians); at least 90% of jumps found; extras at most 0.2 an hour',
    `qH ${m('qH').toFixed(3)} (0.25), qG ${m('qG').toFixed(4)} (0.0025), R ${m('R').toFixed(3)} (0.16); found ${pc(c.found)}; extra ${c.extraPerHour.toFixed(2)}/h`);
  out.push(`INFO  Learned noise levels: nearest same-direction detection to each true jump  |  ${fmtOff(c)}; detections over 6 steps from any true jump ${c.farPerHour.toFixed(2)}/h`);
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
