// A synced Signal Lab session feeds only the signals it recorded: nothing is filled in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../autonomic-math.js');
const mk = (n, f) => Array.from({ length: n }, (_, t) => f(t));
const BREATH = /resp|breath/i, EEG = /eeg|brain/i;

test('a session with heart rate and pulse variation uses exactly those signals and names what is missing', () => {
  const s = mk(150, (t) => ({ heart_rate_bpm: 62 + 6 * Math.sin(t / 9), pulse_rmssd_ms: 40 + 8 * Math.cos(t / 7), pulse_sdnn_ms: 48 + 5 * Math.sin(t / 11), timestamp: 1000 * t }));
  const a = M.runFullLSAAnalysis('vagal_resonance_recovery', { sessionSamples: s, nullDraws: 6, seeds: 2 });
  assert.equal(a.scenario.fromRealSession, true);
  assert.equal(a.scenario.names.length, 3);
  assert.ok(a.scenario.names.every((n) => !BREATH.test(n) && !EEG.test(n)), 'no breathing or brainwave node is built');
  assert.ok(a.scenario.missingSignals.some((n) => BREATH.test(n)) && a.scenario.missingSignals.some((n) => EEG.test(n)));
  assert.ok(a.scenario.Y.every((row) => row.length === 3 && row.every(Number.isFinite)));
  assert.equal(a.gfevd.NET.length, 3);
});

test('brainwaves join the network only when the session recorded them', () => {
  const s = mk(150, (t) => ({ heart_rate_bpm: 64 + 5 * Math.sin(t / 8), pulse_rmssd_ms: 42, eeg_beta_alpha: 1.1 + 0.1 * Math.cos(t / 5) }));
  const a = M.runFullLSAAnalysis('vagal_resonance_recovery', { sessionSamples: s, nullDraws: 6, seeds: 2 });
  assert.ok(a.scenario.names.some((n) => EEG.test(n)));
  assert.ok(!a.scenario.names.some((n) => BREATH.test(n)));
});

test('a heart-rate-only or short session is declined and the sample is kept, with a reason', () => {
  const hrOnly = mk(150, (t) => ({ heart_rate_bpm: 62 + 6 * Math.sin(t / 9) }));
  const a = M.runFullLSAAnalysis('vagal_resonance_recovery', { sessionSamples: hrOnly, nullDraws: 6, seeds: 2 });
  assert.equal(a.scenario.fromRealSession, false);
  assert.match(a.scenario.sessionRejected.reason, /no second signal/);
  const short = mk(40, (t) => ({ heart_rate_bpm: 60, pulse_rmssd_ms: 40 }));
  assert.equal(M.runFullLSAAnalysis('vagal_resonance_recovery', { sessionSamples: short, nullDraws: 6, seeds: 2 }).scenario.fromRealSession, false);
});

test('the heart and breathing section never takes a session, and says so', () => {
  const s = mk(150, (t) => ({ heart_rate_bpm: 62, pulse_rmssd_ms: 40, pulse_sdnn_ms: 48 }));
  assert.equal(M.runAutonomicBiophysicsMastery('vagal_resonance_recovery', { sessionSamples: s }).sessionIgnored, true);
  assert.equal(M.runAutonomicBiophysicsMastery('vagal_resonance_recovery', {}).sessionIgnored, false);
});
