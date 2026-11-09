// Effort target, step 2 of 2: findTargetJumps on realistic rides, as the ride import receives them (5-second bin means of
// heart rate, binRide in offline.html), noise levels learned from each ride.
// Run: node tests/autonomic_effort_target_rides_qc.cjs [engine path]
//
// The rides are step 3b's (tests/autonomic_ride_realism_qc.cjs): heart rate moves toward an effort target with tau 30 s
// rising and 50 s recovering (the model assumes one tau, 40 s); slow wandering, the 0.1 Hz wave, breathing and beat noise;
// a chest strap, or a watch / Hume-style band (5-second averaging, whole bpm, 2% of seconds dropped).
//
// The bar, set for pushes before this model existed (2026-11-09), unchanged; records from a new seed:
//   Steady riding (strap; watch; watch with cardiac drift +8 bpm over the hour; watch with effort wandering, target OU
//   tau 120 s SD 5 bpm; 120 rides each): rides with any jump at most 5% of each kind.
//   Clear intervals (2 min at +40 bpm, 3 min easy; strap and watch; 120 each): at least 90% of starts found as up-jumps
//   and 90% of ends as down-jumps, within 3 steps (15 s); spurious jumps at most 0.2 an hour.
//   Reported, no bar: rolling hills and weak intervals (+15 bpm), watch.
//
// Run 1 (seed 20261120, one shared 40-s speed): interval starts 100%, ends 99.2-99.5%, spurious 0.18 (strap) and 0.23
// (watch) an hour; steady rides with any jump 2.5 / 1.7 / 0.0 / 5.8% (wandering). Weak intervals left 1.47 spurious an
// hour after recoveries. The model now learns a rising and a recovery speed; from run 2
// the rides use a new seed (20261121), same bar. The learned speeds are reported (the rides use 30 s and 50 s).
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const info = (name, evidence) => out.push(`INFO  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261121), randn = M.makeNormal(rng);   // run 1 used 20261120
const pc = x => `${(100 * x).toFixed(1)}%`;
const t0 = Date.now();
const N = 3600, WARM = 300, BIN = 5;

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
  const levels = [];
  for (let k = 0; k < N / BIN; k++) { let s = 0; for (let j = 0; j < BIN; j++) s += seen[k * BIN + j]; levels.push(s / BIN); }
  return { levels, events };
}
function score(n, make) {
  let anyJump = 0, spurious = 0, ups = 0, upsFound = 0, downs = 0, downsFound = 0;
  const qG = [], tauUp = [], tauDown = [];
  for (let i = 0; i < n; i++) {
    const { levels, events } = make(), f = M.findTargetJumps(levels);
    qG.push(f.params.qG); tauUp.push(f.tauUp); tauDown.push(f.tauDown);
    if (f.jumps.length) anyJump++;
    for (const ev of events) {
      const hit = f.jumps.some(j => j.direction === ev.dir && Math.abs(j.at - ev.bin) <= 3);
      if (ev.dir === 'up') { ups++; upsFound += hit; } else { downs++; downsFound += hit; }
    }
    spurious += f.jumps.filter(j => !events.some(ev => ev.dir === j.direction && Math.abs(j.at - ev.bin) <= 3)).length;
  }
  return { anyJump: anyJump / n, spuriousPerHour: spurious / n, up: ups ? upsFound / ups : null, down: downs ? downsFound / downs : null, qGmed: M.quantile(qG, 0.5), tauUp: M.quantile(tauUp, 0.5), tauDown: M.quantile(tauDown, 0.5) };
}

// Steady riding.
{
  const kinds = [['strap', () => ride('steady', 'strap')], ['watch', () => ride('steady', 'watch')], ['watch + cardiac drift', () => ride('steady', 'watch', { drift: 8 })], ['watch + effort wandering', () => ride('steady', 'watch', { wander: 5 })]];
  let ok = true;
  const lines = kinds.map(([label, make]) => { const s = score(120, make); if (s.anyJump > 0.05) ok = false; return `${label} ${pc(s.anyJump)} (learned target drift ${s.qGmed.toFixed(3)})`; });
  rec(ok, 'Steady riding: rides with any jump at most 5% of each kind', lines.join('; '));
}

// Clear intervals.
{
  let ok = true;
  const lines = [['strap', () => ride('intervals', 'strap')], ['watch', () => ride('intervals', 'watch')]].map(([label, make]) => {
    const s = score(120, make);
    if (s.up < 0.9 || s.down < 0.9 || s.spuriousPerHour > 0.2) ok = false;
    return `${label}: starts ${pc(s.up)}, ends ${pc(s.down)}, spurious ${s.spuriousPerHour.toFixed(2)}/h (learned speeds ${s.tauUp.toFixed(0)} s up, ${s.tauDown.toFixed(0)} s down)`;
  });
  rec(ok, 'Clear intervals: at least 90% of starts (up) and ends (down) found within 15 s; spurious at most 0.2 an hour', lines.join('; '));
}

// Reported.
for (const [label, make] of [['Rolling hills, watch', () => ride('hills', 'watch')], ['Weak intervals (+15 bpm), watch', () => ride('weak', 'watch')]]) {
  const s = score(120, make);
  info(label, `starts ${pc(s.up)}, ends ${pc(s.down)}, spurious ${s.spuriousPerHour.toFixed(2)}/h (learned speeds ${s.tauUp.toFixed(0)} s up, ${s.tauDown.toFixed(0)} s down)`);
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
