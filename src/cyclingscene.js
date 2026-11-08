/* cyclingscene.js: shared procedural scenery for both cycling cockpits.
   Catalog indices are stable. Misty pines keeps the original Biofeedback height,
   sky, road and motes; six newer landscapes retain their own geometry. No
   cadence or heart-beat propagation bars are drawn across the road. */
(function (global) {
  'use strict';
  const { FS_HEAD, srgb } = GLKit;
  const lerp = (a, b, t) => a + (b - a) * t;
  const BIOMES = [
    { id: 'golden-coast', name: 'Golden coast', description: 'Cliffside cycleway · open sea, rock stacks and white guardrails', skyTop: '#397ab1', skyHz: '#abd6eb', sun: '#ffe7be', ground: '#6c8247', rock: '#a58d70', fog: '#9bbbc9', edge: '#e6c985', amp: 45, ridge: .38, trees: 0, sea: 1, snow: 0, strata: 0, grid: 0, fogK: .0018, sunAz: -.65, sunEl: .55, coast: 1, forest: 0, meadow: 0, alpine: 0, canyon: 0, width: 2.25, turn: 1.25, rise: .4, winding: .8 },
    { id: 'tropical-preserve', name: 'Tropical', description: 'Tropical nature preserve · palms, flowering understory and a warm earth trail', skyTop: '#368ca8', skyHz: '#bee1cc', sun: '#ffedbc', ground: '#467642', rock: '#b99b6a', fog: '#a9c7ad', edge: '#e0b887', amp: 22, ridge: .22, trees: 1, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0028, sunAz: -.5, sunEl: .52, coast: 0, forest: 1, meadow: 0, alpine: 0, canyon: 0, width: 1.65, turn: .75, rise: .3, winding: 1.15 },
    { id: 'meadow-lanes', name: 'Meadow lanes', description: 'Country lane · rolling fields, split-rail fences and farmsteads', skyTop: '#5596c6', skyHz: '#d8e8d2', sun: '#fff0c6', ground: '#91a84e', rock: '#87965c', fog: '#cedbc0', edge: '#e4d59a', amp: 14, ridge: .1, trees: .2, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0016, sunAz: -.7, sunEl: .55, coast: 0, forest: 0, meadow: 1, alpine: 0, canyon: 0, width: 2, turn: .95, rise: .5, winding: .7 },
    { id: 'new-england-autumn', name: 'Autumn Lake', description: 'Lakeside road · blue water, gray bluffs and a red, orange and gold woodland', skyTop: '#4379a8', skyHz: '#d6dbd7', sun: '#ffe2b0', ground: '#887246', rock: '#85858a', fog: '#bec5c4', edge: '#e3be7f', amp: 64, ridge: .7, trees: .8, sea: 1, snow: 0, strata: 0, grid: 0, fogK: .0016, sunAz: -.65, sunEl: .5, coast: 0, forest: 0, meadow: 0, alpine: 1, canyon: 0, width: 2.1, turn: 1.4, rise: .7, winding: .65 },
    { id: 'red-canyon', name: 'Red canyon', description: 'Desert passage · sandstone walls, layered mesas and saguaro cacti', skyTop: '#5c9db7', skyHz: '#f5cba0', sun: '#ffe1b0', ground: '#c18a55', rock: '#c67246', fog: '#d8b18a', edge: '#ecc39a', amp: 72, ridge: .8, trees: 0, sea: 0, snow: 0, strata: 1, grid: 0, fogK: .0022, sunAz: -.9, sunEl: .5, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 1, width: 2.35, turn: .75, rise: .25, winding: 1.45 },
    { id: 'rainbow-orbit', name: 'Rainbow orbit', description: 'Rainbow skyway · a suspended ribbon through stars and a ringed planet', skyTop: '#171b42', skyHz: '#302449', sun: '#e0e8ff', ground: '#654a92', rock: '#6c80a8', fog: '#181b35', edge: '#aba9ff', amp: 0, ridge: 0, trees: 0, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0008, sunAz: -.4, sunEl: .6, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 0, orbit: 1, width: 3.5, turn: 2.1, rise: 1.05, winding: .55 },
    { id: 'misty-pines', name: 'Misty ridges', description: 'Original Biofeedback mountain road · misty ridges, teal edges and drifting lights', skyTop: '#1f3a50', skyHz: '#a7c9c2', sun: '#ffe8c6', ground: '#1e3a2f', rock: '#39494a', fog: '#b0d3cc', edge: '#7ff0dd', amp: 64, ridge: 0.22, trees: 1, sea: 0, snow: 0, strata: 0, grid: 0, fogK: 0.0062, sunAz: -0.3, sunEl: 0.16, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 0, orbit: 0, misty: 1, width: 2.25, turn: 1, rise: 1, winding: 1 },
    { id: 'snake-way', name: 'Snake Way', description: 'Serpentine cloud road · pale lilac scales and raised spines above a golden cloud sea', skyTop: '#785093', skyHz: '#e5a1b5', sun: '#ffe1a1', ground: '#b5bfdc', rock: '#a6a3d1', fog: '#e9bb83', edge: '#d0ddf0', amp: 0, ridge: 0, trees: 0, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0014, sunAz: -.6, sunEl: .3, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 0, orbit: 0, misty: 0, snake: 1, width: 2.4, turn: 7, rise: .65, winding: .75 },
    { id: 'tron-grid', name: 'Tron grid', description: 'Lightcycle grid · obsidian highway, neon cyan & orange light walls, recognizer arches and wireframe peaks', skyTop: '#040a18', skyHz: '#0b2844', sun: '#7cf3ff', ground: '#061526', rock: '#0d2e4c', fog: '#082138', edge: '#33f0ff', amp: 52, ridge: .85, trees: 0, sea: 0, snow: 0, strata: 0, grid: 1, fogK: .0016, sunAz: 0, sunEl: .22, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 0, orbit: 0, misty: 0, snake: 0, tron: 1, width: 2.65, turn: 1.65, rise: .35, winding: .9 },
  ].map((b) => ({ orbit: 0, misty: 0, snake: 0, tron: 0, ...b, c: { skyTop: srgb(b.skyTop), skyHz: srgb(b.skyHz), sun: srgb(b.sun), ground: srgb(b.ground), rock: srgb(b.rock), fog: srgb(b.fog), edge: srgb(b.edge) } }));

  const WORLD_KEYS = ['coast', 'forest', 'meadow', 'alpine', 'canyon', 'orbit', 'misty', 'snake', 'tron'];
  const NUMS = ['amp', 'ridge', 'trees', 'sea', 'snow', 'strata', 'grid', 'fogK', 'sunAz', 'sunEl', 'coast', 'forest', 'meadow', 'alpine', 'canyon', 'orbit', 'misty', 'snake', 'tron', 'width', 'turn', 'rise', 'winding'];
  const routeWeights = (scene = BIOMES[0]) => WORLD_KEYS.map((k, i) => Array.isArray(scene) ? scene[i] || 0 : scene[k] || 0);
  function mixScene(a, b, t) {
    const m = { c: {} };
    Object.keys(b.c).forEach(k => { m.c[k] = a.c[k].map((v, i) => lerp(v, b.c[k][i], t)); });
    NUMS.forEach(k => { m[k] = lerp(a[k] ?? 0, b[k] ?? 0, t); });
    return m;
  }
  function routeBlend(z, seed, scene, elevation) {
    const weights = routeWeights(scene);
    return BIOMES.reduce((sum, b, i) => {
      if (weights[i] < .000001) return sum;
      const q = z * b.winding;
      const v = elevation ? b.rise * (7*Math.sin(q*.0071+.4+seed)+3.4*Math.sin(q*.0193+1.9+seed*2.3)+1.1*Math.sin(q*.0471+3.1)) : b.turn * (14*Math.sin(q*.0113+1+seed)+6.5*Math.sin(q*.0271+2.2+seed*1.7));
      return sum + weights[i] * v;
    }, 0);
  }
  // Blend evaluated positions: blending sine frequency changes phase far from origin.
  const pathX = (z, seed = 0, scene = BIOMES[0]) => routeBlend(z, seed, scene, false);
  const roadY = (z, seed = 0, scene = BIOMES[0]) => routeBlend(z, seed, scene, true);
  const gradeAt = (z, seed = 0, scene = BIOMES[0]) => (roadY(z + 3, seed, scene) - roadY(z - 3, seed, scene)) / 6;
  function routeUniforms(scene) {
    const w = routeWeights(scene);
    return { uRouteA: w.slice(0, 4), uRouteB: w[4], uRouteC: w[5], uRouteD: w[6], uRouteE: w[7], uRouteF: w[8],
      uCoast: w[0], uForest: w[1], uMeadow: w[2], uAlpine: w[3], uCanyon: w[4], uOrbit: w[5], uMisty: w[6], uSnake: w[7], uTron: w[8],
      uWidth: Array.isArray(scene) ? BIOMES.reduce((v, b, i) => v + b.width * w[i], 0) : scene.width };

  }

  function landAt(a, b, tb, dusk) {
    const t = tb * tb * (3 - 2 * tb);
    const mix3 = (k) => a.c[k].map((v, i) => lerp(v, b.c[k][i], t));
    const mixN = (k) => lerp(a[k], b[k], t);
    const d = Math.max(0, Math.min(1, Number.isFinite(dusk) ? dusk : 0));

    // Golden hour (peaks around 0.18): radiant amber sun, warm apricot horizon, golden illuminated mist and ground.
    // Sunset (peaks around 0.36): fiery vermilion sun at the horizon, blazing coral/flame horizon glow, rich warm rim light.
    // Dusk (peaks around 0.55): twilight violet/indigo sky, deep crimson/magenta afterglow, cool shadows.
    // Night (approaches 1.0): midnight dark sky, pale moonlit sun, glowing road edges and stars.
    const gh = Math.exp(-Math.pow((d - 0.18) / 0.12, 2));
    const ss = Math.exp(-Math.pow((d - 0.36) / 0.11, 2));
    const dk = Math.exp(-Math.pow((d - 0.55) / 0.13, 2)) * (1 - Math.max(0, (d - 0.72) / 0.28));
    const nt = Math.max(0, Math.min(1, (d - 0.62) / 0.38));
    const tr = mixN('tron');
    const ghSky = gh * (1 - tr * 0.88);
    const ssSky = ss * (1 - tr * 0.88);

    const sunElBase = mixN('sunEl');
    const sunEl = Math.max(0.032, lerp(lerp(lerp(sunElBase, sunElBase * 0.42, gh), 0.046, ss), 0.038, Math.max(dk, nt)));
    const sunAz = mixN('sunAz');
    const sx = Math.sin(sunAz), sz = Math.cos(sunAz), sl = Math.hypot(sx, sunEl, sz);

    const baseTop = mix3('skyTop'), baseHz = mix3('skyHz'), baseSun = mix3('sun'), baseFog = mix3('fog');
    const baseGround = mix3('ground'), baseRock = mix3('rock');

    // Sky top: rich clear azure at golden hour, deep cobalt-violet at sunset, twilight indigo at dusk, pitch midnight at night
    const skyTop = baseTop.map((v, i) => {
      let c = lerp(v, [0.10, 0.28, 0.55][i], ghSky * 0.65);
      c = lerp(c, [0.075, 0.13, 0.34][i], ssSky * 0.85);
      c = lerp(c, [0.035, 0.045, 0.14][i], dk * (1 - tr * 0.75));
      return lerp(c, [0.004, 0.006, 0.024][i], nt);
    });

    // Sky horizon: glowing apricot at golden hour, vivid flame/coral at sunset, rich magenta at dusk, deep dark at night
    const skyHz = baseHz.map((v, i) => {
      let c = lerp(v, [0.98, 0.64, 0.34][i], ghSky * 0.85);
      c = lerp(c, [1.0, 0.37, 0.11][i], ssSky * 0.95);
      c = lerp(c, [0.42, 0.14, 0.32][i], dk * (1 - tr * 0.75));
      return lerp(c, [0.035, 0.025, 0.07][i], nt);
    });

    // Sun color: radiant gold at golden hour, fiery vermilion disk at sunset, twilight plum at dusk, silvery moon at night
    const sunC = baseSun.map((v, i) => {
      let c = lerp(v, [1.0, 0.74, 0.32][i], gh * 0.9);
      c = lerp(c, [1.0, 0.38, 0.12][i], ss * 0.95);
      c = lerp(c, [0.65, 0.28, 0.38][i], dk);
      return lerp(c, [0.26, 0.29, 0.44][i], nt);
    });

    // Fog: golden-lit haze at golden hour, fiery copper glow at sunset, violet twilight mist at dusk, dark night mist
    const fog = baseFog.map((v, i) => {
      let c = lerp(v, [0.92, 0.68, 0.42][i], ghSky * 0.75);
      c = lerp(c, [0.86, 0.38, 0.19][i], ssSky * 0.85);
      c = lerp(c, [0.18, 0.12, 0.25][i], dk * (1 - tr * 0.75));
      return lerp(c, [0.02, 0.025, 0.05][i], nt);
    });

    // Ground & Rock: warm golden illumination vs fiery sunset rim-light vs cool dusk shadows
    const ground = baseGround.map((v, i) => {
      let c = lerp(v, [v * 1.08 + 0.12, v * 0.95 + 0.06, v * 0.75][i], ghSky * 0.5);
      c = lerp(c, [v * 1.14 + 0.14, v * 0.84 + 0.03, v * 0.58][i], ssSky * 0.65);
      return lerp(c, v * 0.68, dk);
    });
    const rock = baseRock.map((v, i) => {
      let c = lerp(v, [v * 1.08 + 0.12, v * 0.95 + 0.06, v * 0.75][i], ghSky * 0.5);
      c = lerp(c, [v * 1.14 + 0.14, v * 0.84 + 0.03, v * 0.58][i], ssSky * 0.65);
      return lerp(c, v * 0.68, dk);
    });

    return {
      uSkyTop: skyTop, uSkyHz: skyHz, uSunC: sunC,
      uGround: ground, uRock: rock, uFog: fog, uEdge: mix3('edge'),
      uSunDir: [sx / sl, sunEl / sl, sz / sl],
      uCoast: mixN('coast'), uForest: mixN('forest'), uMeadow: mixN('meadow'), uAlpine: mixN('alpine'), uCanyon: mixN('canyon'), uOrbit: mixN('orbit'), uMisty: mixN('misty'), uSnake: mixN('snake'), uTron: tr, uWidth: mixN('width'), uRouteA: ['coast','forest','meadow','alpine'].map(mixN), uRouteB: mixN('canyon'), uRouteC: mixN('orbit'), uRouteD: mixN('misty'), uRouteE: mixN('snake'), uRouteF: tr,
      uAmp: mixN('amp'), uRidge: mixN('ridge'), uSea: mixN('sea'), uSnow: mixN('snow'), uStrata: mixN('strata'), uGrid: mixN('grid'), uTrees: mixN('trees'), uDusk: d, uFogK: mixN('fogK'), uLattice: 0.0,
    };
  }

  const SCENE_FS = FS_HEAD + `
uniform vec2 uRes; uniform float uT,uFocal,uBeat,uSeed;
uniform vec3 uCam,uRight,uUp,uFwd;
uniform sampler2D uN,uS;
uniform vec3 uSkyTop,uSkyHz,uSunC,uGround,uRock,uFog,uEdge,uSunDir;
uniform float uAmp,uRidge,uSea,uSnow,uStrata,uGrid,uTrees,uDusk,uFogK;
uniform float uSpark,uCoast,uForest,uMeadow,uAlpine,uCanyon,uOrbit,uMisty,uSnake,uTron,uWidth,uTravelSpeed,uLattice;
uniform float uShimmer,uAurora,uHaze,uWeather,uWarm,uBreath,uBreathOn,uNebula;
uniform vec4 uGhost;
uniform vec4 uRouteA; uniform float uRouteB,uRouteC,uRouteD,uRouteE,uRouteF;
float routeX(float z,float turn,float winding){z*=winding;return turn*(14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7));}
float routeY(float z,float rise,float winding){z*=winding;return rise*(7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1));}
float pathX(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeX(z,1.25,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeX(z,.75,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeX(z,.95,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeX(z,1.4,.65);if(uRouteB>.000001)v+=uRouteB*routeX(z,.75,1.45);if(uRouteC>.000001)v+=uRouteC*routeX(z,2.1,.55);if(uRouteD>.000001)v+=uRouteD*routeX(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeX(z,7.,.75);if(uRouteF>.000001)v+=uRouteF*routeX(z,1.65,.9);return v;}
float roadY(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeY(z,.4,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeY(z,.3,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeY(z,.5,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeY(z,.7,.65);if(uRouteB>.000001)v+=uRouteB*routeY(z,.25,1.45);if(uRouteC>.000001)v+=uRouteC*routeY(z,1.05,.55);if(uRouteD>.000001)v+=uRouteD*routeY(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeY(z,.65,.75);if(uRouteF>.000001)v+=uRouteF*routeY(z,.35,.9);return v;}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return textureLod(uN,(i+f+.5)/256.,0.).r;}
const mat2 R=mat2(.8,.6,-.6,.8);
float fbm2(vec2 p){return (vn(p)+.5*vn(R*p*2.03+3.1))/1.5;}
float fbm4(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=R*p*2.03+1.7;a*=.5;}return s/.9375;}
// Static, seeded world-space vegetation and wildlife. No frame-random color or motion.
// Analytic world-pixel footprint: derivatives are undefined inside the row/leaf
// branches, whose neighboring pixels may be evaluating different billboards.
float foliageAA=.006;
float foliageEdge(float d){return 1.-smoothstep(-foliageAA,foliageAA,d);}
// Integrate a finite strip across one projected pixel. Unlike an SDF edge alone,
// this preserves coverage when a stem or leaflet becomes narrower than a pixel.
float foliageBand(float center,float halfWidth,float aa){
  return clamp((center+halfWidth+aa)/(2.*aa),0.,1.)-clamp((center-halfWidth+aa)/(2.*aa),0.,1.);
}
float foliageSpan(float value,float lo,float hi,float aa){return foliageBand(value-(lo+hi)*.5,(hi-lo)*.5,aa);}
void foliagePaint(inout vec3 c,inout float alpha,vec3 pigment,float mask){
  float a=mask+alpha*(1.-mask);
  c=(pigment*mask+c*alpha*(1.-mask))/max(a,.00001);alpha=a;
}
float line2(vec2 p,vec2 a,vec2 b){vec2 q=p-a,v=b-a;return length(q-v*clamp(dot(q,v)/dot(v,v),0.,1.));}
float leaf2(vec2 p,vec2 a,vec2 b,float width){
  vec2 axis=b-a,q=p-a;float t=dot(q,axis)/dot(axis,axis);
  float crossD=abs(q.x*axis.y-q.y*axis.x)/length(axis);
  return foliageBand(crossD,width*sin(3.14159*clamp(t,0.,1.)),foliageAA)*foliageSpan(t*length(axis),0.,length(axis),foliageAA);
}
vec4 tropicalTree(vec2 p,float h,float side){
  vec3 c=vec3(0.);float alpha=0.;
  float H=6.5+h*4.,bend=-side*(.5+h*1.4);
  float yf=clamp(p.y/H,0.,1.),tx=bend*yf*yf;
  float trunkW=.22-.09*yf;
  float trunk=foliageBand(p.x-tx,trunkW,foliageAA)*foliageSpan(p.y,0.,H,foliageAA);
  float trunkDetail=1.-smoothstep(.35,1.4,foliageAA*15.);
  if(trunk>.001){
    float ring=cos(p.y*16.+sin(p.y*3.5)*.4)*trunkDetail;
    float cyl=clamp((p.x-tx)/max(trunkW,.01),-1.,1.);
    vec3 bark=mix(vec3(.24,.15,.08),vec3(.38,.26,.14),.5+.3*ring+.25*cyl);
    foliagePaint(c,alpha,bark,trunk);
  }
  // Occasional trunk epiphyte / bromeliad rosette clinging halfway up the curved palm trunk
  if(h>.28&&h<.68&&abs(p.y-H*.52)<.85){
    vec2 ep=p-vec2(tx+side*.08,H*.52);
    for(int k=0;k<4;k++){
      float ang=(float(k)-1.5)*.55+side*.25;
      float eLeaf=leaf2(ep,vec2(0.),vec2(sin(ang)*.52,cos(ang)*.46),.09);
      if(eLeaf>.001)foliagePaint(c,alpha,mix(vec3(.08,.26,.07),vec3(.24,.42,.11),float(k)/3.),eLeaf);
    }
    float bract=leaf2(ep,vec2(0.,.05),vec2(side*.22,.48),.07);
    if(bract>.001)foliagePaint(c,alpha,vec3(.78,.16,.22),bract);
  }
  vec2 crown=vec2(bend,H);
  if(h<.78){
    // Soft sunlit inner canopy behind the crisp outer fronds so sky gaps between
    // drooping frond layers do not strobe like venetian blinds at high speed.
    vec2 cq=(p-crown-vec2(0.,-.22))/vec2(2.7+h*.5,1.55+h*.25);
    float innerHalo= clamp(1.-length(cq),0.,1.);
    innerHalo=smoothstep(0.,.65,innerHalo)*.82;
    if(innerHalo>.001)foliagePaint(c,alpha,mix(vec3(.09,.24,.07),vec3(.19,.37,.11),clamp(.5+.35*cq.y+.2*cq.x*side,0.,1.)),innerHalo);
    // Six drooping pinnate fronds plus an upright spear. Curved rachises and
    // alternating narrow leaflets give palms an unmistakable open silhouette.
    for(int f=0;f<6;f++){
      float sideF=f<3?-1.:1.,layer=mod(float(f),3.);
      float span=3.+layer*.55+h*.65,t=(p.x-crown.x)*sideF/span;
      if(t< -foliageAA/span||t>1.+foliageAA/span)continue;
      float tc=clamp(t,0.,1.);
      float axisY=H+(2.-layer*.62)*tc-(2.25+layer*.38)*tc*tc;
      // Leaflet notches converge to their mean coverage once unresolved instead
      // of alternately appearing and disappearing as a subpixel frond moves.
      float resolved=1.-smoothstep(.35,1.4,foliageAA*38./span);
      float leafWidth=(.13+.30*sin(tc*3.14159))*mix(.82,.48+.52*abs(sin(tc*38.+h*4.)),resolved);
      float slope=((2.-layer*.62)-2.*(2.25+layer*.38)*tc)/span;
      float normalScale=inversesqrt(1.+slope*slope);
      float frond=foliageBand((p.y-axisY)*normalScale,leafWidth*normalScale,foliageAA)*foliageSpan(t*span,0.,span,foliageAA);
      float rachis=foliageBand((p.y-axisY)*normalScale,.028*normalScale,foliageAA)*foliageSpan(t*span,0.,span*.92,foliageAA);
      if(frond>.001){
        vec3 fCol=mix(vec3(.06,.20,.065),vec3(.18,.38,.105),.35+.35*sideF+.16*layer)*(.9+.12*cos(tc*38.)*resolved);
        foliagePaint(c,alpha,fCol,frond);
      }
      if(rachis>.001)foliagePaint(c,alpha,vec3(.24,.36,.12),rachis*.7);
    }
    float spear=leaf2(p,crown,crown+vec2(.4*side,2.3),.18);
    if(spear>.001)foliagePaint(c,alpha,vec3(.16,.37,.11),spear);
    // Clustered coconuts nestled beneath the crown
    for(int cn=0;cn<3;cn++){
      vec2 cPos=crown+vec2((float(cn)-1.)*.18+.06*side,-.18-abs(float(cn)-1.)*.09);
      vec2 cd=(p-cPos)/vec2(.16,.14);
      float nut=1.-smoothstep(.85,1.+.8*foliageAA,length(cd));
      if(nut>.001)foliagePaint(c,alpha,vec3(.26,.17,.07)*(1.1-.35*cd.y+.2*cd.x),nut);
    }
  }else{
    // Broad, overlapping leaves form a lower, rounded tropical canopy (banana / traveler's palm).
    for(int f=0;f<9;f++){
      float angle=float(f)*2.4+h*8.;
      vec2 base=crown+vec2(sin(angle)*.35,cos(angle)*.25-.65);
      vec2 tip=base+vec2(sin(angle)*2.25,cos(angle)*1.45+.35);
      float leaf=leaf2(p,base,tip,.72);
      if(leaf>.001){
        float vein=1.-smoothstep(.012,.045,line2(p,base,tip));
        float ribs=.94+.06*cos(dot(p-base,normalize(tip-base))*18.)*(1.-smoothstep(.25,1.,foliageAA*12.));
        foliagePaint(c,alpha,(mix(vec3(.06,.23,.075),vec3(.17,.36,.095),fract(float(f)*.37+h))+vec3(.06,.08,.015)*vein)*ribs,leaf);
      }
    }
    // Pendulous crimson banana-flower bract hanging below the broad leaves
    float bract=leaf2(p,crown+vec2(side*.25,-.55),crown+vec2(side*.42,-1.35),.16);
    if(bract>.001)foliagePaint(c,alpha,vec3(.52,.09,.18),bract);
  }
  return vec4(c,alpha);
}
vec4 tropicalBorder(vec2 p,float h,float sight){
  vec3 c=vec3(0.);float alpha=0.;
  // Ferns and colorful cordyline-like leaves grow in layered clumps.
  if(h<.78)for(int f=0;f<7;f++){
    float a=(float(f)-3.)*.4;
    vec2 base=vec2(-.75,0.),tip=base+vec2(sin(a)*1.45,cos(a)*(1.25+.25*h));
    float leaf=leaf2(p,base,tip,.2);
    float t=dot(p-base,tip-base)/dot(tip-base,tip-base);
    float phaseAA=foliageAA*27./length(tip-base);
    float resolved=1.-smoothstep(.35,1.4,phaseAA);
    leaf*=mix(.85879,smoothstep(.22-phaseAA,.22+phaseAA,abs(sin(t*27.))),resolved);
    if(leaf>.001)foliagePaint(c,alpha,mix(vec3(.045,.22,.085),vec3(.15,.36,.105),float(f)/7.),leaf);
  }
  // Broad heart-shaped monstera / elephant-ear understory leaves with fenestration notches
  if(h>.32&&h<.82)for(int m=0;m<3;m++){
    float mx=-.15+float(m)*.38,my=.38+float(m)*.16;
    vec2 mBase=vec2(mx,0.),mTip=vec2(mx+(float(m)-1.)*.26,my+.62);
    float stemM=foliageBand(line2(p,mBase,mTip),.016,foliageAA);
    if(stemM>.001)foliagePaint(c,alpha,vec3(.07,.24,.07),stemM);
    float mLeaf=leaf2(p,mBase+vec2(0.,.18),mTip,.34);
    if(mLeaf>.001){
      float notch=smoothstep(.04,.09,abs(sin((p.y-my)*16.))+abs(p.x-mx)*1.8);
      float vein=1.-smoothstep(.01,.035,line2(p,mBase+vec2(0.,.18),mTip));
      foliagePaint(c,alpha,mix(vec3(.04,.20,.07),vec3(.13,.33,.10),float(m)*.4)+vec3(.05,.08,.02)*vein,mLeaf*mix(.85,1.,notch));
    }
  }
  if(h>.2&&h<.72)for(int f=0;f<5;f++){
    vec2 base=vec2(.7,0.),tip=base+vec2((float(f)-2.)*.42,1.1+.3*sin(float(f)+h));
    float leaf=leaf2(p,base,tip,.22);
    if(leaf>.001)foliagePaint(c,alpha,mix(vec3(.28,.055,.095),vec3(.48,.14,.18),float(f)/5.),leaf);
  }
  if(h<.3){
    // Upright heliconia stems with alternating boat-shaped orange/red bracts.
    for(int stem=0;stem<2;stem++){
      float sx=-.13+float(stem)*.48,top=1.45+float(stem)*.3;
      if(line2(p,vec2(sx,.05),vec2(sx,top))<.025){alpha=1.;c=vec3(.08,.23,.065);}
      for(int k=0;k<4;k++){
        float sideK=mod(float(k+stem),2.)*2.-1.,by=.55+float(k)*.23+float(stem)*.1;
        vec2 base=vec2(sx,by),tip=base+vec2(sideK*.5,.21);
        if(leaf2(p,base,tip,.13)>.5){alpha=1.;c=mix(vec3(.65,.055,.03),vec3(.95,.27,.035),float(k)/4.);}
      }
    }
  }else if(h>.62&&h<.9){
    // Recognizable five-petalled flowers in pink and purple roadside clusters.
    for(int fl=0;fl<5;fl++){
      vec2 center=vec2((float(fl)-2.)*.28,.65+.42*sin(float(fl)*1.4+h));
      if(line2(p,vec2(center.x*.7,0.),center)<.018){alpha=1.;c=vec3(.05,.2,.055);}
      for(int petal=0;petal<5;petal++){
        float a=float(petal)*1.2566;vec2 d=p-center-vec2(sin(a),cos(a))*.105;
        if(length(d/vec2(.095,.095))<1.){alpha=1.;c=mix(vec3(.47,.07,.31),vec3(.68,.19,.44),h);}
      }
      if(length(p-center)<.04){alpha=1.;c=vec3(.95,.63,.11);}
    }
  }
  // Iridescent Blue Morpho butterfly resting on sunlit foliage
  if(sight>.42&&sight<.54){
    vec2 bp=p-vec2(-.28,1.18+.15*sin(h*19.));
    vec2 wL=vec2(abs(bp.x),bp.y);
    float fore=1.-smoothstep(.88,1.+foliageAA*4.,length((wL-vec2(.13,.06))/vec2(.15,.11)));
    float hind=1.-smoothstep(.88,1.+foliageAA*4.,length((wL-vec2(.10,-.05))/vec2(.12,.09)));
    float wing=max(fore,hind);
    if(wing>.001){
      float rim=smoothstep(.10,.15,length(wL-vec2(.11,.01)));
      vec3 morpho=mix(vec3(.07,.52,.96),vec3(.02,.04,.06),rim);
      foliagePaint(c,alpha,morpho,wing);
    }
  }
  // Occasional toucan-like bird, resting on a woody branch above the flowers.
  if(sight<.055){
    vec2 perch=vec2(.25,1.9);
    if(line2(p,vec2(.8,.1),perch+vec2(.35,-.08))<.045||line2(p,perch-vec2(.1,.1),perch+vec2(.55,-.1))<.035){alpha=1.;c=vec3(.22,.13,.07);}
    vec2 q=p-perch;
    float bird=step(length((q-vec2(0.,.22))/vec2(.24,.3)),1.);
    bird=max(bird,leaf2(q,vec2(-.04,.08),vec2(-.34,-.28),.085));
    if(bird>.5){alpha=1.;c=vec3(.025,.055,.085);}
    if(length((q-vec2(.12,.47))/vec2(.16,.17))<1.){alpha=1.;c=vec3(.035,.07,.08);}
    if(length((q-vec2(.1,.3))/vec2(.1,.13))<1.){alpha=1.;c=vec3(.9,.72,.23);}
    if(leaf2(q,vec2(.2,.5),vec2(.68,.42),.13)>.5){alpha=1.;c=vec3(.94,.36,.035);}
    if(length(q-vec2(.17,.5))<.025){alpha=1.;c=vec3(.005);}
  }
  // A small lizard rests on a low rock, off the riding surface.
  if(sight>.94){
    vec2 q=p-vec2(.2,.24);
    if(length((p-vec2(.15,.09))/vec2(.72,.22))<1.){alpha=1.;c=vec3(.26,.23,.17);}
    float liz=step(length(q/vec2(.27,.09)),1.);
    liz=max(liz,step(length((q-vec2(.29,.03))/vec2(.1,.075)),1.));
    float tailY=.04*sin((q.x+.27)*7.);
    liz=max(liz,step(-.85,q.x)*step(q.x,-.18)*step(abs(q.y-tailY),.035*(q.x+.9)/.72));
    for(int leg=0;leg<4;leg++){
      float sideL=mod(float(leg),2.)*2.-1.,lx=leg<2?-.13:.14;
      liz=max(liz,step(line2(q,vec2(lx,0.),vec2(lx-.08,sideL*.19)),.025));
    }
    if(liz>.5){alpha=1.;c=vec3(.15,.27,.08)*(1.+.18*sin(q.x*31.));}
  }
  return vec4(c,alpha);
}

// Small, non-emissive roadside details. p is metres from a roadside ground point:
// x across the path, y up. h is the existing stable per-row random number in [0,1].
// Call AFTER the row's depth/terrain rejection, only within abs(p.x)<1.5 and -.16<p.y<1.35.
// Returns straight RGB + coverage; multiply RGB by the scene's existing lighting/fog.
// Fixed upper bound: three stems, five petals each, one small animal. No texture reads.
float epHash(float v){return fract(sin(v*127.13+3.7)*43758.5453);}
float epCross(vec2 a,vec2 b){return a.x*b.y-a.y*b.x;}
float epLine(vec2 p,vec2 a,vec2 b,float width,float aa){
  vec2 ab=b-a;float q=clamp(dot(p-a,ab)/max(dot(ab,ab),.00001),0.,1.);
  return foliageBand(length(p-a-ab*q),width,aa);
}
float epOval(vec2 p,vec2 r,float aa){
  float d=(length(p/r)-1.)*min(r.x,r.y);
  return (1.-smoothstep(-aa,aa,d))*min(1.,min(r.x,r.y)/aa);
}
float epTriangle(vec2 p,vec2 a,vec2 b,vec2 c,float aa){
  vec2 e0=b-a,e1=c-b,e2=a-c;float side=sign(epCross(e0,c-a));
  float d=min(side*epCross(e0,p-a)/length(e0),min(side*epCross(e1,p-b)/length(e1),side*epCross(e2,p-c)/length(e2)));
  return smoothstep(-aa,aa,d);
}
vec4 epPaint(vec4 base,vec3 pigment,float mask){
  float m=clamp(mask,0.,1.),a=m+base.a*(1.-m);
  return vec4((pigment*m+base.rgb*base.a*(1.-m))/max(a,.00001),a);
}
// A lance-shaped leaf or petal: pointed at both ends, widest halfway along its length.
float epLance(vec2 p,vec2 root,vec2 tip,float width,float aa){
  vec2 d=tip-root;float len=length(d);d/=max(len,.0001);
  vec2 q=vec2(epCross(d,p-root),dot(d,p-root));
  float w=width*sin(3.14159265*clamp(q.y/len,0.,1.));
  return foliageBand(q.x,w,aa)*foliageSpan(q.y,0.,len,aa);
}
vec4 seasonalPlants(vec2 p,float h,float coast,float meadow,float alpine,float canyon){
  vec4 outp=vec4(0.);
  float floral=clamp(coast*.8+meadow+alpine*.75,0.,1.);
  if(abs(p.x)>1.5||p.y<-.16||p.y>1.35||floral+canyon<.002)return outp;
  float aa=foliageAA;
  vec3 stem=vec3(.085,.15,.035);
  // Coastal dune grass blades & golden seed plumes along the cliffside shoulder
  if(coast>.002&&h<.76){
    for(int g=0;g<4;g++){
      float gx=-.55+float(g)*.34+(h-.5)*.2;
      float arch=(float(g)-1.5)*.28;
      vec2 gFoot=vec2(gx,0.),gTip=vec2(gx+arch,.52+.18*sin(float(g)*2.+h*7.));
      outp=epPaint(outp,mix(vec3(.18,.27,.11),vec3(.44,.41,.21),float(g)/3.),epLance(p,gFoot,gTip,.022,aa)*coast);
      outp=epPaint(outp,vec3(.58,.50,.28),epLance(p,gTip-vec2(arch*.2,.1),gTip+vec2(arch*.15,.11),.032,aa)*coast);
    }
  }
  // Fallen autumn leaf scatter & lakeside cattails/reeds in Autumn Lake
  if(alpine>.002){
    for(int lf=0;lf<4;lf++){
      float lx=-.85+float(lf)*.52+sin(h*31.+float(lf)*4.)*.18;
      float ly=.02+.03*fract(h*13.+float(lf)*.37);
      vec3 lCol=lf==0?vec3(.48,.07,.03):lf==1?vec3(.56,.21,.03):vec3(.52,.36,.05);
      outp=epPaint(outp,lCol,epOval(p-vec2(lx,ly),vec2(.065,.026),aa)*alpine);
    }
    if(h<.54){
      for(int r=0;r<2;r++){
        float rx=-.35+float(r)*.46;
        vec2 rBase=vec2(rx,0.),rTop=vec2(rx+(float(r)-.5)*.08,.78+.15*h);
        outp=epPaint(outp,vec3(.14,.22,.07),epLine(p,rBase,rTop,.011,aa)*alpine);
        outp=epPaint(outp,vec3(.24,.12,.05),epLine(p,rTop-vec2(0.,.22),rTop-vec2(0.,.06),.032,aa)*alpine);
      }
    }
  }
  if(floral>.002&&h>.18){
    for(int i=0;i<3;i++){
      float v=epHash(h*81.+float(i)*7.3),x=-.72+float(i)*.61+(v-.5)*.18;
      float tall=(.38+v*.4)*(1.-alpine*.35),lean=(v-.5)*.26;
      vec2 foot=vec2(x,0.),tip=vec2(x+lean,tall);
      outp=epPaint(outp,stem,epLine(p,foot,tip,.012,aa)*floral);
      vec2 leaf=foot+(tip-foot)*.35;
      outp=epPaint(outp,stem*1.12,epLance(p,leaf,leaf+vec2(-.17,.13),.034,aa)*floral);
      leaf=foot+(tip-foot)*.57;
      outp=epPaint(outp,stem*.9,epLance(p,leaf,leaf+vec2(.15,.12),.028,aa)*floral);
      vec3 flower=v<.34?vec3(.62,.36,.055):v<.68?vec3(.42,.075,.19):vec3(.28,.09,.36);
      // Alpine patches are mostly violet and butter yellow; coastal flowers include pink thrift.
      if(alpine>.5)flower=v<.52?vec3(.31,.12,.38):vec3(.61,.39,.075);
      float size=.105+v*.035;
      for(int k=0;k<5;k++){
        float angle=float(k)*1.256637+v*3.;vec2 dir=vec2(cos(angle),sin(angle));
        outp=epPaint(outp,flower,epLance(p,tip,tip+dir*size,.038,aa)*floral);
      }
      outp=epPaint(outp,vec3(.35,.20,.035),epOval(p-tip,vec2(.025),aa)*floral);
    }
  }
  // Spiky blue-agave / yucca rosette in Red Canyon
  if(canyon>.002&&h<.52){
    vec2 agBase=vec2(.32-(h-.25)*.8,.02);
    for(int s=0;s<7;s++){
      float ang=-1.15+float(s)*.38;
      vec2 sTip=agBase+vec2(sin(ang)*.46,cos(ang)*.42);
      outp=epPaint(outp,mix(vec3(.11,.24,.18),vec3(.22,.36,.27),float(s)/6.),epLance(p,agBase,sTip,.042,aa)*canyon);
    }
  }
  // A low prickly pear complements the tall canyon saguaros; blooms are small and seasonal.
  if(canyon>.002&&h>.36&&h<.86){
    float x=-.25+(h-.5)*.7;
    float pad=epOval(p-vec2(x,.24),vec2(.15,.25),aa);
    pad=max(pad,epOval(p-vec2(x-.15,.43),vec2(.12,.19),aa));
    pad=max(pad,epOval(p-vec2(x+.17,.34),vec2(.13,.18),aa));
    outp=epPaint(outp,vec3(.12,.22,.115),pad*canyon);
    outp=epPaint(outp,vec3(.065,.115,.055),epLine(p,vec2(x,.05),vec2(x,.44),.007,aa)*canyon);
    vec2 top=vec2(x-.15,.62);
    for(int k=0;k<5;k++){
      float angle=.2+float(k)*.68;vec2 dir=vec2(cos(angle),sin(angle));
      outp=epPaint(outp,vec3(.64,.22,.075),epLance(p,top,top+dir*.085,.024,aa)*canyon);
    }
  }
  float birdWeight=coast*step(.91,h)+meadow*step(.88,h)+alpine*step(.955,h);
  if(birdWeight>.002){
    // Ground/perched bird: two fine legs, pointed tail and beak, layered wing, separate head.
    vec2 b=p-vec2(.38,.13);b.x*=h>.96?-1.:1.;
    float scale=1.+coast*.3;b/=scale;
    vec3 feather=mix(vec3(.23,.145,.085),vec3(.49,.52,.49),coast);
    feather=mix(feather,vec3(.24,.255,.24),alpine);
    outp=epPaint(outp,vec3(.18,.11,.045),max(epLine(b,vec2(-.055,.07),vec2(-.065,-.1),.011,aa),epLine(b,vec2(.035,.07),vec2(.055,-.1),.011,aa))*birdWeight);
    outp=epPaint(outp,feather*.65,epTriangle(b,vec2(-.12,.15),vec2(-.39,.26),vec2(-.19,.035),aa)*birdWeight);
    outp=epPaint(outp,feather,epOval(b-vec2(0.,.18),vec2(.21,.135),aa)*birdWeight);
    outp=epPaint(outp,feather*.64,epLance(b,vec2(.09,.22),vec2(-.21,.12),.07,aa)*birdWeight);
    outp=epPaint(outp,mix(vec3(.38,.105,.04),feather,coast+alpine),epOval(b-vec2(.12,.16),vec2(.075,.09),aa)*birdWeight);
    outp=epPaint(outp,feather*1.05,epOval(b-vec2(.17,.32),vec2(.09,.085),aa)*birdWeight);
    outp=epPaint(outp,vec3(.33,.22,.055),epTriangle(b,vec2(.235,.345),vec2(.36,.31),vec2(.23,.29),aa)*birdWeight);
    outp=epPaint(outp,vec3(.012,.016,.01),epOval(b-vec2(.20,.34),vec2(.012),aa)*birdWeight);
  }
  if(canyon>.002&&h>.91){
    // A small desert lizard on a sun-warmed rock, with tapered tail and four angular legs.
    vec2 b=p-vec2(.15,.11);b.x*=h>.96?-1.:1.;
    outp=epPaint(outp,vec3(.30,.21,.13),epOval(b-vec2(0.,-.06),vec2(.53,.18),aa)*canyon);
    vec3 skin=vec3(.29,.27,.11);
    for(int k=0;k<2;k++){
      float side=k==0?-1.:1.;
      float legs=epLine(b,vec2(-.11,.04),vec2(-.21,.04+side*.13),.015,aa);
      legs=max(legs,epLine(b,vec2(-.21,.04+side*.13),vec2(-.29,.02+side*.15),.012,aa));
      legs=max(legs,epLine(b,vec2(.13,.04),vec2(.18,.04+side*.12),.015,aa));
      legs=max(legs,epLine(b,vec2(.18,.04+side*.12),vec2(.28,.02+side*.16),.012,aa));
      outp=epPaint(outp,skin*.8,legs*canyon);
    }
    outp=epPaint(outp,skin,epTriangle(b,vec2(-.16,-.015),vec2(-.65,.10),vec2(-.15,.09),aa)*canyon);
    outp=epPaint(outp,skin,epOval(b-vec2(0.,.04),vec2(.23,.067),aa)*canyon);
    outp=epPaint(outp,skin*1.16,epTriangle(b,vec2(.17,-.015),vec2(.37,.045),vec2(.17,.11),aa)*canyon);
    outp=epPaint(outp,vec3(.11,.12,.045),epLine(b,vec2(-.17,.04),vec2(.24,.055),.012,aa)*canyon);
    outp=epPaint(outp,vec3(.012,.014,.006),epOval(b-vec2(.265,.069),vec2(.011),aa)*canyon);
  }
  return outp;
}

// Dense woodland seen on the hillsides. Each 4.8 m cell grows a small,
// overlapping rounded crown rather than stretching a color ramp over terrain.
// A footprint in surface metres integrates crown edges and fades unresolved
// crowns to their mean pigment before they can shimmer at the horizon.
vec3 autumnCanopy(vec2 p,float footprint){
  const float spacing=4.8;
  vec2 cell=floor(p/spacing);float aa=max(.025,footprint*.65);
  vec3 average=vec3(.185,.095,.031),col=vec3(.065,.061,.022);
  float detail=1.-smoothstep(1.1,4.2,footprint);
  if(detail<.001)return average;
  for(int ix=-1;ix<=1;ix++)for(int iz=-1;iz<=1;iz++){
    vec2 id=cell+vec2(float(ix),float(iz));
    float h=fract(sin(dot(id,vec2(127.1,311.7))+uSeed*3.1)*43758.54);
    float j=fract(sin(dot(id,vec2(269.5,183.3))+uSeed)*17571.31);
    vec2 center=(id+.5+vec2(h-.5,j-.5)*.46)*spacing;
    vec2 q=p-center;float radius=2.35+j*.8,r=length(q);
    float edge=radius*(1.+.055*sin(atan(q.y,q.x)*7.+h*29.)*detail);
    float cover=1.-smoothstep(edge-aa,edge+aa,r);
    if(cover<.001)continue;
    vec3 pigment=h<.24?vec3(.105,.15,.041):h<.49?vec3(.31,.058,.022):h<.78?vec3(.41,.145,.028):vec3(.38,.245,.055);
    vec2 xy=q/max(radius,.01);
    float dome=sqrt(max(0.,1.-min(.98,dot(xy,xy))));
    float light=.48+.52*max(0.,dot(normalize(vec3(xy,dome)),normalize(vec3(-.45,-.55,1.))));
    // Small, low-contrast leaf clusters soften the broad crown's interior.
    float lobes=.96+.04*sin(q.x*3.1+h*17.)*sin(q.y*2.7+j*13.)*detail;
    col=mix(col,pigment*light*lobes,cover*.96);
  }
  return mix(average,col,detail);
}

vec4 autumnTree(vec2 p,float h){
          float scale=.47+h*.3, aa=foliageAA/scale;
          vec2 q=p/scale;float crown=0.;
          for(int leaf=0;leaf<12;leaf++){
            float f=float(leaf),ang=f*2.399+h*3.;
            vec2 center=vec2(cos(ang)*(1.5+.35*sin(f*3.+h)),6.2+sin(ang)*(1.6+.35*cos(f*2.1)));
            crown=max(crown,epOval(q-center,vec2(1.12+h*.35,1.4+h*.3),aa));
          }
          float trunkA=epLine(q,vec2(0.,0.),vec2(.12,6.6),.14,aa);
          trunkA=max(trunkA,epLine(q,vec2(0.,3.7),vec2(-1.7,6.7),.08,aa));
          trunkA=max(trunkA,epLine(q,vec2(0.,4.4),vec2(1.7,7.4),.07,aa));
          trunkA=max(trunkA,epLine(q,vec2(-.45,4.8),vec2(-1.1,7.5),.045,aa));
          // Paper-birch white bark with dark lenticel bands vs dark sugar-maple bark
          float birch=step(.62,h);
          float barkBand=smoothstep(.45,.75,cos(q.y*12.+sin(q.x*6.+h*19.)))*(1.-smoothstep(.35,1.4,aa*8.));
          vec3 barkC=mix(vec3(.12,.09,.065),mix(vec3(.78,.75,.70),vec3(.16,.14,.13),barkBand*.75),birch);
          vec3 leafC=h<.44?vec3(.32,.035,.012):h<.73?vec3(.46,.12,.015):vec3(.44,.28,.025);
          leafC*=.6+.55*fbm2(q*1.1+h*21.)+.18*smoothstep(-3.,3.,q.x);
          // Visible forked upper branches peeking through the lower autumn canopy
          float peek=trunkA*smoothstep(5.4,3.2,q.y);
          return vec4(mix(leafC,barkC,clamp(1.-crown+peek*.65,0.,1.)),max(crown,trunkA));
}

const float SEA=-14.;
float mistyHeight(vec2 p,bool hi){
  float px=pathX(p.y),ry=roadY(p.y),d=abs(p.x-px);
  float t=smoothstep(4.,46.,d);
  vec2 q=p*.0088+uSeed*3.;
  q+=.55*vec2(vn(q*.73+1.3),vn(q*.73+4.1));          // bends the noise lattice out of sight
  float n=hi?fbm4(q):fbm2(q);
  float r=1.-abs(2.*fbm2(q*.63+9.)-1.);
  float m=mix(n,r*r,uRidge);
  float mid=vn(q*4.3+5.3)-.5;
  float h=ry+t*max(0.,m-.27+mid*.16)*uAmp*(1.+d*.0016);
  float far=smoothstep(110.,430.,d);
  if(far>0.){float rr=1.-abs(2.*fbm2(q*.31+2.7)-1.);h+=far*rr*rr*uAmp*1.5;}
  if(uTrees>0.)h+=smoothstep(4.,22.,d)*uTrees*pow(vn(p*.19),3.)*5.;
  if(uSea>0.){float side=smoothstep(7.,70.,p.x-px);h=mix(h,SEA-5.,side*uSea);}
  return h;
}
float mistySurface(vec2 p,bool hi){float h=mistyHeight(p,hi);return uSea>0.?max(h,SEA):h;}
float mistyMarch(vec3 ro,vec3 rd,out float last){
  float t=.8,h=0.;last=0.;
  for(int i=0;i<76;i++){
    vec3 p=ro+rd*t;h=p.y-mistySurface(p.xz,false);
    if(h<.002*t||t>680.)break;
    last=t;t+=max(h*.62,.03+t*.011);
  }
  if(t<680.&&last>0.){float a=last,b=t;for(int i=0;i<7;i++){float m=.5*(a+b);vec3 q=ro+rd*m;if(q.y-mistySurface(q.xz,false)>0.)a=m;else b=m;}t=.5*(a+b);}
  return t;
}
float mistySkyTrail=0.;
vec3 mistyNebula(vec3 rd,float s){
  vec2 p=vec2(atan(rd.x,rd.z)*1.5,rd.y*2.5-1.22);
  float wide=mix(.62,1.12,uWeather);
  float r=length(p*vec2(1.,1.22))/wide;
  float mask=smoothstep(1.3,.1,r);
  if(mask<=0.)return vec3(0.);
  vec2 q=p*2.05+vec2(uT*.011,-uT*.007);
  q+=.95*vec2(fbm2(q*.8+3.1),fbm2(q*.8+7.7))-.47;
  float d=fbm4(q*1.15);
  float wisp=pow(d,2.1)*2.1;
  float core=exp(-r*r*2.4);
  vec3 cool=mix(vec3(.25,.2,.66),vec3(.1,.44,.54),fbm2(q*.7+11.));
  vec3 warm=mix(vec3(.82,.28,.44),vec3(1.,.62,.34),core);
  vec3 c=mix(cool,warm,uWarm*(.3+.7*d));
  return c*wisp*mask*(.2+.82*uWeather)*(.62+core*.62);
}
vec3 mistySky(vec3 rd,vec2 sv){
  float y=max(rd.y,0.);
  vec3 c=mix(uSkyHz,uSkyTop,pow(y,.52));
  float s=max(dot(rd,uSunDir),0.);
  c+=uSunC*(pow(s,380.)*5.+pow(s,26.)*.42+pow(s,5.)*.2);
  // cloud deck
  if(rd.y>.004){
    vec2 cp=rd.xz/(rd.y+.13)*1.25+vec2(uT*.006,uCam.z*.0009);
    float cl=fbm4(cp);
    float cov=smoothstep(.46,.84,cl);
    vec3 cc=mix(uFog*.9,uSunC*1.02,.3+.55*pow(s,3.));
    c=mix(c,cc,cov*.62*smoothstep(.004,.13,rd.y));
  }
  if(uNebula>.002)c+=mistyNebula(rd,s)*uNebula*smoothstep(-.01,.12,rd.y);
  if(uBreathOn>.002)c+=uSunC*pow(s,mix(190.,44.,uBreath))*(.2+.62*uBreath)*uBreathOn;
  if(uHaze>.002){
    float hz=exp(-max(rd.y,0.)*mix(8.,1.7,uHaze));
    c=mix(c,uFog*.82+uSunC*pow(s,9.)*.5,uHaze*hz);
  }
  // stars at dusk, with a steady twinkle
  float dark=uDusk*smoothstep(.02,.26,rd.y);
  if(dark>.01){
    vec3 q=rd*190.;vec3 id=floor(q);vec3 f=fract(q)-.5;
    float h=fract(sin(dot(id,vec3(127.1,311.7,74.7)))*43758.5453);
    if(h>.968){float b=(h-.968)/.032;float tw=.55+.45*sin(uT*(2.+h*6.)+h*900.);
      c+=vec3(.95,.97,1.)*b*b*(tw+uSpark*1.6+uShimmer*1.1*sin(uT*18.+h*400.))*exp(-dot(f,f)*42.)*dark*2.2;}
  }
  // aurora curtains, from the inferred index in Watch
  if(uAurora>.01){
    float az=atan(rd.x,rd.z);
    float cur=pow(fbm2(vec2(az*4.+uT*.25,uT*.09)),3.)*5.;
    float band=smoothstep(.03,.2,rd.y)*smoothstep(.72,.22,rd.y);
    c+=mix(uEdge,vec3(.6,.9,1.),.45)*cur*band*uAurora*1.6;
  }
  // the horizon ridge is the last two minutes of heart rate, newest in the middle
  float u=abs(sv.x);
  float a=texture(uS,vec2(clamp(u,0.,1.),.5)).r;
  float jag=fbm2(vec2(sv.x*9.+uSeed,uT*.03))*.012;
  float top=.006+jag+a*.17;
  float edge=smoothstep(0.,.0028,top-rd.y);
  vec3 ridge=mix(uFog*.42,uSkyTop*.6,.35)+uEdge*a*.5*smoothstep(top-.05,top,rd.y);
  c=mix(c,ridge,edge*smoothstep(-.03,.0,rd.y));
  float ridgeD=abs(rd.y-top);
  c+=uEdge*exp(-pow(ridgeD/.016,1.8))*a*1.35*smoothstep(-.02,.01,rd.y);
  mistySkyTrail=exp(-pow(ridgeD/.022,1.8))*a*.4*smoothstep(-.02,.01,rd.y);
  return c;
}
vec4 mistyWorld(vec3 ro,vec3 rd,vec2 sv){
  mistySkyTrail=0.;
  vec3 skyc=mistySky(rd,sv);
  float trail=0.;
  vec3 col=skyc;
  float last;
  float t=rd.y<.32?mistyMarch(ro,rd,last):1e4;
  if(t<680.){
    vec3 p=ro+rd*t;
    bool water=uSea>0.&&p.y<=SEA+.02;
    float e=.05+t*.0018;
    vec3 N=normalize(vec3(mistySurface(p.xz-vec2(e,0.),true)-mistySurface(p.xz+vec2(e,0.),true),2.*e,mistySurface(p.xz-vec2(0.,e),true)-mistySurface(p.xz+vec2(0.,e),true)));
    float px=pathX(p.z),d=abs(p.x-px),rel=p.y-roadY(p.z);
    float dn=mix(fbm4(p.xz*.075),.5,smoothstep(50.,220.,t));
    vec3 alb=mix(uGround*.75,uGround*1.55,dn);
    float sl=1.-N.y;
    alb=mix(alb,uRock,smoothstep(.1,.42,sl+dn*.14-.07));
    if(uSnow>0.)alb=mix(alb,vec3(.84,.88,.96),uSnow*smoothstep(14.,44.,rel+dn*22.)*smoothstep(.62,.22,sl));
    if(uStrata>0.)alb*=mix(1.,.74+.3*sin(rel*.85+dn*3.5),uStrata);
    if(uGrid>0.){vec2 g=abs(fract(p.xz*.12)-.5);float gl=smoothstep(.47,.5,max(g.x,g.y));alb+=uEdge*gl*.32*uGrid*exp(-t*.012);}
    float dif=clamp(dot(N,uSunDir),0.,1.);
    vec3 amb=mix(uFog*.7,uSkyTop,.5+.5*N.y)*.62;
    vec3 c=alb*(uSunC*dif*1.5+amb);
    float back=clamp(dot(N,normalize(vec3(-uSunDir.x,0.,-uSunDir.z))),0.,1.);
    c+=alb*uSkyHz*back*.12;
    if(water){
      vec3 W=normalize(vec3((vn(p.xz*.3+uT*.5)-.5)*.14,1.,(vn(p.xz*.27-uT*.4)-.5)*.14));
      vec3 rf=reflect(rd,W);
      float keep=mistySkyTrail;c=mix(uFog*.22+uSkyTop*.18,mistySky(vec3(rf.x,abs(rf.y),rf.z),vec2(0.)),.72);mistySkyTrail=keep;
      c+=uSunC*pow(max(dot(rf,uSunDir),0.),190.)*7.;
    }
    // the road
    float aaRoad=max(.18,t/(uRes.y*uFocal));
    float rm=1.-smoothstep(2.25-aaRoad,2.25+aaRoad,d);
    if(!water){
      vec3 asphalt=mix(vec3(.022,.023,.03),uFog*.05,.4)+alb*.04;
      c=mix(c,asphalt*(uSunC*dif*1.2+amb),rm);
    }
    float em=0.;vec3 emC=vec3(0.);
    if(rm>0.){
      float dashL=max(uBeat*.5,1.);
      float df=fract(p.z/dashL);
      float dashAA=max(.02,t/(dashL*uRes.y*uFocal));
      float dash=smoothstep(0.,dashAA,df)*(1.-smoothstep(.5-dashAA,.5,df))*(1.-smoothstep(.05,.1,abs(p.x-px)));
      emC+=uEdge*dash*.045*rm*smoothstep(2.,16.,t);
    }
    if(uGhost.w>0.)emC+=mix(uEdge,vec3(1.),.45)*exp(-dot(p.xz-uGhost.xz,p.xz-uGhost.xz)/9.)*.75*uGhost.w;
    float aaSide=max(.02,t/(uRes.y*uFocal));
    float side=foliageBand(d-2.25,.07,aaSide);
    float spark=pow(vn(vec2(p.z*.3,uT*1.3)),2.5)*1.8*(1.-smoothstep(35.,140.,t));
    emC+=uEdge*side*(.055+uSpark*spark*.03)*smoothstep(2.2,10.,t);
    float fog=1.-exp(-pow(t*uFogK,1.55));
    vec3 fogC=mix(uFog,uSunC,pow(max(dot(rd,uSunDir),0.),7.)*.55)*(1.-uDusk*.55);
    col=mix(c,fogC,fog)+emC*exp(-t*.0085);
    col=mix(col,skyc,smoothstep(590.,680.,t));
    trail=clamp(dot(emC,vec3(.4))*exp(-t*.0085),0.,1.);
  }
  // Layered mountain pines and mossy pass boulders along the Misty Ridges road
  if(rd.z>.02&&uTrees>.01){
    for(int row=14;row>=0;row--){
      float spacing=16.;
      float cell=floor(ro.z/spacing)+float(row)+1.;
      float z=cell*spacing,ot=(z-ro.z)/rd.z;
      if(ot>t||ot>220.||ot<.5)continue;
      vec3 hit=ro+rd*ot;
      float aa=max(.005,ot/(uRes.y*uFocal));
      for(int sideI=0;sideI<2;sideI++){
        float signX=sideI==0?-1.:1.;
        float h=fract(sin(cell*12.71+signX*91.+uSeed)*43758.54);
        float x=pathX(z)+signX*(4.4+h*11.5),dx=hit.x-x;
        if(abs(dx)>3.8)continue;
        float base=mistySurface(vec2(x,z),false),y=hit.y-base;
        if(y<-.2||y>14.)continue;
        float treeH=6.5+h*6.5,treeW=1.5+h*1.2,pine=0.;
        for(int tier=0;tier<4;tier++){
          float by=1.1+float(tier)*treeH*.16,top=by+treeH*.46;
          float rad=treeW*(1.-float(tier)*.16)*clamp((top-y)/(top-by),0.,1.);
          rad*=.88+.12*sin(y*7.+h*23.);
          pine=max(pine,foliageBand(dx,rad,aa)*foliageSpan(y,by,top,aa));
        }
        float trunk=foliageBand(dx,.14,aa)*foliageSpan(y,0.,treeH*.45,aa);
        float boulder=epOval(vec2(dx-(h-.5)*1.4,y-.35),vec2(.85+h*.4,.52+h*.25),aa)*step(.55,h);
        float sil=max(max(pine,trunk),boulder)*smoothstep(220.,140.,ot)*smoothstep(1.2,5.,ot);
        if(sil>.001){
          vec3 treeC=mix(vec3(.04,.07,.06),uGround*(.65+.35*step(0.,dx*signX)),pine);
          treeC=mix(treeC,uRock*.85,boulder);
          float fog=1.-exp(-pow(ot*uFogK,1.55));
          vec3 fogC=mix(uFog,uSunC,pow(max(dot(rd,uSunDir),0.),7.)*.55)*(1.-uDusk*.55);
          vec3 lit=treeC*(uSunC*.55+uFog*.55)*(1.-uDusk*.55);
          col=mix(col,mix(lit,fogC,clamp(fog+.18,0.,1.)),sil*.88);
        }
      }
    }
  }
  if(uGhost.w>0.){
    vec3 og=uGhost.xyz-ro;float b=dot(og,rd);
    if(b>0.&&b<t){float dg=length(og-rd*b)/(1.+b*.006);float gg=exp(-dg*dg*2.6)*uGhost.w;col+=mix(uEdge,vec3(1.),.55)*gg*2.2;trail=max(trail,gg*.8);}
  }
  // alpha marks what may leave a trail: emitters and the spectrum ridge, never the sun or the sky
  return vec4(col,max(trail,mistySkyTrail));
}

float height(vec2 p,bool hi){
  float px=pathX(p.y),ry=roadY(p.y),dx=p.x-px,d=abs(dx);
  float shoulder=smoothstep(uWidth+.35,uWidth+3.,d);
  vec2 q=p*.0088+uSeed*3.;
  float n=fbm2(q),h=0.;
  // Distinct landforms; uniform branches skip the inactive worlds on the GPU.
  if(uCoast>.001){
    float coast=ry+shoulder*(4.+n*16.)*smoothstep(2.,60.,-dx);
    coast=mix(coast,SEA-5.,smoothstep(5.,21.,dx));
    vec2 stack=vec2(dx-58.,mod(p.y+uSeed*17.,135.)-67.5);
    vec2 stack2=vec2(dx-38.,mod(p.y+uSeed*17.+52.,135.)-67.5);
    coast=max(coast,SEA-4.+26.*(1.-smoothstep(7.,15.,length(stack))));
    coast=max(coast,SEA-4.+16.*(1.-smoothstep(4.5,10.5,length(stack2))));
    h+=coast*uCoast;
  }
  if(uForest>.001)h+=(ry+shoulder*(.2+n*.9)+smoothstep(35.,150.,d)*n*6.)*uForest;
  if(uMeadow>.001)h+=(ry+shoulder*(n-.35)*5.+smoothstep(20.,180.,d)*n*14.)*uMeadow;
  if(uAlpine>.001){
    // A left-hand lake and a close right-hand bluff, with wooded hills beyond.
    float bluff=smoothstep(14.+n*4.,42.+n*9.,dx)*(24.+n*32.);
    float farHill=smoothstep(65.,160.,d)*(12.+fbm2(q*.8+3.)*28.);
    float shore=ry+shoulder*.85+bluff+farHill;
    float lake=smoothstep(5.,18.,-dx)*(1.-smoothstep(235.,285.,-dx));
    float canopy=smoothstep(6.,15.,d)*(1.-lake)*pow(vn(p*.16),2.)*2.5;
    h+=(mix(shore,SEA-7.,lake)+canopy)*uAlpine;
  }
  if(uCanyon>.001){
    float wall=smoothstep(12.+n*12.,23.+n*16.,d);
    h+=(ry+shoulder*1.2+wall*(22.+floor(n*5.)*7.))*uCanyon;
  }
  if(uTron>.001){
    float gridMesa=smoothstep(uWidth+3.,uWidth+16.,d)*(floor(n*5.)*3.5);
    float cyberPeak=smoothstep(uWidth+14.,uWidth+58.,d)*(14.+abs(2.*vn(q*2.2)-1.)*28.+floor(n*6.)*4.5);
    h+=(ry+gridMesa+cyberPeak)*uTron;
  }
  if(uMisty>.001)h+=mistyHeight(p,hi)*uMisty;
  // Land weights sum to 1-uOrbit during a space transition; preserve the
  // full shared route elevation so the temporary ground stays under the camera.
  return h+ry*(uOrbit+uSnake);
}
float surface(vec2 p,bool hi){float h=height(p,hi);return mix(h,max(h,SEA),uSea);}
float march(vec3 ro,vec3 rd,out float last){
  float t=.8,h=0.;last=0.;bool found=false;
  for(int i=0;i<140;i++){
    vec3 p=ro+rd*t;h=p.y-surface(p.xz,false);
    if(h<.002*t){found=true;break;}
    if(t>680.)break;
    last=t;t+=max(.3,t*.045);
  }
  if(!found)return 1e4;
  if(t<680.&&last>0.){float a=last,b=t;for(int i=0;i<7;i++){float m=.5*(a+b);vec3 q=ro+rd*m;if(q.y-surface(q.xz,false)>0.)a=m;else b=m;}t=.5*(a+b);}
  return t;
}
float skyTrail=0.;
vec3 sky(vec3 rd,vec2 sv){
  float y=max(rd.y,0.);
  vec3 c=mix(uSkyHz,uSkyTop,pow(y,.52));
  float s=max(dot(rd,uSunDir),0.);
  c+=uSunC*(pow(s,950.)*2.5*(1.-uTron*.55)+pow(s,56.)*.15);
  if(uTron>.001){
    // Digital Vault sky dome wireframe, I/O Tower vertical light beam, and synth-scanline solar disk
    float domeLong=foliageBand(abs(fract(atan(rd.x,rd.z)*4.45)-.5)-.5,.012,.025)*smoothstep(.04,.55,rd.y);
    float domeLat=foliageBand(abs(fract(rd.y*9.)-.5)-.5,.012,.025)*smoothstep(.04,.45,rd.y);
    c+=vec3(0.,.45,.75)*(domeLong+domeLat)*.14*uTron;
    float ioBeam=exp(-pow(sv.x/.012,2.))*smoothstep(-.02,.65,rd.y)+.32*exp(-pow(sv.x/.085,2.))*smoothstep(-.02,.38,rd.y);
    c+=mix(vec3(0.,.82,1.),vec3(.75,.96,1.),exp(-pow(sv.x/.006,2.)))*ioBeam*.75*uTron;
    float sunDisk=smoothstep(.9962,.9976,s);
    float scanline=.55+.45*smoothstep(-.2,.2,sin(rd.y*240.));
    c+=mix(vec3(1.,.36,.04),vec3(0.,.88,1.),clamp((rd.y-.04)*12.,0.,1.))*sunDisk*scanline*1.35*uTron;
  }
  // cloud deck
  if(rd.y>.004){
    vec2 cp=rd.xz/(rd.y+.13)*1.25+vec2(uT*.006,uCam.z*.0009);
    float cl=fbm4(cp);
    float cov=smoothstep(.57,.88,cl)*(1.-uTron*.85);
    vec3 cc=mix(uFog*.9,uSunC*1.02,.3+.55*pow(s,3.));
    c=mix(c,cc,cov*.62*smoothstep(.004,.13,rd.y));
  }
  if(uNebula>.002)c+=mistyNebula(rd,s)*uNebula*smoothstep(-.01,.12,rd.y);
  if(uBreathOn>.002)c+=uSunC*pow(s,mix(190.,44.,uBreath))*(.2+.62*uBreath)*uBreathOn;
  if(uHaze>.002){float hz=exp(-max(rd.y,0.)*mix(8.,1.7,uHaze));c=mix(c,uFog*.82+uSunC*pow(s,9.)*.5,uHaze*hz);}
  if(uAurora>.01){float az=atan(rd.x,rd.z);float cur=pow(fbm2(vec2(az*4.+uT*.25,uT*.09)),3.)*5.;float band=smoothstep(.03,.2,rd.y)*smoothstep(.72,.22,rd.y);c+=mix(uEdge,vec3(.6,.9,1.),.45)*cur*band*uAurora*1.6;}
  // stars at dusk
  float dark=uDusk*smoothstep(.02,.26,rd.y);
  if(dark>.01){
    vec3 q=rd*190.;vec3 id=floor(q);vec3 f=fract(q)-.5;
    float h=fract(sin(dot(id,vec3(127.1,311.7,74.7)))*43758.5453);
    if(h>.968){float b=(h-.968)/.032;float tw=.55+.45*sin(uT*(2.+h*6.)+h*900.);
      c+=vec3(.95,.97,1.)*b*b*(tw+uSpark*1.6)*exp(-dot(f,f)*42.)*dark*2.2;}
  }
  // the far range, drifting past as you ride: low in the middle, high at the edges
  float u=abs(sv.x);
  float a=texture(uS,vec2(clamp(u,0.,1.),.5)).r;
  float jag=fbm2(vec2(sv.x*9.+uSeed,uT*.03))*.012;
  float top=.006+jag+a*.17;
  float edge=smoothstep(0.,.0028,top-rd.y);
  vec3 ridge=mix(uFog*.42,uSkyTop*.6,.35)+uEdge*a*.5*smoothstep(top-.05,top,rd.y);
  c=mix(c,ridge,edge*smoothstep(-.03,.0,rd.y));
  float ridgeD=abs(rd.y-top);
  c+=uEdge*exp(-pow(ridgeD/.016,1.8))*a*1.35*smoothstep(-.02,.01,rd.y);
  skyTrail=exp(-pow(ridgeD/.022,1.8))*a*.22*smoothstep(-.02,.01,rd.y);
  return c;
}
// A sky-fixed star field and original ringed planet. No animated sparkle or
// repeating transverse track stripes: the rainbow runs along the direction of travel.
vec3 orbitSky(vec3 rd){
  vec3 c=mix(vec3(.006,.009,.032),vec3(.018,.013,.055),.5+.5*rd.y);
  vec2 cloud=vec2(rd.x*3.2+rd.z*.8,rd.y*3.4+rd.z*.3)+uSeed*.17;
  float mist=fbm4(cloud+4.2), dust=fbm2(cloud*1.8-2.);
  float band=exp(-pow((rd.y-.18-rd.x*.22)*3.2,2.));
  c+=mix(vec3(.014,.025,.07),vec3(.065,.013,.065),dust)*band*smoothstep(.26,.78,mist);
  vec2 uv=vec2(atan(rd.x,rd.z),asin(clamp(rd.y,-1.,1.)))*vec2(62.,55.);
  vec2 cell=floor(uv),f=fract(uv)-.5;
  float h=fract(sin(dot(cell,vec2(127.1,311.7))+uSeed)*43758.54);
  if(h>.92){
    float radius=.025+.055*fract(h*91.);
    float aa=max(.025,70./uRes.y);
    float star=(1.-smoothstep(radius-aa,radius+aa,length(f)))*min(1.,radius*radius/(aa*aa));
    c+=mix(vec3(.3,.46,.7),vec3(.7,.53,.3),fract(h*33.))*star*.7;
  }
  vec3 center=normalize(vec3(.64,.34,1.));
  vec3 pr=normalize(cross(vec3(0.,1.,0.),center)),pu=cross(center,pr);
  float face=dot(rd,center);
  if(face>0.){
    vec2 q=vec2(dot(rd,pr),dot(rd,pu))/face;
    vec2 r=mat2(.94,.342,-.342,.94)*q;
    float aa=2./uRes.y,rad=length(vec2(r.x,r.y/.26));
    float ring=smoothstep(.25-aa,.25+aa,rad)*(1.-smoothstep(.42-aa,.42+aa,rad));
    // Crisp Cassini-style ring division and concentric icy ringlet bands
    ring*=1.-.62*foliageBand(rad-.334,.0055,aa);
    vec3 ringC=mix(vec3(.12,.18,.28),vec3(.34,.27,.18),smoothstep(.26,.41,rad));
    ringC*=.78+.22*sin(rad*85.)+.08*cos(rad*210.);
    if(r.y>0.)c=mix(c,ringC,ring*.78);
    float disk=1.-smoothstep(.202-aa,.202+aa,length(q));
    if(disk>0.){
      vec2 p=q/.202;
      vec3 n=vec3(p,sqrt(max(0.,1.-dot(p,p))));
      float light=.22+.78*max(0.,dot(n,normalize(vec3(-.6,.7,.8))));
      float bands=.5+.5*sin(p.y*17.+sin(p.x*3.)*.8);
      vec2 storm=(p-vec2(-.22,-.18))/vec2(.19,.11);
      float eye=exp(-dot(storm,storm)*2.2);
      vec3 planet=mix(vec3(.14,.24,.31),vec3(.48,.31,.2),smoothstep(.3,.75,bands));
      planet=mix(planet,vec3(.62,.34,.22),eye*.65)*light;
      planet+=vec3(.04,.09,.15)*pow(1.-n.z,3.);
      c=mix(c,planet,disk);
    }
    if(r.y<=0.)c=mix(c,ringC,ring*.88);
  }
  vec3 moonDir=normalize(vec3(-.68,.14,1.));
  float md=length(rd-moonDir),maa=2./uRes.y;
  float moon=1.-smoothstep(.052-maa,.052+maa,md);
  if(moon>0.){
    vec2 mq=(rd.xy-moonDir.xy)/.052;
    float mare=smoothstep(.15,.55,fbm2(mq*2.8+4.));
    vec3 mCol=mix(vec3(.14,.20,.29),vec3(.09,.13,.21),mare)*(.58+.42*smoothstep(-.9,.9,mq.x));
    c=mix(c,mCol,moon);
  }
  // Gravitational lens Einstein ring from Autonomic Console's Rest mode
  if(rd.z>0.){
    vec2 lensTh=vec2(rd.x+.06,rd.y-.11);
    float lensR=length(lensTh);
    float einstein=exp(-pow((lensR-.22)/.018,2.));
    float darkCore=smoothstep(.13,.24,lensR);
    vec3 lensC=mix(vec3(.26,.56,1.),vec3(.88,.52,.96),smoothstep(.18,.26,lensR));
    c=c*darkCore+lensC*(einstein*.85+exp(-lensR*lensR*28.)*.5);
  }
  return c;
}
vec3 orbitRainbow(float x){
  float s=clamp(x,0.,.9999)*6.,i=floor(s),f=s-i;
  vec3 a,b;
  if(i<1.){a=vec3(.56,.035,.075);b=vec3(.72,.19,.025);}
  else if(i<2.){a=vec3(.72,.19,.025);b=vec3(.64,.53,.035);}
  else if(i<3.){a=vec3(.64,.53,.035);b=vec3(.035,.36,.13);}
  else if(i<4.){a=vec3(.035,.36,.13);b=vec3(.025,.36,.55);}
  else if(i<5.){a=vec3(.025,.36,.55);b=vec3(.065,.12,.58);}
  else{a=vec3(.065,.12,.58);b=vec3(.37,.065,.49);}
  return mix(a,b,smoothstep(.22,.78,f));
}
// Intersect a finite ribbon, without an infinite ground plane below it. A missed
// crossing continues to the next hill so the track can curve across open space.
float orbitMarch(vec3 ro,vec3 rd){
  float a=.2,ga=ro.y+rd.y*a-roadY(ro.z+rd.z*a);
  for(int i=0;i<120;i++){
    if(a>=680.)break;
    float b=min(680.,a+max(.55,a*.042));
    vec3 p=ro+rd*b;float gb=p.y-roadY(p.z);
    if(ga*gb<=0.){
      float lo=a,hi=b,glo=ga;
      for(int j=0;j<6;j++){
        float m=(lo+hi)*.5;vec3 q=ro+rd*m;float gm=q.y-roadY(q.z);
        if(glo*gm>0.){lo=m;glo=gm;}else hi=m;
      }
      float hit=(lo+hi)*.5;vec3 q=ro+rd*hit;
      if(abs(q.x-pathX(q.z))<uWidth)return hit;
    }
    a=b;ga=gb;
  }
  return 1e4;
}
vec3 orbitWorld(vec3 ro,vec3 rd){
  vec3 space=orbitSky(rd),c=space;
  float t=orbitMarch(ro,rd);
  if(t<680.){
    vec3 p=ro+rd*t;float dx=p.x-pathX(p.z),d=abs(dx);
    float rx=(dx/uWidth+1.)*.5;
    c=orbitRainbow(rx)*(.8+.12*pow(1.-d/uWidth,2.));
    // Longitudinal prismatic lane filaments and crystalline facets along the ribbon
    float aaBand=max(.006,t/(uRes.y*uFocal*uWidth)*3.);
    float laneSeam=foliageBand(abs(fract(rx*6.)-.5)-.485,.014,aaBand)*smoothstep(.08,.22,uWidth-d);
    c+=vec3(.12,.14,.22)*laneSeam*(1.-smoothstep(90.,240.,t));
    float seam=1.-smoothstep(.025,.07,uWidth-d);
    c=mix(c,vec3(.36,.42,.58),seam*.8);
    // A calm continuous edge glow gives the floating road a visible boundary.
    c+=vec3(.055,.09,.15)*exp(-pow((d-uWidth+.14)/.12,2.));
    c=mix(c,space,smoothstep(370.,680.,t));
  }
  if(rd.z>.02 && uLattice>.001){
    // Rest lattice perspective corridor frames: rectangular light strands echoing Autonomic Console's Rest mode
    for(int k=8;k>=0;k--){
      float z=(floor(ro.z/45.)+float(k)+1.)*45.;
      float ot=(z-ro.z)/rd.z;
      if(ot>t||ot>380.||ot<.3)continue;
      vec3 p=ro+rd*ot;vec2 q=vec2(p.x-pathX(z),p.y-(roadY(z)+.8));
      float aa=max(.004,ot/(uRes.y*uFocal));
      vec2 boxW=vec2(uWidth*1.32,2.4);
      vec2 dBox=abs(q)-boxW;
      float frameEdge=max(dBox.x,dBox.y);
      float strand=foliageBand(abs(frameEdge),.035,aa);
      float cornerNode=foliageBand(length(max(dBox,0.)),.07,aa);
      vec3 strandColor=mix(vec3(.22,.55,1.),vec3(.68,.42,.95),fract(z*.008));
      float fade=smoothstep(360.,200.,ot)*smoothstep(.3,2.,ot);
      c+=strandColor*(strand*.8+cornerNode*1.4)*fade*(1.-uDusk*.25);
    }
    // Sparse orbital gantries repeat every 140 m, with open centers and a low
    // blue-metal frame. Their fixed positions give depth without a flashing pattern.
    for(int k=4;k>=0;k--){
      float z=(floor(ro.z/140.)+float(k)+1.)*140.;
      float ot=(z-ro.z)/rd.z;
      if(ot>t||ot>620.||ot<.3)continue;
      vec3 p=ro+rd*ot;vec2 q=vec2(p.x-pathX(z),p.y-roadY(z));
      float aa=max(.004,ot/(uRes.y*uFocal));
      float radius=uWidth+.32;
      float frame=foliageBand(length(q)-radius,.085,aa)*smoothstep(-aa,aa,q.y);
      float inset=foliageBand(length(q)-(radius-.12),.025,aa)*smoothstep(-aa,aa,q.y);
      vec3 arch=mix(vec3(.035,.07,.15),vec3(.16,.24,.4),clamp(q.y/radius,0.,1.));
      c=mix(c,arch,frame*(1.-smoothstep(420.,620.,ot)));
      c=mix(c,vec3(.22,.34,.51),inset*.65*(1.-smoothstep(420.,620.,ot)));
    }
    // Continuous low guardrails are real capsules above the ribbon, so open
    // space is visible between their illuminated tops and the track surface.
    for(int k=0;k<22;k++){
      float za=(floor(ro.z/14.)+float(k))*14.,zb=za+14.;
      for(int side=0;side<2;side++){
        float sg=side==0?-1.:1.;
        vec3 a=vec3(pathX(za)+sg*(uWidth+.08),roadY(za)+.38,za);
        vec3 b=vec3(pathX(zb)+sg*(uWidth+.08),roadY(zb)+.38,zb);
        vec3 ba=b-a,oa=ro-a;
        float bb=dot(ba,ba),br=dot(ba,rd),bo=dot(ba,oa),rr=dot(rd,oa);
        float aa=bb-br*br,ab=bb*rr-bo*br,ac=bb*dot(oa,oa)-bo*bo-.0036*bb;
        float disc=ab*ab-aa*ac;if(disc<0.||aa<.001)continue;
        float rt=(-ab-sqrt(disc))/aa,y=bo+rt*br;
        if(rt<.1||rt>t||y<0.||y>bb)continue;
        c=mix(c,vec3(.19,.27,.42),1.-smoothstep(180.,310.,rt));
      }
    }
  }
  return c*(1.-uDusk*.24);
}


float cloudHeight(vec2 p){
  // Overlapping, differently sized cloud domes. The nine neighboring cells
  // cover boundaries continuously; fixed world positions never boil or flicker.
  vec2 cell=floor(p/32.);float top=-36.;
  for(int ix=-1;ix<=1;ix++)for(int iz=-1;iz<=1;iz++){
    vec2 id=cell+vec2(float(ix),float(iz));
    float h=fract(sin(dot(id,vec2(127.1,311.7))+uSeed)*43758.54);
    vec2 center=(id+.5+vec2(sin(h*31.),cos(h*47.))*.12)*32.;
    float radius=23.+h*6.,d2=dot(p-center,p-center);
    if(d2<radius*radius)top=max(top,-36.+sqrt(radius*radius-d2)*.8+h*2.);
  }
  return top;
}
vec3 snakeSky(vec3 ro,vec3 rd){
  vec3 c=mix(vec3(.63,.26,.38),vec3(.12,.055,.24),smoothstep(-.15,.85,rd.y));
  float sun=max(dot(rd,normalize(vec3(-.5,.32,1.))),0.);
  c+=vec3(.55,.27,.09)*pow(sun,40.);
  if(rd.y<.12){
    float t=.5,previous=.5;bool hit=false;
    for(int i=0;i<70;i++){
      vec3 p=ro+rd*t;
      if(p.y<cloudHeight(p.xz)){hit=true;break;}
      if(t>1250.)break;
      previous=t;t+=max(1.2,t*.095);
    }
    if(hit){
      float lo=previous,hi=t;
      for(int j=0;j<4;j++){float mid=(lo+hi)*.5;vec3 p=ro+rd*mid;if(p.y>cloudHeight(p.xz))lo=mid;else hi=mid;}
      t=(lo+hi)*.5;vec3 p=ro+rd*t;
      float e=.25+t*.001;
      vec3 n=normalize(vec3(cloudHeight(p.xz-vec2(e,0.))-cloudHeight(p.xz+vec2(e,0.)),2.*e,cloudHeight(p.xz-vec2(0.,e))-cloudHeight(p.xz+vec2(0.,e))));
      float light=.35+.65*max(0.,dot(n,normalize(vec3(-.5,.9,.5))));
      vec3 cloud=mix(vec3(.32,.13,.025),vec3(.96,.64,.23),light);
      cloud+=vec3(.13,.085,.035)*smoothstep(-19.,-11.,p.y);
      c=mix(cloud,vec3(.74,.4,.16),smoothstep(180.,1250.,t));
    }
  }
  return c*(1.-uDusk*.35);
}
vec3 snakeWorld(vec3 ro,vec3 rd){
  vec3 clouds=snakeSky(ro,rd),c=clouds;
  float t=orbitMarch(ro,rd);
  if(t<680.){
    vec3 p=ro+rd*t;float dx=p.x-pathX(p.z),d=abs(dx);
    float aa=max(.005,t/(uRes.y*uFocal));
    // Broad, low-contrast overlapping scales. Analytic coverage removes distant
    // subpixel outlines; the surface never pulses or changes hue with time.
    vec2 tile=vec2(dx/.85,p.z/1.5);tile.x+=mod(floor(tile.y),2.)*.5;
    vec2 q=fract(tile)-.5;
    float arc=abs(length(vec2(q.x,q.y+.46))-.58);
    float seam=foliageBand(arc,.014,max(.01,aa));
    float centerRidge=foliageBand(d,.045,max(.01,aa));
    vec3 base=mix(vec3(.49,.61,.79),vec3(.67,.59,.8),smoothstep(0.,uWidth,d));
    c=base*(1.-seam*.16+.08*centerRidge)*(.92+.08*cos(dx*.4));
    float lip=1.-smoothstep(.06,.19,uWidth-d);
    c=mix(c,vec3(.61,.64,.78),lip);
    c=mix(c,clouds,smoothstep(370.,680.,t));
  }
  if(rd.z>.02){
    // Raised continuous side walls follow the same route as the road/camera.
    // Closely spaced pale dorsal spines sit outside the riding surface.
    for(int k=0;k<48;k++){
      float za=(floor(ro.z/6.)+float(k))*6.,zb=za+6.;
      for(int side=0;side<2;side++){
        float sg=side==0?-1.:1.;
        vec3 a=vec3(pathX(za)+sg*(uWidth+.02),roadY(za)+.23,za);
        vec3 b=vec3(pathX(zb)+sg*(uWidth+.02),roadY(zb)+.23,zb);
        vec3 ba=b-a,oa=ro-a;
        float bb=dot(ba,ba),br=dot(ba,rd),bo=dot(ba,oa),rr=dot(rd,oa);
        float aa=bb-br*br,ab=bb*rr-bo*br,ac=bb*dot(oa,oa)-bo*bo-.075*bb;
        float disc=ab*ab-aa*ac;
        if(disc>=0.&&aa>.001){
          float rt=(-ab-sqrt(disc))/aa,y=bo+rt*br;
          if(rt>.1&&rt<t&&y>=0.&&y<=bb){
            float wallRib=.94+.06*cos(y*1.6)*(1.-smoothstep(40.,140.,rt));
            float shade=(.62+.15*sg)*wallRib;
            c=mix(c,vec3(.55,.59,.78)*shade,1.-smoothstep(250.,380.,rt));
          }
        }
        float z=za+3.,ot=(z-ro.z)/rd.z;
        if(ot<.3||ot>t||ot>380.)continue;
        vec3 p=ro+rd*ot;vec2 q=vec2((p.x-pathX(z))*sg-uWidth,p.y-roadY(z));
        float px=max(.006,ot/(uRes.y*uFocal));
        float spine=epTriangle(q,vec2(-.13,.23),vec2(.65,.23),vec2(.36,1.02),px);
        float flute=epTriangle(q,vec2(.08,.25),vec2(.44,.25),vec2(.34,.84),px);
        vec3 pigment=mix(vec3(.36,.39,.59),vec3(.7,.71,.84),smoothstep(.23,1.18,q.y))+vec3(.08,.09,.12)*flute;
        c=mix(c,pigment,spine*(1.-smoothstep(250.,380.,ot)));
      }
    }
  }
  return c;
}

void main(){
  vec2 sv=vUv*2.-1.;float asp=uRes.x/uRes.y;
  vec3 rd=normalize(uFwd*uFocal+uRight*sv.x*asp+uUp*sv.y);
  vec3 ro=uCam;
  if(uMisty>.999){o=mistyWorld(ro,rd,sv);return;}
  skyTrail=0.;
  vec3 skyc=(uOrbit+uSnake)>.999?vec3(0.):sky(rd,sv);
  if(uMisty>.001)skyc=mix(skyc,mistySky(rd,sv),uMisty);
  float trail=0.;
  vec3 col=skyc;
  float last;
  float t=(uOrbit+uSnake)>.999?1e4:march(ro,rd,last);
  if(t<680.){
    vec3 p=ro+rd*t;
    float hRaw=height(p.xz,false);
    bool water=uSea>.5&&hRaw<SEA+.25;
    float e=.05+t*.0018;
    vec3 N=normalize(vec3(surface(p.xz-vec2(e,0.),true)-surface(p.xz+vec2(e,0.),true),2.*e,surface(p.xz-vec2(0.,e),true)-surface(p.xz+vec2(0.,e),true)));
    float px=pathX(p.z),d=abs(p.x-px),rel=p.y-roadY(p.z);
    float dn=mix(fbm4(p.xz*.075),.5,smoothstep(50.,220.,t));
    vec3 alb=mix(uGround*.75,uGround*1.55,dn);
    float sl=1.-N.y;
    alb=mix(alb,uRock,smoothstep(.1,.42,sl+dn*.14-.07));
    if(uSnow>0.)alb=mix(alb,vec3(.84,.88,.96),uSnow*smoothstep(33.,65.,rel+dn*15.)*(1.-smoothstep(.3,.68,sl)));
    if(uAlpine>.001){
      // Include elevation in the cross-slope coordinate so canopy crowns
      // retain their rounded proportions on steep shore bluffs.
      vec2 forestUV=vec2(p.x+sign(p.x-px)*p.y*.85,p.z);
      float footprint=2.*t/(uRes.y*uFocal*max(.2,abs(dot(rd,N))));
      vec3 leaves=autumnCanopy(forestUV,footprint);
      float cliff=smoothstep(.69,.92,sl)*smoothstep(.38,.66,fbm2(p.xz*.025+3.));
      float woods=smoothstep(5.,11.,d)*(1.-cliff);
      vec3 exposed=uRock*(.78+.24*fbm2(p.xz*.19+rel*.08));
      alb=mix(alb,mix(exposed,leaves,woods),uAlpine*smoothstep(4.,7.,d));
    }
    if(uMeadow>0.) { float fieldAA=max(.02,t*.0008); float field=smoothstep(.48-fieldAA,.48+fieldAA,fract(p.x*.024+sin(p.z*.012)*.2)); alb=mix(alb,mix(vec3(.19,.28,.055),vec3(.34,.39,.08),field),uMeadow*.65*smoothstep(4.,9.,d)); }
    if(uStrata>0.)alb*=mix(1.,.74+.3*sin(rel*.85+dn*3.5),uStrata);
    if(uGrid>0.&&uTron<.001){vec2 g=abs(fract(p.xz*.12)-.5);float gl=smoothstep(.47,.5,max(g.x,g.y));alb+=uEdge*gl*.32*uGrid*exp(-t*.012);}
    float dif=clamp(dot(N,uSunDir),0.,1.);
    vec3 amb=mix(uFog*.7,uSkyTop,.5+.5*N.y)*.62;
    vec3 c=alb*(uSunC*dif*1.5+amb);
    float back=clamp(dot(N,normalize(vec3(-uSunDir.x,0.,-uSunDir.z))),0.,1.);
    c+=alb*uSkyHz*back*.12;
    if(water){
      vec3 W=normalize(vec3((vn(p.xz*.3+uT*.5)-.5)*mix(.14,.025,uAlpine),1.,(vn(p.xz*.27-uT*.4)-.5)*mix(.14,.025,uAlpine)));
      vec3 rf=reflect(rd,W);
      float keep=skyTrail;c=mix(mix(vec3(.015,.16,.26),vec3(.013,.055,.12),uAlpine),sky(vec3(rf.x,abs(rf.y),rf.z),vec2(0.)),mix(.22,.08,uAlpine)+mix(.3,.14,uAlpine)*pow(1.-max(0.,dot(-rd,W)),3.));
      c+=vec3(.12,.22,.19)*pow(max(0.,sin(p.z*.8+p.x*.17+uT)),12.)*.2*(1.-uAlpine);skyTrail=keep;
      // Turquoise coastal shallows and whitewater surf rings around sea stacks & shoreline
      float hSub=hRaw-SEA;
      float shallows=smoothstep(-3.2,-.2,hSub)*uCoast;
      c=mix(c,vec3(.05,.32,.36)*(uSunC*.75+amb),shallows*.55);
      float surf=smoothstep(-1.15,-.02,hSub)*(.55+.45*sin(hSub*8.-uT*2.+vn(p.xz*.35)*4.))*(1.-smoothstep(80.,240.,t));
      c=mix(c,vec3(.78,.84,.88)*(uSunC*.7+amb),surf*(uCoast*.65+uAlpine*.2));
      c+=uSunC*pow(max(dot(rf,uSunDir),0.),190.)*7.;
    }
    // the road
    float aaRoad=max(.12,t/(uRes.y*uFocal));
    float rm=1.-smoothstep(uWidth-aaRoad,uWidth+aaRoad,d);
    if(!water){
      float nearTex=1.-smoothstep(16.,52.,t);
      float wheelTrack=exp(-pow((d-uWidth*.46)/.28,2.));
      float aggregate=(vn(p.xz*1.8)-.5)*.08*nearTex*(1.-uTron);
      vec3 asphalt=mix(vec3(.07,.075,.07),vec3(.31,.25,.16),uCanyon*.35)*(.88+.18*dn+.05*wheelTrack+aggregate);
      float trailStone=smoothstep(.35,.75,cos(p.z*2.2+sin(p.x*3.)))*foliageBand(d-(uWidth-.22),.12,aaRoad)*nearTex;
      asphalt=mix(asphalt,vec3(.44,.32,.17)*(.9+.14*dn+.08*trailStone),uForest);
      asphalt=mix(asphalt,vec3(.010,.020,.038)*(.85+.25*wheelTrack),uTron);
      float verge=foliageBand(d-(uWidth+.18),.16,aaRoad);
      c=mix(c,uRock*(uSunC*dif+amb)*.82,verge*.45*(1.-uTron));
      c=mix(c,asphalt*(uSunC*dif*1.2+amb),rm);
    }
    float em=0.;vec3 emC=vec3(0.);
    if(uTron>.001){
      // Anti-aliased coordinate grid across the basin and faceted wireframe mountain slopes
      float aaX=max(.04,t*.0035+uTravelSpeed*.014);
      float aaZ=max(.065,t*.006+uTravelSpeed*.022);
      float gx=foliageBand(abs(fract((p.x-px)*.14)-.5)-.5,.018,aaX);
      float gz=foliageBand(abs(fract(p.z*.05)-.5)-.5,.022,aaZ)*exp(-t*.016);
      float ridgeGlow=smoothstep(.18,.58,sl)*(.7+.3*gx);
      vec3 gridCol=mix(vec3(0.,.84,1.),vec3(1.,.42,.04),smoothstep(16.,52.,rel));
      vec3 tronBase=(vec3(.018,.048,.095)+vec3(.02,.08,.15)*smoothstep(0.,36.,rel))*(.85+.35*dif);
      c=mix(c,tronBase,uTron*(1.-rm)*.9);
      emC+=gridCol*(gx*.095+gz*.055+ridgeGlow*.095)*uTron*(1.-rm)*exp(-t*.010)*smoothstep(2.5,10.,t);
      // Parallel Cyan & Orange Lightcycle jetwall ribbons slicing along the obsidian highway
      float aaLane=max(.016,t/(uRes.y*uFocal));
      float dxSigned=p.x-px;
      float cyanRibbon=foliageBand(dxSigned+uWidth*.38,.055,aaLane)+.35*exp(-pow((dxSigned+uWidth*.38)/.22,2.));
      float orangeRibbon=foliageBand(dxSigned-uWidth*.38,.055,aaLane)+.35*exp(-pow((dxSigned-uWidth*.38)/.22,2.));
      emC+=(vec3(0.,.88,1.)*cyanRibbon+vec3(1.,.38,.02)*orangeRibbon)*.24*rm*uTron*smoothstep(1.8,8.,t);
    }
    if(rm>0.){
      float dashL=max(uBeat*.5,1.);
      float df=fract(p.z/dashL);
      float dashAA=max(.02,t/(dashL*uRes.y*uFocal));
      float dash=smoothstep(0.,dashAA,df)*(1.-smoothstep(.5-dashAA,.5,df))*(1.-smoothstep(.05,.1,abs(p.x-px)));
      emC+=uEdge*dash*.045*rm*smoothstep(2.,16.,t);
    }
    float aaSide=max(.02,t/(uRes.y*uFocal));
    float side=foliageBand(d-uWidth,.055,aaSide);
    float spark=pow(vn(vec2(p.z*.3,uT*1.3)),2.5)*1.8*(1.-smoothstep(35.,140.,t));
    emC+=uEdge*side*(.055+.085*uTron+uSpark*spark*.03)*smoothstep(2.2,10.,t);
    float fog=1.-exp(-pow(t*uFogK,1.55));
    vec3 fogC=mix(uFog,uSunC,pow(max(dot(rd,uSunDir),0.),7.)*.55)*(1.-uDusk*.55);
    col=mix(c,fogC,fog)+emC*exp(-t*.0085);
    col=mix(col,skyc,smoothstep(590.,680.,t));
    trail=clamp(dot(emC,vec3(.4))*exp(-t*.0085),0.,1.);
  }
  // World-space roadside silhouettes: each has a fixed seeded position, parallax and terrain occlusion.
  // A bounded set of planes avoids expensive per-step tree geometry on mobile GPUs.
  if(rd.z>.02&&(uOrbit+uSnake)<.999&&uMisty<.999){
    // Where the road heads per metre: a roadside point's motion on screen is measured against it.
    vec2 cameraSlope=vec2(0.);
    if(uForest>.001)cameraSlope=vec2(pathX(ro.z+.5)-pathX(ro.z-.5),roadY(ro.z+.5)-roadY(ro.z-.5));
    for(int row=21;row>=0;row--){
      float spacing=14.; // fixed grid: scenery blends never rehash object positions
      float cell=floor(ro.z/spacing)+float(row)+1.;
      float z=cell*spacing;
      float ot=(z-ro.z)/rd.z;
      if(ot>t||ot>300.||ot<.2)continue;
      vec3 hit=ro+rd*ot;
      // Project the actual ray/pixel derivatives onto this fixed-z billboard.
      // The footprint grows with distance and oblique viewing; capping it in
      // world metres leaves far-away foliage undersampled and shimmering.
      float pixelFactor=2.*ot*dot(rd,uFwd)/(uRes.y*uFocal);
      vec2 pixelX=pixelFactor*(uRight.xy-rd.xy*uRight.z/rd.z);
      vec2 pixelY=pixelFactor*(uUp.xy-rd.xy*uUp.z/rd.z);
      float worldAA=max(.003,.5*max(abs(pixelX.x)+abs(pixelY.x),abs(pixelX.y)+abs(pixelY.y)));
      // Tropical's dense canopy against bright sky flashes at speed: integrate its foliage over a
      // 60 ms travel exposure as well as a pixel footprint, without storing old images, shifting scenery
      // or blurring the road. Without it (67e7e60) Tropical flashed far above the WCAG 2.2 limit; the old
      // 160 ms exposure (.08) looked visibly blurrier than the other routes, and 30 ms (.015) left too
      // little margin. Other routes do not flash and keep their crisp roadside detail.
      if(uForest>.001){
        vec2 sweep=abs(cameraSlope-rd.xy/rd.z)*uTravelSpeed*.03;
        worldAA=max(worldAA,uForest*max(sweep.x,sweep.y));
      }
      foliageAA=worldAA;
      for(int sideI=0;sideI<2;sideI++){
        float signX=sideI==0?-1.:1.;
        float h=fract(sin(cell*12.71+signX*91.+uSeed)*43758.54);
        float offset=uWidth+mix(2.4,2.,uForest)+h*mix(7.,5.,uForest);
        if(uAlpine>.001)offset=mix(offset,signX<0.?3.6+h*.8:5.+h*15.,uAlpine);
        float x=pathX(z)+signX*offset;
        float dx=hit.x-x;
        float nearX=pathX(z)+signX*(uWidth+1.25+h*1.3);
        float farX=pathX(z)+signX*(uWidth+11.+h*7.);
        // Separate bounds keep near-road flowers and wildlife visible even when
        // the row's main tree happens to be far from the trail.
        float mainBound=6.+uForest*(1.+worldAA),farBound=7.+worldAA;
        if(abs(dx)>mainBound&&abs(hit.x-nearX)>1.5&&(uForest<.001||abs(hit.x-farX)>farBound))continue;
        float base=height(vec2(x,z),false), y=hit.y-base;
        float treeH=7.+h*9., treeW=1.8+h*1.6;
        float pine=0.;
        for(int tier=0;tier<4;tier++){
          float by=1.4+float(tier)*treeH*.16, top=by+treeH*.48;
          float radius=treeW*(1.-float(tier)*.17)*(top-y)/(top-by);
          radius*=.86+.14*sin(y*8.+h*29.)+.06*sin(y*23.+h*7.);
          pine=max(pine,step(by,y)*step(y,top)*step(abs(dx),radius));
        }
        float trunk=step(abs(dx),.16)*step(0.,y)*step(y,treeH*.66);
        float forestAlpha=uAlpine*step(h,.2);
        float silhouette=max(pine,trunk)*forestAlpha;
        vec3 obj=mix(vec3(.14,.085,.04),vec3(.025,.13,.075)*(.8+.28*h+.3*dx/treeW+.16*sin(y*5.)+.18*step(0.,dx)),pine);
        if(uAlpine>.001&&h>=.2){
          vec4 fall=autumnTree(vec2(dx,y),h);obj=fall.rgb;silhouette=fall.a*uAlpine;
        }
        // Golden Coast: cliffside Monterey cypress trees & sun-bleached granite boulders
        if(uCoast>.001&&signX<0.&&h<.42){
          float cTrunk=epLine(vec2(dx,y),vec2(0.,0.),vec2(-.35,3.6),.15,worldAA);
          cTrunk=max(cTrunk,epLine(vec2(dx,y),vec2(-.15,2.1),vec2(-1.3,3.5),.09,worldAA));
          cTrunk=max(cTrunk,epLine(vec2(dx,y),vec2(-.22,2.5),vec2(.95,3.8),.08,worldAA));
          float cPad=epOval(vec2(dx+.25,y-3.7),vec2(1.85+h*.6,.75),worldAA);
          cPad=max(cPad,epOval(vec2(dx-.9,y-3.4),vec2(1.25,.55),worldAA));
          cPad=max(cPad,epOval(vec2(dx+1.0,y-4.0),vec2(1.35,.58),worldAA));
          float cRock=epOval(vec2(dx-1.4,y-.28),vec2(.95+h*.5,.52),worldAA);
          float cSil=max(max(cTrunk,cPad),cRock)*uCoast;
          if(cSil>silhouette){
            silhouette=cSil;
            vec3 cCol=mix(vec3(.22,.16,.11),vec3(.07,.17,.10)*(.8+.25*sin(dx*3.+y*4.)),step(.01,cPad));
            obj=mix(cCol,vec3(.48,.43,.36)*(.85+.2*y),step(.01,cRock)*(1.-step(.01,cPad+cTrunk)));
          }
        }
        if(uForest>.001){
          // Composite each antialiased layer over the previous one. Replacing
          // its alpha by a tiny foreground edge opened holes in opaque canopy;
          // choosing the largest alpha snapped palm edges on at full coverage.
          if(abs(hit.x-farX)<farBound){
            vec2 farP=vec2(hit.x-farX,hit.y-height(vec2(farX,z),false));
            foliageAA=worldAA/.78;
            vec4 foliage=tropicalTree(farP/vec2(1.35,.78),.8+h*.18,signX);
            foliagePaint(obj,silhouette,foliage.rgb*.82,foliage.a*uForest);
            if(farP.y<3.2){
              foliageAA=worldAA/.25;
              vec4 understory=tropicalTree(farP/vec2(1.25,.25),.8+h*.18,signX);
              foliagePaint(obj,silhouette,understory.rgb*.72,understory.a*uForest);
            }
          }
          foliageAA=worldAA;
          vec4 palm=tropicalTree(vec2(dx,y),h,signX);
          foliagePaint(obj,silhouette,palm.rgb,palm.a*uForest);
          vec2 plant=vec2(hit.x-nearX,hit.y-height(vec2(nearX,z),false));
          float sight=fract(sin(cell*37.7+signX*5.9+uSeed*3.)*878.31);
          float cluster=fract(sin(cell*19.31+signX*17.7+uSeed)*1237.2);
          // Natural gaps and varied clump sizes instead of one repeated bouquet.
          if(abs(plant.x)<1.5&&plant.y<2.4&&plant.y>-.2&&(cluster>.22||sight<.055||sight>.94||(sight>.42&&sight<.54))){
            float scale=.65+.2*h;
            foliageAA=worldAA/scale;
            vec4 border=tropicalBorder(plant/scale,h,sight);
            foliagePaint(obj,silhouette,border.rgb,border.a*uForest);
          }
        }
        if(uCoast+uMeadow+uAlpine+uCanyon>.001&&h>mix(.55,.78,uAlpine)&&abs(hit.x-nearX)<1.5){
          vec2 detail=vec2(hit.x-nearX,hit.y-height(vec2(nearX,z),false));
          if(detail.y>-.16&&detail.y<1.35){
            foliageAA=worldAA;
            vec4 small=seasonalPlants(detail,h,uCoast,uMeadow,uAlpine,uCanyon);
            if(small.a>.001){obj=mix(obj,small.rgb,small.a);silhouette=max(silhouette,small.a);}
          }
        }
        // Country trees have round crowns; farms and golden hay bales sit behind the split-rail fence.
        float crownShape=length(vec2(dx/(2.7+h*1.5),(y-5.2)/(2.7+h)));
        float crown=step(crownShape,1.+.06*sin(dx*8.)*sin(y*7.));
        float country=(max(trunk*step(y,5.),crown))*step(h,.35)*uMeadow;
        if(country>silhouette){silhouette=country;obj=mix(vec3(.16,.1,.04),vec3(.11,.24,.035)*(.8+.22*sin(dx*3.)*cos(y*2.)+.2*(1.-crownShape)),crown);}
        if(uMeadow>.001&&h>.42&&h<.76){
          vec2 baleQ=vec2(dx,y-.58);
          float baleEnd=epOval(baleQ-vec2(-.32,0.),vec2(.58,.58),worldAA);
          float baleSide=epOval(baleQ-vec2(.12,0.),vec2(.82,.58),worldAA);
          float bale=max(baleEnd,baleSide)*uMeadow;
          if(bale>silhouette){
            silhouette=bale;
            float swirl=.88+.12*cos(length(baleQ-vec2(-.32,0.))*18.);
            obj=mix(vec3(.52,.39,.14),vec3(.68,.54,.21)*swirl,baleEnd);
          }
        }
        float house=step(abs(dx),3.3)*step(0.,y)*step(y,3.1);
        float roof=step(3.1,y)*step(y,5.-abs(dx)*.56)*step(abs(dx),3.6);
        float siloBody=foliageBand(dx-4.15,.72,worldAA)*foliageSpan(y,0.,5.1,worldAA);
        float siloDome=epOval(vec2(dx-4.15,y-5.1),vec2(.72,.68),worldAA)*step(5.1,y);
        float silo=max(siloBody,siloDome);
        float farm=max(max(house,roof),silo)*step(.82,h)*uMeadow;
        if(farm>silhouette){
          silhouette=farm;
          float siding=.93+.07*cos(dx*11.)*(1.-smoothstep(.15,.6,worldAA*6.));
          obj=mix(vec3(.62,.24,.16)*siding,vec3(.26,.12,.07),roof);
          float door=step(abs(dx),.85)*step(y,2.15);
          float crossBrace=foliageBand(abs(dx)-y*.39,.045,worldAA)*door;
          obj=mix(obj,vec3(.42,.16,.11),door);
          obj=mix(obj,vec3(.82,.79,.72),crossBrace);
          float window=step(abs(abs(dx)-1.85),.38)*step(abs(y-1.85),.48)+step(abs(dx),.42)*step(abs(y-3.65),.38);
          obj=mix(obj,vec3(.06,.09,.10),clamp(window,0.,1.));
          if(silo>.01){
            vec3 siloC=mix(vec3(.55,.56,.58)*(1.-.22*(dx-4.15)),vec3(.68,.70,.74),siloDome);
            obj=mix(obj,siloC,silo);
          }
        }
        // Anti-aliased ribbed saguaros with desert blossoms and sculpted red-rock hoodoos in Red Canyon
        if(uCanyon>.001){
          if(h>=.32){
            float stemH=3.+h*2.5;
            float stem=foliageBand(dx,.22,worldAA)*foliageSpan(y,0.,stemH,worldAA);
            stem=max(stem,epOval(vec2(dx,y-stemH),vec2(.22,.22),worldAA));
            float armL=foliageBand(dx+.9,.16,worldAA)*foliageSpan(y,2.0,2.5+h*.8,worldAA);
            armL=max(armL,epOval(vec2(dx+.9,y-(2.5+h*.8)),vec2(.16,.16),worldAA));
            float armR=foliageBand(dx-.85,.15,worldAA)*foliageSpan(y,1.65,2.2+h*.6,worldAA)*step(.48,h);
            armR=max(armR,epOval(vec2(dx-.85,y-(2.2+h*.6)),vec2(.15,.15),worldAA)*step(.48,h));
            float joinL=foliageBand(y-2.0,.16,worldAA)*foliageSpan(dx,-.9,0.,worldAA);
            float joinR=foliageBand(y-1.65,.15,worldAA)*foliageSpan(dx,0.,.85,worldAA)*step(.48,h);
            float bloom=epOval(vec2(dx,y-(stemH+.20)),vec2(.14,.09),worldAA);
            float cactus=max(max(stem,max(armL,armR)),max(joinL,max(joinR,bloom)))*uCanyon;
            if(cactus>silhouette){
              silhouette=cactus;
              float ribs=.82+.18*cos(dx*28.)*(1.-smoothstep(.15,.6,worldAA*8.));
              obj=mix(vec3(.11,.23,.12)*ribs*(.75+.15*dx),vec3(.88,.68,.32),bloom);
            }
          }else{
            // Stratified sandstone hoodoo / desert boulder spire
            float hW=(1.65-.22*y+.18*sin(y*3.2+h*9.))*smoothstep(4.2,0.,y);
            float hoodoo=foliageBand(dx,max(hW,.01),worldAA)*foliageSpan(y,0.,3.8+h*2.,worldAA);
            hoodoo=max(hoodoo,epOval(vec2(dx,y-(3.5+h*1.8)),vec2(.75,.32),worldAA));
            if(hoodoo*uCanyon>silhouette){
              silhouette=hoodoo*uCanyon;
              float strata=.78+.22*sin(y*4.5+h*11.);
              obj=mix(vec3(.48,.22,.12),vec3(.68,.38,.21),strata)*(.85+.12*dx);
            }
          }
        }
        // Tron Grid: obsidian circuit monoliths with neon cyan/orange energy traces & floating octahedral Bit nodes
        if(uTron>.001){
          float mH=5.5+h*6.5, mW=.82+h*.42;
          float stepW=mW*(1.-.28*step(mH*.68,y));
          float tower=foliageBand(dx,stepW,worldAA)*foliageSpan(y,0.,mH,worldAA);
          float spire=epTriangle(vec2(dx,y),vec2(-stepW*.85,mH),vec2(stepW*.85,mH),vec2(0.,mH+1.35),worldAA);
          float bitY=mH+2.1+.25*sin(cell*3.1+h*9.);
          float bitUp=epTriangle(vec2(dx,y),vec2(-.52,bitY),vec2(.52,bitY),vec2(0.,bitY+.72),worldAA);
          float bitDn=epTriangle(vec2(dx,y),vec2(-.52,bitY),vec2(.52,bitY),vec2(0.,bitY-.72),worldAA);
          float bit=max(bitUp,bitDn)*step(.35,h);
          float mono=max(max(tower,spire),bit)*.72*uTron;
          if(mono>silhouette){
            silhouette=mono;
            vec3 neon=mix(vec3(0.,.78,.95),vec3(.95,.38,.04),step(.58,h));
            float traceAA=max(worldAA,.04+uTravelSpeed*.006);
            float rim=foliageBand(abs(dx)-stepW,.04,traceAA)*tower;
            float coreTrace=foliageBand(dx,.035,traceAA)*foliageSpan(y,.6,mH-.4,traceAA);
            float rung=foliageBand(abs(fract(y*.45)-.5)-.42,.028,traceAA)*foliageSpan(abs(dx),0.,stepW*.75,traceAA)*tower;
            obj=mix(vec3(.022,.052,.105),neon*.48,clamp(rim+coreTrace+rung,0.,1.));
            if(bit>.01)obj=mix(obj,mix(neon*.55,vec3(.45,.72,.88),.35+.25*step(0.,dx)),bit);
          }
        }
        if(silhouette>.001){
          float distFade=smoothstep(300.,220.,ot);
          silhouette*=distFade;
          float fog=1.-exp(-pow(ot*uFogK,1.55));
          vec3 lit=obj*(uSunC*.8+uFog*.65)*(1.-uDusk*.5);
          if(uTron>.001)lit=mix(lit,obj,uTron*.85);
          // Warm sunlit canopy backlight for upper tropical fronds against bright sky
          // prevents high-frequency venetian-blind luminance swings without smearing worldAA.
          if(uForest>.001){
            float skyBg=smoothstep(2.2,4.5,y);
            lit=mix(lit,col*(.78+.14*clamp(obj.g*2.5,0.,1.))+obj*(uSunC*.32),uForest*skyBg*(1.-uDusk*.65));
            silhouette*=mix(1.,.82,uForest*skyBg);
          }
          col=mix(col,mix(lit,uFog*(1.-uDusk*.3),fog),clamp(silhouette,0.,1.));
        }
      }
      // Distant sailboats skimming across the bay in Golden Coast & Autumn Lake
      if((uCoast+uAlpine)>.001){
        float bHash=fract(sin(cell*31.7+uSeed*5.3)*43758.54);
        if(bHash>.72){
          float waterSide=uCoast>uAlpine?1.:-1.;
          float boatX=pathX(z)+waterSide*(30.+bHash*24.);
          vec2 bq=vec2((hit.x-boatX)*waterSide,hit.y-SEA);
          if(abs(bq.x)<2.6&&bq.y>-.15&&bq.y<4.2){
            float hull=epOval(bq-vec2(0.,.18),vec2(1.35,.24),worldAA)*step(.08,bq.y);
            float mast=epLine(bq,vec2(.05,.32),vec2(.05,3.65),.035,worldAA);
            float mainSail=epTriangle(bq,vec2(.09,.52),vec2(.09,3.55),vec2(-1.25,.64),worldAA);
            float jibSail=epTriangle(bq,vec2(-.04,.56),vec2(-.04,3.15),vec2(.92,.62),worldAA);
            float boat=max(max(hull,mast),max(mainSail,jibSail))*(uCoast+uAlpine)*smoothstep(300.,210.,ot);
            if(boat>.001){
              vec3 bCol=mix(vec3(.14,.18,.26),vec3(.92,.89,.82),max(mainSail,jibSail));
              float fog=1.-exp(-pow(ot*uFogK,1.55));
              vec3 lit=bCol*(uSunC*.85+uFog*.55)*(1.-uDusk*.5);
              col=mix(col,mix(lit,uFog*(1.-uDusk*.3),fog),clamp(boat,0.,1.));
            }
          }
        }
      }
      if(uAlpine>.001){
        for(int layer=0;layer<3;layer++){
          float h=fract(sin(cell*8.91+float(layer)*43.7+uSeed)*12345.6);
          float x=pathX(z)+19.+float(layer)*21.+h*13.;
          if(abs(hit.x-x)>4.5)continue;
          float y=hit.y-height(vec2(x,z),false);
          if(y<0.||y>11.)continue;
          foliageAA=worldAA;
          vec4 fall=autumnTree(vec2(hit.x-x,y),h);
          float distFade=smoothstep(300.,220.,ot);
          float fog=1.-exp(-pow(ot*uFogK,1.55));
          vec3 lit=fall.rgb*(uSunC*.8+uFog*.65)*(1.-uDusk*.5);
          col=mix(col,mix(lit,uFog*(1.-uDusk*.3),fog),fall.a*uAlpine*distFade);
        }
      }
      // Fence and guardrail posts frame the route; they remain outside the riding surface.
      float railX=abs(hit.x-pathX(z)), railY=hit.y-roadY(z);
      float postAA=max(.004,ot/(uRes.y*uFocal));
      float post=smoothstep(.09+postAA,.09-postAA,abs(railX-(uWidth+.65)))*smoothstep(-postAA,postAA,railY)*smoothstep(.95+postAA,.95-postAA,railY);
      float railWeight=uCoast+uMeadow+uAlpine;
      if(post*railWeight>.01){
        float distFade=smoothstep(300.,220.,ot);
        vec3 c=mix(vec3(.65,.65,.53),vec3(.26,.18,.09),uMeadow)*(uSunC*.7+uFog*.5);
        col=mix(col,mix(c,uFog,1.-exp(-ot*uFogK)),post*railWeight*distFade);
      }
    }
    // Towering Tron Recognizer arches straddling the Lightcycle highway every 160 m
    if(uTron>.001){
      for(int k=4;k>=0;k--){
        float z=(floor(ro.z/160.)+float(k)+1.)*160.;
        float ot=(z-ro.z)/rd.z;
        if(ot>t||ot>480.||ot<.4)continue;
        vec3 p=ro+rd*ot;vec2 q=vec2(p.x-pathX(z),p.y-roadY(z));
        float aa=max(.012,ot/(uRes.y*uFocal));
        float ax=abs(q.x), legX=uWidth+2.15-.14*clamp(q.y,0.,6.2);
        float legs=foliageBand(ax-legX,.34,aa)*foliageSpan(q.y,0.,5.8,aa);
        float foot=foliageBand(ax-(uWidth+2.25),.62,aa)*foliageSpan(q.y,0.,.52,aa);
        float bridge=foliageBand(q.y-5.45,.48,aa)*foliageSpan(ax,0.,uWidth+2.75,aa);
        float pod=foliageBand(q.y-4.72,.28,aa)*foliageSpan(ax,0.,1.15,aa);
        float rec=max(max(legs,foot),max(bridge,pod))*.78*uTron;
        if(rec>.001){
          float trim=foliageBand(abs(ax-legX)-.29,.04,aa)*legs+foliageBand(abs(q.y-5.45)-.43,.04,aa)*bridge+foliageBand(q.y-4.52,.045,aa)*pod;
          vec3 rCol=mix(vec3(.022,.048,.095),vec3(.92,.36,.04)*.62,clamp(trim,0.,1.));
          float fade=smoothstep(480.,300.,ot)*smoothstep(2.,14.,ot);
          col=mix(col,rCol,clamp(rec*fade,0.,1.));
        }
      }
    }
    // The rails are continuous 3D capsules, with curved segments and true perspective.
    float railWeight=uCoast+uMeadow+uAlpine+uTron;
    if(railWeight>.01){
      for(int r=0;r<22;r++){
        float za=(floor(ro.z/14.)+float(r))*14., zb=za+14.;
        for(int sideI=0;sideI<2;sideI++){
          float side=sideI==0?-1.:1.;
          for(int bar=0;bar<2;bar++){
            if(bar==1&&(uMeadow+uTron)<.01)continue;
            float rH=bar==0?.75:.42;
            vec3 a=vec3(pathX(za)+side*(uWidth+.65),roadY(za)+rH,za);
            vec3 b=vec3(pathX(zb)+side*(uWidth+.65),roadY(zb)+rH,zb);
            vec3 ba=b-a,oa=ro-a;
            float bb=dot(ba,ba),br=dot(ba,rd),bo=dot(ba,oa),rr=dot(rd,oa);
            float aa=bb-br*br,ab=bb*rr-bo*br,ac=bb*dot(oa,oa)-bo*bo-.004*bb;
            float disc=ab*ab-aa*ac;
            if(disc<0.||aa<.001)continue;
            float rt=(-ab-sqrt(max(0.,disc)))/aa, y=bo+rt*br;
            if(rt<.1||rt>t||y<0.||y>bb)continue;
            float railAA=max(.004,rt/(uRes.y*uFocal));
            float edgeAlpha=smoothstep(0.,aa*railAA*4.,disc)*smoothstep(300.,220.,rt);
            vec3 c=mix(vec3(.65,.65,.53),vec3(.26,.18,.09),uMeadow)*(uSunC*.7+uFog*.5);
            vec3 tronRail=bar==0?vec3(0.,.88,1.):mix(vec3(0.,.88,1.),vec3(1.,.38,.02),step(0.,side));
            c=mix(c,tronRail,uTron);
            col=mix(col,mix(c,uFog,1.-exp(-rt*uFogK)),(bar==0?railWeight:(uMeadow+uTron))*edgeAlpha);
          }
        }
      }
    }
  }
  if(uOrbit>.001){col=mix(col,orbitWorld(ro,rd),uOrbit);trail*=1.-uOrbit;skyTrail*=1.-uOrbit;}
  if(uSnake>.001){col=mix(col,snakeWorld(ro,rd),uSnake);trail*=1.-uSnake;skyTrail*=1.-uSnake;}
  float suspended=uOrbit+uSnake;
  if(suspended>.001){
    float alignment=max(dot(rd,uSunDir),0.);
    if(uNebula>.002)col+=mistyNebula(rd,alignment)*uNebula*smoothstep(-.01,.12,rd.y)*suspended;
    if(uAurora>.002){float band=smoothstep(.03,.2,rd.y)*smoothstep(.72,.22,rd.y);col+=mix(uEdge,vec3(.6,.9,1.),.45)*fbm2(vec2(atan(rd.x,rd.z)*4.+uT*.25,uT*.09))*band*uAurora*suspended;}
    if(uBreathOn>.002)col+=uSunC*pow(alignment,mix(190.,44.,uBreath))*(.2+.62*uBreath)*uBreathOn*suspended;
    if(uHaze>.002){float hz=exp(-max(rd.y,0.)*mix(8.,1.7,uHaze));col=mix(col,uFog*.82+uSunC*pow(alignment,9.)*.5,uHaze*hz*suspended);}
    if(uGhost.w>0.)t=min(t,orbitMarch(ro,rd));
  }
  if(uGhost.w>0.){
    vec3 og=uGhost.xyz-ro;float b=dot(og,rd);
    if(b>0.&&b<t){float dg=length(og-rd*b)/(1.+b*.006);float gg=exp(-dg*dg*2.6)*uGhost.w;col+=mix(uEdge,vec3(1.),.55)*gg*2.2;trail=max(trail,gg*.8);}
  }
  // alpha marks what may leave a trail: emitters and the spectrum ridge, never the sun or the sky
  o=vec4(col,max(trail,skyTrail));
}`;

  const MOTE_VS = `#version 300 es
precision highp float;
uniform vec3 uCam,uRight,uUp,uFwd; uniform float uFocal,uAsp,uZ,uPx,uSeed,uSpeedN,uSpark,uShimmer;
out float vA;
float h(float n){return fract(sin(n)*43758.5453);}
uniform vec4 uRouteA; uniform float uRouteB,uRouteC,uRouteD,uRouteE,uRouteF;
float routeX(float z,float turn,float winding){z*=winding;return turn*(14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7));}
float routeY(float z,float rise,float winding){z*=winding;return rise*(7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1));}
float pathX(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeX(z,1.25,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeX(z,.75,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeX(z,.95,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeX(z,1.4,.65);if(uRouteB>.000001)v+=uRouteB*routeX(z,.75,1.45);if(uRouteC>.000001)v+=uRouteC*routeX(z,2.1,.55);if(uRouteD>.000001)v+=uRouteD*routeX(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeX(z,7.,.75);if(uRouteF>.000001)v+=uRouteF*routeX(z,1.65,.9);return v;}
float roadY(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeY(z,.4,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeY(z,.3,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeY(z,.5,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeY(z,.7,.65);if(uRouteB>.000001)v+=uRouteB*routeY(z,.25,1.45);if(uRouteC>.000001)v+=uRouteC*routeY(z,1.05,.55);if(uRouteD>.000001)v+=uRouteD*routeY(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeY(z,.65,.75);if(uRouteF>.000001)v+=uRouteF*routeY(z,.35,.9);return v;}
void main(){
  float i=float(gl_VertexID);
  float a=h(i*1.13),b=h(i*2.71),c=h(i*4.33);
  float span=130.;
  float z=uZ+mod(c*span-uZ,span);
  vec3 p=vec3(pathX(z)+(a-.5)*(4.+b*34.),roadY(z)+.2+b*b*11.,z);
  vec3 d=p-uCam;float cz=dot(d,uFwd);
  if(cz<.4){gl_Position=vec4(2.,2.,0.,1.);gl_PointSize=0.;vA=0.;return;}
  gl_Position=vec4(dot(d,uRight)*uFocal/cz/uAsp,dot(d,uUp)*uFocal/cz,0.,1.);
  float tw=.5+.5*sin(i*.7+uZ*.5);
  vA=(.1+.55*uSpark+.25*uShimmer*tw+.12*uSpeedN)*smoothstep(span,span*.45,cz)*smoothstep(.4,4.,cz);
  gl_PointSize=clamp(uPx*(.5+a*1.3)/cz*(1.+uSpark),1.,44.);
}`;
  const MOTE_FS = FS_HEAD.replace('in vec2 vUv;\n', '') + `
uniform vec3 uEdge; in float vA;
void main(){ vec2 q=gl_PointCoord-.5; float g=exp(-dot(q,q)*16.); o=vec4(mix(uEdge,vec3(1.),.45)*g*vA,g*vA*.8); }`;

  // The feedback loop: last frame, zoomed toward the vanishing point and warped, under the fresh scene.
  const DREAM_FS = FS_HEAD + `
uniform sampler2D uScene,uPrev; uniform vec2 uVP; uniform float uZoom,uDream,uWild,uT;
void main(){
  vec2 c=vUv-uVP; float r=length(c);
  float z=1.-uZoom*(1.+r*.55);
  // Organic spiral wave vortex for Wild mode
  float ang=atan(c.y,max(abs(c.x),1e-5))*sign(c.x);
  float a=uWild*(.04*sin(r*6.-uT*1.2)+.02*sin(ang*3.+uT*.8)*smoothstep(.04,.4,r));
  float ca=cos(a),sa=sin(a);
  vec2 uv=uVP+mat2(ca,-sa,sa,ca)*c*z;
  // Supercharged chromatic prism dispersion scaling toward screen periphery
  float sh=uWild*.015*(.25+r*1.5);
  vec4 pm=texture(uPrev,uv);
  vec3 prev=vec3(texture(uPrev,uv+c*sh).r,pm.g,texture(uPrev,uv-c*sh).b);
  vec4 sc=texture(uScene,vUv);
  // Motion blur trails from the zoomed previous frame
  float k=(uDream*.58+uWild*.16)*smoothstep(0.,.14,r+uDream*.1);
  vec3 m=mix(sc.rgb,prev*(.985+uWild*.008),min(k,0.94));
  float dreamAlpha=(.42+uDream*.46+uWild*.1)*smoothstep(0.,.05,uDream+uWild);
  m=max(m,prev*pm.a*dreamAlpha);
  float trailA=pm.a*(.8+uDream*.16)*smoothstep(0.,.05,uDream+uWild);
  o=vec4(min(m,vec3(30.)),max(sc.a,trailA));
}`;

  // The dotted orbit, drawn crisp over the finished picture. It marks the reference in Watch and the breath in Train.
  const ORBIT_VS = `#version 300 es
precision highp float;
uniform vec2 uC; uniform float uR,uAsp,uT,uA,uPx,uSquash;
out float vA;
float h(float n){return fract(sin(n)*43758.5453);}
void main(){
  float i=float(gl_VertexID);
  float a=h(i*1.13)*6.28318+uT*.012*(.5+h(i*3.1));
  float band=h(i*5.7);
  float rr=uR*(1.+(band-.5)*(.05+.06*h(i*7.1)));
  vec2 p=vec2(cos(a),sin(a)*uSquash)*rr;
  float c=cos(.42),s=sin(.42);
  p=vec2(p.x*c-p.y*s,p.x*s+p.y*c);
  gl_Position=vec4(uC.x+p.x/uAsp,uC.y+p.y,0.,1.);
  float tw=.55+.45*sin(uT*(.6+h(i*9.)*1.4)+i);
  float clump=pow(.5+.5*sin(a*5.+h(i)*.8+1.),2.);
  vA=uA*tw*(.25+.75*clump);
  gl_PointSize=uPx*(.7+h(i*2.3)*1.2);
}`;
  const ORBIT_FS = FS_HEAD.replace('in vec2 vUv;\n', '') + `
in float vA;
void main(){ vec2 q=gl_PointCoord-.5; float g=smoothstep(.5,.12,length(q)); o=vec4(vec3(.93,.92,1.)*g*vA,1.); }`;

  global.CyclingScene = { BIOMES, WORLD_KEYS, NUMS, SCENE_FS, MOTE_VS, MOTE_FS, DREAM_FS, ORBIT_VS, ORBIT_FS, mixScene, routeWeights, routeUniforms, pathX, roadY, gradeAt, landAt };
})(window);
