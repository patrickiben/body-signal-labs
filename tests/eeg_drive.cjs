#!/usr/bin/env node
/* Run the production controller with a deterministic clock, fake same-origin
   HTTP/SSE, and actual bridge-shaped frames. No Bluetooth or network access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../src/eeg-drive.js'), 'utf8');
let checks = 0;
const test = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness(options = {}) {
  let clock = 100000, seq = 0, getHook = null, postHook = null, nextTimer = 0;
  const skew = options.skew || 0, calls = [], streams = [], timers = new Map();
  const config = options.config === undefined ? {base: '/private-test/', session: 'session-test', simulated: false} : options.config;
  const snapshot = () => ({session: config?.session, server_now: clock + skew, simulated: config?.simulated === true,
    devices: {muse: {device: 'muse', phase: 'streaming', deviceName: 'Muse S Athena'}},
    discovery: {devices: [{kind: 'muse', id: 'headband', name: 'Muse S Athena'}, {kind: 'hume', id: 'heart', name: 'Hume'}]}});
  const fetcher = async (url, init) => {
    calls.push({url, init, body: init.body ? JSON.parse(init.body) : null});
    if (url.endsWith('api/state')) {
      const value = getHook ? await getHook() : snapshot();
      return {ok: true, json: async () => value};
    }
    if (postHook) return postHook(init);
    return {ok: true};
  };
  class Events {
    constructor(url) { this.url = url; this.closed = false; streams.push(this); }
    close() { this.closed = true; }
  }
  const context = {console, Date, Math, AbortController,
    setInterval: fn => { const id = ++nextTimer; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
    setTimeout: () => ++nextTimer, clearTimeout() {}};
  context.window = context; vm.createContext(context); vm.runInContext(code, context);
  const drive = context.createEEGDrive({config, now: () => clock, fetch: fetcher, EventSource: Events});
  const emit = (kind, payload = {}, extra = {}) => {
    const event = {kind, payload, session: config?.session, sequence: ++seq, server_sent_at: clock + skew, ...extra};
    streams.at(-1)?.onmessage?.({data: JSON.stringify(event)}); return event;
  };
  const eeg = (ratio = 1, opts = {}) => {
    const stamp = opts.stamp ?? clock + skew, channels = opts.channels || [0, 1], protocol = opts.protocol || 'athena';
    return emit('features', {type: 'features', source: config?.simulated ? 'synthetic' : 'device-reported',
      received_at: clock + skew, eeg_beta_alpha: ratio, heart_rate_bpm: opts.hr ?? 70, pulse_rmssd_ms: 55,
      quality: {eeg_beta_alpha: {valid: true, received_at: stamp, channels,
        source: `muse:${protocol}:eeg:${channels.join(',')}`, source_kind: config?.simulated ? 'synthetic' : 'device-reported',
        sample_rate_hz: 256, window_seconds: 4, contact_verified: false,
        reason: 'Software spectral gates passed; contact/EMG are not verified.', ...opts.quality}}, ...opts.payload}, opts.event);
  };
  const frames = (n, ratio = 1) => { for (let i = 0; i < n; i++) { clock += 1000; eeg(typeof ratio === 'function' ? ratio(i) : ratio); } };
  return {drive, calls, streams, timers, emit, eeg, frames, snapshot,
    get clock() { return clock; }, set clock(value) { clock = value; }, get skew() { return skew; },
    advance(ms) { clock += ms; }, setGet(fn) { getHook = fn; }, setPost(fn) { postHook = fn; },
    maintenance() { [...timers.values()].forEach(fn => fn()); }};
}

(async () => {
  await test('construction and standalone demo make no unsolicited requests', async () => {
    const h = harness({config: null}), identity = h.drive.state;
    assert.equal(h.drive.state.available, false); assert.equal(await h.drive.start(), false);
    assert.equal(h.drive.tick(1, true) > 0, true); assert.equal(h.drive.state.simulated, true);
    assert.match(h.drive.state.message, /synthetic/i); assert.equal(h.drive.state.baseline, null);
    h.drive.tick(1, false); assert.equal(h.drive.state.simulated, false); assert.equal(h.drive.state.score, null);
    assert.equal(h.drive.state, identity); assert.equal(h.calls.length, 0); assert.equal(h.streams.length, 0);
  });
  await test('only private same-origin paths and valid session configuration are accepted', async () => {
    for (const base of ['https://example.com/run/', '//example.com/run/', '/run/../', '/run/?x=1', '/run/#fragment', '/', '/a/b/', '/%2Fhost/']) {
      const h = harness({config: {base, session: 's'}}); assert.equal(await h.drive.start(), false); assert.equal(h.calls.length, 0);
    }
    for (const config of [{base: '/ok/', session: ''}, {base: '/ok/', session: 's', simulated: 'false'}]) {
      const h = harness({config}); assert.equal(h.drive.state.available, false);
    }
  });
  await test('start synchronizes before a single stream and scans Muse using same-origin controls', async () => {
    const h = harness(); assert.equal(h.calls.length, 0); assert.equal(await h.drive.start(), true);
    assert.equal(h.calls[0].url, '/private-test/api/state'); assert.equal(h.calls[1].body.action, 'scan');
    assert.equal(h.streams.length, 1); assert.equal(h.streams[0].url, '/private-test/api/events'); assert.equal(h.timers.size, 1);
    assert.equal(h.drive.state.devices.length, 1); assert.equal(h.drive.state.devices[0].name, 'Muse S Athena');
    for (const call of h.calls) { assert.equal(call.init.credentials, 'same-origin'); assert.equal(call.init.redirect, 'error'); }
    await h.drive.start(); assert.equal(h.streams.length, 1); assert.equal(h.timers.size, 1);
  });
  await test('Mac/browser clock skew is removed without changing the supporting timestamp', async () => {
    const h = harness({skew: 3600000}); await h.drive.start(); h.advance(1000); h.eeg(2);
    assert.equal(h.drive.state.ratio, 2); assert.equal(h.drive.state.quality.received_at, h.clock);
    assert.equal(h.drive.state.quality.origin_received_at, h.clock + h.skew);
  });
  await test('sync uses request start; network delay cannot freshen old EEG', async () => {
    const h = harness({skew: 40000}); const old = h.clock + h.skew;
    h.setGet(() => { const s = h.snapshot(); h.advance(6000); return s; }); await h.drive.start();
    h.eeg(1, {stamp: old, payload: {received_at: old}});
    assert.equal(h.drive.state.progress, 0); assert.equal(h.drive.state.ratio, null); assert.equal(h.drive.state.phase, 'stale');
    h.eeg(1); assert.equal(h.drive.state.progress, 1 / 20);
  });
  await test('20 distinct eligible seconds form a fixed robust log-ratio reference', async () => {
    const h = harness(); await h.drive.start(); h.frames(19);
    assert.equal(h.drive.state.baseline, null); assert.equal(h.drive.state.progress, .95); assert.equal(h.drive.tick(1), 0);
    h.frames(1); const baseline = h.drive.state.baseline;
    assert.equal(baseline.samples, 20); assert.equal(baseline.center, 0); assert.equal(baseline.spread, .15);
    assert.equal(h.drive.state.score, .5); assert.equal(h.drive.state.phase, 'ready');
    const rising = h.drive.tick(.5); assert.ok(rising > 0 && rising < .5);
    h.frames(1, .7); const lower = h.drive.state.score; assert.ok(lower > .85);
    h.frames(1, 1.4); assert.ok(h.drive.state.score < .15 && h.drive.state.score < lower);
    assert.equal(h.drive.state.baseline, baseline, 'ongoing data do not silently move the reference');
  });
  await test('reference uses median/MAD and stays bounded for zero and extreme valid ratios', async () => {
    const h = harness(); await h.drive.start(); h.frames(20, i => i === 19 ? 40 : 1);
    assert.equal(h.drive.state.baseline.center, 0); assert.equal(h.drive.state.baseline.spread, .15);
    h.frames(1, 0); assert.equal(h.drive.state.score, 1);
    h.frames(1, 50); assert.equal(h.drive.state.score, 0); assert.ok(Number.isFinite(h.drive.tick(1)));
  });
  await test('duplicate event IDs, repeated EEG timestamps and rapid frames cannot fill calibration', async () => {
    const h = harness(); await h.drive.start(); const event = h.eeg();
    for (let i = 0; i < 30; i++) h.streams[0].onmessage({data: JSON.stringify(event)});
    for (let i = 0; i < 30; i++) h.eeg(1, {stamp: h.clock});
    assert.equal(h.drive.state.progress, .05);
    for (let i = 0; i < 19; i++) { h.advance(100); h.eeg(); }
    assert.equal(h.drive.state.progress, .1);
    assert.equal(h.drive.state.baseline, null);
  });
  await test('invalid gaps add no calibration credit and keep the actual quality reason', async () => {
    const h = harness(); await h.drive.start(); h.frames(5);
    h.advance(30000); h.eeg(null, {quality: {valid: false, reason: 'Movement/gravity artifact gate failed.', source_kind: undefined}});
    assert.equal(h.drive.state.progress, .25); assert.equal(h.drive.state.score, null);
    assert.match(h.drive.state.message, /Movement\/gravity/); assert.equal(h.drive.state.phase, 'waiting');
    h.frames(1); assert.equal(h.drive.state.progress, .3); assert.equal(h.drive.state.baseline, null);
  });
  await test('fresh envelope cannot rescue stale or future component timestamps', async () => {
    const h = harness(); await h.drive.start();
    for (const delta of [-5001, 101]) {
      h.eeg(1, {stamp: h.clock + delta}); assert.equal(h.drive.state.progress, 0); assert.equal(h.drive.state.phase, 'stale');
    }
    h.eeg(1, {payload: {received_at: h.clock - 5001}}); assert.equal(h.drive.state.progress, 0);
  });
  await test('at least two unique standard EEG channels and matching metadata are required', async () => {
    const h = harness(); await h.drive.start();
    const bad = [{channels: [0]}, {channels: [0, 0]}, {channels: [4, 5]},
      {quality: {source: 'muse:athena:eeg:2,3'}}, {quality: {sample_rate_hz: 128}}, {quality: {window_seconds: 1}}];
    for (const opts of bad) { h.advance(1000); h.eeg(1, opts); assert.equal(h.drive.state.progress, 0); }
    for (const ratio of [-1, 51, null, '1', Infinity]) { h.advance(1000); h.eeg(ratio); assert.equal(h.drive.state.progress, 0); }
    h.advance(1000); h.eeg(1, {channels: [0, 1, 2, 3]}); assert.equal(h.drive.state.progress, .05);
  });
  await test('HR, PPG, cadence and non-Muse status never create propulsion', async () => {
    const h = harness(); await h.drive.start();
    for (let i = 0; i < 25; i++) {
      h.advance(1000); h.emit('features', {type: 'features', received_at: h.clock, source: 'device-reported',
        heart_rate_bpm: 55, pulse_rmssd_ms: 90, rpm: 100, quality: {heart_rate_bpm: {valid: true, received_at: h.clock}}});
      h.emit('status', {device: 'hume', phase: 'streaming', deviceName: 'Hume'});
    }
    assert.equal(h.drive.state.baseline, null); assert.equal(h.drive.tick(5), 0); assert.equal(h.drive.state.deviceName, 'Muse S Athena');
    h.frames(20); h.advance(1000); h.eeg(1, {hr: 210}); assert.equal(h.drive.state.score, .5);
  });
  await test('channel/protocol changes reset the reference even on an equal timestamp', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); const stamp = h.clock;
    h.eeg(1, {stamp, channels: [1, 2]}); assert.equal(h.drive.state.baseline, null); assert.equal(h.drive.state.progress, .05);
    assert.match(h.drive.state.message, /channels or protocol changed/);
    h.frames(20, 1); // Channel set returns to 0,1 and learns its own reference.
    assert.ok(h.drive.state.baseline); h.advance(1000); h.eeg(1, {protocol: 'classic'});
    assert.equal(h.drive.state.baseline, null); assert.equal(h.drive.state.progress, .05);
  });
  await test('changed headset and explicit pair both clear the old reference', async () => {
    const h = harness(); await h.drive.start(); h.frames(20);
    h.emit('status', {device: 'muse', phase: 'streaming', deviceName: 'Different Muse'});
    assert.equal(h.drive.state.baseline, null); assert.equal(h.drive.state.progress, 0);
    h.frames(20); assert.ok(h.drive.state.baseline);
    assert.equal(await h.drive.pair('headband'), true); assert.equal(h.drive.state.baseline, null);
    assert.equal(h.calls.at(-1).body.device, 'muse'); assert.equal(h.calls.at(-1).body.id, 'headband');
    const count = h.calls.length; assert.equal(await h.drive.pair('unknown'), false); assert.equal(h.calls.length, count);
  });
  await test('source-kind mismatch cannot train or replace a live reference', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); const baseline = h.drive.state.baseline;
    h.advance(1000); h.eeg(.1, {quality: {source_kind: 'synthetic'}, payload: {source: 'synthetic'}});
    assert.equal(h.drive.state.baseline, baseline); assert.equal(h.drive.state.ratio, null); assert.equal(h.drive.state.score, null);
    assert.equal(h.drive.state.simulated, false); assert.match(h.drive.state.message, /source labeling/);
    const sim = harness({config: {base: '/test/', session: 's', simulated: true}}); await sim.drive.start(); sim.frames(20);
    assert.equal(sim.drive.state.simulated, true); assert.match(sim.drive.state.message, /Synthetic/);
    assert.match(sim.drive.state.baseline.source, /synthetic/);
  });
  await test('demo EEG is labeled and cannot accumulate a real reference', async () => {
    const h = harness(); await h.drive.start(); h.frames(5); h.drive.tick(1, true);
    h.frames(25); assert.equal(h.drive.state.simulated, true); assert.equal(h.drive.state.baseline, null);
    assert.equal(h.drive.calibrate(), false); assert.match(h.drive.state.quality.reason, /Synthetic/);
    const before = h.drive.tick(1, true); h.drive.tick(1, false);
    assert.equal(h.drive.state.simulated, false); assert.equal(h.drive.state.progress, .25); assert.equal(h.drive.state.score, null);
    assert.ok(h.drive.state.drive < before); h.frames(15); assert.ok(h.drive.state.baseline);
  });
  await test('demo exit restores an existing fresh real reference rather than a synthetic baseline', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); const baseline = h.drive.state.baseline;
    h.drive.tick(1, true); h.frames(1, .8); h.drive.tick(1, false);
    assert.equal(h.drive.state.baseline, baseline); assert.equal(h.drive.state.simulated, false); assert.equal(h.drive.state.ratio, .8);
    assert.ok(h.drive.state.score > .5);
  });
  await test('manual recalibration cannot count the last frame again', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); assert.equal(h.drive.calibrate(), true);
    h.eeg(1); assert.equal(h.drive.state.progress, 0); assert.equal(h.drive.state.baseline, null);
    h.frames(1); assert.equal(h.drive.state.progress, .05);
  });
  await test('duplicate windows do not refresh stale EEG; invalid drive coasts smoothly to zero', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); const stamp = h.clock;
    let before = h.drive.tick(5); assert.ok(before > .4);
    for (let i = 0; i < 6; i++) { h.advance(1000); h.emit('heartbeat'); h.eeg(1, {stamp}); }
    h.drive.tick(1); assert.equal(h.drive.state.phase, 'stale'); assert.equal(h.drive.state.ratio, null);
    assert.ok(h.drive.state.drive < before && h.drive.state.drive > 0);
    for (let i = 0; i < 8; i++) h.drive.tick(5);
    assert.equal(h.drive.state.drive, 0);
  });
  await test('transport errors withhold control until fresh eligible EEG resumes', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); const baseline = h.drive.state.baseline;
    h.streams[0].onerror(); assert.equal(h.drive.state.transport, false); assert.equal(h.drive.state.score, null);
    h.eeg(); assert.equal(h.drive.state.score, null, 'duplicate EEG cannot resume a failed transport');
    h.frames(1); assert.equal(h.drive.state.baseline, baseline); assert.equal(h.drive.state.phase, 'ready');
    h.advance(4501); h.drive.tick(1); assert.equal(h.drive.state.transport, false); assert.equal(h.drive.state.phase, 'stale');
  });
  await test('wrong sessions and out-of-order events cannot update EEG; a restarted bridge clears it', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); const baseline = h.drive.state.baseline;
    h.advance(1000); h.eeg(.1, {event: {session: 'other'}}); assert.equal(h.drive.state.score, .5);
    h.eeg(.1, {event: {sequence: 1}}); assert.equal(h.drive.state.baseline, baseline); assert.equal(h.drive.state.score, .5);
    h.emit('hello', {...h.snapshot(), session: 'new-session'}, {session: 'new-session'});
    assert.equal(h.drive.state.phase, 'error'); assert.equal(h.drive.state.baseline, null); assert.equal(h.drive.state.transport, false);
    assert.equal(h.streams[0].closed, true); assert.equal(h.timers.size, 0);
  });
  await test('initial session or simulation mismatch fails before stream or device control', async () => {
    for (const change of [{session: 'other'}, {simulated: true}]) {
      const h = harness(); h.setGet(() => ({...h.snapshot(), ...change}));
      assert.equal(await h.drive.start(), false); assert.equal(h.drive.state.phase, 'error');
      assert.equal(h.streams.length, 0); assert.equal(h.calls.length, 1);
    }
  });
  await test('disconnect releases stream/timer, sends Muse stop, and ignores old callbacks', async () => {
    const h = harness(); await h.drive.start(); h.frames(20); const callback = h.streams[0].onmessage;
    await h.drive.disconnect(); assert.equal(h.calls.at(-1).body.action, 'disconnect'); assert.equal(h.calls.at(-1).body.device, 'muse');
    assert.equal(h.streams[0].closed, true); assert.equal(h.timers.size, 0); assert.equal(h.drive.state.baseline, null);
    callback({data: JSON.stringify({kind: 'features', session: 'session-test', sequence: 999, server_sent_at: h.clock})});
    assert.equal(h.drive.state.phase, 'disconnected');
    await h.drive.start(); assert.equal(h.streams.length, 2); assert.equal(h.timers.size, 1); assert.equal(h.drive.state.progress, 0);
  });
  await test('late synchronization cannot reopen or mutate a disconnected controller', async () => {
    const h = harness(); await h.drive.start(); const old = h.snapshot(), pending = deferred();
    h.setGet(() => pending.promise); h.advance(31000); h.maintenance();
    const read = h.calls.at(-1); await h.drive.disconnect(); assert.equal(read.init.signal.aborted, true);
    pending.resolve(old); await settle(); assert.equal(h.drive.state.phase, 'disconnected'); assert.equal(h.drive.state.transport, false);
    assert.equal(h.streams.length, 1); assert.equal(h.timers.size, 0);
  });
  await test('failed device stop still closes the cockpit transport and explains the unconfirmed stop', async () => {
    const h = harness(); await h.drive.start(); h.setPost(() => { throw Error('Bridge offline'); });
    assert.equal(await h.drive.disconnect(), false); assert.equal(h.streams[0].closed, true); assert.equal(h.timers.size, 0);
    assert.equal(h.drive.state.phase, 'disconnected'); assert.match(h.drive.state.message, /Could not confirm the Muse stop/);
  });
  await test('late failed scan cannot overwrite a newer pair action', async () => {
    const h = harness(), pending = deferred();
    h.setPost(init => JSON.parse(init.body).action === 'scan' ? pending.promise : {ok: true});
    const opening = h.drive.start(); await settle(); assert.equal(await h.drive.pair('headband'), true);
    pending.reject(Error('Old scan failed')); await opening;
    assert.notEqual(h.drive.state.phase, 'error'); assert.doesNotMatch(h.drive.state.message, /Old scan/);
  });
  await test('Muse S Athena fNIRS optical, PRV, IMU stillness and 4-sensor fusion calibrate and drive automation', async () => {
    const h = harness(); await h.drive.start();
    for (let i = 0; i < 20; i++) {
      h.advance(1000);
      const stamp = h.clock;
      h.eeg(1, {
        payload: {
          optical_od: 2.35, optical_drift: 0.002, pulse_rmssd_ms: 52, pulse_sdnn_ms: 48, heart_rate_bpm: 66, motion: 0.006,
          quality: {
            eeg_beta_alpha: {valid: true, received_at: stamp, channels: [0, 1], source: 'muse:athena:eeg:0,1', source_kind: 'device-reported', sample_rate_hz: 256, window_seconds: 4},
            optical_od: {valid: true, received_at: stamp, channels: [0, 1, 2, 3], source: 'muse:athena:fnirs:0,1,2,3', source_kind: 'device-reported', sample_rate_hz: 64, window_seconds: 20},
            pulse_rmssd_ms: {valid: true, received_at: stamp, source: 'muse:athena:optical-channel-1', source_kind: 'device-reported'},
            motion: {valid: true, received_at: stamp, source: 'muse:accelerometer-vector-rms', source_kind: 'device-reported'},
          },
        },
      });
    }
    assert.equal(h.drive.state.sensors.fnirs.valid, true);
    assert.equal(h.drive.state.sensors.fnirs.score, 0.5);
    assert.equal(h.drive.state.sensors.prv.valid, true);
    assert.equal(h.drive.state.sensors.prv.score, 0.5);
    assert.equal(h.drive.state.sensors.stillness.valid, true);
    assert.ok(h.drive.state.sensors.stillness.score > 0.8);
    assert.equal(h.drive.state.sensors.fusion.valid, true);
    assert.deepEqual([...h.drive.state.sensors.fusion.activeChannels], ['eeg', 'fnirs', 'prv', 'stillness']);
    h.drive.setSensorMode('fnirs');
    assert.equal(h.drive.state.sensorMode, 'fnirs');
    h.drive.tick(2);
    assert.ok(h.drive.activeDrive('fnirs') > 0.25);
    assert.ok(h.drive.activeDrive('fusion') > 0.25);
  });
  console.log(`\n${checks}/${checks} EEG drive checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
