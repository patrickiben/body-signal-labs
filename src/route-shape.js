/* route-shape.js: Customize Route, in a rider's units.
   The road is a sum of sines (cyclingscene.js): its height is rise x (7 sin(.0071 q) + 3.4 sin(.0193 q) + 1.1 sin(.0471 q))
   and its sideways line is turn x (14 sin(.0113 q) + 6.5 sin(.0271 q)), with q = winding x distance. So a landscape's
   steepest grade is rise x winding x 0.16722, and its tightest bend has curvature turn x winding^2 x 0.0065614 per metre.
   A setting in percent or metres becomes the climb and bend sizes that reach it on whichever landscape is showing.
   Limits: never steeper than the steepest landscape here, never tighter than the twistiest. No DOM, no graphics. */
(function (global) {
  'use strict';
  const GRADE_PER_RISE = 7 * .0071 + 3.4 * .0193 + 1.1 * .0471;            // steepest slope of the height sum, per unit rise
  const CURV_PER_TURN = 14 * .0113 ** 2 + 6.5 * .0271 ** 2;                  // largest curvature of the sideways sum, per unit turn
  const WIDTH = [1, 3.8];                                                    // road half-width in metres: 2 m to 7.6 m across
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function make(biomes) {
    const grade = biomes.map((b) => b.rise * b.winding * GRADE_PER_RISE);   // steepest grade of each landscape's own road
    const curv = biomes.map((b) => b.turn * b.winding ** 2 * CURV_PER_TURN); // tightest-bend curvature of each landscape's own road
    const MAX_GRADE = Math.max(...grade), MAX_CURV = Math.max(...curv);
    // The landscape's own road, in the units the controls use.
    const own = (i) => ({ grade: grade[i], radius: 1 / curv[i], width: biomes[i].width });
    // Steepest grade (a fraction, 0.1 = 10%) to the climb size on landscape i.
    const climbFor = (i, g) => clamp(g, 0, MAX_GRADE) / grade[i];
    // Tightest bend radius in metres (Infinity = straight) to the bend size on landscape i.
    const bendFor = (i, r) => clamp(r > 0 && Number.isFinite(r) ? 1 / r : 0, 0, MAX_CURV) / curv[i];
    // A custom route { grade, radius, width }, any of them null for the landscape's own, applied to landscape i.
    function sceneFor(i, custom) {
      const b = biomes[i], c = custom || {};
      const out = { ...b };
      if (c.grade != null) out.climb = climbFor(i, c.grade);
      if (c.radius != null) out.bend = bendFor(i, c.radius);
      if (c.width != null) out.width = clamp(c.width, WIDTH[0], WIDTH[1]);
      return out;
    }
    // What the road on landscape i really is under a custom route: the readouts the panel shows.
    const actual = (i, custom) => {
      const s = sceneFor(i, custom), g = grade[i] * (s.climb ?? 1), k = curv[i] * (s.bend ?? 1);
      return { grade: g, radius: k > 0 ? 1 / k : Infinity, width: s.width };
    };
    return Object.freeze({ MAX_GRADE, MIN_RADIUS: 1 / MAX_CURV, WIDTH, own, climbFor, bendFor, sceneFor, actual });
  }
  global.RouteShape = Object.freeze({ GRADE_PER_RISE, CURV_PER_TURN, make });
})(typeof window === 'undefined' ? globalThis : window);
