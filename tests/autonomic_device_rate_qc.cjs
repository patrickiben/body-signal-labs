// Heart rhythm with the Rest breathing guide, as devices deliver heart rate (step 2). Run: node tests/autonomic_device_rate_qc.cjs [engine path]
// Simulated hearts: slow drift, beat noise, the heart's own slow wave near 0.1 Hz (Mayer wave), and the breathing
// rhythm (following the guide, or breathing on one's own). Beats by integral pulse frequency modulation. Devices: a
// chest strap's beat intervals, and once-a-second whole-bpm reports averaged over 0, 3, 5 or 8 s, arriving up to 0.4 s
// late, 2% dropped. Ten-minute sessions. The app's decision "keeps time with the guide" is p < 0.01.
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const TAU = 2 * Math.PI, T = 600;

function heartBeats(sc, rng, randn) {
  const dt = 0.1, burn = 60, n = Math.round((T + burn) / dt);
  const ou = (tau, s) => { const a = Math.exp(-dt / tau), b = s * Math.sqrt(1 - a * a); let v = s * randn(); return () => (v = a * v + b * randn()); };
  const drift = ou(30, 2), fast = ou(2, 0.8), jit = ou(20, 0.3), fr = ou(30, sc.freeSd ?? 0.03);
  const r = Math.exp(-Math.PI * (sc.mayerBw ?? 0.02) * dt), w0 = TAU * 0.095 * dt, a1 = 2 * r * Math.cos(w0), a2 = -r * r;
  const unitVar = (1 - a2) / ((1 + a2) * ((1 - a2) ** 2 - a1 * a1)), eSd = ((sc.mayer ?? 1.5) / Math.SQRT2) / Math.sqrt(unitVar);
  let m1 = 0, m2 = 0, psi = rng() * TAU, cum = 0;
  for (let i = 0; i < 2000; i++) { const m = a1 * m1 + a2 * m2 + eSd * randn(); m2 = m1; m1 = m; }
  const beats = [];
  for (let i = 0; i < n; i++) {
    const t = i * dt - burn;
    const m = a1 * m1 + a2 * m2 + eSd * randn(); m2 = m1; m1 = m;
    if (sc.follow) psi = TAU * (((t % 10) + 10) % 10) / 10 + jit();
    else psi += TAU * Math.max(0.05, sc.rate + fr()) * dt;
    const hr = 68 + drift() + fast() + m + sc.amp * Math.cos(psi - 0.6 * Math.PI);
    const f = hr / 60; cum += f * dt;
    if (cum >= 1) { cum -= 1; beats.push(t - cum / f); }
  }
  return beats;
}

function device(beats, dev, rng, randn) {
  const jit = dev.kind === 'strap' ? 0.003 : 0.015;
  const bt = beats.map(b => b + jit * randn()).sort((a, b) => a - b);
  const bh = []; for (let k = 1; k < bt.length; k++) bh.push([bt[k], 60 / (bt[k] - bt[k - 1])]);
  const hr = new Array(T);
  if (dev.kind === 'strap') {
    let k = 0;
    for (let g = 0; g < T; g++) {
      while (k < bh.length - 2 && bh[k + 1][0] < g) k++;
      const [t0, h0] = bh[k], [t1, h1] = bh[k + 1];
      hr[g] = h0 + (h1 - h0) * Math.min(1, Math.max(0, (g - t0) / (t1 - t0)));
    }
    return hr;
  }
  let hi = -1, lo = 0, last = 68;
  for (let g = 0; g < T; g++) {
    const at = g - 1 + 0.4 * rng();
    while (hi + 1 < bh.length && bh[hi + 1][0] <= at) hi++;
    if (rng() < 0.02) { hr[g] = last; continue; }
    let v;
    if (dev.L === 0) v = hi >= 0 ? bh[hi][1] : 68;
    else {
      while (lo < hi && bh[lo][0] <= at - dev.L) lo++;
      let s = 0, c = 0; for (let k = lo; k <= hi; k++) { s += bh[k][1]; c++; }
      v = c ? s / c : last;
    }
    hr[g] = last = Math.round(v);
  }
  return hr;
}

const guideSec = [...Array(T).keys()];
const DEVICES = [{ name: 'chest strap', kind: 'strap', att: 1 }, ...[0, 3, 5, 8].map(L => ({ name: L ? `once/s, ${L} s smoothing` : 'once/s, no smoothing', kind: 'hume', L, att: L ? Math.abs(Math.sin(Math.PI * 0.1 * L) / (Math.PI * 0.1 * L)) : 1 }))];
const SCEN = [
  { key: 'F4', label: 'following, ±4 bpm', follow: true, amp: 4, n: 60 },
  { key: 'F15', label: 'following, ±1.5 bpm', follow: true, amp: 1.5, n: 100 },
  { key: 'N15', label: 'not following, free 15/min', follow: false, rate: 0.25, amp: 1.5, n: 300 },
  { key: 'N65', label: 'not following, own slow 6.5/min', follow: false, rate: 6.5 / 60, freeSd: 0.005, amp: 4, n: 300 },
  { key: 'NM3', label: 'not following, strong slow wave ±3', follow: false, rate: 0.25, amp: 1.5, mayer: 3, n: 300 },
  { key: 'NMS', label: 'not following, slower slow wave ±2', follow: false, rate: 0.25, amp: 1.5, mayer: 2, mayerBw: 0.01, n: 300 },
];
const rng = M.makeRng(20261109), randn = M.makeNormal(rng);
const res = {};
let sameDecision = true;
for (const sc of SCEN) {
  res[sc.key] = DEVICES.map(() => ({ hit: 0, ray: 0, amps: [] }));
  for (let s = 0; s < sc.n; s++) {
    const beats = heartBeats(sc, rng, randn);
    DEVICES.forEach((dev, d) => {
      const hr = device(beats, dev, rng, randn);
      const g = M.fitGuideAwareNetwork(hr.map(v => [v]), guideSec).guide[0], pl = M.guidePhaseLocking(hr, guideSec);
      if (g.p !== pl.p) sameDecision = false;
      const K = pl.breaths, Rn = K * pl.plv;
      const pRay = Math.min(1, Math.exp(Math.sqrt(1 + 4 * K + 4 * (K * K - Rn * Rn)) - (1 + 2 * K)));
      const r = res[sc.key][d];
      if (g.p < 0.01) r.hit++;
      if (pRay < 0.01) r.ray++;
      r.amps.push(g.amplitude);
    });
  }
}
const rate = (key, d) => res[key][d].hit / SCEN.find(s => s.key === key).n;
const pc = x => `${(100 * x).toFixed(1)}%`;
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

rec(sameDecision, "The app's guide decision is the minute-block timing test, not the VARX's white-noise test", 'fitGuideAwareNetwork guide p equals guidePhaseLocking p in every session');
rec(DEVICES.every((_, d) => rate('F4', d) >= 0.98), 'Following the guide, ±4 bpm swing: found in at least 98% of sessions on every device', DEVICES.map((dv, d) => `${dv.name} ${pc(rate('F4', d))}`).join(', '));
rec([0, 1, 2, 3].every(d => rate('F15', d) >= 0.9), 'Following the guide, ±1.5 bpm swing: found in at least 90% with a strap or up to 5 s of smoothing (8 s reported)', DEVICES.map((dv, d) => `${dv.name} ${pc(rate('F15', d))}`).join(', '));
const H0 = ['N15', 'N65', 'NM3', 'NMS'];
let worst = 0, worstAt = '', pooledHit = 0, pooledN = 0, pooledRay = 0;
for (const k of H0) DEVICES.forEach((dv, d) => {
  const n = SCEN.find(s => s.key === k).n, x = res[k][d].hit / n;
  pooledHit += res[k][d].hit; pooledRay += res[k][d].ray; pooledN += n;
  if (x > worst) { worst = x; worstAt = `${SCEN.find(s => s.key === k).label}, ${dv.name}`; }
});
rec(worst <= 10 / 300 && pooledHit / pooledN <= 0.02, 'Not following: "keeps time with the guide" in at most 3.3% of sessions in any case, at most 2% overall (stated level 1%)',
  `overall ${pc(pooledHit / pooledN)} of ${pooledN}; worst ${pc(worst)} (${worstAt})`);
rec(pooledRay / pooledN > 0.03, 'The not-following cases are hard enough to break a breath-by-breath test (so this bench can fail)', `Rayleigh test on the same sessions: ${pc(pooledRay / pooledN)} false alarms at the 1% level`);
let worstSwing = 0, swingAt = '';
for (const k of ['F4', 'F15']) DEVICES.forEach((dv, d) => {
  const truth = SCEN.find(s => s.key === k).amp * dv.att, rel = Math.abs(med(res[k][d].amps) - truth) / truth;
  if (rel > worstSwing) { worstSwing = rel; swingAt = `${k} ${dv.name}: ${med(res[k][d].amps).toFixed(2)} vs ${truth.toFixed(2)} bpm`; }
});
rec(worstSwing < 0.12, 'The bpm swing matches what the device sees (within 12%, every device, both swings)', `largest gap ${pc(worstSwing)} (${swingAt})`);

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length;
console.log(`\n${out.length - fails} pass, ${fails} fail`);
process.exit(fails ? 1 : 0);
