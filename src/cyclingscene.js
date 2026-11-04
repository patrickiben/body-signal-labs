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
    { id: 'tropical-preserve', name: 'Tropical preserve', description: 'Tropical nature preserve · palms, flowering understory and a warm earth trail', skyTop: '#368ca8', skyHz: '#bee1cc', sun: '#ffedbc', ground: '#467642', rock: '#b99b6a', fog: '#a9c7ad', edge: '#e0b887', amp: 22, ridge: .22, trees: 1, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0028, sunAz: -.5, sunEl: .52, coast: 0, forest: 1, meadow: 0, alpine: 0, canyon: 0, width: 1.65, turn: .75, rise: .3, winding: 1.15 },
    { id: 'meadow-lanes', name: 'Meadow lanes', description: 'Country lane · rolling fields, split-rail fences and farmsteads', skyTop: '#5596c6', skyHz: '#d8e8d2', sun: '#fff0c6', ground: '#91a84e', rock: '#87965c', fog: '#cedbc0', edge: '#e4d59a', amp: 14, ridge: .1, trees: .2, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0016, sunAz: -.7, sunEl: .55, coast: 0, forest: 0, meadow: 1, alpine: 0, canyon: 0, width: 2, turn: .95, rise: .5, winding: .7 },
    { id: 'new-england-autumn', name: 'New England Autumn', description: 'Lakeside road · blue water, gray bluffs and a red, orange and gold woodland', skyTop: '#4379a8', skyHz: '#d6dbd7', sun: '#ffe2b0', ground: '#887246', rock: '#85858a', fog: '#bec5c4', edge: '#e3be7f', amp: 64, ridge: .7, trees: .8, sea: 1, snow: 0, strata: 0, grid: 0, fogK: .0016, sunAz: -.65, sunEl: .5, coast: 0, forest: 0, meadow: 0, alpine: 1, canyon: 0, width: 2.1, turn: 1.4, rise: .7, winding: .65 },
    { id: 'red-canyon', name: 'Red canyon', description: 'Desert passage · sandstone walls, layered mesas and saguaro cacti', skyTop: '#5c9db7', skyHz: '#f5cba0', sun: '#ffe1b0', ground: '#c18a55', rock: '#c67246', fog: '#d8b18a', edge: '#ecc39a', amp: 72, ridge: .8, trees: 0, sea: 0, snow: 0, strata: 1, grid: 0, fogK: .0022, sunAz: -.9, sunEl: .5, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 1, width: 2.35, turn: .75, rise: .25, winding: 1.45 },
    { id: 'rainbow-orbit', name: 'Rainbow orbit', description: 'Rainbow skyway · a suspended ribbon through stars and a ringed planet', skyTop: '#171b42', skyHz: '#302449', sun: '#e0e8ff', ground: '#654a92', rock: '#6c80a8', fog: '#181b35', edge: '#aba9ff', amp: 0, ridge: 0, trees: 0, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0008, sunAz: -.4, sunEl: .6, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 0, orbit: 1, width: 3.5, turn: 2.1, rise: 1.05, winding: .55 },
    { id: 'misty-pines', name: 'Misty pines', description: 'Original Biofeedback mountain road · misty ridges, teal edges and drifting lights', skyTop: '#1f3a50', skyHz: '#a7c9c2', sun: '#ffe8c6', ground: '#1e3a2f', rock: '#39494a', fog: '#b0d3cc', edge: '#7ff0dd', amp: 64, ridge: 0.22, trees: 1, sea: 0, snow: 0, strata: 0, grid: 0, fogK: 0.0062, sunAz: -0.3, sunEl: 0.16, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 0, orbit: 0, misty: 1, width: 2.25, turn: 1, rise: 1, winding: 1 },
    { id: 'snake-way', name: 'Snake Way', description: 'Serpentine cloud road · pale lilac scales and raised spines above a golden cloud sea', skyTop: '#785093', skyHz: '#e5a1b5', sun: '#ffe1a1', ground: '#b5bfdc', rock: '#a6a3d1', fog: '#e9bb83', edge: '#d0ddf0', amp: 0, ridge: 0, trees: 0, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0014, sunAz: -.6, sunEl: .3, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 0, orbit: 0, misty: 0, snake: 1, width: 2.4, turn: 7, rise: .65, winding: .75 },
  ].map((b) => ({ orbit: 0, misty: 0, snake: 0, ...b, c: { skyTop: srgb(b.skyTop), skyHz: srgb(b.skyHz), sun: srgb(b.sun), ground: srgb(b.ground), rock: srgb(b.rock), fog: srgb(b.fog), edge: srgb(b.edge) } }));

  const WORLD_KEYS = ['coast', 'forest', 'meadow', 'alpine', 'canyon', 'orbit', 'misty', 'snake'];
  const NUMS = ['amp', 'ridge', 'trees', 'sea', 'snow', 'strata', 'grid', 'fogK', 'sunAz', 'sunEl', 'coast', 'forest', 'meadow', 'alpine', 'canyon', 'orbit', 'misty', 'snake', 'width', 'turn', 'rise', 'winding'];
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
    return { uRouteA: w.slice(0, 4), uRouteB: w[4], uRouteC: w[5], uRouteD: w[6], uRouteE: w[7],
      uCoast: w[0], uForest: w[1], uMeadow: w[2], uAlpine: w[3], uCanyon: w[4], uOrbit: w[5], uMisty: w[6], uSnake: w[7],
      uWidth: Array.isArray(scene) ? BIOMES.reduce((v, b, i) => v + b.width * w[i], 0) : scene.width };

  }

  function landAt(a, b, tb, dusk) {
    const t = tb * tb * (3 - 2 * tb);
    const mix3 = (k) => a.c[k].map((v, i) => lerp(v, b.c[k][i], t));
    const mixN = (k) => lerp(a[k], b[k], t);
    // Night is a real night: the sky goes dark, the sun becomes a pale moon, and the road's lights carry the scene.
    const night = dusk * dusk;
    const sunEl = Math.max(0.035, mixN('sunEl') * (1 - dusk * 0.7)), sunAz = mixN('sunAz');
    const sx = Math.sin(sunAz), sz = Math.cos(sunAz), sl = Math.hypot(sx, sunEl, sz);
    return {
      uSkyTop: mix3('skyTop').map((v, i) => lerp(v, [0.004, 0.006, 0.024][i], dusk * 0.94)),
      uSkyHz: mix3('skyHz').map((v, i) => lerp(v, [0.1, 0.045, 0.11][i], dusk * 0.92)),
      uSunC: mix3('sun').map((v, i) => lerp(v, [0.26, 0.29, 0.44][i], night * 0.96)),
      uGround: mix3('ground'), uRock: mix3('rock'), uFog: mix3('fog').map((v) => v * (1 - dusk * 0.86)), uEdge: mix3('edge'),
      uSunDir: [sx / sl, sunEl / sl, sz / sl],
      uCoast: mixN('coast'), uForest: mixN('forest'), uMeadow: mixN('meadow'), uAlpine: mixN('alpine'), uCanyon: mixN('canyon'), uOrbit: mixN('orbit'), uMisty: mixN('misty'), uSnake: mixN('snake'), uWidth: mixN('width'), uRouteA: ['coast','forest','meadow','alpine'].map(mixN), uRouteB: mixN('canyon'), uRouteC: mixN('orbit'), uRouteD: mixN('misty'), uRouteE: mixN('snake'),
      uAmp: mixN('amp'), uRidge: mixN('ridge'), uSea: mixN('sea'), uSnow: mixN('snow'), uStrata: mixN('strata'), uGrid: mixN('grid'), uTrees: mixN('trees'), uDusk: dusk, uFogK: mixN('fogK'),
    };
  }

  const SCENE_FS = FS_HEAD + `
uniform vec2 uRes; uniform float uT,uFocal,uBeat,uSeed;
uniform vec3 uCam,uRight,uUp,uFwd;
uniform sampler2D uN,uS;
uniform vec3 uSkyTop,uSkyHz,uSunC,uGround,uRock,uFog,uEdge,uSunDir;
uniform float uAmp,uRidge,uSea,uSnow,uStrata,uGrid,uTrees,uDusk,uFogK;
uniform float uSpark,uCoast,uForest,uMeadow,uAlpine,uCanyon,uOrbit,uMisty,uSnake,uWidth,uTravelSpeed;
uniform float uShimmer,uAurora,uHaze,uWeather,uWarm,uBreath,uBreathOn,uNebula;
uniform vec4 uGhost;
uniform vec4 uRouteA; uniform float uRouteB,uRouteC,uRouteD,uRouteE;
float routeX(float z,float turn,float winding){z*=winding;return turn*(14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7));}
float routeY(float z,float rise,float winding){z*=winding;return rise*(7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1));}
float pathX(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeX(z,1.25,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeX(z,.75,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeX(z,.95,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeX(z,1.4,.65);if(uRouteB>.000001)v+=uRouteB*routeX(z,.75,1.45);if(uRouteC>.000001)v+=uRouteC*routeX(z,2.1,.55);if(uRouteD>.000001)v+=uRouteD*routeX(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeX(z,7.,.75);return v;}
float roadY(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeY(z,.4,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeY(z,.3,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeY(z,.5,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeY(z,.7,.65);if(uRouteB>.000001)v+=uRouteB*routeY(z,.25,1.45);if(uRouteC>.000001)v+=uRouteC*routeY(z,1.05,.55);if(uRouteD>.000001)v+=uRouteD*routeY(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeY(z,.65,.75);return v;}
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
  float trunk=foliageBand(p.x-tx,.22-.09*yf,foliageAA)*foliageSpan(p.y,0.,H,foliageAA);
  float trunkDetail=1.-smoothstep(.35,1.4,foliageAA*15.);
  if(trunk>.001)foliagePaint(c,alpha,vec3(.29,.19,.105)*(.78+.18*cos(p.y*15.)*trunkDetail+.2*clamp((p.x-tx)/.22,-1.,1.)),trunk);
  vec2 crown=vec2(bend,H);
  if(h<.78){
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
      float leafWidth=(.12+.29*sin(tc*3.14159))*mix(.803775,.46+.54*abs(sin(tc*38.+h*4.)),resolved);
      float slope=((2.-layer*.62)-2.*(2.25+layer*.38)*tc)/span;
      float normalScale=inversesqrt(1.+slope*slope);
      float frond=foliageBand((p.y-axisY)*normalScale,leafWidth*normalScale,foliageAA)*foliageSpan(t*span,0.,span,foliageAA);
      if(frond>.001)foliagePaint(c,alpha,mix(vec3(.025,.13,.055),vec3(.11,.29,.075),.35+.35*sideF+.15*layer)*(.88+.12*cos(tc*38.)*resolved),frond);
    }
    float spear=leaf2(p,crown,crown+vec2(.4*side,2.3),.18);
    if(spear>.001)foliagePaint(c,alpha,vec3(.12,.31,.09),spear);
    float fruit=step(length((p-crown-vec2(.12,-.18))/vec2(.25,.2)),1.);
    if(fruit>.5){alpha=1.;c=vec3(.19,.13,.055);}
  }else{
    // Broad, overlapping leaves form a lower, rounded tropical canopy.
    for(int f=0;f<9;f++){
      float angle=float(f)*2.4+h*8.;
      vec2 base=crown+vec2(sin(angle)*.35,cos(angle)*.25-.65);
      vec2 tip=base+vec2(sin(angle)*2.25,cos(angle)*1.45+.35);
      float leaf=leaf2(p,base,tip,.72);
      if(leaf>.001){float vein=1.-smoothstep(.012,.045,line2(p,base,tip));foliagePaint(c,alpha,mix(vec3(.035,.18,.065),vec3(.12,.29,.075),fract(float(f)*.37+h))+vec3(.05,.06,.01)*vein,leaf);}
    }
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
    if(leaf>.001)foliagePaint(c,alpha,mix(vec3(.035,.19,.075),vec3(.12,.32,.09),float(f)/7.),leaf);
  }
  if(h>.2&&h<.72)for(int f=0;f<5;f++){
    vec2 base=vec2(.7,0.),tip=base+vec2((float(f)-2.)*.42,1.1+.3*sin(float(f)+h));
    float leaf=leaf2(p,base,tip,.22);
    if(leaf>.001)foliagePaint(c,alpha,mix(vec3(.24,.045,.085),vec3(.44,.12,.16),float(f)/5.),leaf);
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
          vec3 leafC=h<.44?vec3(.32,.035,.012):h<.73?vec3(.46,.12,.015):vec3(.42,.26,.025);
          leafC*=.6+.55*fbm2(q*1.1+h*21.)+.18*smoothstep(-3.,3.,q.x);
          return vec4(mix(vec3(.12,.09,.065),leafC,crown),max(crown,trunkA));
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
  if(t<680.&&last>0.){float a=last,b=t;for(int i=0;i<5;i++){float m=.5*(a+b);vec3 q=ro+rd*m;if(q.y-mistySurface(q.xz,false)>0.)a=m;else b=m;}t=.5*(a+b);}
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
  c+=uEdge*exp(-abs(rd.y-top)*110.)*a*1.9*smoothstep(-.02,.01,rd.y);
  mistySkyTrail=exp(-abs(rd.y-top)*90.)*a*.8*smoothstep(-.02,.01,rd.y);
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
    float dn=fbm4(p.xz*.075);
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
    float rm=1.-smoothstep(2.,2.55,d);
    if(!water){
      vec3 asphalt=mix(vec3(.022,.023,.03),uFog*.05,.4)+alb*.04;
      c=mix(c,asphalt*(uSunC*dif*1.2+amb),rm);
    }
    float em=0.;vec3 emC=vec3(0.);
    if(rm>0.){
      float dash=step(fract(p.z/max(uBeat*.5,1.)),.5)*(1.-smoothstep(.05,.1,abs(p.x-px)));
      emC+=uEdge*dash*.32*rm*smoothstep(2.,16.,t);
    }
    if(uGhost.w>0.)emC+=mix(uEdge,vec3(1.),.45)*exp(-dot(p.xz-uGhost.xz,p.xz-uGhost.xz)/9.)*.75*uGhost.w;
    float side=exp(-pow((d-2.25)/.09,2.));
    float spark=pow(vn(vec2(p.z*.9,uT*1.3)),6.)*7.;
    emC+=uEdge*side*(.3+uShimmer*spark*.9+uSpark*spark*1.2);
    float fog=1.-exp(-pow(t*uFogK,1.55));
    vec3 fogC=mix(uFog,uSunC,pow(max(dot(rd,uSunDir),0.),7.)*.55)*(1.-uDusk*.55);
    col=mix(c,fogC,fog)+emC*exp(-t*.0085);
    col=mix(col,skyc,smoothstep(590.,680.,t));
    trail=clamp(dot(emC,vec3(.4))*exp(-t*.0085),0.,1.);
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
    coast=max(coast,SEA-4.+26.*(1.-smoothstep(7.,15.,length(stack))));
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
  if(t<680.&&last>0.){float a=last,b=t;for(int i=0;i<5;i++){float m=.5*(a+b);vec3 q=ro+rd*m;if(q.y-surface(q.xz,false)>0.)a=m;else b=m;}t=.5*(a+b);}
  return t;
}
float skyTrail=0.;
vec3 sky(vec3 rd,vec2 sv){
  float y=max(rd.y,0.);
  vec3 c=mix(uSkyHz,uSkyTop,pow(y,.52));
  float s=max(dot(rd,uSunDir),0.);
  c+=uSunC*(pow(s,950.)*2.5+pow(s,56.)*.15);
  // cloud deck
  if(rd.y>.004){
    vec2 cp=rd.xz/(rd.y+.13)*1.25+vec2(uT*.006,uCam.z*.0009);
    float cl=fbm4(cp);
    float cov=smoothstep(.57,.88,cl);
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
  c+=uEdge*exp(-abs(rd.y-top)*110.)*a*1.9*smoothstep(-.02,.01,rd.y);
  skyTrail=exp(-abs(rd.y-top)*90.)*a*.35*smoothstep(-.02,.01,rd.y);
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
    vec3 ringC=mix(vec3(.12,.18,.28),vec3(.31,.25,.16),smoothstep(.26,.41,rad));
    ringC*=.8+.2*sin(rad*75.);
    if(r.y>0.)c=mix(c,ringC,ring*.78);
    float disk=1.-smoothstep(.202-aa,.202+aa,length(q));
    if(disk>0.){
      vec2 p=q/.202;
      vec3 n=vec3(p,sqrt(max(0.,1.-dot(p,p))));
      float light=.22+.78*max(0.,dot(n,normalize(vec3(-.6,.7,.8))));
      float bands=.5+.5*sin(p.y*17.+sin(p.x*3.)*.8);
      vec3 planet=mix(vec3(.14,.24,.31),vec3(.48,.31,.2),smoothstep(.3,.75,bands))*light;
      planet+=vec3(.04,.09,.15)*pow(1.-n.z,3.);
      c=mix(c,planet,disk);
    }
    if(r.y<=0.)c=mix(c,ringC,ring*.88);
  }
  vec3 moonDir=normalize(vec3(-.68,.14,1.));
  float md=length(rd-moonDir),maa=2./uRes.y;
  float moon=1.-smoothstep(.052-maa,.052+maa,md);
  c=mix(c,vec3(.12,.18,.27)*(.6+.4*smoothstep(-.052,.052,rd.x-moonDir.x)),moon);
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
    c=orbitRainbow((dx/uWidth+1.)*.5)*(.8+.12*pow(1.-d/uWidth,2.));
    float seam=1.-smoothstep(.025,.07,uWidth-d);
    c=mix(c,vec3(.36,.42,.58),seam*.8);
    // A calm continuous edge glow gives the floating road a visible boundary.
    c+=vec3(.055,.09,.15)*exp(-pow((d-uWidth+.14)/.12,2.));
    c=mix(c,space,smoothstep(370.,680.,t));
  }
  if(rd.z>.02){
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
    vec3 base=mix(vec3(.49,.61,.79),vec3(.67,.59,.8),smoothstep(0.,uWidth,d));
    c=base*(1.-seam*.16)*(.92+.08*cos(dx*.4));
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
          if(rt>.1&&rt<t&&y>=0.&&y<=bb){float shade=.62+.15*sg;c=mix(c,vec3(.55,.59,.78)*shade,1.-smoothstep(250.,380.,rt));}
        }
        float z=za+3.,ot=(z-ro.z)/rd.z;
        if(ot<.3||ot>t||ot>380.)continue;
        vec3 p=ro+rd*ot;vec2 q=vec2((p.x-pathX(z))*sg-uWidth,p.y-roadY(z));
        float px=max(.006,ot/(uRes.y*uFocal));
        float spine=epTriangle(q,vec2(-.13,.23),vec2(.65,.23),vec2(.36,1.02),px);
        vec3 pigment=mix(vec3(.36,.39,.59),vec3(.7,.71,.84),smoothstep(.23,1.18,q.y));
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
    bool water=uSea>.5&&height(p.xz,false)<SEA+.25;
    float e=.05+t*.0018;
    vec3 N=normalize(vec3(surface(p.xz-vec2(e,0.),true)-surface(p.xz+vec2(e,0.),true),2.*e,surface(p.xz-vec2(0.,e),true)-surface(p.xz+vec2(0.,e),true)));
    float px=pathX(p.z),d=abs(p.x-px),rel=p.y-roadY(p.z);
    float dn=fbm4(p.xz*.075);
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
    if(uMeadow>0.) { float field=step(.48,fract(p.x*.024+sin(p.z*.012)*.2)); alb=mix(alb,mix(vec3(.19,.28,.055),vec3(.34,.39,.08),field),uMeadow*.65*smoothstep(4.,9.,d)); }
    if(uStrata>0.)alb*=mix(1.,.74+.3*sin(rel*.85+dn*3.5),uStrata);
    if(uGrid>0.){vec2 g=abs(fract(p.xz*.12)-.5);float gl=smoothstep(.47,.5,max(g.x,g.y));alb+=uEdge*gl*.32*uGrid*exp(-t*.012);}
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
      c+=uSunC*pow(max(dot(rf,uSunDir),0.),190.)*7.;
    }
    // the road
    float rm=1.-smoothstep(uWidth-.12,uWidth+.12,d);
    if(!water){
      vec3 asphalt=mix(vec3(.07,.075,.07),vec3(.31,.25,.16),uCanyon*.35)*( .88+.18*dn);
      asphalt=mix(asphalt,vec3(.44,.32,.17)*(.9+.14*dn),uForest);
      c=mix(c,asphalt*(uSunC*dif*1.2+amb),rm);
    }
    float em=0.;vec3 emC=vec3(0.);
    if(rm>0.){
      float dash=step(fract(p.z/max(uBeat*.5,1.)),.5)*(1.-smoothstep(.05,.1,abs(p.x-px)));
      emC+=uEdge*dash*.045*rm*smoothstep(2.,16.,t)*(1.-uForest);
    }
    float side=exp(-pow((d-uWidth)/.045,2.));
    float spark=pow(vn(vec2(p.z*.9,uT*1.3)),6.)*7.;
    emC+=uEdge*side*(.055+uSpark*spark*.2);
    float fog=1.-exp(-pow(t*uFogK,1.55));
    vec3 fogC=mix(uFog,uSunC,pow(max(dot(rd,uSunDir),0.),7.)*.55)*(1.-uDusk*.55);
    col=mix(c,fogC,fog)+emC*exp(-t*.0085);
    col=mix(col,skyc,smoothstep(590.,680.,t));
    trail=clamp(dot(emC,vec3(.4))*exp(-t*.0085),0.,1.);
  }
  // World-space roadside silhouettes: each has a fixed seeded position, parallax and terrain occlusion.
  // A bounded set of planes avoids expensive per-step tree geometry on mobile GPUs.
  if(rd.z>.02&&(uOrbit+uSnake)<.999&&uMisty<.999){
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
      // Integrate tropical foliage over a 160 ms travel exposure as well as a
      // pixel footprint. This filters fronds moving across bright sky without
      // storing old images, shifting scenery, or blurring the road.
      if(uForest>.001){
        vec2 sweep=abs(cameraSlope-rd.xy/rd.z)*uTravelSpeed*.08;
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
          if(abs(plant.x)<1.5&&plant.y<2.4&&plant.y>-.2&&(cluster>.22||sight<.055||sight>.94)){
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
        // Country trees have round crowns; farms sit behind the split-rail fence.
        float crownShape=length(vec2(dx/(2.7+h*1.5),(y-5.2)/(2.7+h)));
        float crown=step(crownShape,1.+.06*sin(dx*8.)*sin(y*7.));
        float country=(max(trunk*step(y,5.),crown))*step(h,.35)*uMeadow;
        if(country>silhouette){silhouette=country;obj=mix(vec3(.16,.1,.04),vec3(.11,.24,.035)*(.8+.22*sin(dx*3.)*cos(y*2.)+.2*(1.-crownShape)),crown);}
        float house=step(abs(dx),3.3)*step(0.,y)*step(y,3.1);
        float roof=step(3.1,y)*step(y,5.-abs(dx)*.56)*step(abs(dx),3.6);
        float farm=max(house,roof)*step(.82,h)*uMeadow;
        if(farm>silhouette){silhouette=farm;obj=mix(vec3(.66,.55,.34),vec3(.28,.12,.065),roof);float window=step(abs(abs(dx)-1.5),.42)*step(abs(y-1.8),.6);obj=mix(obj,vec3(.05,.09,.09),window);}
        // Upright cacti have actual arms and a stem in the desert passage.
        float stem=step(length(vec2(dx,y-clamp(y,0.,3.+h*2.5))),.22);
        float arm=step(length(vec2(abs(dx)-.9,y-clamp(y,2.1,2.6+h))),.17);
        float join=step(abs(dx),1.05)*step(abs(y-2.2),.17);
        float cactus=max(stem,max(arm,join))*uCanyon;
        if(cactus>silhouette){silhouette=cactus;obj=vec3(.11,.22,.12)*(.7+.3*cos(dx*7.)+.15*dx);}
        if(silhouette>.001){
          float fog=1.-exp(-pow(ot*uFogK,1.55));
          vec3 lit=obj*(uSunC*.8+uFog*.65)*(1.-uDusk*.5);
          col=mix(col,mix(lit,uFog*(1.-uDusk*.3),fog),clamp(silhouette,0.,1.));
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
          float fog=1.-exp(-pow(ot*uFogK,1.55));
          vec3 lit=fall.rgb*(uSunC*.8+uFog*.65)*(1.-uDusk*.5);
          col=mix(col,mix(lit,uFog*(1.-uDusk*.3),fog),fall.a*uAlpine);
        }
      }
      // Fence and guardrail posts frame the route; they remain outside the riding surface.
      float railX=abs(hit.x-pathX(z)), railY=hit.y-roadY(z);
      float post=step(abs(railX-(uWidth+.65)),.09)*step(0.,railY)*step(railY,.95);
      float railWeight=uCoast+uMeadow+uAlpine;
      if(post*railWeight>.01){vec3 c=mix(vec3(.65,.65,.53),vec3(.26,.18,.09),uMeadow)*(uSunC*.7+uFog*.5);col=mix(col,mix(c,uFog,1.-exp(-ot*uFogK)),post*railWeight);}
    }
    // The rails are continuous 3D capsules, with curved segments and true perspective.
    float railWeight=uCoast+uMeadow+uAlpine;
    if(railWeight>.01){
      for(int r=0;r<22;r++){
        float za=(floor(ro.z/14.)+float(r))*14., zb=za+14.;
        for(int sideI=0;sideI<2;sideI++){
          float side=sideI==0?-1.:1.;
          vec3 a=vec3(pathX(za)+side*(uWidth+.65),roadY(za)+.75,za);
          vec3 b=vec3(pathX(zb)+side*(uWidth+.65),roadY(zb)+.75,zb);
          vec3 ba=b-a,oa=ro-a;
          float bb=dot(ba,ba),br=dot(ba,rd),bo=dot(ba,oa),rr=dot(rd,oa);
          float aa=bb-br*br,ab=bb*rr-bo*br,ac=bb*dot(oa,oa)-bo*bo-.004*bb;
          float disc=ab*ab-aa*ac;
          if(disc<0.||aa<.001)continue;
          float rt=(-ab-sqrt(disc))/aa, y=bo+rt*br;
          if(rt<.1||rt>t||y<0.||y>bb)continue;
          vec3 c=mix(vec3(.65,.65,.53),vec3(.26,.18,.09),uMeadow)*(uSunC*.7+uFog*.5);
          col=mix(col,mix(c,uFog,1.-exp(-rt*uFogK)),railWeight);
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
uniform vec4 uRouteA; uniform float uRouteB,uRouteC,uRouteD,uRouteE;
float routeX(float z,float turn,float winding){z*=winding;return turn*(14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7));}
float routeY(float z,float rise,float winding){z*=winding;return rise*(7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1));}
float pathX(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeX(z,1.25,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeX(z,.75,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeX(z,.95,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeX(z,1.4,.65);if(uRouteB>.000001)v+=uRouteB*routeX(z,.75,1.45);if(uRouteC>.000001)v+=uRouteC*routeX(z,2.1,.55);if(uRouteD>.000001)v+=uRouteD*routeX(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeX(z,7.,.75);return v;}
float roadY(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeY(z,.4,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeY(z,.3,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeY(z,.5,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeY(z,.7,.65);if(uRouteB>.000001)v+=uRouteB*routeY(z,.25,1.45);if(uRouteC>.000001)v+=uRouteC*routeY(z,1.05,.55);if(uRouteD>.000001)v+=uRouteD*routeY(z,1.,1.);if(uRouteE>.000001)v+=uRouteE*routeY(z,.65,.75);return v;}
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
  float a=uWild*.0034*sin(r*7.-uT*.7);
  float ca=cos(a),sa=sin(a);
  vec2 uv=uVP+mat2(ca,-sa,sa,ca)*c*z;
  float sh=uWild*.0026*(.4+r);
  vec4 pm=texture(uPrev,uv);
  vec3 prev=vec3(texture(uPrev,uv+c*sh).r,pm.g,texture(uPrev,uv-c*sh).b);
  vec4 sc=texture(uScene,vUv);
  // Motion blur from the zoomed last frame, then long trails from emitters only.
  float k=uDream*.58*smoothstep(0.,.14,r+uDream*.1);
  vec3 m=mix(sc.rgb,prev*.985,k);
  m=max(m,prev*pm.a*(.42+uDream*.46));
  o=vec4(min(m,vec3(30.)),max(sc.a,pm.a*(.8+uDream*.16)));
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
