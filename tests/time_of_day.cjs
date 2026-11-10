/* Time of day moves one way: a step to a later time only ever lowers the sun and darkens the sky, and a step
   back only raises and brightens them. The look is blended from what is on screen to the new time's look
   (CyclingScene.blendLand), never by easing the time value through the hours in between. Run: node tests/time_of_day.cjs */
'use strict';
const path = require('node:path');
globalThis.window = globalThis;
// the page's own colour conversion (gl.js srgb), so brightness comparisons use the real colours
globalThis.GLKit = { FS_HEAD: '', srgb: (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2)); } };
require(path.join(__dirname, '../src/cyclingscene.js'));
const CS = globalThis.CyclingScene;
const TIMES = { 'Golden hour': 0.18, Sunset: 0.36, Dusk: 0.55, Night: 1 };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL', msg); } };

for (const b of CS.BIOMES) {
  const look = (d) => CS.landAt(b, b, 1, d);
  // The whole day, as the Moving cycle and Biofeedback's weather run it: the sun never rises on the way to night.
  // (Before the fix, reading the weights between held times lifted it: Golden coast, dusk to night, 0.038 up to 0.396.)
  let rise = 0, prev = Infinity;
  for (let k = 0; k <= 1000; k++) { const e = look(k / 1000).uSunDir[1]; rise = Math.max(rise, e - prev); prev = e; }
  ok(rise <= 1e-12, `${b.name}: over the whole day the sun never rises (largest rise ${rise.toExponential(1)})`);
  // Between two neighbouring held times every colour stays between those two times' colours: no detour.
  const held = Object.values(TIMES); held.unshift(0);
  for (let i = 0; i + 1 < held.length; i++) {
    const A = look(held[i]), B = look(held[i + 1]);
    let inside = true;
    for (let k = 1; k < 50; k++) {
      const L = look(held[i] + (held[i + 1] - held[i]) * k / 50);
      for (const f of ['uSkyTop', 'uSkyHz', 'uSunC', 'uFog', 'uGround', 'uRock'])
        L[f].forEach((v, j) => { if (v < Math.min(A[f][j], B[f][j]) - 1e-12 || v > Math.max(A[f][j], B[f][j]) + 1e-12) inside = false; });
    }
    ok(inside, `${b.name}: between ${held[i]} and ${held[i + 1]} every colour stays between those two times`);
  }
  const names = Object.keys(TIMES);
  for (let i = 0; i + 1 < names.length; i++) {
    for (const [p, q] of [[names[i], names[i + 1]], [names[i + 1], names[i]]]) {
      const A = look(TIMES[p]), B = look(TIMES[q]);
      let prevE = A.uSunDir[1], prevL = lum(A.uSkyTop), mono = true, inside = true;
      const lo = Math.min(A.uSunDir[1], B.uSunDir[1]) - 1e-12, hi = Math.max(A.uSunDir[1], B.uSunDir[1]) + 1e-12;
      for (let k = 1; k <= 60; k++) {
        const t = k / 60, s = t * t * (3 - 2 * t), L = CS.blendLand(A, B, s);
        const e = L.uSunDir[1], l = lum(L.uSkyTop);
        if (e < lo || e > hi) inside = false;
        if ((B.uSunDir[1] - A.uSunDir[1]) * (e - prevE) < -1e-12 || (lum(B.uSkyTop) - lum(A.uSkyTop)) * (l - prevL) < -1e-12) mono = false;
        prevE = e; prevL = l;
      }
      ok(inside && mono, `${b.name}: ${p} to ${q} moves one way and stays between the two looks`);
      const end = CS.blendLand(A, B, 1);
      ok(JSON.stringify(end) === JSON.stringify(B), `${b.name}: ${p} to ${q} ends exactly on ${q}'s look`);
    }
  }
}
console.log(`${checks - fails}/${checks} time-of-day checks passed.`);
process.exit(fails ? 1 : 0);
