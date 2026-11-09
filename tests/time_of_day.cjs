/* Time of day moves one way: a step to a later time only ever lowers the sun and darkens the sky, and a step
   back only raises and brightens them. The look is blended from what is on screen to the new time's look
   (CyclingScene.blendLand), never by easing the time value through the hours in between. Run: node tests/time_of_day.cjs */
'use strict';
const path = require('node:path');
globalThis.window = globalThis; globalThis.GLKit = { FS_HEAD: '', srgb: () => [0, 0, 0] };
require(path.join(__dirname, '../src/cyclingscene.js'));
const CS = globalThis.CyclingScene;
const TIMES = { 'Golden hour': 0.18, Sunset: 0.36, Dusk: 0.55, Night: 1 };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL', msg); } };

for (const b of CS.BIOMES) {
  const look = (d) => CS.landAt(b, b, 1, d);
  // Why: easing the time value itself from Dusk to Night lifts the sun far above both ends on most landscapes.
  let rise = 0;
  for (let d = 0.55; d <= 1.0001; d += 0.01) rise = Math.max(rise, look(d).uSunDir[1] - Math.max(look(0.55).uSunDir[1], look(1).uSunDir[1]));
  if (b.id === 'golden-coast') ok(rise > 0.2, `${b.name}: the old path did climb (rise ${rise.toFixed(3)}), so this test can see the fault`);
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
