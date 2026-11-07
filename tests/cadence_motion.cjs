#!/usr/bin/env node
/* Numerical parity against the preserved Biofeedback equations, plus source
   precedence and fixed-step trajectories grouped into different render rates.
   No DOM, graphics, network, Bluetooth, or timers are needed. */
const assert = require('node:assert/strict');
const path = require('node:path');
require(path.join(__dirname, '../src/cadence-motion.js'));
const C = globalThis.CadenceMotion;
let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const near = (a, b, label = '', tolerance = 2e-12) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);

// Coasting momentum physics, matching cadence-motion.js.
function originalStep(s, targetRpm, h, map, roadGrade, loadTarget, drift) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const next = {...s};
  if (targetRpm < next.rpm) {
    const tau = next.rpm > 25 ? 0.65 : 0.32;
    next.rpm += (targetRpm - next.rpm) * (1 - Math.exp(-h / tau));
  } else {
    next.rpm += (targetRpm - next.rpm) * (1 - Math.exp(-h / 0.32));
  }
  if (next.rpm < 0.3) next.rpm = Math.max(0, next.rpm - h * 8);
  const m = Math.pow(clamp((next.rpm - map.idle) / Math.max(1, map.max - map.idle), 0, 1), 1 / map.gamma);
  next.zoom = m * map.maxZoom;
  next.grade = roadGrade;
  next.gradeLoad += (loadTarget - next.gradeLoad) * (1 - Math.exp(-h / 2));
  next.speed = m * 18 * clamp(1 - (next.grade + next.gradeLoad) * 5, 0.6, 1.35);
  next.dist += next.speed * h;
  next.vis += (next.speed + drift * (1 - m)) * h;
  return next;
}
function originalTarget(s, source, h) {
  if (s.replayRpm != null) return s.replayRpm;
  if (source.demo || source.live) return source.rpm || 0;
  if (s.mode !== 'ride') return 0;
  if (s.steady != null) return s.steady;
  if (s.pedal) return 88;
  if (s.auto) { s.autoT += h; const t = s.autoT % 40; return t < 12 ? 62 : t < 24 ? 92 : t < 30 ? 108 : 48; }
  return 0;
}
function apply(s, result) {
  return {...s, rpm: result.rpm, zoom: result.zoom, grade: result.grade,
    gradeLoad: result.gradeLoad, speed: result.speed, dist: s.dist + result.distanceDelta, vis: s.vis + result.visualDelta};
}

test('shared identity and defaults preserve the Biofeedback cadence contract', () => {
  assert.equal(C.VERSION, 'biofeedback-cadence@1'); assert.equal(C.MAX_SPEED, 18); assert.equal(C.STEP, 1 / 120);
  assert.deepEqual(C.DEFAULT_MAP, {idle: 25, max: 95, maxZoom: .018, gamma: 1.6});
  assert.ok(Object.isFrozen(C.DEFAULT_MAP)); assert.ok(Object.isFrozen(C));
});
test('cadence curve preserves thresholds, gamma and custom mappings', () => {
  for (const map of [C.DEFAULT_MAP, {idle: 0, max: 130, maxZoom: .004, gamma: .6},
    {idle: 60, max: 60, maxZoom: .04, gamma: 3.2}]) {
    for (let rpm = 0; rpm <= 250; rpm += .25) {
      const expected = Math.pow(Math.max(0, Math.min(1, (rpm - map.idle) / Math.max(1, map.max - map.idle))), 1 / map.gamma);
      near(C.motion01(rpm, map), expected);
    }
  }
  assert.equal(C.motion01(25), 0); assert.equal(C.motion01(95), 1); assert.equal(C.motion01(250), 1);
});
test('grade changes speed by the same bounded multiplier and never changes zoom', () => {
  const flat = C.step({rpm: 95, targetRpm: 95}), up = C.step({rpm: 95, targetRpm: 95, grade: .2}), down = C.step({rpm: 95, targetRpm: 95, grade: -.2});
  near(flat.speed, 18); near(up.speed, 10.8); near(down.speed, 24.3);
  assert.equal(up.zoom, flat.zoom); assert.equal(down.zoom, flat.zoom);
  near(C.gradeFactor(.02), .9); near(C.gradeFactor(-.02), 1.1);
});
test('precedence exactly matches Biofeedback replay, demo/live, mode, steady, pedal and workout', () => {
  for (const replayRpm of [null, 0, 72]) for (const source of [{}, {live: true, rpm: 0}, {live: true, rpm: 91}, {demo: true, rpm: 67}])
    for (const mode of ['watch', 'ride', 'train']) for (const steady of [null, 0, 55]) for (const pedal of [false, true]) for (const auto of [false, true]) {
      const s = {replayRpm, mode, steady, pedal, auto, autoT: 12 - C.STEP / 2};
      const expected = originalTarget(s, source, C.STEP);
      const input = {replayRpm, sourceRpm: source.demo || source.live ? source.rpm || 0 : null,
        manualEnabled: mode === 'ride', steady, pedal, auto, autoT: 12 - C.STEP / 2};
      const result = C.target(Object.freeze(input), C.STEP);
      assert.equal(result.rpm, expected); assert.equal(result.autoT, s.autoT);
    }
});
test('workout segments advance only when workout supplies the cadence', () => {
  for (const [time, rpm] of [[0,62],[11.999,62],[12,92],[24,108],[30,48],[40,62],[80,62]]) assert.equal(C.workoutRpm(time), rpm);
  assert.equal(C.target({pedal: true, auto: true, autoT: 10}, 1).autoT, 10);
  assert.equal(C.target({steady: 50, pedal: true}).rpm, 50);
  assert.equal(C.target({sourceRpm: 0, steady: 80, pedal: true}).rpm, 0);
  assert.equal(C.target({auto: true, autoT: 11}, 1).rpm, 92);
});
test('acceleration follows the original .32 second time constant for every source', () => {
  let rpm = 0;
  for (let i = 0; i < 120; i++) rpm = C.smoothRpm(rpm, 88, C.STEP);
  near(rpm, 88 * (1 - Math.exp(-1 / .32)));
  const manual = C.step({rpm: 20, targetRpm: C.target({pedal: true}).rpm});
  const sensor = C.step({rpm: 20, targetRpm: C.target({sourceRpm: 88}).rpm});
  assert.deepEqual(manual, sensor, 'Bluetooth must not retain Endless’s former .18 second response');
});
test('braking reaches an exact stop and resting drift is excluded from distance', () => {
  let s = {rpm: 95, gradeLoad: 0, dist: 0, vis: 0};
  for (let i = 0; i < 600; i++) s = apply(s, C.step({...s, targetRpm: 0}));
  assert.equal(s.rpm, 0); assert.equal(s.speed, 0); assert.equal(s.zoom, 0);
  const distance = s.dist, position = s.vis;
  for (let i = 0; i < 120; i++) s = apply(s, C.step({...s, targetRpm: 0}));
  assert.equal(s.dist, distance); near(s.vis - position, 2.2);
  const train = C.step({rpm: 0, targetRpm: 0, idleDrift: 1.5});
  assert.equal(train.distanceDelta, 0); near(train.visualDelta, 1.5 / 120);
});
test('grade-load preserves the separate two second response without adding cadence or zoom', () => {
  let s = {rpm: 95, gradeLoad: 0, dist: 0, vis: 0};
  for (let i = 0; i < 240; i++) s = apply(s, C.step({...s, targetRpm: 95, gradeLoadTarget: .045}));
  near(s.gradeLoad, .045 * (1 - Math.exp(-1))); near(s.rpm, 95); near(s.zoom, .018);
  near(s.speed, 18 * (1 - s.gradeLoad * 5));
});
test('long variable-cadence, grade and load trajectory matches the preserved Biofeedback step', () => {
  let old = {rpm: 0, gradeLoad: 0, dist: 0, vis: 40}, current = {...old};
  const map = {idle: 17, max: 108, gamma: 2.1, maxZoom: .023};
  for (let i = 0; i < 120 * 100; i++) {
    const t = i / 120, target = t < 8 ? 88 : t < 14 ? 0 : C.workoutRpm(t), grade = .11 * Math.sin(t * .7), load = t < 38 ? 0 : .045;
    old = originalStep(old, target, C.STEP, map, grade, load, 2.2);
    current = apply(current, C.step({...current, targetRpm: target, map, grade, gradeLoadTarget: load}));
    for (const key of ['rpm','zoom','grade','gradeLoad','speed','dist','vis']) near(current[key], old[key], `${key} at ${t}`);
  }
});
test('fixed physics steps produce identical trajectories across render frame groupings', () => {
  function run(fps, jitter = false) {
    let s = {rpm: 0, gradeLoad: 0, dist: 0, vis: 40}, acc = 0, steps = 0, frame = 0;
    while (steps < 120 * 20) {
      acc += (jitter ? [0.45, 1.6, .7, 1.25][frame++ % 4] : 1) / fps;
      while (acc + 1e-12 >= C.STEP && steps < 2400) {
        const t = steps * C.STEP, target = t < 4 ? 88 : t < 7 ? 0 : t < 12 ? 62 : 108;
        const grade = .09 * Math.sin(s.vis * .013);
        s = apply(s, C.step({...s, targetRpm: target, grade})); steps++; acc -= C.STEP;
      }
    }
    return s;
  }
  const expected = run(120);
  for (const fps of [24,30,60,90,144]) for (const jitter of [false, true]) assert.deepEqual(run(fps, jitter), expected);
});
test('legacy Endless replay can retain seven metre-per-second scaling without affecting live defaults', () => {
  const input = {rpm: 95, targetRpm: 95, grade: .03, dt: C.STEP};
  const live = C.step(input), legacy = C.step({...input, maxSpeed: 7});
  near(legacy.speed, live.speed * 7 / 18); near(legacy.distanceDelta, live.distanceDelta * 7 / 18);
  assert.equal(legacy.rpm, live.rpm); assert.equal(legacy.zoom, live.zoom);
  assert.equal(C.step({rpm: 95, targetRpm: 95}).speed, 18);
});
test('pure calls do not mutate caller state and malformed numeric input cannot generate motion', () => {
  const input = Object.freeze({rpm: 62, targetRpm: 88, gradeLoad: .02, map: Object.freeze({...C.DEFAULT_MAP})});
  C.step(input); assert.equal(input.rpm, 62); assert.equal(input.gradeLoad, .02);
  const result = C.step({rpm: NaN, targetRpm: Infinity, grade: NaN, gradeLoad: Infinity, gradeLoadTarget: NaN});
  assert.equal(result.speed, 0); assert.equal(result.distanceDelta, 0);
  for (const value of Object.values(result)) assert.ok(Number.isFinite(value));
  const stoppedTime = C.step({rpm: 50, targetRpm: 88, dt: -1});
  assert.equal(stoppedTime.rpm, 50); assert.equal(stoppedTime.distanceDelta, 0); assert.equal(stoppedTime.visualDelta, 0);
});
console.log(`\n${checks}/${checks} cadence motion checks passed.`);
