// Known-answer QC of the VARX extension (breathing guide as an outside input). Run: node tests/autonomic_varx_qc.cjs [engine path]
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));
const TAU = 2 * Math.PI;

// Simulate x[t+1] = c + Phi x[t] + B [cos th_t, sin th_t] + sigma e, th_t = where the guide is at sample t.
// The guide inputs here are computed independently of the engine's breathingGuideInputs.
function simulate({ Phi, c, B, T, sigma, randn, dt = 1, period = 10, guideOn = () => true, burn = 300 }) {
  const N = Phi.length, Y = [], guideSec = [];
  let x = new Array(N).fill(0);
  for (let t = 0; t < T + burn; t++) {
    const sec = guideOn(t - burn) ? t * dt : null;
    if (t >= burn) { Y.push(x.slice()); guideSec.push(sec); }
    const th = sec === null ? null : TAU * ((sec % period) / period);
    const u = th === null ? [0, 0] : [Math.cos(th), Math.sin(th)];
    x = x.map((_, i) => c[i] + Phi[i].reduce((s, p, j) => s + p * x[j], 0) + B[i][0] * u[0] + B[i][1] * u[1] + (Array.isArray(sigma) ? sigma[i] : sigma) * randn());
  }
  return { Y, guideSec };
}
const maxAbsDiff = (A, B) => { let m = 0; A.forEach((r, i) => (Array.isArray(r) ? r : [r]).forEach((v, j) => { m = Math.max(m, Math.abs(v - (Array.isArray(B[i]) ? B[i][j] : B[i]))); })); return m; };

const rng = M.makeRng(20261108), randn = M.makeNormal(rng);

// ---------- helpers ----------
{
  const g = M.breathingGuideInputs([0, 2.5, 12.5, null, -7.5]);
  const ok = Math.abs(g[0][0] - 1) < 1e-12 && Math.abs(g[0][1]) < 1e-12 && Math.abs(g[1][0]) < 1e-12 && Math.abs(g[1][1] - 1) < 1e-12 &&
    maxAbsDiff([g[2]], [g[1]]) < 1e-12 && g[3][0] === 0 && g[3][1] === 0 && maxAbsDiff([g[4]], [g[1]]) < 1e-12;
  rec(ok, 'breathingGuideInputs: 0 s → [1, 0], 2.5 s → [0, 1], one breath later the same, guide off → [0, 0], negative clock wraps', JSON.stringify(g.map(r => r.map(v => +v.toFixed(3)))));
  const p2 = M.chiSquareSurvivalEven(5.991464547, 2), p4 = M.chiSquareSurvivalEven(9.487729037, 4);
  rec(Math.abs(p2 - 0.05) < 1e-6 && Math.abs(p4 - 0.05) < 1e-6 && M.chiSquareSurvivalEven(3, 3) === null, 'chi-square tail: 5.991 (2 df) and 9.488 (4 df) → 0.05; odd df → null', `${p2.toFixed(6)}, ${p4.toFixed(6)}`);
}

// ---------- V1: with no guide, the VARX is exactly the non-negative VAR it extends ----------
{
  const Phi = [[0.5, 0.2, 0], [0.1, 0.4, 0], [0, 0.25, 0.45]], c = [0.2, 0.1, 0.15], B = [[0, 0], [0, 0], [0, 0]];
  const { Y } = simulate({ Phi, c, B, T: 500, sigma: 0.3, randn });
  let worst = 0;
  for (const [lam, it] of [[0.05, 45], [0, 400], [0.08, 25]]) {
    const a = M.fitVarNonneg(Y, lam, it), b = M.fitVarxNonneg(Y, null, lam, it);
    worst = Math.max(worst, maxAbsDiff(a.Phi, b.Phi), maxAbsDiff(a.c, b.c), maxAbsDiff(a.Sigma, b.Sigma), Math.abs(a.spectralRadius - b.spectralRadius));
  }
  rec(worst === 0, 'V1 no guide → identical to fitVarNonneg (Φ, c, Σ, ρ; three settings)', `max difference ${worst}`);
}

// ---------- V2: recover a known Φ and a known signed guide effect ----------
const PhiT = [[0.55, 0.20, 0.00], [0.00, 0.45, 0.15], [0.10, 0.00, 0.35]];
const BT = [[0.60, -0.40], [-0.80, 0.30], [0.00, 0.00]];
const cT = [0.3, 0.2, 0.1];
const sim2 = simulate({ Phi: PhiT, c: cT, B: BT, T: 4000, sigma: 0.5, randn });
const fit2 = M.fitVarxNonneg(sim2.Y, M.breathingGuideInputs(sim2.guideSec), 0, 400);
{
  const ePhi = maxAbsDiff(fit2.Phi, PhiT), eB = maxAbsDiff(fit2.B, BT);
  const negCross = fit2.Phi.flat().filter((v, k) => Math.floor(k / 3) !== k % 3 && v < 0).length;
  rec(ePhi < 0.05 && negCross === 0, 'V2 recovers the known coupling Φ (T=4000, λ=0)', `max |Φ̂−Φ| = ${f3(ePhi)}, negative cross entries ${negCross}`);
  rec(eB < 0.05 && fit2.B[1][0] < 0 && fit2.B[0][1] < 0, 'V2 recovers the known guide effect B, including downward pushes', `max |B̂−B| = ${f3(eB)}; B̂ = ${JSON.stringify(fit2.B.map(r => r.map(v => +v.toFixed(3))))}`);
  const pT = fit2.inputTest.map(t => t.p);
  rec(pT[0] < 1e-6 && pT[1] < 1e-6 && pT[2] > 0.001, 'V2 guide test: signals 1 and 2 follow the guide, signal 3 does not', `p = ${pT.map(v => v.toExponential(1)).join(', ')}`);
}

// ---------- V3: the steady-state swing formula matches a noise-free simulation exactly ----------
{
  let worstA = 0, worstP = 0;
  for (const dt of [1, 0.5]) {
    const T = Math.round(3000 / dt), keep = Math.round(2000 / dt);
    const { Y, guideSec } = simulate({ Phi: PhiT, c: cT, B: BT, T, sigma: 0, randn, dt, burn: Math.round(600 / dt) });
    const resp = M.guideResponse(PhiT, BT, dt, 10);
    for (let i = 0; i < 2; i++) {
      const xs = Y.slice(-keep).map(r => r[i]), th = guideSec.slice(-keep).map(s => TAU * ((s % 10) / 10));
      const m = xs.reduce((s, v) => s + v, 0) / keep;
      let a = 0, b = 0;
      xs.forEach((v, k) => { a += (2 / keep) * (v - m) * Math.cos(th[k]); b += (2 / keep) * (v - m) * Math.sin(th[k]); });
      const amp = Math.hypot(a, b);
      let frac = Math.atan2(b, a) / TAU; frac -= Math.floor(frac);
      worstA = Math.max(worstA, Math.abs(resp[i].amplitude - amp) / amp);
      let dP = Math.abs(resp[i].peakAtS - frac * 10); dP = Math.min(dP, 10 - dP);
      worstP = Math.max(worstP, dP);
    }
  }
  rec(worstA < 1e-9 && worstP < 1e-9, 'V3 guideResponse = the simulated steady-state swing (amplitude and peak time; 1 s and 0.5 s samples)', `max relative amplitude error ${worstA.toExponential(1)}, max peak-time error ${worstP.toExponential(1)} s`);
}

// ---------- V4: the swing estimated from data matches the truth ----------
{
  const rT = M.guideResponse(PhiT, BT, 1, 10), rE = M.guideResponse(fit2.Phi, fit2.B, 1, 10);
  const relA = [0, 1].map(i => Math.abs(rE[i].amplitude - rT[i].amplitude) / rT[i].amplitude);
  const dP = [0, 1].map(i => { const d = Math.abs(rE[i].peakAtS - rT[i].peakAtS); return Math.min(d, 10 - d); });
  rec(Math.max(...relA) < 0.05 && Math.max(...dP) < 0.3, 'V4 estimated swing within 5% and peak time within 0.3 s (T=4000)',
    `true amplitude ${rT.slice(0, 2).map(r => f3(r.amplitude)).join(', ')} vs estimated ${rE.slice(0, 2).map(r => f3(r.amplitude)).join(', ')}; peak ${rT.slice(0, 2).map(r => r.peakAtS.toFixed(2)).join(', ')} s vs ${rE.slice(0, 2).map(r => r.peakAtS.toFixed(2)).join(', ')} s`);
}

// ---------- V5: two signals that both follow the guide but do not drive each other ----------
for (const [label, B] of [['in step', [[0.8, 0], [0.5, 0]]], ['a quarter breath apart', [[0.8, 0], [0, 0.8]]]]) {
  const Phi = [[0.6, 0], [0, 0.5]], c = [0.2, 0.2];
  const stats = { plainCross: 0, varxCross: 0, plainTCI: 0, varxTCI: 0 }, R = 20;
  for (let r = 0; r < R; r++) {
    const { Y, guideSec } = simulate({ Phi, c, B, T: 600, sigma: 0.4, randn });
    const pl = M.fitVarNonneg(Y, 0.05, 45), vx = M.fitVarxNonneg(Y, M.breathingGuideInputs(guideSec), 0.05, 45);
    stats.plainCross += Math.max(pl.Phi[0][1], pl.Phi[1][0]) / R; stats.varxCross += Math.max(vx.Phi[0][1], vx.Phi[1][0]) / R;
    stats.plainTCI += M.gfevd(pl.Phi, pl.Sigma, 10).TCI / R; stats.varxTCI += M.gfevd(vx.Phi, vx.Sigma, 10).TCI / R;
  }
  rec(stats.varxCross < 0.05 && stats.varxTCI < 2, `V5 shared guide rhythm, ${label}: the VARX finds no signal driving the other (truth: none, spillover 0%)`,
    `mean largest cross-coupling: plain ${f3(stats.plainCross)} vs VARX ${f3(stats.varxCross)}; spillover index: plain ${stats.plainTCI.toFixed(1)}% vs VARX ${stats.varxTCI.toFixed(1)}% (20 ten-minute sessions)`);
}

// ---------- V6: no real guide effect → false alarms at the stated rate (white-noise model) ----------
// The VARX's Wald test is valid in this model class; the app decides with the minute-block timing test instead,
// because on device-like heart rate the Wald test's false alarms ran far above its level (tests/autonomic_device_rate_qc.cjs).
{
  const Phi = [[0.6, 0.1], [0.0, 0.5]], c = [0.2, 0.2], B = [[0, 0], [0, 0]], R = 1500;
  let w05 = 0, w01 = 0, b05 = 0, b01 = 0;
  for (let r = 0; r < R; r++) {
    const { Y, guideSec } = simulate({ Phi, c, B, T: 600, sigma: 0.5, randn });
    const net = M.fitGuideAwareNetwork(Y, guideSec), pw = net.guideFit.inputTest[0].p, pb = net.guide[0].p;
    if (pw < 0.05) w05++; if (pw < 0.01) w01++; if (pb < 0.05) b05++; if (pb < 0.01) b01++;
  }
  rec(w05 >= 53 && w05 <= 97 && w01 <= 24, 'V6 VARX guide test (standardized, no ridge): false alarms at the stated rate in its model (1500 ten-minute sessions)',
    `p < 0.05 in ${(100 * w05 / R).toFixed(1)}% (expected 5%), p < 0.01 in ${(100 * w01 / R).toFixed(1)}% (expected 1%)`);
  rec(b05 >= 53 && b05 <= 97 && b01 <= 24, "V6 the app's minute-block timing test: false alarms at the stated rate in the same sessions",
    `p < 0.05 in ${(100 * b05 / R).toFixed(1)}%, p < 0.01 in ${(100 * b01 / R).toFixed(1)}%`);
}

// ---------- V7: a real guide effect is found by the VARX test in its model ----------
{
  const Phi = [[0.6, 0.1], [0.0, 0.5]], c = [0.2, 0.2], R = 200, rates = [], block = [];
  for (const b of [0.05, 0.1, 0.2]) {
    let hit = 0, bh = 0;
    for (let r = 0; r < R; r++) {
      const { Y, guideSec } = simulate({ Phi, c, B: [[b, 0], [0, 0]], T: 600, sigma: 0.5, randn });
      const net = M.fitGuideAwareNetwork(Y, guideSec);
      if (net.guideFit.inputTest[0].p < 0.01) hit++;
      if (net.guide[0].p < 0.01) bh++;
    }
    rates.push([b, hit / R]); block.push(bh / R);
  }
  rec(rates[2][1] >= 0.95, 'V7 VARX guide test: an effect of 0.4 noise SDs per step is found at p < 0.01 in at least 95% of ten-minute sessions',
    rates.map(([b, r], i) => `effect ${b / 0.5} SD: VARX test ${(100 * r).toFixed(0)}%, minute-block test ${(100 * block[i]).toFixed(0)}%`).join('; '));
}

// ---------- V8: guide off for the whole window ----------
{
  const { Y } = simulate({ Phi: PhiT, c: cT, B: [[0, 0], [0, 0], [0, 0]], T: 600, sigma: 0.5, randn });
  const off = M.fitVarxNonneg(Y, Y.map(() => [0, 0]), 0.05, 45), plain = M.fitVarNonneg(Y, 0.05, 45);
  const d = maxAbsDiff(off.Phi, plain.Phi);
  rec(off.inputTest === null && off.B.flat().every(v => v === 0) && d < 1e-9, 'V8 guide off all session → no guide test, guide effect 0, coupling as without the guide', `inputTest ${off.inputTest}, max |ΔΦ| ${d.toExponential(1)}`);
}

// ---------- V9: heart-rate scale: the session fit keeps persistence; a ridge in raw units does not ----------
{
  const PhiH = [[0.9, 0.0], [0.05, 0.7]];
  const { Y } = simulate({ Phi: PhiH, c: [0.1, 0.3], B: [[0, 0], [0, 0]], T: 600, sigma: [0.06, 0.15], randn });
  const net = M.fitGuideAwareNetwork(Y, null), raw = M.fitVarNonneg(Y, 0.05, 45);
  rec(Math.abs(net.persistence - 0.9) < 0.1, 'V9 heart rate in the app\'s units (true persistence 0.90): the session fit keeps it',
    `session fit ${f3(net.persistence)}; the same ridge in raw units ${f3(raw.spectralRadius)}`);
}

// ---------- V10: units do not matter ----------
{
  const sc = [15, 0.02, 3], sh = [60, 1, -5];
  const Y2 = sim2.Y.map(r => r.map((v, j) => v * sc[j] + sh[j]));
  const a = M.fitGuideAwareNetwork(sim2.Y, sim2.guideSec), b = M.fitGuideAwareNetwork(Y2, sim2.guideSec);
  const dNet = maxAbsDiff(a.gfevd.NET, b.gfevd.NET), dT = Math.abs(a.gfevd.TCI - b.gfevd.TCI), dR = Math.abs(a.persistence - b.persistence);
  const dAmp = Math.max(...a.guide.map((g, i) => Math.abs(b.guide[i].amplitude / (g.amplitude * sc[i]) - 1)));
  rec(dNet < 1e-9 && dT < 1e-9 && dR < 1e-9 && dAmp < 1e-9, 'V10 rescaling and shifting the signals changes nothing but the swing\'s units',
    `max change: NET ${dNet.toExponential(1)}, spillover ${dT.toExponential(1)}, persistence ${dR.toExponential(1)}, swing ratio ${dAmp.toExponential(1)}`);
}

// ---------- V11: too little guide → no guide result ----------
{
  const { Y, guideSec } = simulate({ Phi: PhiT, c: cT, B: BT, T: 600, sigma: 0.5, randn, guideOn: t => t < 48 });
  const net = M.fitGuideAwareNetwork(Y, guideSec);
  rec(net.valid && net.guide === null, 'V11 guide on for under a quarter of the window → no guide result is given', `guide samples ${guideSec.filter(Number.isFinite).length} of 600 → guide ${net.guide}`);
}

// ---------- V12: the swing comes back in beats per minute, close to the truth ----------
{
  const PhiB = [[0.85, 0.0], [0.05, 0.6]], cB = [68 * 0.15, 0.3 - 0.05 * 68], BB = [[1.2, -0.6], [0, 0]];
  const truth = M.guideResponse(PhiB, BB, 1, 10)[0];
  const amps = [], peaks = [];
  for (let r = 0; r < 20; r++) {
    const sim = simulate({ Phi: PhiB, c: cB, B: BB, T: 600, sigma: [0.6, 0.1], randn });
    const g = M.fitGuideAwareNetwork(sim.Y, sim.guideSec).guide[0];
    amps.push(g.amplitude); peaks.push(g.peakAtS);
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const relMed = Math.abs(med(amps) - truth.amplitude) / truth.amplitude;
  let dPk = Math.abs(med(peaks) - truth.peakAtS); dPk = Math.min(dPk, 10 - dPk);
  rec(relMed < 0.1 && dPk < 0.5, 'V12 heart rate in bpm: the session fit\'s swing with the guide matches the truth (20 ten-minute sessions)',
    `true swing ±${truth.amplitude.toFixed(2)} bpm, peak ${truth.peakAtS.toFixed(2)} s after the inhale starts; estimated median ±${med(amps).toFixed(2)} bpm (range ${Math.min(...amps).toFixed(2)}–${Math.max(...amps).toFixed(2)}), peak ${med(peaks).toFixed(2)} s`);
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length;
console.log(`\n${out.length - fails} pass, ${fails} fail`);
process.exit(fails ? 1 : 0);
