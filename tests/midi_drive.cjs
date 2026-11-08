/* MIDI drive: every note pushes, harder notes push more, stopping coasts down, nothing passes the cap. */
const assert = require('assert');
const D = require('../src/midi-drive.js');
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; };

function play(st, { rate, velocity, from = 0, seconds }) {
  for (let t = from; t < from + seconds - 1e-9; t += 1 / rate) D.note(st, t, velocity);
  return from + seconds;
}

check('silence rides nothing', () => {
  const st = D.create();
  assert.strictEqual(D.rpm(st, 0), 0);
  assert.strictEqual(D.rpm(st, 10), 0);
  assert.strictEqual(D.playing(st, 10), false);
});

check('one loud note pushes, then fades within a few seconds', () => {
  const st = D.create();
  D.note(st, 0, 127);
  const now = D.rpm(st, 0);
  assert.ok(now > 30 && now < 60, `one full-velocity note gives ${now}`);
  assert.ok(D.rpm(st, 3) < 0.08 * now, 'after 3 s the push has mostly faded');
});

check('steady medium playing rides at a comfortable cadence', () => {
  const st = D.create();
  const end = play(st, { rate: 4, velocity: 76, seconds: 12 });
  const r = D.rpm(st, end);
  assert.ok(r > 60 && r < 90, `4 notes/s at velocity 76 gives ${r}`);
  assert.strictEqual(D.notesPerMin(st, end), 240);
  assert.strictEqual(D.playing(st, end), true);
});

check('harder notes push more at the same rate', () => {
  const soft = D.create(), hard = D.create();
  const end = play(soft, { rate: 4, velocity: 50, seconds: 12 });
  play(hard, { rate: 4, velocity: 115, seconds: 12 });
  assert.ok(D.rpm(hard, end) > D.rpm(soft, end) + 15);
});

check('faster playing pushes more, never past the cap', () => {
  const slow = D.create(), fast = D.create(), flat = D.create();
  const end = play(slow, { rate: 2, velocity: 90, seconds: 12 });
  play(fast, { rate: 8, velocity: 90, seconds: 12 });
  play(flat, { rate: 30, velocity: 127, seconds: 12 });
  assert.ok(D.rpm(fast, end) > D.rpm(slow, end) + 20);
  assert.ok(D.rpm(flat, end) <= D.RPM_MAX + 1e-9 && D.rpm(flat, end) > 0.95 * D.RPM_MAX);
});

check('stopping coasts down', () => {
  const st = D.create();
  const end = play(st, { rate: 4, velocity: 90, seconds: 10 });
  const r = D.rpm(st, end);
  assert.ok(D.rpm(st, end + 1) < r && D.rpm(st, end + 4) < 0.1 * r);
  assert.strictEqual(D.playing(st, end + 4), false);
});

check('only note-on with velocity counts, on any channel', () => {
  assert.deepStrictEqual(D.parse(Uint8Array.from([0x99, 38, 100])), { note: 38, velocity: 100, channel: 10 });
  assert.deepStrictEqual(D.parse(Uint8Array.from([0x90, 60, 1])), { note: 60, velocity: 1, channel: 1 });
  assert.strictEqual(D.parse(Uint8Array.from([0x99, 38, 0])), null, 'note-on at velocity 0 is a note-off');
  assert.strictEqual(D.parse(Uint8Array.from([0x89, 38, 64])), null, 'note-off');
  assert.strictEqual(D.parse(Uint8Array.from([0xB0, 7, 100])), null, 'controller');
  assert.strictEqual(D.parse(Uint8Array.from([0xF8])), null, 'clock');
  assert.strictEqual(D.parse(null), null);
});

console.log(`${passed}/7 MIDI drive checks passed.`);
