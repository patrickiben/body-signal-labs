// Stage 3, step 3b: fastStretchTest on realistic rides, as the ride import receives them (5-second bin means of heart
// rate, binRide in offline.html, and the changes between bins).
// Run: node tests/autonomic_ride_realism_qc.cjs [engine path]
//
// Simulated heart rate, once a second for one hour (after a 5-minute warm-up that is dropped):
//   heart rate moves toward an effort target with a lag, tau 30 s rising and 50 s recovering; base target 135 bpm;
//   slow wandering (OU, tau 30 s, SD 1.5 bpm); the 0.1 Hz slow wave (+-1 bpm); breathing at 0.35-0.45 Hz (+-0.5 bpm);
//   beat noise (OU, tau 2 s, SD 0.8 bpm).
//   Devices: a chest strap (accurate, noise SD 0.3 bpm); a watch or Hume-style band (5-second averaging, whole bpm,
//   2% of seconds dropped and the last value repeated).
//
// Written before the first run (2026-11-09):
//   Steady riding, no distinct stretches (120 rides each): S1 strap; S2 watch; S3 watch with slow cardiac drift (+8 bpm
//   over the hour); S4 watch with gentle effort wandering (target OU, tau 120 s, SD 5 bpm). False "stretches" at most
//   3.3% in each and 2% pooled.
//   Clear intervals (2 min at +40 bpm, 3 min easy, all hour; 120 rides each): I1 strap; I2 watch. Found in at least 90%.
//   Reported, no bar: H1 rolling hills (bursts about every 5 min, 30-90 s, +15-30 bpm), watch; W1 weak intervals (1 min at
//   +15 bpm, 4 min easy), watch. For every case with stretches: which test fired (drift persistence or jumpy).
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const info = (name, evidence) => out.push(`INFO  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261115), randn = M.makeNormal(rng);
const pc = x => `${(100 * x).toFixed(1)}%`;
const t0 = Date.now();
const N = 3600, WARM = 300, BIN = 5;

function ride(kind, device, { drift = 0, wander = 0 } = {}) {
  const L = N + WARM, target = new Float64Array(L);
  const off = Math.floor(rng() * 300);
  if (kind === 'intervals') for (let t = 0; t < L; t++) target[t] = ((t + off) % 300) < 120 ? 40 : 0;
  if (kind === 'weak') for (let t = 0; t < L; t++) target[t] = ((t + off) % 300) < 60 ? 15 : 0;
  if (kind === 'hills') {
    let t = Math.floor(rng() * 300);
    while (t < L) {
      const dur = 30 + Math.floor(rng() * 61), amp = 15 + 15 * rng();
      for (let u = t; u < Math.min(L, t + dur); u++) target[u] = amp;
      t += dur + Math.floor(-Math.log(1 - rng()) * 300);
    }
  }
  const ou = (tau, sd) => { const a = Math.exp(-1 / tau), b = sd * Math.sqrt(1 - a * a); let v = sd * randn(); return () => (v = a * v + b * randn()); };
  const wand = ou(120, wander || 1e-9), slow = ou(30, 1.5), beat = ou(2, 0.8);
  const rr = Math.exp(-Math.PI * 0.02), w0 = 2 * Math.PI * 0.1, a1 = 2 * rr * Math.cos(w0), a2 = -rr * rr;
  const unitVar = (1 - a2) / ((1 + a2) * ((1 - a2) ** 2 - a1 * a1)), eSd = (1 / Math.SQRT2) / Math.sqrt(unitVar);
  let m1 = 0, m2 = 0;
  for (let i = 0; i < 500; i++) { const m = a1 * m1 + a2 * m2 + eSd * randn(); m2 = m1; m1 = m; }
  const fb = 0.35 + 0.1 * rng();
  let phase = rng() * 2 * Math.PI, H = 135 + target[0];
  const hr = new Float64Array(L);
  for (let t = 0; t < L; t++) {
    const goal = 135 + target[t] + (wander ? wand() : 0) + drift * Math.max(0, t - WARM) / N;
    H += (goal - H) * (1 - Math.exp(-1 / (goal > H ? 30 : 50)));
    const m = a1 * m1 + a2 * m2 + eSd * randn(); m2 = m1; m1 = m;
    phase += 2 * Math.PI * fb + 0.05 * randn();
    hr[t] = H + slow() + beat() + m + 0.5 * Math.sin(phase);
  }
  const seen = new Float64Array(N);
  let last = hr[WARM];
  for (let t = 0; t < N; t++) {
    const s = t + WARM;
    if (device === 'strap') seen[t] = hr[s] + 0.3 * randn();
    else {
      if (rng() < 0.02) { seen[t] = last; continue; }
      let sum = 0; for (let j = 0; j < 5; j++) sum += hr[s - j];
      seen[t] = last = Math.round(sum / 5);
    }
  }
  const bins = [];
  for (let k = 0; k < N / BIN; k++) { let s = 0; for (let j = 0; j < BIN; j++) s += seen[k * BIN + j]; bins.push(s / BIN); }
  const steps = [];
  for (let k = 1; k < bins.length; k++) steps.push(bins[k] - bins[k - 1]);
  return steps;
}

function runCase(n, make) {
  let hit = 0, drift = 0, jumpy = 0;
  for (let i = 0; i < n; i++) { const s = M.fastStretchTest(make(), { fit: false }); hit += s.stretches; drift += s.climbs; jumpy += s.jumpy; }
  return { rate: hit / n, drift: drift / n, jumpy: jumpy / n };
}

// Steady riding.
{
  const NULLS = [
    ['S1 steady, strap', () => ride('steady', 'strap')],
    ['S2 steady, watch', () => ride('steady', 'watch')],
    ['S3 steady + cardiac drift 8 bpm/h, watch', () => ride('steady', 'watch', { drift: 8 })],
    ['S4 steady + effort wandering, watch', () => ride('steady', 'watch', { wander: 5 })]
  ];
  let pooled = 0, over = false;
  const lines = NULLS.map(([label, make]) => { const r = runCase(120, make); pooled += r.rate * 120; if (r.rate > 10 / 300) over = true; return `${label} ${pc(r.rate)}`; });
  rec(!over && pooled / 480 <= 0.02, 'Steady riding: false "stretches" at most 3.3% in each and 2% pooled', `${lines.join('; ')}; pooled ${pc(pooled / 480)}`);
}

// Clear intervals.
{
  const cases = [['I1 intervals, strap', () => ride('intervals', 'strap')], ['I2 intervals, watch', () => ride('intervals', 'watch')]];
  let ok = true;
  const lines = cases.map(([label, make]) => { const r = runCase(120, make); if (r.rate < 0.9) ok = false; return `${label} ${pc(r.rate)} (drift ${pc(r.drift)}, jumpy ${pc(r.jumpy)})`; });
  rec(ok, 'Clear intervals (2 min at +40 bpm, 3 min easy) found in at least 90% of rides', lines.join('; '));
}

// Reported.
{
  const cases = [['H1 rolling hills, watch', () => ride('hills', 'watch')], ['W1 weak intervals (+15 bpm), watch', () => ride('weak', 'watch')]];
  for (const [label, make] of cases) { const r = runCase(120, make); info(label, `found in ${pc(r.rate)} (drift ${pc(r.drift)}, jumpy ${pc(r.jumpy)})`); }
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
