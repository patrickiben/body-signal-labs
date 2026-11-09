#!/usr/bin/env node
/* Customize Route: settings in a rider's units must be what the road really does.
   Measured on the shared road functions (the same ones the camera, the grade readout and the speed use),
   over 20 km and 14 road layouts per landscape. Expected answers were written before the first run. */
const assert = require('node:assert/strict');
const path = require('node:path');
globalThis.window = globalThis; globalThis.GLKit = { FS_HEAD: '', srgb: () => [0, 0, 0] };
require(path.join(__dirname, '../src/cyclingscene.js'));
require(path.join(__dirname, '../src/route-shape.js'));
const C = globalThis.CyclingScene, RS = globalThis.RouteShape.make(C.BIOMES);
let checks = 0, fails = 0;
const test = (name, fn) => { try { fn(); checks++; console.log(`PASS ${name}`); } catch (e) { fails++; console.log(`FAIL ${name}\n     ${e.message}`); } };
const near = (a, b, rel, label) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-12), `${label}: ${a} vs ${b}`);

// Measure a scene's road: steepest grade (as the grade readout computes it), and the tightest bend two ways:
// from the sideways line's second difference (what the formula bounds) and as a true geometric radius.
function measure(scene) {
  let g = 0, k2 = 0, kg = 0, maxX = 0;
  for (let seed = 0; seed < 40; seed += 3) for (let z = 0; z < 20000; z += 2.5) {
    g = Math.max(g, Math.abs(C.gradeAt(z, seed, scene)));
    const a = C.pathX(z - 2.5, seed, scene), b = C.pathX(z, seed, scene), c = C.pathX(z + 2.5, seed, scene);
    const x2 = Math.abs(a - 2 * b + c) / 6.25, x1 = (c - a) / 5;
    k2 = Math.max(k2, x2); kg = Math.max(kg, x2 / Math.pow(1 + x1 * x1, 1.5)); maxX = Math.max(maxX, Math.abs(b));
  }
  return { grade: g, radius2: k2 > 0 ? 1 / k2 : Infinity, radiusGeo: kg > 0 ? 1 / kg : Infinity, maxX };
}

// Corrected after the first run: the expectation was first written as .167217, an addition slip;
// 7 x .0071 + 3.4 x .0193 + 1.1 x .0471 = .0497 + .06562 + .05181 = .16713.
test('the formulas give the stated limits: 16.71% and 38.71 m', () => {
  near(RS.MAX_GRADE, .16713, 1e-4, 'steepest grade'); near(RS.MIN_RADIUS, 38.708, 1e-3, 'tightest bend');
});
test('Golden coast\'s own road: 5.35% steepest, 190.5 m tightest bend, 2.25 m half-width', () => {
  const o = RS.own(0); near(o.grade, .053509, 1e-3, 'grade'); near(o.radius, 190.51, 1e-3, 'radius'); assert.equal(o.width, 2.25);
});
test('no custom setting leaves every landscape\'s road exactly as it was', () => {
  C.BIOMES.forEach((b, i) => { const s = RS.sceneFor(i, null); for (const k of Object.keys(b)) assert.deepEqual(s[k], b[k], `${b.name} ${k}`); });
});
const own = C.BIOMES.map((b) => measure(b));
test('each landscape\'s own road measures what the formula says (within 1%)', () => {
  C.BIOMES.forEach((b, i) => { near(own[i].grade, RS.own(i).grade, .01, `${b.name} grade`); near(own[i].radius2, RS.own(i).radius, .01, `${b.name} bend`); });
});
for (const g of [0, .02, .05, .1, .1672]) {
  test(`steepest grade set to ${(g * 100).toFixed(1)}% measures ${(g * 100).toFixed(1)}% on every landscape`, () => {
    C.BIOMES.forEach((b, i) => { const m = measure(RS.sceneFor(i, { grade: g })); if (g === 0) assert.equal(m.grade, 0, b.name); else near(m.grade, g, .01, b.name); });
  });
}
for (const r of [38.71, 60, 120, 250]) {
  test(`tightest bend set to ${r} m measures ${r} m on every landscape`, () => {
    C.BIOMES.forEach((b, i) => near(measure(RS.sceneFor(i, { radius: r })).radius2, r, .012, b.name));
  });
}
test('straight means the road never turns', () => {
  C.BIOMES.forEach((b, i) => assert.equal(measure(RS.sceneFor(i, { radius: Infinity })).maxX, 0, b.name));
});
test('settings past the limits stop at them: 30% gives 16.7%, 10 m gives 38.7 m', () => {
  C.BIOMES.forEach((b, i) => { const m = measure(RS.sceneFor(i, { grade: .3, radius: 10 })); near(m.grade, RS.MAX_GRADE, .01, `${b.name} grade`); near(m.radius2, RS.MIN_RADIUS, .012, `${b.name} bend`); });
});
test('road width: set, and held to 2 m to 7.6 m across', () => {
  assert.equal(RS.sceneFor(3, { width: 1.5 }).width, 1.5); assert.equal(RS.sceneFor(3, { width: 9 }).width, 3.8); assert.equal(RS.sceneFor(3, { width: .2 }).width, 1);
});
test('the readouts the panel shows are what the road measures', () => {
  C.BIOMES.forEach((b, i) => { const c = { grade: .08, radius: 120 }, a = RS.actual(i, c), m = measure(RS.sceneFor(i, c)); near(a.grade, m.grade, .01, b.name); near(a.radius, m.radius2, .012, b.name); });
});
// How far the true geometric radius sits from the formula's radius, per landscape, at the tightest setting.
const geo = C.BIOMES.map((b, i) => { const m = measure(RS.sceneFor(i, { radius: RS.MIN_RADIUS })); return `${b.name} ${m.radius2.toFixed(1)} m line / ${m.radiusGeo.toFixed(1)} m geometric`; });
console.log('     tightest setting, formula vs true geometric radius:\n     ' + geo.join('\n     '));
console.log(`${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
