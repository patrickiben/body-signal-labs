#!/usr/bin/env node
/* Source-level regressions for real sensor parsing, imported sessions and UI
   session handlers. Fake Bluetooth and MediaRecorder expose event ordering;
   the production functions run unchanged. No GPU, network or real devices. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
let clock = 1000, checks = 0, deviceMode = 'heart';
const listeners = {};
const device = { name: 'Regression sensor', addEventListener() {}, gatt: {
  connected: true,
  async connect() { return { async getPrimaryService(name) {
    if (deviceMode === 'ftms' && name === 'cycling_speed_and_cadence') throw Error('No CSC service');
    return { async getCharacteristic(id) { return { addEventListener(ev, fn) { listeners[id] = fn; }, async startNotifications() {} }; } };
  } }; },
  disconnect() { this.connected = false; },
} };
const context = { console, performance: { now: () => clock }, Date, Math, DataView, ArrayBuffer, Uint8Array, Float32Array, Float64Array,
  setInterval: () => 1, clearInterval() {}, navigator: { userAgent: 'Node regression', bluetooth: { async requestDevice() { return device; } } }, isSecureContext: true };
context.window = context; vm.createContext(context);
for (const file of ['src/vendor/autonomic/research-math.js', 'src/vendor/autonomic/multivariate-engine.js', 'src/cadence-motion.js', 'src/bio.js', 'src/ride.js']) vm.runInContext(read(file), context);
const test = (name, fn) => { fn(); console.log(`PASS ${name}`); checks++; };
const packet = (id, bytes) => listeners[id]({ target: { value: new DataView(Uint8Array.from(bytes).buffer) } });
const bioSession = (lanes = {}) => ({ schema: 'body-signal-labs/biofeedback-session@1', durationMs: 1000, synthetic: false, lanes });
const rideSession = (lanes = {}) => ({ schema: 'body-signal-labs/ride-session@1', durationMs: 1000, synthetic: false, lanes });
const SHARED_SCENES = 'cycling-scenes@1', LEGACY_SCENES = 'biofeedback-pathscene@1';
const initialRoute = (biome) => ({ vis: 700, seed: 3, biome, mode: 'ride', dist: 0, rpm: 75,
  map: { idle: 25, max: 95, maxZoom: .018, gamma: 1.6 } });
const page = read('src/biofeedback.js');
const section = (from, to) => page.slice(page.indexOf(from), page.indexOf(to, page.indexOf(from)));

(async () => {
  const heart = context.createBio(); await heart.connectHeart('standard');
  packet('heart_rate_measurement', [6, 72]); heart.tick(clock);
  clock += 100; packet('heart_rate_measurement', [4, 0]); clock += 600; heart.tick(clock);
  test('contact loss immediately clears live heart rate and derived values', () => {
    assert.equal(heart.hr.state, 'no-signal'); assert.equal(heart.hr.noContact, true);
    assert.equal(heart.hr.deviceBpm, null); assert.equal(heart.now.hr, null); assert.equal(heart.now.rmssd, null);
  });
  packet('heart_rate_measurement', [6, 73]); clock += 600; heart.tick(clock);
  test('valid heart contact resumes the sensor', () => { assert.equal(heart.hr.state, 'live'); assert.equal(heart.now.hr, 73); });

  deviceMode = 'ftms'; const cadence = context.createBio(); await cadence.connectCadence();
  packet('indoor_bike_data', [0, 0, 0, 0]);
  test('speed-only FTMS packet cannot claim live cadence', () => assert.equal(cadence.cadence.state, 'no-signal'));
  packet('indoor_bike_data', [4, 0, 0, 0, 160, 0]); const validAt = cadence.cadence.lastAt;
  for (let i = 0; i < 12; i++) { clock += 1000; packet('indoor_bike_data', [0, 0, 0, 0]); cadence.tick(clock); }
  test('other FTMS fields cannot keep stale cadence alive', () => {
    assert.equal(cadence.cadence.lastAt, validAt); assert.equal(cadence.cadence.state, 'no-signal'); assert.equal(cadence.cadence.rpm, null);
  });
  packet('indoor_bike_data', [4, 0, 0, 0, 0, 0]);
  test('explicit zero cadence is a fresh stopped measurement', () => { assert.equal(cadence.cadence.state, 'live'); assert.equal(cadence.cadence.rpm, 0); });

  const recorded = context.createBio(); recorded.startRecording('biofeedback-path-cockpit'); recorded.startDemo(); recorded.tick(clock); recorded.noteLane('hr', recorded.now.hr);
  const mixed = recorded.stopRecording();
  test('starting demo during recording marks its synthetic contents', () => { assert.equal(mixed.synthetic, true); assert.equal(mixed.lanes.hr[0][1], 66); });
  recorded.stopDemo(); recorded.startReplay({ ...bioSession({ hr: [[0, 66]] }), synthetic: true }); recorded.startRecording('biofeedback-path-cockpit'); recorded.noteLane('hr', 66);
  test('recording a synthetic replay preserves source provenance', () => assert.equal(recorded.stopRecording().synthetic, true)); recorded.stopReplay();

  const reader = context.createBio(); reader.startDemo();
  const invalid = [
    { schema: bioSession().schema }, { ...bioSession(), durationMs: NaN }, { ...bioSession(), durationMs: -1 },
    { ...bioSession(), lanes: [] }, bioSession({ hr: 'bad' }), bioSession({ hr: [[0, Infinity]] }),
    bioSession({ rpm: [[-1, 60]] }), bioSession({ rpm: [[1001, 60]] }), bioSession({ rpm: [[500, 60], [100, 70]] }),
    bioSession({ biome: [[0, 5]] }), bioSession({ mode: [[0, 'missing']] }), bioSession({ rpm: [[0, '90']] }),
    { ...bioSession(), start: { vis: 200 } }, { ...bioSession(), synthetic: 'false' },
  ];
  test('malformed Biofeedback files fail before stopping the demo', () => {
    for (const raw of invalid) { assert.throws(() => reader.startReplay(raw), /Invalid session/); assert.equal(reader.demoOn, true); assert.equal(reader.replayOn, false); }
  });
  const valid = bioSession({ hr: [[0, null], [1000, 80]], idx: [[0, null]], rpm: [[0, 0]], biome: [[0, 4]], mode: [[0, 'train']] });
  test('nullable readings and existing five Biofeedback scene IDs remain valid', () => {
    const normalized = reader.readSession(valid);
    assert.equal(normalized.lanes, valid.lanes); assert.equal(normalized.sceneCatalog, LEGACY_SCENES);
  });
  test('old Misty and Neon IDs keep their legacy catalog without mutating the file', () => {
    const legacy = { ...bioSession({ biome: [[0, 1], [500, 2]] }), start: initialRoute(1) };
    const before = JSON.stringify(legacy), normalized = reader.readSession(legacy);
    assert.equal(normalized.sceneCatalog, LEGACY_SCENES); assert.equal(normalized.start.biome, 1);
    assert.deepEqual(normalized.lanes.biome, [[0, 1], [500, 2]]);
    assert.equal(JSON.stringify(legacy), before); assert.equal(reader.readSession(normalized), normalized);
  });
  test('tagged Biofeedback accepts all eight shared scenes including Misty6 and Snake7', () => {
    for (let biome = 0; biome < 8; biome++) {
      const s = { ...bioSession({ biome: [[0, biome]] }), sceneCatalog: SHARED_SCENES, start: initialRoute(biome) };
      assert.equal(reader.readSession(s), s);
    }
  });
  test('unknown catalogs and out-of-catalog Biofeedback IDs fail before state changes', () => {
    for (const s of [
      { ...bioSession(), sceneCatalog: 'cycling-scenes@2' },
      { ...bioSession(), sceneCatalog: {} },
      { ...bioSession({ biome: [[0, 5]] }), sceneCatalog: LEGACY_SCENES },
      { ...bioSession({ biome: [[0, 8]] }), sceneCatalog: SHARED_SCENES },
      { ...bioSession(), sceneCatalog: SHARED_SCENES, start: initialRoute(8) },
    ]) {
      assert.throws(() => reader.startReplay(s), /Invalid session/);
      assert.equal(reader.demoOn, true); assert.equal(reader.replayOn, false);
    }
  });
  test('older synthetic timeline files still convert', () => {
    const converted = reader.readSession({ timeline: { rpm: [60, 70], dt: .1 }, autoTimeline: { HR: [65], dt: 1 }, mode: 'ride' });
    assert.equal(converted.synthetic, true); assert.equal(converted.lanes.rpm[1][0], 100);
    assert.equal(converted.sceneCatalog, LEGACY_SCENES); assert.equal(reader.readSession(converted), converted);
  });
  test('old timeline Misty and Neon prompts remain legacy IDs', () => {
    for (const biome of [1, 2]) {
      const converted = reader.readSession({ timeline: { rpm: [60], dt: .1 }, meta: { promptIdx: biome } });
      assert.equal(converted.sceneCatalog, LEGACY_SCENES); assert.equal(converted.lanes.biome[0][1], biome);
    }
  });
  test('bad legacy sampling intervals are rejected', () => assert.throws(() => reader.readSession({ timeline: { rpm: [60], dt: -1 } }), /sample interval/));

  test('new Biofeedback recording exports shared catalog and Snake Way roundtrips', () => {
    const b = context.createBio(); b.startRecording('biofeedback-path-cockpit', initialRoute(7));
    b.noteLane('biome', 7); clock += 10;
    const saved = b.stopRecording();
    assert.equal(saved.sceneCatalog, SHARED_SCENES); assert.equal(b.readSession(saved), saved);
  });
  test('recording a legacy replay explicitly preserves old scene identity', () => {
    const b = context.createBio(), legacy = b.readSession({ ...bioSession({ biome: [[0, 1], [500, 2]] }), start: initialRoute(1) });
    b.startReplay(legacy); b.startRecording('biofeedback-path-cockpit', legacy.start, legacy.sceneCatalog);
    b.noteLane('biome', 1); clock += 10; b.noteLane('biome', 2);
    const saved = b.stopRecording(), normalized = b.readSession(saved);
    assert.equal(saved.sceneCatalog, LEGACY_SCENES); assert.equal(normalized.start.biome, 1);
    assert.equal(normalized.lanes.biome[1][1], 2); assert.equal(b.readSession(normalized), normalized);
    b.stopReplay();
  });
  test('invalid recording catalog cannot replace an active recording', () => {
    const b = context.createBio(); b.startRecording('keep-this-take', initialRoute(6));
    assert.throws(() => b.startRecording('bad', initialRoute(1), 'unknown'), /scene catalog/);
    assert.equal(b.recording, true); assert.equal(b.stopRecording().app, 'keep-this-take');
  });
  test('an omitted optional replay baseline stays null in a rerecording before JSON export', () => {
    const b = context.createBio(), legacy = b.readSession({ ...bioSession(), start: initialRoute(1) });
    b.startReplay(legacy); assert.equal(b.now.baseHr, null);
    b.startRecording('baseline-free-replay', legacy.start, legacy.sceneCatalog);
    b.noteLane('baseHr', b.now.baseHr);
    const saved = b.stopRecording();
    assert.equal(saved.lanes.baseHr[0][1], null); assert.equal(b.readSession(saved), saved);
    b.stopReplay();
  });

  const ride = context.createRide(); ride.startReplay(rideSession({ biome: [[0, 5]], rpm: [[0, 80]] }));
  test('ride import validates each lane before replacing an existing replay', () => {
    for (const raw of [rideSession({ rpm: null }), rideSession({ biome: [[0, 6]] }), rideSession({ tod: [[0, 4]] }), rideSession({ rpm: [[0, NaN]] }), rideSession({ routeStart: [[0, { biome: 5, map: { idle: 25 } }]] })]) {
      assert.throws(() => ride.startReplay(raw), /Invalid ride/); assert.equal(ride.replayOn, true);
    }
  });
  test('sixth ride scene and old session schema stay compatible', () => {
    assert.equal(ride.readSession(rideSession({ biome: [[0, 5]] })).lanes.biome[0][1], 5);
    assert.equal(ride.readSession({ ...rideSession(), schema: 'endless-cockpit/session@1' }).durationMs, 1000);
  });
  test('untagged Endless scenes retain their six numeric IDs and normalize once', () => {
    for (let biome = 0; biome < 6; biome++) {
      const raw = rideSession({ biome: [[0, biome]], routeStart: [[0, { biome }]] }), normalized = ride.readSession(raw);
      assert.equal(normalized.sceneCatalog, SHARED_SCENES); assert.equal(normalized.lanes.biome[0][1], biome);
      assert.equal(normalized.lanes.routeStart[0][1].biome, biome); assert.equal(raw.sceneCatalog, undefined);
      assert.equal(ride.readSession(normalized), normalized);
    }
  });
  test('shared Endless Misty and Snake routes accept only the declared motion version', () => {
    for (const biome of [6, 7]) {
      const s = { ...rideSession({ biome: [[0, biome]], routeStart: [[0, { biome, motionVersion: 'biofeedback-cadence@1' }]] }), sceneCatalog: SHARED_SCENES };
      assert.equal(ride.readSession(s), s);
    }
    for (const s of [
      rideSession({ biome: [[0, 6]] }),
      { ...rideSession(), sceneCatalog: LEGACY_SCENES },
      { ...rideSession({ biome: [[0, 8]] }), sceneCatalog: SHARED_SCENES },
      { ...rideSession({ routeStart: [[0, { biome: 8 }]] }), sceneCatalog: SHARED_SCENES },
      rideSession({ routeStart: [[0, { motionVersion: 'future' }]] }),
      rideSession({ routeStart: [[0, { motionVersion: null }]] }),
    ]) assert.throws(() => ride.readSession(s), /Invalid ride/);
  });
  test('new Endless recordings export an explicit shared scene catalog', () => {
    ride.startRecording('endless-cockpit', false); ride.noteLane('biome', 7);
    ride.noteLane('routeStart', { biome: 7, motionVersion: 'biofeedback-cadence@1' }); clock += 10;
    const saved = ride.stopRecording(); assert.equal(saved.sceneCatalog, SHARED_SCENES); assert.equal(ride.readSession(saved), saved);
  });

  // Run the production session click handler with asynchronous stop callbacks.
  const elements = {}, get = (id) => elements[id] ||= { checked: id === 'rec-video', textContent: '', value: 0, classList: { add() {}, remove() {}, toggle() {} }, addEventListener(ev, fn) { this[ev] = fn; }, dispatchEvent() {} };
  const instances = [], streams = [], downloads = [], stopped = [], toasts = [];
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(stream, opts) { this.mimeType = opts.mimeType; this.stream = stream; this.state = 'inactive'; instances.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; stopped.push(() => this.onstop()); }
  }
  const uiBio = context.createBio(); uiBio.now.baseHr = 62;
  const S = { mode: 'ride', drivePower: 'cadence', sceneCatalog: SHARED_SCENES, vis: 700, seed: 3, biome: 2, biomeNext: 2, dist: 1609, rpm: 75, gradeLoad: .02, map: { idle: 25, max: 95, maxZoom: .018, gamma: 1.6 }, holdT: 8, dawn: .2 };
  const ui = { console, Blob, Event: class {}, $: get, S, bio: uiBio, document: { querySelectorAll: () => [], body: { style: { setProperty() {} } } },
    cv: { captureStream() { const track = { count: 0, stop() { this.count++; } }; const stream = { track, getTracks: () => [track] }; streams.push(stream); return stream; } },
    MediaRecorder: Recorder, window: { MediaRecorder: Recorder }, shell: { download(blob) { downloads.push(blob); }, toast(message) { toasts.push(message); }, syncRange() {}, setMode(m) { S.mode = m; S.holdT = 0; S.dawn = 0; } },
    BIOMES: ['Golden coast', 'Tropical', 'Meadow lanes', 'Autumn Lake', 'Red canyon', 'Rainbow orbit', 'Misty ridges', 'Snake Way'].map(name => ({ edge: '#fff', name })), SET_SECONDS: 60, M_PER_MI: 1609.34,
    PathScene: { BIOMES: ['Golden coast', 'Misty pines', 'Neon forest', 'High alpine', 'Red canyon'].map(name => ({ edge: '#fff', name })) }, SCENE_CATALOG: SHARED_SCENES,
    mmss: String, performance: { now: () => clock }, renderAnalysis() {}, stopGhost() {}, motion01: (rpm) => rpm / 100, MAX_SPEED: 18 };
  vm.createContext(ui);
  vm.runInContext(section('  const legacyScene =', '  const pathX ='), ui);
  vm.runInContext(section('  function selectedSceneIndex()', "  $('biome-row').innerHTML"), ui);
  vm.runInContext(section('  function sessionStart()', "  bio.on('lane'"), ui);
  vm.runInContext(section('  let recorder = null, lastRide', '  function renderAnalysis(s)'), ui);
  get('rec-toggle').click(); instances[0].ondataavailable({ data: new Blob(['first']) }); S.dist = 1709; get('rec-toggle').click();
  get('rec-toggle').click(); instances[1].ondataavailable({ data: new Blob(['second']) }); stopped.shift()(); get('rec-toggle').click(); stopped.shift()();
  const payloads = await Promise.all(downloads.map((b) => b.text()));
  test('overlapping asynchronous video stops preserve independent chunks', () => {
    assert(payloads.includes('first')); assert(payloads.includes('second')); assert.equal(payloads.filter((v) => v === 'firstsecond').length, 0);
    assert.deepEqual(streams.map((s) => s.track.count), [1, 1]);
  });
  const firstSaved = payloads.filter((p) => p.startsWith('{')).map(JSON.parse)[0];
  test('new recordings save route start and session-relative distance', () => {
    assert.equal(firstSaved.start.vis, 700); assert.equal(firstSaved.start.dist, 1609); assert.equal(firstSaved.distanceRelative, true);
    assert.equal(firstSaved.lanes.dist.at(-1)[1], 100); assert.equal(firstSaved.lanes.dist[0][1], 0);
  });
  vm.runInContext(section('  function ghostFrom(s)', '  function ghostDistance(now)'), ui);
  test('older cumulative ghost distances start at zero', () => {
    const g = ui.ghostFrom({ ...bioSession({ dist: [[0, 1609], [1000, 1709]], seed: [[0, 3]] }) });
    assert.equal(g.dist[0][1], 0); assert.equal(g.total, 100);
  });
  test('new relative ghost distances are not rebased twice', () => { const g = ui.ghostFrom(firstSaved); assert.equal(g.total, 100); assert.equal(g.seed, 3); });
  S.vis = 9000; S.seed = 19; S.map.idle = 50; S.biomeNext = 4; S.rpm = 0;
  ui.startReplay(firstSaved);
  test('replay restores route position, mapping, starting cadence and baseline', () => {
    assert.equal(S.vis, 700); assert.equal(S.seed, 3); assert.equal(S.map.idle, 25); assert.equal(S.biomeNext, 2); assert.equal(S.biomeT, 1);
    assert.equal(S.dist, 0); assert.equal(S.rpm, 75); assert.equal(S.gradeLoad, .02); assert.equal(S.holdT, 8); assert.equal(uiBio.now.baseHr, 62);
  });
  test('UI rejects invalid replay before resetting the current ride', () => { S.vis = 456; assert.throws(() => ui.startReplay(bioSession({ biome: [[0, 500]] })), /Invalid session/); assert.equal(S.vis, 456); });
  test('legacy UI restoration chooses original Misty before resolving its numeric ID', () => {
    ui.startReplay({ ...bioSession({ biome: [[0, 1]] }), start: initialRoute(1) });
    assert.equal(S.sceneCatalog, LEGACY_SCENES); assert.equal(S.biomeNext, 1);
    assert.equal(vm.runInContext('currentBiome().name', ui), 'Misty pines');
  });
  test('legacy recording prevents catalog mixing and a later new choice exits legacy replay', () => {
    uiBio.startRecording('legacy-take', ui.sessionStart(), S.sceneCatalog);
    ui.chooseBiome(7);
    assert.equal(S.sceneCatalog, LEGACY_SCENES); assert.equal(S.biomeNext, 1); assert.equal(uiBio.recording, true);
    assert(toasts.at(-1).includes('Stop this legacy recording'));
    assert.equal(uiBio.readSession(uiBio.stopRecording()).sceneCatalog, LEGACY_SCENES);
    ui.chooseBiome(7);
    assert.equal(S.sceneCatalog, SHARED_SCENES); assert.equal(S.biomeNext, 7); assert.equal(uiBio.replayOn, false);
  });
  for (const [current, incoming, from, to] of [[LEGACY_SCENES, SHARED_SCENES, 1, 7], [SHARED_SCENES, LEGACY_SCENES, 7, 2]]) {
    test(`recording ${current} rejects replay, ghost and restore from ${incoming} before mutation`, () => {
      const currentFile = { ...bioSession({ biome: [[0, from]], rpm: [[0, 75]], dist: [[0, 0], [1000, 20]] }), sceneCatalog: current, start: initialRoute(from) };
      const incomingFile = { ...bioSession({ biome: [[0, to]], rpm: [[0, 75]], dist: [[0, 0], [1000, 20]] }), sceneCatalog: incoming, start: initialRoute(to) };
      ui.startReplay(currentFile); S.vis = 1234; const ghost = S.ghost = { marker: 'keep-current-ghost' };
      uiBio.startRecording('protected-take', ui.sessionStart(), S.sceneCatalog);
      for (const action of [() => ui.startReplay(incomingFile), () => ui.startGhost(incomingFile), () => ui.restoreStart(incomingFile, true)]) {
        assert.throws(action, /Stop recording before loading/);
        assert.equal(S.sceneCatalog, current); assert.equal(S.biomeNext, from); assert.equal(S.vis, 1234);
        assert.equal(S.ghost, ghost); assert.equal(uiBio.replayOn, true); assert.equal(uiBio.recording, true);
      }
      assert.equal(uiBio.readSession(uiBio.stopRecording()).sceneCatalog, current);
      uiBio.stopReplay();
    });
  }
  const equal = { ...firstSaved, start: { ...firstSaved.start, map: { ...firstSaved.start.map, idle: 60, max: 60 } } };
  test('attainable equal cadence bounds remain valid and finite', () => {
    assert.equal(reader.readSession(equal), equal);
    assert.equal(ride.readSession(rideSession({ routeStart: [[0, { map: equal.start.map }]] })).lanes.routeStart[0][1].map.idle, 60);
    const motion = section('  const motion01 = (rpm) =>', '\n\n  const bio = createBio();');
    const mc = { S: { map: equal.start.map }, CadenceMotion: context.CadenceMotion, Math, clamp: (v,a,b) => Math.min(b,Math.max(a,v)) }; vm.createContext(mc); vm.runInContext(motion,mc);
    for (const rpm of [0,59,60,61,130]) assert(Number.isFinite(vm.runInContext(`motion01(${rpm})`,mc)));
  });
  console.log(`${checks} session/sensor regressions passed.`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
