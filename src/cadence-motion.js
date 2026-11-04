/* Shared cadence motion, preserved from Biofeedback's Ride mode.
   Call step at STEP seconds; rendering can run at any frame rate. Grade-load
   is supplied by the caller, so this module has no sensor or EEG inference.
   A legacy Endless replay may explicitly pass maxSpeed: 7; live rides use 18.
   All functions are pure and leave their arguments unchanged. */
(function (global) {
  'use strict';
  const VERSION = 'biofeedback-cadence@1', MAX_SPEED = 18, STEP = 1 / 120;
  const DEFAULT_MAP = Object.freeze({idle: 25, max: 95, maxZoom: 0.018, gamma: 1.6});
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const cadence = v => Math.max(0, finite(v));
  const seconds = dt => Math.max(0, finite(dt));

  function motion01(rpm, map = DEFAULT_MAP) {
    const idle = finite(map.idle, DEFAULT_MAP.idle), max = finite(map.max, DEFAULT_MAP.max);
    const gamma = Number.isFinite(map.gamma) && map.gamma > 0 ? map.gamma : DEFAULT_MAP.gamma;
    return Math.pow(clamp((cadence(rpm) - idle) / Math.max(1, max - idle), 0, 1), 1 / gamma);
  }
  function gradeFactor(grade) { return clamp(1 - finite(grade) * 5, 0.6, 1.35); }
  function workoutRpm(time) {
    const t = Math.max(0, finite(time)) % 40;
    return t < 12 ? 62 : t < 24 ? 92 : t < 30 ? 108 : 48;
  }
  function target({replayRpm = null, sourceRpm = null, manualEnabled = true,
    steady = null, pedal = false, auto = false, autoT = 0} = {}, dt = STEP) {
    const time = Math.max(0, finite(autoT));
    // Zero from a replay or a live source means stopped, not absent. The
    // supplied source can be a sensor or the app's explicitly labeled demo.
    if (replayRpm != null) return {rpm: cadence(replayRpm), autoT: time};
    if (sourceRpm != null) return {rpm: cadence(sourceRpm), autoT: time};
    if (!manualEnabled) return {rpm: 0, autoT: time};
    if (steady != null) return {rpm: cadence(steady), autoT: time};
    if (pedal) return {rpm: 88, autoT: time};
    if (auto) { const next = time + seconds(dt); return {rpm: workoutRpm(next), autoT: next}; }
    return {rpm: 0, autoT: time};
  }
  function smoothRpm(rpm, targetRpm, dt = STEP) {
    const h = seconds(dt);
    let next = cadence(rpm);
    next += (cadence(targetRpm) - next) * (1 - Math.exp(-h / 0.32));
    // Preserve Biofeedback's finite stop instead of an endless tiny tail.
    if (next < 0.3) next = Math.max(0, next - h * 8);
    return next;
  }
  function step({rpm = 0, targetRpm = 0, dt = STEP, map = DEFAULT_MAP,
    grade = 0, gradeLoad = 0, gradeLoadTarget = 0, idleDrift = 2.2, maxSpeed = MAX_SPEED} = {}) {
    const h = seconds(dt), nextRpm = smoothRpm(rpm, targetRpm, h), motion = motion01(nextRpm, map);
    const nextGrade = finite(grade);
    const load = finite(gradeLoad) + (finite(gradeLoadTarget) - finite(gradeLoad)) * (1 - Math.exp(-h / 2));
    const speed = motion * Math.max(0, finite(maxSpeed, MAX_SPEED)) * gradeFactor(nextGrade + load);
    return {rpm: nextRpm, motion, zoom: motion * Math.max(0, finite(map.maxZoom, DEFAULT_MAP.maxZoom)),
      grade: nextGrade, gradeLoad: load, speed, distanceDelta: speed * h,
      visualDelta: (speed + Math.max(0, finite(idleDrift, 2.2)) * (1 - motion)) * h};
  }
  global.CadenceMotion = Object.freeze({VERSION, MAX_SPEED, STEP, DEFAULT_MAP,
    motion01, gradeFactor, workoutRpm, target, smoothRpm, step});
})(typeof window === 'undefined' ? globalThis : window);
