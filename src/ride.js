/* ride.js: recording and replay for a ride, with no audio input of any kind.
   A page notes named lanes (cadence, scene, route) as it runs. A replay sends them back at the times they were noted.
   Nothing here touches the network, and nothing is stored unless the rider saves the file. */
(function (global) {
  'use strict';

  const SCHEMA = 'body-signal-labs/ride-session@1';
  const SCENE_CATALOG = 'cycling-scenes@1';

  function createRide() {
    const handlers = {};
    const emit = (ev, data) => (handlers[ev] || []).forEach((fn) => fn(data));
    let session = null, replay = null;

    const ride = {
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      get recording() { return !!session; },
      get replayOn() { return !!replay; },
    };

    ride.startRecording = (app, synthetic) => {
      session = { t0: performance.now(), app, created: new Date().toISOString(), synthetic: !!synthetic, lanes: {} };
      emit('recording', true);
      emit('state');
    };
    ride.noteLane = (name, value) => { if (session) (session.lanes[name] = session.lanes[name] || []).push([Math.round(performance.now() - session.t0), value]); };
    ride.stopRecording = () => {
      if (!session) return null;
      const s = session; session = null;
      emit('state');
      return { schema: SCHEMA, app: s.app, created: s.created, durationMs: Math.round(performance.now() - s.t0), synthetic: s.synthetic, sceneCatalog: SCENE_CATALOG, note: 'Cadence ten times a second, with scene and route changes. No audio and no other reading.', lanes: s.lanes };
    };

    // Rides saved by the earlier page used another schema with the same lanes, so they replay too.
    ride.readSession = (raw) => {
      if (!raw || !(raw.schema === SCHEMA || /\/session@1$/.test(raw.schema || ''))) throw new Error('This is not a ride file from this page.');
      const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
      const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
      const fail = (part) => { throw new Error(`Invalid ride ${part}.`); };
      if (!finite(raw.durationMs, 0, Number.MAX_SAFE_INTEGER) || !object(raw.lanes)) fail('duration or lanes');
      if (raw.sceneCatalog != null && raw.sceneCatalog !== SCENE_CATALOG) fail('scene catalog');
      if (raw.synthetic != null && typeof raw.synthetic !== 'boolean') fail('source label');
      // Appending Misty at 6 and Snake Way at 7 preserves existing Endless IDs.
      // Require a catalog tag for new IDs so old files cannot gain a new meaning.
      const biome = (v) => Number.isInteger(v) && v >= 0 && v < (raw.sceneCatalog === SCENE_CATALOG ? 8 : 6);
      const tod = (v) => Number.isInteger(v) && v >= 0 && v < 4;
      for (const [name, lane] of Object.entries(raw.lanes)) {
        if (!Array.isArray(lane)) fail(`${name} lane`);
        let previous = -1;
        for (const point of lane) {
          if (!Array.isArray(point) || point.length !== 2 || !finite(point[0], 0, raw.durationMs) || point[0] < previous) fail(`${name} timing`);
          previous = point[0]; const v = point[1];
          if ((name === 'rpm' && !finite(v, 0, 250)) || (name === 'seed' && !finite(v, -1e6, 1e6)) || (name === 'biome' && !biome(v)) || (name === 'tod' && !tod(v))) fail(`${name} value`);
          if (name === 'routeStart') {
            if (!object(v)) fail('starting route');
            if (v.motionVersion !== undefined && v.motionVersion !== 'biofeedback-cadence@1') fail('starting motion version');
            if ((v.biome != null && !biome(v.biome)) || (v.tod != null && !tod(v.tod))) fail('starting scene');
            for (const k of ['seed', 'vis', 'dist']) if (v[k] != null && !finite(v[k], k === 'dist' ? 0 : -1e12, 1e12)) fail(`starting ${k}`);
            if (v.map != null) {
              if (!object(v.map)) fail('starting cadence mapping');
              for (const [k, lim] of Object.entries({ idle: [0, 60], max: [60, 130], maxZoom: [.004, .04], gamma: [.6, 3.2] })) if (!finite(v.map[k], ...lim)) fail(`starting ${k}`);
            }
          }
        }
      }
      return raw.sceneCatalog === SCENE_CATALOG ? raw : { ...raw, sceneCatalog: SCENE_CATALOG };
    };
    ride.startReplay = (raw) => {
      const s = ride.readSession(raw);
      replay = { s, t0: performance.now(), lanes: Object.entries(s.lanes).map(([k, v]) => ({ k, v, i: 0 })) };
      emit('replay', true); emit('state');
    };
    ride.stopReplay = () => {
      if (!replay) return;
      replay = null;
      emit('replay', false); emit('state');
    };
    ride.tick = (now) => {
      if (!replay) return;
      const R = replay, t = now - R.t0;
      R.lanes.forEach((l) => { while (l.i < l.v.length && l.v[l.i][0] <= t) { const p = l.v[l.i++]; emit('lane', { name: l.k, value: p[1] }); } });
      if (t >= R.s.durationMs) ride.stopReplay();
    };
    return ride;
  }

  global.createRide = createRide;
})(window);
