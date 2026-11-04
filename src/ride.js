/* ride.js: recording and replay for a ride, with no audio input of any kind.
   A page notes named lanes (cadence, scene, route) as it runs. A replay sends them back at the times they were noted.
   Nothing here touches the network, and nothing is stored unless the rider saves the file. */
(function (global) {
  'use strict';

  const SCHEMA = 'body-signal-labs/ride-session@1';

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
      return { schema: SCHEMA, app: s.app, created: s.created, durationMs: Math.round(performance.now() - s.t0), synthetic: s.synthetic, note: 'Cadence ten times a second, with scene and route changes. No audio and no other reading.', lanes: s.lanes };
    };

    // Rides saved by the earlier page used another schema with the same lanes, so they replay too.
    ride.readSession = (raw) => {
      if (raw && raw.lanes && typeof raw.durationMs === 'number' && (raw.schema === SCHEMA || /\/session@1$/.test(raw.schema || ''))) return raw;
      throw new Error('This is not a ride file from this page.');
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
