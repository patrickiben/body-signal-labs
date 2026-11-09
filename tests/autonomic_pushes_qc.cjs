// Stage 3, pushes (findPushes): where heart rate was pushed much harder than usual, and the climb or fall that followed.
// Run: node tests/autonomic_pushes_qc.cjs [engine path]
//
// Written before the first run of this file (2026-11-09; threshold 4.5 x the rider's robust spread, set in advance):
//   K known answer (200 records): momentum 0.8, noise 1, one push of +8 at a random step. Found within 1 step in at least
//     95%; direction right whenever found; no other push in at least 95%. Size, checked on the median over records (a single
//     record's model size moves with its momentum estimate, sensitivity 1/(1 - phi)^2; this reading of "within 15%" was
//     fixed after one smoke record): model size within 15% of the true total 8 / (1 - 0.8) = 40; the measured change over
//     the shaded steps within 15% of the noise-free response over the same steps.
//   S steady riding (the step 3b rides: strap; watch; watch with cardiac drift; watch with effort wandering; 120 each): rides
//     with any push at most 5% of each kind.
//   I clear intervals (2 min at +40 bpm, 3 min easy; strap and watch; 120 each): at least 90% of interval starts found as
//     up-pushes and 90% of ends as down-pushes, within 3 steps (15 s); spurious pushes at most 0.2 an hour.
//   Reported, no bar: rolling hills and weak intervals (+15 bpm), watch.
//
// Run 1 (seed 20261116): K and S passed; interval starts were found in only 22-26% and ends 1-2%. At 5-second steps a
// push is about 6 bpm, often split across two bins, against about 1.2 bpm of noise. findPushes now judges pushes on
// 15-second changes (aggregate 3; heart rate rises over about 30 s). From run 2 the records use a new seed (20261117) and
// the same bar. K tests the machinery on its own steps (aggregate 1); the rides use the default.
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const info = (name, evidence) => out.push(`INFO  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261117), randn = M.makeNormal(rng);   // run 1 used 20261116
const pc = x => `${(100 * x).toFixed(1)}%`;
const t0 = Date.now();
const N = 3600, WARM = 300, BIN = 5;

// K. Known answer.
{
  let found = 0, dirOk = true, clean = 0;
  const sizeRatio = [], changeRatio = [];
  for (let i = 0; i < 200; i++) {
    const at = 100 + Math.floor(rng() * 500), r = [];
    for (let t = 0; t < 920; t++) { let v = randn() + 0.8 * (r[t - 1] ?? 0); if (t === at + 200) v += 8; r.push(v); }
    const x = r.slice(200), f = M.findPushes(x, { aggregate: 1, maxSettle: 36, minSteps: 60 });
    const hit = f.pushes.find(p => Math.abs(p.at - at) <= 1);
    if (hit) {
      found++;
      if (hit.direction !== 'up') dirOk = false;
      sizeRatio.push(hit.size / 40);
      let truth = 0; for (let j = 0; j < hit.settleSteps; j++) truth += 8 * 0.8 ** (j - (hit.at - at) >= 0 ? j - (hit.at - at) : 0) * (j - (hit.at - at) >= 0 ? 1 : 0);
      changeRatio.push(hit.change / truth);
    }
    if (f.pushes.length === (hit ? 1 : 0)) clean++;
  }
  const mS = M.quantile(sizeRatio, 0.5), mC = M.quantile(changeRatio, 0.5);
  rec(found / 200 >= 0.95 && dirOk && clean / 200 >= 0.95 && Math.abs(mS - 1) <= 0.15 && Math.abs(mC - 1) <= 0.15,
    'Known push (+8 on momentum 0.8): found at the right step, right direction, no others, sizes right on the median (200 records)',
    `found ${pc(found / 200)}; no other push ${pc(clean / 200)}; model size median ${(40 * mS).toFixed(1)} of 40 bpm (80% of records ${(40 * M.quantile(sizeRatio, 0.1)).toFixed(0)}-${(40 * M.quantile(sizeRatio, 0.9)).toFixed(0)}); measured change median ${(100 * mC).toFixed(0)}% of the noise-free response`);
}

// The realistic rides of step 3b, with the true effort changes.
function ride(kind, device, { drift = 0, wander = 0 } = {}) {
  const L = N + WARM, target = new Float64Array(L), events = [];
  const off = Math.floor(rng() * 300);
  const mark = (t, dir) => { const d = t - WARM; if (d >= 15 && d < N - 15) events.push({ bin: Math.floor(d / BIN), dir }); };
  if (kind === 'intervals' || kind === 'weak') {
    const hard = kind === 'intervals' ? 120 : 60, amp = kind === 'intervals' ? 40 : 15;
    for (let t = 0; t < L; t++) { const ph = (t + off) % 300; target[t] = ph < hard ? amp : 0; if (ph === 0) mark(t, 'up'); if (ph === hard) mark(t, 'down'); }
  }
  if (kind === 'hills') {
    let t = Math.floor(rng() * 300);
    while (t < L) {
      const dur = 30 + Math.floor(rng() * 61), amp = 15 + 15 * rng();
      for (let u = t; u < Math.min(L, t + dur); u++) target[u] = amp;
      mark(t, 'up'); mark(t + dur, 'down');
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
    else { if (rng() < 0.02) { seen[t] = last; continue; } let sum = 0; for (let j = 0; j < 5; j++) sum += hr[s - j]; seen[t] = last = Math.round(sum / 5); }
  }
  const bins = [];
  for (let k = 0; k < N / BIN; k++) { let s = 0; for (let j = 0; j < BIN; j++) s += seen[k * BIN + j]; bins.push(s / BIN); }
  const steps = [];
  for (let k = 1; k < bins.length; k++) steps.push(bins[k] - bins[k - 1]);
  return { steps, events };
}
function score(n, make) {
  let anyPush = 0, spurious = 0, ups = 0, upsFound = 0, downs = 0, downsFound = 0;
  for (let i = 0; i < n; i++) {
    const { steps, events } = make(), f = M.findPushes(steps);
    if (f.pushes.length) anyPush++;
    for (const ev of events) {
      const hit = f.pushes.some(p => p.direction === ev.dir && Math.abs(p.at - ev.bin) <= 3);
      if (ev.dir === 'up') { ups++; upsFound += hit; } else { downs++; downsFound += hit; }
    }
    spurious += f.pushes.filter(p => !events.some(ev => ev.dir === p.direction && Math.abs(p.at - ev.bin) <= 3)).length;
  }
  return { anyPush: anyPush / n, spuriousPerHour: spurious / n, up: ups ? upsFound / ups : null, down: downs ? downsFound / downs : null };
}

// S. Steady riding.
{
  const kinds = [['strap', () => ride('steady', 'strap')], ['watch', () => ride('steady', 'watch')], ['watch + cardiac drift', () => ride('steady', 'watch', { drift: 8 })], ['watch + effort wandering', () => ride('steady', 'watch', { wander: 5 })]];
  let ok = true;
  const lines = kinds.map(([label, make]) => { const s = score(120, make); if (s.anyPush > 0.05) ok = false; return `${label} ${pc(s.anyPush)}`; });
  rec(ok, 'Steady riding: rides with any push at most 5% of each kind', lines.join('; '));
}

// I. Clear intervals.
{
  let ok = true;
  const lines = [['strap', () => ride('intervals', 'strap')], ['watch', () => ride('intervals', 'watch')]].map(([label, make]) => {
    const s = score(120, make);
    if (s.up < 0.9 || s.down < 0.9 || s.spuriousPerHour > 0.2) ok = false;
    return `${label}: starts ${pc(s.up)}, ends ${pc(s.down)}, spurious ${s.spuriousPerHour.toFixed(2)}/h`;
  });
  rec(ok, 'Clear intervals: at least 90% of starts (up) and ends (down) found within 15 s; spurious at most 0.2 an hour', lines.join('; '));
}

// Reported.
for (const [label, make] of [['Rolling hills, watch', () => ride('hills', 'watch')], ['Weak intervals (+15 bpm), watch', () => ride('weak', 'watch')]]) {
  const s = score(120, make);
  info(label, `starts ${pc(s.up)}, ends ${pc(s.down)}, spurious ${s.spuriousPerHour.toFixed(2)}/h`);
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
