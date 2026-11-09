// Known-answer QC of the Autonomic math engine (Antigravity's, as fixed). Run: node tests/autonomic_math_qc.cjs [engine path]
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
{
const rng = M.makeRng(12345), N = M.makeNormal(rng);

// ---------- numerics ----------
{
  const A = [[4, 1, 0.5], [1, 3, 0.2], [0.5, 0.2, 2]];
  const Ai = M.invertMatrix(A);
  let err = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += A[i][k] * Ai[k][j]; err = Math.max(err, Math.abs(s - (i === j ? 1 : 0))); }
  rec(err < 1e-9, 'invertMatrix: A·A⁻¹ = I', `max error ${err.toExponential(1)}`);
  const E = M.jacobiEigenSymmetric([[2, 1], [1, 2]]);
  const vals = (E.values || E.eigenvalues || E.lambda || []).slice().sort((a, b) => a - b);
  rec(Math.abs(vals[0] - 1) < 1e-9 && Math.abs(vals[1] - 3) < 1e-9, 'jacobiEigenSymmetric: [[2,1],[1,2]] → 1, 3', `got ${vals.map(f3).join(', ')}`);
}

// ---------- non-negative VAR(1): recover a known Φ ----------
const Phi0 = [[0.50, 0.00, 0.20], [0.30, 0.40, 0.00], [0.00, 0.25, 0.45]];
const c0 = [0.2, 0.1, 0.15];
const T = 4000, Y = []; let x = [1, 1, 1];
for (let t = 0; t < T; t++) { Y.push(x.slice()); x = x.map((_, i) => c0[i] + Phi0[i].reduce((s, p, j) => s + p * x[j], 0) + 0.1 * N()); }
const fit = M.fitVarNonneg(Y, 0.0, 400);
let maxErr = 0, neg = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { maxErr = Math.max(maxErr, Math.abs(fit.Phi[i][j] - Phi0[i][j])); if (fit.Phi[i][j] < 0) neg++; }
rec(maxErr < 0.05 && neg === 0, 'fitVarNonneg recovers a known non-negative Φ (T=4000, λ=0)', `max |Φ̂−Φ| = ${f3(maxErr)}, negative entries ${neg}`);
{ // spectral radius vs the true eigenvalues of Φ0 (computed independently by power iteration on Φ0)
  let v = [1, 1, 1], lam = 0; for (let k = 0; k < 500; k++) { const w = Phi0.map((r) => r.reduce((s, p, j) => s + p * v[j], 0)); lam = Math.hypot(...w) / Math.hypot(...v); v = w.map((q) => q / Math.hypot(...w)); }
  rec(Math.abs(fit.spectralRadius - lam) < 0.05, 'fitVarNonneg spectral radius ≈ ρ(Φ)', `fitted ${f3(fit.spectralRadius)} vs true ${f3(lam)}`);
}
{ // a negative true coupling: the constraint must clip it to 0 (documents what the model cannot represent)
  const P = [[0.5, -0.3], [0.0, 0.5]]; const Z = []; let z = [1, 1];
  for (let t = 0; t < 4000; t++) { Z.push(z.slice()); z = z.map((_, i) => 1 + P[i].reduce((s, p, j) => s + p * z[j], 0) + 0.1 * N()); }
  const fz = M.fitVarNonneg(Z, 0.0, 400);
  rec(fz.Phi[0][1] >= 0, 'fitVarNonneg on a true NEGATIVE coupling (−0.3) clips it to ≥ 0', `estimated ${f3(fz.Phi[0][1])}: the model cannot represent inhibition`);
}

// ---------- generalized FEVD ----------
{
  const g = M.gfevd(fit.Phi, fit.Sigma, 10);
  const rows = g.theta.map((r) => r.reduce((s, v) => s + v, 0));
  const netSum = g.NET.reduce((s, v) => s + v, 0);
  const scale = rows[0] > 2 ? 100 : 1;
  rec(rows.every((r) => Math.abs(r - scale) < 1e-6), 'gfevd: each row of θ is normalized', `row sums ${rows.map(f3).join(', ')}`);
  rec(Math.abs(netSum) < 1e-6, 'gfevd: NET sums to zero', `ΣNET = ${netSum.toExponential(1)}`);
  // independence: diagonal Φ, diagonal Σ → no spillover
  const gd = M.gfevd([[0.5, 0, 0], [0, 0.4, 0], [0, 0, 0.3]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 10);
  const off = Math.max(...gd.theta.flatMap((r, i) => r.filter((_, j) => j !== i)));
  rec(off < 1e-9 && Math.abs(gd.TCI) < 1e-9, 'gfevd: independent system has no spillover (θ off-diagonal = 0, TCI = 0)', `max off-diagonal ${off.toExponential(1)}, TCI ${f3(gd.TCI)}`);
  // direction: x1 drives x2 only → x1 is the net transmitter
  const gdir = M.gfevd([[0.5, 0], [0.6, 0.3]], [[1, 0], [0, 1]], 10);
  rec(gdir.NET[0] > 0 && gdir.NET[1] < 0, 'gfevd: when x1 drives x2, x1 is the net transmitter', `NET = [${gdir.NET.map(f3).join(', ')}]`);
}

// ---------- beat measures on RR intervals with known answers ----------
{
  const rr = Array.from({ length: 1200 }, () => 800 + 30 * N());   // white noise beats
  const h = M.computeAutonomicHRVMastery(rr);
  const d = rr.slice(1).map((v, i) => v - rr[i]);
  const sd1 = Math.sqrt(std(d) ** 2 / 2), sdnn = std(rr), sd2 = Math.sqrt(Math.max(0, 2 * sdnn ** 2 - sd1 ** 2));
  rec(Math.abs(h.sd1Ms - sd1) / sd1 < 0.02 && Math.abs(h.sd2Ms - sd2) / sd2 < 0.02, 'Poincaré SD1/SD2 match the standard formulas', `engine ${f3(h.sd1Ms)}/${f3(h.sd2Ms)} vs formula ${f3(sd1)}/${f3(sd2)}`);
  rec(Math.abs(h.dfaAlpha1 - 0.5) < 0.15, 'DFA α1 on white-noise beats ≈ 0.5', `α1 = ${f3(h.dfaAlpha1)}`);
  let acc = 800; const rw = Array.from({ length: 1200 }, () => (acc += 3 * N()));      // random walk beats: α ≈ 1.5
  const hw = M.computeAutonomicHRVMastery(rw);
  rec(Math.abs(hw.dfaAlpha1 - 1.5) < 0.2, 'DFA α1 on random-walk beats ≈ 1.5', `α1 = ${f3(hw.dfaAlpha1)}`);
  // Lomb–Scargle: a 0.1 Hz oscillation in the beats must put the LF band above the HF band
  let tt = 0; const rrLf = []; for (let i = 0; i < 600; i++) { const v = 850 + 60 * Math.sin(2 * Math.PI * 0.1 * tt) + 5 * N(); rrLf.push(v); tt += v / 1000; }
  const hl = M.computeAutonomicHRVMastery(rrLf);
  rec(hl.lfHfRatio > 3, 'Lomb–Scargle: a 0.1 Hz beat oscillation gives LF/HF ≫ 1', `LF/HF = ${f3(hl.lfHfRatio)}`);
  tt = 0; const rrHf = []; for (let i = 0; i < 600; i++) { const v = 850 + 60 * Math.sin(2 * Math.PI * 0.25 * tt) + 5 * N(); rrHf.push(v); tt += v / 1000; }
  const hh = M.computeAutonomicHRVMastery(rrHf);
  rec(hh.lfHfRatio < 0.33, 'Lomb–Scargle: a 0.25 Hz beat oscillation gives LF/HF ≪ 1', `LF/HF = ${f3(hh.lfHfRatio)}`);
  const per = Array.from({ length: 600 }, (_, i) => 800 + 50 * Math.sin(i * 2 * Math.PI / 6));
  const hp = M.computeAutonomicHRVMastery(per);
  rec(hp.sampleEntropy < h.sampleEntropy, 'Sample entropy: periodic beats < white-noise beats', `periodic ${f3(hp.sampleEntropy)} vs noise ${f3(h.sampleEntropy)}`);
}

// ---------- cardiorespiratory coupling ----------
{
  const n = 600, resp = [], hrL = [], hrN = [];
  for (let i = 0; i < n; i++) { const ph = 2 * Math.PI * 0.1 * i; resp.push(12 + 3 * Math.sin(ph)); hrL.push(65 + 5 * Math.sin(ph - 0.6) + 0.3 * N()); hrN.push(65 + 5 * N()); }
  const cl = M.computeCardiorespiratoryCoupling(hrL, resp), cn = M.computeCardiorespiratoryCoupling(hrN, resp);
  rec(cl.phaseLockingValuePLV > 0.8 && cn.phaseLockingValuePLV < 0.4, 'PLV: locked heart/breath ≈ 1, unrelated ≈ 0', `locked ${f3(cl.phaseLockingValuePLV)}, unrelated ${f3(cn.phaseLockingValuePLV)}`);
  const te = cl.transferEntropy || cl.te || {};
  rec(true, 'Transfer entropy fields reported (direction checked in part 2)', JSON.stringify(Object.keys(cl)).slice(0, 160));
}

// ---------- regime filter ----------
{
  const s = []; for (let i = 0; i < 300; i++) s.push((i >= 120 && i < 180 ? 0.8 : 0.1) * N());
  const rf = M.computeAutonomicRegimeFilter(s, []);
  const p = rf.filteredProbCrisis;
  const inP = mean(p.slice(130, 175)), outP = mean(p.slice(20, 110));
  const inRange = p.every((v) => v >= 0 && v <= 1);
  rec(inRange && inP > 0.7 && outP < 0.3, 'Regime filter: P(high-change state) high inside a volatile stretch, low outside', `inside ${f3(inP)}, outside ${f3(outP)}`);
  rec(true, 'Regime filter parameters', 'fixed transition probs p00=0.965, p11=0.915 and quantile-based means; not estimated (no EM/MLE): noted for review');
}

}
{ const rng = M.makeRng(777), N = M.makeNormal(rng);

// ---------- Voronoi: cells tile the box, each point lies in its own cell ----------
{
  const pts = Array.from({ length: 12 }, () => [4 * rng() - 2, 4 * rng() - 2]);
  const v = M.computeVoronoiTessellation(pts);
  const sum = v.areas.reduce((s, a) => s + a, 0);
  const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const own = pts.every((p, i) => inside(p, v.cells[i]));
  rec(Math.abs(sum - v.totalArea) / v.totalArea < 1e-6 && own, 'Voronoi: cell areas sum to the box, each point inside its own cell', `Σareas ${f3(sum)} vs box ${f3(v.totalArea)}, own-cell ${own}`);
}
// ---------- Rips persistence on a unit square ----------
{
  const sq = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
  const d = M.ripsPersistenceDiagram3D(sq);
  const h0d = d.h0.map((b) => b[1]).filter(Number.isFinite).sort((a, b) => a - b);
  rec(d.h1.length === 1 && Math.abs(d.h1[0][0] - 1) < 1e-9 && Math.abs(d.h1[0][1] - Math.SQRT2) < 1e-9, 'Rips: unit square has one loop born at 1, dying at √2', `H1 = ${JSON.stringify(d.h1.map((b) => b.map(f3)))}; H0 finite deaths ${h0d.map(f3).join(', ')}`);
}
// Hungarian matching is internal to the engine; it is exercised by the Wasserstein test below.
// ---------- Wasserstein distance between persistence diagrams ----------
{
  const A = [[0, 1], [0.2, 0.9], [0.1, 0.5]], B = [[0, 1.1], [0.3, 0.8]];
  const wAA = M.wassersteinPersistenceDiagram(A, A), wAB = M.wassersteinPersistenceDiagram(A, B), wBA = M.wassersteinPersistenceDiagram(B, A);
  const val = (w) => (typeof w === 'number' ? w : w && (w.w2 ?? w.distance ?? w.W2 ?? w.value));
  rec(Math.abs(val(wAA)) < 1e-9 && Math.abs(val(wAB) - val(wBA)) < 1e-9 && val(wAB) > 0, 'Wasserstein-2 on diagrams: W(A,A)=0, symmetric, positive', `W(A,A) ${f3(val(wAA))}, W(A,B) ${f3(val(wAB))}, W(B,A) ${f3(val(wBA))}`);
}
// ---------- trial design: does the spillover-adjusted estimator recover a known effect with NOISE? ----------
{
  const r = M.runCRTDesignAndInference(M.DEFAULT_PHYSIOLOGICAL_NODES, { nPerm: 28, nSimRep: 300, spilloverStrength: 0.35, deltaTrue: -0.45 });
  const oc = r.operatingCharacteristics.filter((o) => o.estimator === 'adjusted');
  for (const o of oc) rec(Math.abs(o.bias) < 0.08 && o.coverage > 0.85, `Spillover-adjusted estimator (${o.design}, 300 noisy reps): bias small, 95% CI covers`, `bias ${f3(o.bias)}, RMSE ${f3(o.rmse)}, coverage ${(100 * o.coverage).toFixed(1)}%`);
  const naive = r.operatingCharacteristics.filter((o) => o.estimator === 'naive');
  rec(true, 'Naive estimator for comparison', naive.map((o) => `${o.design}: bias ${f3(o.bias)}, coverage ${(100 * o.coverage).toFixed(1)}%`).join(' · '));
}
// ---------- safe learning: guard, centered readout, M3 recurrence ----------
{
  const P = (o) => M.canAutoApplyAnl({ target_level: 'L5_decision', evidence_count: 25, parameter_path: 'policy.gain', ...o });
  const cases = [['valid L5 proposal, 25 pieces of evidence', P({}), true], ['L0 constitution', P({ target_level: 'L0_constitution' }), false],
    ['L1 safety', P({ target_level: 'L1_safety' }), false], ['L7 meta', P({ target_level: 'L7_meta' }), false],
    ['frozen prefix safety_rules.', P({ parameter_path: 'safety_rules.hr_ceiling' }), false], ['evidence 19 < 20', P({ evidence_count: 19 }), false]];
  const okAll = cases.every(([, got, want]) => got === want);
  rec(okAll, 'canAutoApplyAnl blocks L0/L1/L7, frozen prefixes and low evidence; admits a valid proposal', cases.map(([n, got]) => `${n} → ${got}`).join(' · '));
  const cands = [0.85, 0.80, 0.72, 0.67, 0.30].map((b, i) => ({ id: 'c' + i, name: 'c' + i, baseScore: b, nativeBias: [0.04, 0.043, -0.017, -0.024, 0][i], memoryBias: [0.025, 0.03, -0.013, -0.018, 0][i], elasticBias: [0.011, 0.014, -0.005, -0.007, 0][i], approved: true, fallback: i === 4 }));
  const cr = M.centerAndContractReadout(cands, 0.05);
  const shifts = cr.candidates.filter((c) => !c.fallback).map((c) => c.centeredScore - c.baseScore);
  const guaranteed = cr.pairwiseGuarantees.filter((q) => q.guaranteedByProp1);
  rec(shifts.every((v) => Math.abs(v) <= 0.05 + 1e-12) && guaranteed.every((q) => q.orderPreserved), 'Centered readout (Proposition 1): shifts within ±B; pairs with gap > 2B keep their order', `shifts ${shifts.map(f3).join(', ')}; guaranteed pairs ${guaranteed.length}`);
  const m3 = M.computeM3LinearRecurrenceAndCurves({});
  const mul = (X, Y) => X.map((r) => Y[0].map((_, j) => r.reduce((s, v, k) => s + v * Y[k][j], 0)));
  let PW = m3.A.map((r) => r.slice()), lg = 0; for (let i = 0; i < 40; i++) { PW = mul(PW, PW); lg *= 2; const nr = Math.max(...PW.flat().map(Math.abs)); PW = PW.map((r) => r.map((v) => v / nr)); lg += Math.log(nr); }
  const lam = Math.exp(lg / 2 ** 40);
  const t100 = m3.trajectory.find((r) => r.episode === 100);
  rec(Math.abs(lam - m3.spectralRadiusA) < 1e-6 && t100 && Math.abs(t100.correctedSharePct - m3.shareAt100Pct) < 1e-9, 'M3 recurrence: ρ(A) matches the Gelfand formula; reported share at ep 100 is the computed one', `engine ρ ${m3.spectralRadiusA.toFixed(6)} vs Gelfand ${lam.toFixed(6)}; ep100 ${f3(m3.shareAt100Pct)}% (computed ${t100 ? f3(t100.correctedSharePct) : 'none'})`);
}
// ---------- transfer entropy direction ----------
{
  const n = 900, resp = [], hr = [];
  for (let i = 0; i < n; i++) { resp.push(Math.sin(2 * Math.PI * 0.1 * i) + 0.6 * N()); }
  for (let i = 0; i < n; i++) hr.push((i >= 2 ? 0.9 * resp[i - 2] : 0) + 0.4 * N());
  const c = M.computeCardiorespiratoryCoupling(hr, resp);
  rec(c.teRespToHRBits > c.teHRToRespBits, 'Transfer entropy: breathing driving heart rate shows TE(resp→HR) > TE(HR→resp)', `resp→HR ${f3(c.teRespToHRBits)} bits, HR→resp ${f3(c.teHRToRespBits)} bits`);
}
}

// ---------- the fixes ----------
{
  const fs = require('fs'); const src = fs.readFileSync(process.argv[2] || DEFAULT, 'utf8');
  rec(!/fullBoundEpisode \|\| 280|\?\? 27\.0|\?\? 66\.0/.test(src), 'F1: no silent fallback to transcribed numbers (280, 27.0, 66.0)', /fullBoundEpisode \|\| 280/.test(src) ? 'fallbacks present' : 'no fallbacks in the source');
  const r = M.runCRTDesignAndInference(M.DEFAULT_PHYSIOLOGICAL_NODES, { nPerm: 28, nSimRep: 24, spilloverStrength: 0.35, deltaTrue: -0.45 });
  const e = r.activeAdjustedEstimate, w = e.hi - e.lo;
  rec(w > 0.05, 'F2: the trial-design estimate has a real interval (the outcome carries noise)', `estimate ${f3(e.est)}, 95% CI [${f3(e.lo)}, ${f3(e.hi)}], width ${f3(w)}`);
  const anl = M.runAnchoredNestedLearning();
  rec(/transcribed/.test(anl.capProtocol.provenance || ''), 'F3: the admission benchmark is labeled as transcribed, not computed', `provenance: ${anl.capProtocol.provenance || 'none'}`);
  const mk = (n, f) => Array.from({ length: n }, (_, t) => f(t));
  const sess = mk(150, (t) => ({ heart_rate_bpm: 62 + 6 * Math.sin(t / 9), pulse_rmssd_ms: 40 + 8 * Math.cos(t / 7), pulse_sdnn_ms: 48 + 5 * Math.sin(t / 11), timestamp: 1000 * t }));
  const lsa = M.runFullLSAAnalysis('vagal_resonance_recovery', { sessionSamples: sess, nullDraws: 6, seeds: 2 });
  const names = lsa.scenario.names || [];
  rec(lsa.scenario.fromRealSession === true && names.length === 3 && !names.some((n) => /resp|breath|eeg|skin|pressure|temperature|pulse transit/i.test(n)), 'F4: a session with heart rate and pulse variability builds a 3-signal network from those alone (nothing invented)', `signals used: ${names.join(' · ') || 'none'}; from real session ${lsa.scenario.fromRealSession}`);
}
// ---------- F5: a real session keeps its persistence (the ridge no longer works in raw units) ----------
{
  const n5 = M.makeNormal(M.makeRng(55)); const samples = []; let h = 0, v = 0;
  for (let t = 0; t < 900; t++) {
    h = 0.9 * h + 0.8 * n5(); v = 0.8 * v + 2.5 * n5();
    samples.push({ timestamp: 1000 * t, heart_rate_bpm: 68 + h, rmssd_ms: 45 + v, pulse_sdnn_ms: 55 + 0.5 * v + n5() });
  }
  const lsa = M.runFullLSAAnalysis('vagal_resonance_recovery', { sessionSamples: samples, nullDraws: 6, seeds: 2 });
  const rho = lsa.varFit.spectralRadius;
  rec(lsa.scenario.fromRealSession === true && Math.abs(rho - 0.9) < 0.1, 'F5: a real session with heart-rate persistence 0.90 keeps it (signals fitted on their own scales)', `persistence ${f3(rho)} (true 0.90)`);
}
// ---------- F6: the coupling function never answers with made-up data ----------
{
  const c = M.computeCardiorespiratoryCoupling([70, 71, 72], [12, 12, 12]);
  rec(c.valid === false && c.phaseLockingValuePLV === undefined, 'F6: too-short input gives "not enough data", not made-up coupling numbers', `valid ${c.valid}; ${c.reason || 'PLV ' + c.phaseLockingValuePLV}`);
}
console.log(out.join('\n'));
const fails = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n${out.length - fails} pass, ${fails} fail`);
process.exit(fails ? 1 : 0);
