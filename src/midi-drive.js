/* midi-drive.js: turns MIDI notes into a cadence the bike can ride on.
   Any MIDI instrument works (drums, pads, keys): every note-on pushes, and a harder note (higher velocity)
   pushes more. Each push fades with time constant TAU, and the sum saturates smoothly at RPM_MAX:
     x(t) = sum over notes of (velocity / 127) * exp(-(t - t_note) / TAU),   rpm(t) = RPM_MAX * (1 - exp(-x / X0)).
   Steady playing at r notes per second with mean velocity v holds x near v * r * TAU, so about 4 notes a
   second at medium velocity rides near 75 rpm, and stopping lets the cadence fall away within a few seconds.
   The cockpit feeds this rpm into the same motion model as a cadence sensor, so top speed and the
   scenery's flash limits stay exactly as they are. Pure functions, no browser APIs: tested in tests/midi_drive.cjs. */
(function (root) {
  'use strict';
  const VERSION = 'midi-drive@1', TAU = 1.0, X0 = 2.0, RPM_MAX = 110, RATE_WINDOW = 10, PLAYING_WINDOW = 3;

  function create() { return { x: 0, t: null, times: [] }; }

  function decay(st, t) {
    if (st.t != null && t > st.t) st.x *= Math.exp(-(t - st.t) / TAU);
    if (st.t == null || t > st.t) st.t = t;
  }

  /* One note-on at time t (seconds) with MIDI velocity 1-127. */
  function note(st, t, velocity) {
    decay(st, t);
    st.x += Math.max(0, Math.min(127, Number(velocity) || 0)) / 127;
    st.times.push(t);
    if (st.times.length > 4096) st.times.splice(0, st.times.length - 4096);
  }

  function rpm(st, t) { decay(st, t); return RPM_MAX * (1 - Math.exp(-st.x / X0)); }

  function notesPerMin(st, t) {
    while (st.times.length && t - st.times[0] > RATE_WINDOW) st.times.shift();
    return Math.round(st.times.length * 60 / RATE_WINDOW);
  }

  /* Playing means a note in the last few seconds: the heart shift waits, as it does while pedaling. */
  function playing(st, t) { return st.times.length > 0 && t - st.times[st.times.length - 1] <= PLAYING_WINDOW; }

  /* A raw MIDI message to a note, or null. Only note-on with velocity above 0 counts, on any channel;
     note-off, note-on with velocity 0, controllers, clock and other system messages are ignored. */
  function parse(data) {
    if (!data || data.length < 3) return null;
    if ((data[0] & 0xF0) !== 0x90 || !(data[2] > 0)) return null;
    return { note: data[1], velocity: data[2], channel: (data[0] & 0x0F) + 1 };
  }

  const api = { VERSION, TAU, X0, RPM_MAX, create, note, rpm, notesPerMin, playing, parse };
  root.MidiDrive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
