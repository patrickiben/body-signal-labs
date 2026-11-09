// Effort changes from cadence, and heart rate's measured answer (cadenceEffortChanges).
// Run: node tests/autonomic_cadence_effort_qc.cjs [engine path]
//
// Written before the first run (2026-11-09):
//   C1 cadence alone (one hour per ride; per-second noise SD 3 rpm, slow wander OU tau 120 s SD 2 rpm, whole rpm, 2% of
//      seconds dropped, 5-s bin means). Steps of 10-20 rpm about every 5 min, 100 rides: found within 1 bin (5 s) in at
//      least 95%; direction always right; median size within 10%; spurious at most 0.1 an hour. Steady cadence, 100 rides:
//      rides with any change at most 5%.
//   C2 heart rate's answer on noise-free glides (tau 30 s and 50 s rising, 50 s recovering): the change within 1% of the
//      same windows computed by hand, and secondsTo90 within one bin of the hand computation.
//   C3 rides with cadence (the step 3b heart-rate rides, watch; cadence as in C1 and +12 rpm while hard): 2 min at +40 bpm,
//      3 min easy, 120 rides: starts and ends found within 15 s in at least 90%; median heart-rate change within 15% of the
//      noise-free heart rate over the same windows; spurious at most 0.2 an hour. Steady rides with effort wandering (cadence
//      only wanders), 120 rides: rides with any change at most 5%.
//   INFO, the known limit: a climb in a harder gear (effort +25 bpm while cadence drops 5 rpm).
//
// Run 1 (seed 20261122): C2 passed; C1 and C3 failed only on spurious changes (0.22 and 0.66 an hour). A diagnostic
// showed they were real changes in the first or last minute, which the truth list left out: on rides 0.65 of the 0.66
// an hour, with 0.04 an hour having no real change nearby. Scoring corrected: every real change counts when matching a
// detection; detection rates count changes at least 30 s from the ends (the detector needs 30 s on either side). From
// run 2 the records use a new seed (20261123); the bar is unchanged.
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'autonomic', 'autonomic-math.js');
const M = require(process.argv[2] || DEFAULT);
const out = [];
const rec = (ok, name, evidence) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  |  ${evidence}`);
const info = (name, evidence) => out.push(`INFO  ${name}  |  ${evidence}`);
const rng = M.makeRng(20261123), randn = M.makeNormal(rng);   // run 1 used 20261122
const pc = x => `${(100 * x).toFixed(1)}%`;
const t0 = Date.now();
const N = 3600, WARM = 300, BIN = 5;
const ou = (tau, sd) => { const a = Math.exp(-1 / tau), b = sd * Math.sqrt(1 - a * a); let v = sd * randn(); return () => (v = a * v + b * randn()); };

// A cadence sensor: per-second cadence from a level path, wander, noise, whole rpm, dropouts.
function cadenceSensor(level) {
  const wander = ou(120, 2), seen = new Float64Array(level.length);
  let last = level[0];
  for (let t = 0; t < level.length; t++) {
    if (rng() < 0.02) { seen[t] = last; continue; }
    seen[t] = last = Math.max(0, Math.round(level[t] + wander() + 3 * randn()));
  }
  return seen;
}
const binMeans = (x) => { const b = []; for (let k = 0; k < x.length / BIN; k++) { let s = 0; for (let j = 0; j < BIN; j++) s += x[k * BIN + j]; b.push(s / BIN); } return b; };

// C1. Cadence alone.
{
  let found = 0, total = 0, dirOk = true, spurious = 0, anySteady = 0;
  const ratio = [];
  for (let i = 0; i < 100; i++) {
    const level = new Float64Array(N), truth = [];
    let cur = 85, t = 150 + Math.floor(rng() * 150);
    for (let s = 0; s < N; s++) {
      if (s === t) { const step = (cur > 95 ? -1 : cur < 75 ? 1 : (rng() < 0.5 ? -1 : 1)) * (10 + 10 * rng()); cur += step; truth.push({ bin: Math.floor(t / BIN), step, inner: t >= 30 && t < N - 30 }); t += 240 + Math.floor(rng() * 120); }
      level[s] = cur;
    }
    const rows = binMeans(cadenceSensor(level)).map(c => ({ cad: c, hr: 135 }));
    const r = M.cadenceEffortChanges(rows);
    total += truth.filter(tr => tr.inner).length;
    for (const tr of truth.filter(tr0 => tr0.inner)) {
      const c = r.changes.find(v => Math.abs(v.at - tr.bin) <= 1);
      if (c) { found++; if ((c.cadenceChange > 0) !== (tr.step > 0)) dirOk = false; ratio.push(c.cadenceChange / tr.step); }
    }
    spurious += r.changes.filter(v => !truth.some(tr => Math.abs(v.at - tr.bin) <= 1)).length;
  }
  for (let i = 0; i < 100; i++) {
    const rows = binMeans(cadenceSensor(new Float64Array(N).fill(85))).map(c => ({ cad: c, hr: 135 }));
    if (M.cadenceEffortChanges(rows).changes.length) anySteady++;
  }
  const mr = M.quantile(ratio, 0.5);
  rec(found / total >= 0.95 && dirOk && Math.abs(mr - 1) <= 0.1 && spurious / 100 <= 0.1 && anySteady / 100 <= 0.05,
    'Cadence steps of 10-20 rpm found within 5 s, direction right, sizes right, few spurious; steady cadence stays quiet',
    `found ${pc(found / total)} of ${total}; direction ${dirOk ? 'always right' : 'WRONG at least once'}; median size ${(100 * mr).toFixed(0)}%; spurious ${(spurious / 100).toFixed(2)}/h; steady rides with any change ${pc(anySteady / 100)}`);
}

// C2. Heart rate's answer on noise-free glides, against the same windows computed by hand.
{
  let worstChange = 0, worstT = 0;
  for (const [label, tau, from, to] of [['rise 30 s', 30, 135, 175], ['rise 50 s', 50, 135, 175], ['recovery 50 s', 50, 175, 135]]) {
    const rho = Math.exp(-BIN / tau), rows = [], H = [];
    let h = from;
    for (let k = 0; k < 200; k++) { if (k > 0) h = rho * h + (1 - rho) * (k >= 100 ? to : from); H.push(h); rows.push({ hr: h, cad: k >= 100 ? (to > from ? 97 : 85) : (to > from ? 85 : 97) }); }
    const c = M.cadenceEffortChanges(rows).changes.find(v => v.at === 100);
    const mean = (a, b) => { let s = 0; for (let j = a; j < b; j++) s += H[j]; return s / (b - a); };
    const change = mean(112, 124) - mean(94, 100);
    let t90 = null;
    for (let j = 100; j < 124; j++) { const run = (H[j - 1] + H[j] + H[j + 1]) / 3; if ((run - mean(94, 100)) / change >= 0.9) { t90 = (j - 100) * BIN; break; } }
    if (!c) { worstChange = Infinity; continue; }
    worstChange = Math.max(worstChange, Math.abs(c.heartRateChange / change - 1));
    worstT = Math.max(worstT, Math.abs((c.secondsTo90 ?? 1e9) - t90));
    out.push(`INFO  ${label}  |  change ${c.heartRateChange.toFixed(2)} bpm (hand ${change.toFixed(2)}), 90% after ${c.secondsTo90} s (hand ${t90} s)`);
  }
  rec(worstChange <= 0.01 && worstT <= BIN, "Heart rate's answer on noise-free glides: change within 1% and time to 90% within one bin of the hand computation",
    `largest change gap ${(100 * worstChange).toFixed(2)}%, largest time gap ${worstT} s`);
}

// C3. Rides with cadence.
function ride(kind) {
  const L = N + WARM, target = new Float64Array(L), cadLevel = new Float64Array(L).fill(85), events = [];
  const off = Math.floor(rng() * 300);
  const mark = (t, dir) => { const d = t - WARM; if (d >= 0 && d < N) events.push({ bin: Math.floor(d / BIN), dir, inner: d >= 30 && d < N - 30 }); };
  if (kind === 'intervals') for (let t = 0; t < L; t++) { const ph = (t + off) % 300; const hard = ph < 120; target[t] = hard ? 40 : 0; cadLevel[t] = hard ? 97 : 85; if (ph === 0) mark(t, 'up'); if (ph === 120) mark(t, 'down'); }
  if (kind === 'gear') for (let t = 0; t < L; t++) { const ph = (t + off) % 300; const hill = ph < 120; target[t] = hill ? 25 : 0; cadLevel[t] = hill ? 80 : 85; if (ph === 0) mark(t, 'up'); if (ph === 120) mark(t, 'down'); }
  const wand = kind === 'steady' ? ou(120, 5) : () => 0, slow = ou(30, 1.5), beat = ou(2, 0.8);
  const rr = Math.exp(-Math.PI * 0.02), w0 = 2 * Math.PI * 0.1, a1 = 2 * rr * Math.cos(w0), a2 = -rr * rr;
  const unitVar = (1 - a2) / ((1 + a2) * ((1 - a2) ** 2 - a1 * a1)), eSd = (1 / Math.SQRT2) / Math.sqrt(unitVar);
  let m1 = 0, m2 = 0;
  for (let i = 0; i < 500; i++) { const m = a1 * m1 + a2 * m2 + eSd * randn(); m2 = m1; m1 = m; }
  const fb = 0.35 + 0.1 * rng();
  let phase = rng() * 2 * Math.PI, H = 135 + target[0];
  const hr = new Float64Array(L), clean = new Float64Array(L);
  for (let t = 0; t < L; t++) {
    const goal = 135 + target[t] + wand();
    H += (goal - H) * (1 - Math.exp(-1 / (goal > H ? 30 : 50)));
    const m = a1 * m1 + a2 * m2 + eSd * randn(); m2 = m1; m1 = m;
    phase += 2 * Math.PI * fb + 0.05 * randn();
    clean[t] = H;
    hr[t] = H + slow() + beat() + m + 0.5 * Math.sin(phase);
  }
  const seen = new Float64Array(N);
  let last = hr[WARM];
  for (let t = 0; t < N; t++) { const s = t + WARM; if (rng() < 0.02) { seen[t] = last; continue; } let sum = 0; for (let j = 0; j < 5; j++) sum += hr[s - j]; seen[t] = last = Math.round(sum / 5); }
  const cad = cadenceSensor(cadLevel.slice(WARM)), hrBins = binMeans(seen), cadBins = binMeans(cad), cleanBins = binMeans(clean.slice(WARM));
  return { rows: hrBins.map((h, k) => ({ hr: h, cad: cadBins[k] })), cleanRows: cleanBins.map((h, k) => ({ hr: h, cad: cadBins[k] })), events };
}
{
  let ups = 0, upsFound = 0, downs = 0, downsFound = 0, spurious = 0;
  const ratio = [];
  for (let i = 0; i < 120; i++) {
    const { rows, cleanRows, events } = ride('intervals'), r = M.cadenceEffortChanges(rows), rc = M.cadenceEffortChanges(cleanRows);
    for (const ev of events.filter(e => e.inner)) {
      const c = r.changes.find(v => v.direction === ev.dir && Math.abs(v.at - ev.bin) <= 3);
      if (ev.dir === 'up') { ups++; upsFound += !!c; } else { downs++; downsFound += !!c; }
      const cc = c && rc.changes.find(v => v.at === c.at);
      if (c && cc && Math.abs(cc.heartRateChange) > 1) ratio.push(c.heartRateChange / cc.heartRateChange);
    }
    spurious += r.changes.filter(v => !events.some(ev => ev.dir === v.direction && Math.abs(v.at - ev.bin) <= 3)).length;
  }
  let anySteady = 0;
  for (let i = 0; i < 120; i++) if (M.cadenceEffortChanges(ride('steady').rows).changes.length) anySteady++;
  const mr = ratio.length ? M.quantile(ratio, 0.5) : NaN;
  rec(upsFound / ups >= 0.9 && downsFound / downs >= 0.9 && Math.abs(mr - 1) <= 0.15 && spurious / 120 <= 0.2 && anySteady / 120 <= 0.05,
    'Rides with cadence: interval starts and ends found within 15 s, heart-rate change right, few spurious; steady rides quiet',
    `starts ${pc(upsFound / ups)}, ends ${pc(downsFound / downs)}; median heart-rate change ${(100 * mr).toFixed(0)}% of noise-free (${ratio.length} changes); spurious ${(spurious / 120).toFixed(2)}/h; steady rides with any change ${pc(anySteady / 120)}`);
}

// INFO: the known limit.
{
  let up = 0, down = 0, none = 0;
  for (let i = 0; i < 60; i++) {
    const { rows, events } = ride('gear'), r = M.cadenceEffortChanges(rows);
    for (const ev of events.filter(e => e.dir === 'up' && e.inner)) {
      const c = r.changes.find(v => Math.abs(v.at - ev.bin) <= 3);
      if (!c) none++; else if (c.direction === 'up') up++; else down++;
    }
  }
  const n = up + down + none;
  info('Known limit: climbs in a harder gear (effort +25 bpm, cadence -5 rpm)', `cadence sees nothing at ${pc(none / n)} of climb starts, a wrong-way change at ${pc(down / n)}, an upward change at ${pc(up / n)}`);
}

console.log(out.join('\n'));
const fails = out.filter(l => l.startsWith('FAIL')).length, passes = out.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passes} pass, ${fails} fail (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
