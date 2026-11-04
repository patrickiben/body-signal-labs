/* endless.js: Endless Cockpit. A procedural road that keeps pace with your pedaling.
   Five landscapes have their own terrain, roadside objects and route profiles, with an optional dream-feedback loop.
   Cadence sets the speed, and each crank revolution sends a ring of light down the road.
   Plants and occasional wildlife have fixed seeded world positions across the landscapes; animals are static. */
(function () {
  'use strict';
  const { createGL, createPost, FS_HEAD, srgb } = GLKit;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const RM = matchMedia('(prefers-reduced-motion: reduce)');

  const BIOMES = [
    { name: 'Golden coast', description: 'Cliffside cycleway · open sea, rock stacks and white guardrails', skyTop: '#397ab1', skyHz: '#abd6eb', sun: '#ffe7be', ground: '#6c8247', rock: '#a58d70', fog: '#9bbbc9', edge: '#e6c985', amp: 45, ridge: .38, trees: 0, sea: 1, snow: 0, strata: 0, grid: 0, fogK: .0018, sunAz: -.65, sunEl: .55, coast: 1, forest: 0, meadow: 0, alpine: 0, canyon: 0, width: 2.25, turn: 1.25, rise: .4, winding: .8 },
    { name: 'Tropical preserve', description: 'Tropical nature preserve · palms, flowering understory and a warm earth trail', skyTop: '#368ca8', skyHz: '#bee1cc', sun: '#ffedbc', ground: '#467642', rock: '#b99b6a', fog: '#a9c7ad', edge: '#e0b887', amp: 22, ridge: .22, trees: 1, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0028, sunAz: -.5, sunEl: .52, coast: 0, forest: 1, meadow: 0, alpine: 0, canyon: 0, width: 1.65, turn: .75, rise: .3, winding: 1.15 },
    { name: 'Meadow lanes', description: 'Country lane · rolling fields, split-rail fences and farmsteads', skyTop: '#5596c6', skyHz: '#d8e8d2', sun: '#fff0c6', ground: '#91a84e', rock: '#87965c', fog: '#cedbc0', edge: '#e4d59a', amp: 14, ridge: .1, trees: .2, sea: 0, snow: 0, strata: 0, grid: 0, fogK: .0016, sunAz: -.7, sunEl: .55, coast: 0, forest: 0, meadow: 1, alpine: 0, canyon: 0, width: 2, turn: .95, rise: .5, winding: .7 },
    { name: 'Alpine lake', description: 'Lakeside pass · turquoise water, snowy peaks and mountain pines', skyTop: '#367bb3', skyHz: '#d3e7ee', sun: '#fff3d9', ground: '#6b8968', rock: '#8c9699', fog: '#c2d9df', edge: '#b4dbe2', amp: 128, ridge: .7, trees: .2, sea: 1, snow: 1, strata: 0, grid: 0, fogK: .0016, sunAz: .7, sunEl: .5, coast: 0, forest: 0, meadow: 0, alpine: 1, canyon: 0, width: 2.1, turn: 1.4, rise: .7, winding: .65 },
    { name: 'Red canyon', description: 'Desert passage · sandstone walls, layered mesas and saguaro cacti', skyTop: '#5c9db7', skyHz: '#f5cba0', sun: '#ffe1b0', ground: '#c18a55', rock: '#c67246', fog: '#d8b18a', edge: '#ecc39a', amp: 72, ridge: .8, trees: 0, sea: 0, snow: 0, strata: 1, grid: 0, fogK: .0022, sunAz: -.9, sunEl: .5, coast: 0, forest: 0, meadow: 0, alpine: 0, canyon: 1, width: 2.35, turn: .75, rise: .25, winding: 1.45 },
  ].map((b) => ({ ...b, c: { skyTop: srgb(b.skyTop), skyHz: srgb(b.skyHz), sun: srgb(b.sun), ground: srgb(b.ground), rock: srgb(b.rock), fog: srgb(b.fog), edge: srgb(b.edge) } }));

  /* ---- the same road in JS and GLSL, so the camera, the grade readout and the picture agree ---- */
  const S = {
    rpm: 0, rev: 0, demo: false, demoT: 0, bleT: -1e12, bt: 'idle', btName: '', speed: 0, dist: 0, vis: 40, zoom: 0, grade: 0, surge: 0, shake: 0, shakeV: 0, roll: 0,
    map: { idle: 25, max: 95, maxZoom: 0.018, gamma: 1.6 }, dream: 0.15, wild: 0.1, seed: 0,
    pedal: false, steady: null, ble: null, bleName: '', biome: 0, biomeNext: 0, biomeT: 1, dusk: 0.3, ambient: 2.2,
  };
  const MAX_SPEED = 7, M_PER_MI = 1609.34, GRADE_K = 5;
  const routeValue = (key) => { const t = S.biomeT * S.biomeT * (3 - 2 * S.biomeT); return lerp((S.fromMix || BIOMES[S.biome])[key], BIOMES[S.biomeNext][key], t); };
  const WORLD_KEYS = ['coast', 'forest', 'meadow', 'alpine', 'canyon'];
  const routeBlend = (z, scene, elevation) => BIOMES.reduce((sum, b, i) => {
    const weight = scene ? scene[WORLD_KEYS[i]] : routeValue(WORLD_KEYS[i]);
    if (weight < .000001) return sum;
    const q = z * b.winding;
    const v = elevation ? b.rise * (7*Math.sin(q*.0071+.4+S.seed)+3.4*Math.sin(q*.0193+1.9+S.seed*2.3)+1.1*Math.sin(q*.0471+3.1)) : b.turn * (14*Math.sin(q*.0113+1+S.seed)+6.5*Math.sin(q*.0271+2.2+S.seed*1.7));
    return sum + weight * v;
  }, 0);
  // Blend evaluated route positions. Interpolating a sine's frequency would whip
  // the camera through many cycles when scenery changes late in a long ride.
  const pathX = (z, b) => routeBlend(z, b, false);
  const roadY = (z, b) => routeBlend(z, b, true);
  const gradeAt = (z) => (roadY(z + 3) - roadY(z - 3)) / 6;
  const gradeFactor = (g) => clamp(1 - g * GRADE_K, 0.6, 1.35);
  const motion01 = (rpm) => {
    const { idle, max, gamma } = S.map;
    return Math.pow(clamp((rpm - idle) / Math.max(1, max - idle), 0, 1), 1 / gamma);
  };

  /* ---- shaders ---- */
  const SCENE_FS = FS_HEAD + `
#define RINGS 12
uniform vec2 uRes; uniform float uT,uFocal,uBeat,uSeed;
uniform vec3 uCam,uRight,uUp,uFwd;
uniform sampler2D uN,uS;
uniform vec3 uSkyTop,uSkyHz,uSunC,uGround,uRock,uFog,uEdge,uSunDir;
uniform float uAmp,uRidge,uSea,uSnow,uStrata,uGrid,uTrees,uDusk,uFogK;
uniform float uSpark,uCoast,uForest,uMeadow,uAlpine,uCanyon,uWidth;
uniform vec4 uRing[RINGS];
uniform vec4 uRouteA; uniform float uRouteB;
float routeX(float z,float turn,float winding){z*=winding;return turn*(14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7));}
float routeY(float z,float rise,float winding){z*=winding;return rise*(7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1));}
float pathX(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeX(z,1.25,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeX(z,.75,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeX(z,.95,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeX(z,1.4,.65);if(uRouteB>.000001)v+=uRouteB*routeX(z,.75,1.45);return v;}
float roadY(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeY(z,.4,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeY(z,.3,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeY(z,.5,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeY(z,.7,.65);if(uRouteB>.000001)v+=uRouteB*routeY(z,.25,1.45);return v;}
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

const float SEA=-14.;
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
    float peaks=.6+.4*fbm2(vec2(p.y*.012,uSeed+5.));
    float left=max(0.,1.-abs(dx+190.)/165.)*(72.+48.*peaks);
    float right=max(0.,1.-abs(dx-320.)/145.)*(90.+55.*fbm2(q+7.));
    float distant=smoothstep(320.,540.,d)*(40.+75.*fbm2(q*.7+2.));
    float mountain=ry+shoulder*1.2+left+right+distant;
    float lake=smoothstep(5.,23.,dx)*(1.-smoothstep(170.,245.,dx));
    h+=mix(mountain,SEA-7.,lake)*uAlpine;
  }
  if(uCanyon>.001){
    float wall=smoothstep(12.+n*12.,23.+n*16.,d);
    h+=(ry+shoulder*1.2+wall*(22.+floor(n*5.)*7.))*uCanyon;
  }
  return h;
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
void main(){
  vec2 sv=vUv*2.-1.;float asp=uRes.x/uRes.y;
  vec3 rd=normalize(uFwd*uFocal+uRight*sv.x*asp+uUp*sv.y);
  vec3 ro=uCam;
  skyTrail=0.;
  vec3 skyc=sky(rd,sv);
  float trail=0.;
  vec3 col=skyc;
  float last;
  float t=march(ro,rd,last);
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
    if(uMeadow>0.) { float field=step(.48,fract(p.x*.024+sin(p.z*.012)*.2)); alb=mix(alb,mix(vec3(.19,.28,.055),vec3(.34,.39,.08),field),uMeadow*.65*smoothstep(4.,9.,d)); }
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
      float keep=skyTrail;c=mix(mix(vec3(.015,.16,.26),vec3(.015,.26,.25),uAlpine),sky(vec3(rf.x,abs(rf.y),rf.z),vec2(0.)),.22+.3*pow(1.-max(0.,dot(-rd,W)),3.));
      c+=vec3(.12,.22,.19)*pow(max(0.,sin(p.z*.8+p.x*.17+uT)),12.)*.2;skyTrail=keep;
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
    // rings of light that run ahead of you
    for(int i=0;i<RINGS;i++){
      vec4 r=uRing[i];
      if(r.z<=0.)continue;
      bool wide=r.w>.5;
      float zr=r.x+r.y*(wide?44.:78.);
      float w=.9+r.y*(wide?2.6:2.2);
      float g=exp(-pow((p.z-zr)/w,2.))*exp(-r.y*(wide?2.6:1.9))*r.z;
      g*=exp(-d*(wide?.03:.3))*(.12+.88*smoothstep(1.,20.,t));
      g*=smoothstep(46.,14.,zr-uCam.z);    // rings fade before the horizon, where they would stack into a flashing band
      emC+=(wide?mix(uEdge,vec3(1.),.25):uEdge*1.2)*g*(wide?.15:.5);
    }
    float fog=1.-exp(-pow(t*uFogK,1.55));
    vec3 fogC=mix(uFog,uSunC,pow(max(dot(rd,uSunDir),0.),7.)*.55)*(1.-uDusk*.55);
    col=mix(c,fogC,fog)+emC*exp(-t*.0085);
    col=mix(col,skyc,smoothstep(590.,680.,t));
    trail=clamp(dot(emC,vec3(.4))*exp(-t*.0085),0.,1.);
  }
  // World-space roadside silhouettes: each has a fixed seeded position, parallax and terrain occlusion.
  // A bounded set of planes avoids expensive per-step tree geometry on mobile GPUs.
  if(rd.z>.02){
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
      foliageAA=worldAA;
      for(int sideI=0;sideI<2;sideI++){
        float signX=sideI==0?-1.:1.;
        float h=fract(sin(cell*12.71+signX*91.+uSeed)*43758.54);
        float offset=uWidth+mix(2.4,2.,uForest)+h*mix(7.,5.,uForest);
        float x=pathX(z)+signX*offset;
        float dx=hit.x-x;
        float nearX=pathX(z)+signX*(uWidth+1.25+h*1.3);
        float farX=pathX(z)+signX*(uWidth+11.+h*7.);
        // Separate bounds keep near-road flowers and wildlife visible even when
        // the row's main tree happens to be far from the trail.
        if(abs(dx)>6.&&abs(hit.x-nearX)>1.5&&(uForest<.001||abs(hit.x-farX)>5.))continue;
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
        float forestAlpha=uAlpine*step(h,.65)*step(signX,0.);
        float silhouette=max(pine,trunk)*forestAlpha;
        vec3 obj=mix(vec3(.14,.085,.04),vec3(.025,.13,.075)*(.8+.28*h+.3*dx/treeW+.16*sin(y*5.)+.18*step(0.,dx)),pine);
        if(uForest>.001){
          if(abs(hit.x-farX)<5.){
            vec2 farP=vec2(hit.x-farX,hit.y-height(vec2(farX,z),false));
            foliageAA=worldAA/.78;
            vec4 foliage=tropicalTree(farP/vec2(1.35,.78),.8+h*.18,signX);
            if(foliage.a*uForest>silhouette){silhouette=foliage.a*uForest;obj=foliage.rgb*.82;}
            if(farP.y<3.2){
              foliageAA=worldAA/.25;
              vec4 understory=tropicalTree(farP/vec2(1.25,.25),.8+h*.18,signX);
              if(understory.a>.0){silhouette=understory.a*uForest;obj=understory.rgb*.72;}
            }
          }
          foliageAA=worldAA;
          vec4 palm=tropicalTree(vec2(dx,y),h,signX);
          if(palm.a>.0&&palm.a*uForest>=silhouette){silhouette=palm.a*uForest;obj=palm.rgb;}
          vec2 plant=vec2(hit.x-nearX,hit.y-height(vec2(nearX,z),false));
          float sight=fract(sin(cell*37.7+signX*5.9+uSeed*3.)*878.31);
          float cluster=fract(sin(cell*19.31+signX*17.7+uSeed)*1237.2);
          // Natural gaps and varied clump sizes instead of one repeated bouquet.
          if(abs(plant.x)<1.5&&plant.y<2.4&&plant.y>-.2&&(cluster>.22||sight<.055||sight>.94)){
            float scale=.65+.2*h;
            foliageAA=worldAA/scale;
            vec4 border=tropicalBorder(plant/scale,h,sight);
            if(border.a*uForest>0.){silhouette=border.a*uForest;obj=border.rgb;}
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
  // alpha marks what may leave a trail: emitters and the spectrum ridge, never the sun or the sky
  o=vec4(col,max(trail,skyTrail));
}`;

  const MOTE_VS = `#version 300 es
precision highp float;
uniform vec3 uCam,uRight,uUp,uFwd; uniform float uFocal,uAsp,uZ,uPx,uSeed,uSpeedN;
out float vA;
float h(float n){return fract(sin(n)*43758.5453);}
uniform vec4 uRouteA; uniform float uRouteB;
float routeX(float z,float turn,float winding){z*=winding;return turn*(14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7));}
float routeY(float z,float rise,float winding){z*=winding;return rise*(7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1));}
float pathX(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeX(z,1.25,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeX(z,.75,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeX(z,.95,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeX(z,1.4,.65);if(uRouteB>.000001)v+=uRouteB*routeX(z,.75,1.45);return v;}
float roadY(float z){float v=0.;if(uRouteA.x>.000001)v+=uRouteA.x*routeY(z,.4,.8);if(uRouteA.y>.000001)v+=uRouteA.y*routeY(z,.3,1.15);if(uRouteA.z>.000001)v+=uRouteA.z*routeY(z,.5,.7);if(uRouteA.w>.000001)v+=uRouteA.w*routeY(z,.7,.65);if(uRouteB>.000001)v+=uRouteB*routeY(z,.25,1.45);return v;}
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
  vA=(.1+.12*uSpeedN)*smoothstep(span,span*.45,cz)*smoothstep(.4,4.,cz);
  gl_PointSize=clamp(uPx*(.5+a*1.3)/cz,1.,44.);
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

  /* ---- page ---- */
  const hudHtml = `
    <div class="gauge"><span class="k">Speed</span><span class="v"><span id="g-speed">0.0</span><small>mph</small></span></div>
    <div class="gauge hero"><span class="k">Cadence</span><span class="v" id="g-hero">--</span></div>
    <div class="gauge"><span class="k">Distance</span><span class="v"><span id="g-dist">0.00</span><small>mi</small></span></div>`;

  const routeSheet = `
    <div class="row-actions"><button class="pill" id="ride-sound">Ride sound: off</button></div>
    <div class="sig-title"><span>Route ahead</span><span id="grade-read">grade 0%</span></div>
    <canvas class="sig-canvas" id="elstrip" width="880" height="110" role="img" aria-label="Elevation of the procedural route ahead"></canvas>
    <p class="note">The route is procedural and seeded, not a real GPS track.</p>

    <details open><summary>Look</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="field"><div class="row"><span>Dream, how much of the last frame stays</span><b id="dream-v"></b></div><input type="range" id="dream" min="0" max="100"></label>
      <label class="field"><div class="row"><span>Wildness, warp and color split</span><b id="wild-v"></b></div><input type="range" id="wild" min="0" max="100"></label>
    </div></details>

    <details id="mapping"><summary>Cadence to motion</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="field"><div class="row"><span>Idle cadence, no motion below</span><b id="v-idle"></b></div><input type="range" id="m-idle" min="0" max="60"></label>
      <label class="field"><div class="row"><span>Top cadence, full speed above</span><b id="v-max"></b></div><input type="range" id="m-max" min="60" max="130"></label>
      <label class="field"><div class="row"><span>Zoom per frame at top speed</span><b id="v-zoom"></b></div><input type="range" id="m-zoom" min="4" max="40"></label>
      <label class="field"><div class="row"><span>Response curve</span><b id="v-gamma"></b></div><input type="range" id="m-gamma" min="60" max="320"></label>
      <div class="sig-title" style="margin:6px 0 0"><span>Cadence to zoom</span><span>live dot</span></div>
      <canvas class="sig-canvas" id="curve" width="880" height="170" role="img" aria-label="Transfer curve from cadence to zoom, with the live value"></canvas>
    </div></details>`;

  const TOD = [
    { v: null, label: 'Moving', title: 'A four-minute cycle from golden hour to night' },
    { v: 0.18, label: 'Golden hour', short: 'Golden' }, { v: 0.55, label: 'Dusk' }, { v: 1, label: 'Night' },
  ];
  const LOOKS = { clear: { label: 'Clear', dream: 0.15, wild: 0.1 }, dreamy: { label: 'Dreamy', dream: 0.55, wild: 0.35 }, wild: { label: 'Wild', dream: 0.78, wild: 0.85 } };
  const sceneBar = `
    <div class="scenebar chrome" id="scenebar">
      <div class="scene-tiles" id="scene-tiles" role="group" aria-label="Scenery">
        ${BIOMES.map((b, i) => `<button class="scene-tile" data-b="${i}" aria-pressed="${i === 0}" title="${b.description}"><canvas width="336" height="196" aria-hidden="true" style="background:linear-gradient(${b.skyTop},${b.skyHz} 54%,${b.ground} 55%)"></canvas><span>${b.name}</span></button>`).join('')}
      </div>
      <p class="route-caption" id="route-caption">${BIOMES[0].description}</p>
      <div class="scene-row">
        <div class="seg" role="group" aria-label="Time of day">${TOD.map((t, i) => `<button data-tod="${i}" aria-pressed="${i === 0}"${t.title ? ` title="${t.title}"` : ''}${t.short ? ` aria-label="${t.label}"><span class="long">${t.label}</span><span class="short">${t.short}</span>` : `>${t.label}`}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Look">${Object.entries(LOOKS).map(([k, l]) => `<button data-look="${k}" aria-pressed="${k === 'clear'}">${l.label}</button>`).join('')}</div>
        <button class="seg-solo" id="auto-scene" aria-pressed="true" aria-label="Auto scenery: new scenery every mile" title="A new scene blends in after each mile you ride"><span class="long">New scenery every mile</span><span class="short">Auto scenery</span></button>
        <button class="seg-solo" id="new-route">New route</button>
      </div>
    </div>`;

  const connectHtml = `
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>
      <div class="device-info" id="bt-info" data-tone="idle">
        <strong>Cadence sensor <span class="dot"></span></strong>
        <p class="state" id="bt-state">Not connected</p>
        <p class="why" id="bt-why">A Bluetooth cadence sensor or smart trainer connects straight from Chrome or Edge.</p>
      </div>
      <button class="pill" id="ble-connect">Connect</button>
    </div>
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M7 17l10-10M7 7h10v10"/></svg>
      <div class="device-info">
        <strong>No sensor</strong>
        <p class="why">Hold Space, or the Hold to pedal button, to pedal at 88 rpm. Or set a steady cadence below.</p>
      </div>
    </div>
    <div class="controls-grid">
      <label class="field"><div class="row"><span>Steady cadence</span><b id="steady-v">off</b></div><input type="range" id="steady" min="0" max="120" value="0"></label>
    </div>
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M7 5v14l11-7z"/></svg>
      <div class="device-info">
        <strong>Just looking</strong>
        <p class="why">The demo is a synthetic interval ride. It is labeled on screen the whole time.</p>
      </div>
      <button class="pill" id="demo-sheet-ride">Run demo</button>
    </div>`;

  const about = `
    <p class="sheet-intro">Everything you see here is a stated rule. There is no model and no server.</p>
    <table class="maptable"><tbody>
      <tr><th>Cadence</th><td>Sets the speed, and the zoom of the picture each frame, through the curve under Route.</td></tr>
      <tr><th>Each revolution</th><td>Sends a ring of light down the road.</td></tr>
      <tr><th>Grade</th><td>The procedural road's slope changes your speed by up to 40%, never the zoom curve.</td></tr>
      <tr><th>Distance</th><td>Counts only the speed your cadence makes, never the slow drift at rest.</td></tr>
      <tr><th>Scenery</th><td>Five different routes: a cliffside coast, a tropical nature preserve, country lanes, an alpine lake and a sandstone canyon. With New scenery every mile on, the next one blends in after each mile you ride, counted only while your cadence moves the road.</td></tr>
      <tr><th>Time of day</th><td>A four-minute cycle from golden hour to night, or held where you choose.</td></tr>
      <tr><th>Look</th><td>Clear, Dreamy and Wild set how much of the last frame stays and how much it warps. The sliders under Scenery fine-tune both.</td></tr>
    </tbody></table>
    <p class="note">Keys: hold <b>Space</b> to pedal · <b>D</b> demo · <b>C</b> connect · <b>B</b> next scene · <b>T</b> time of day · <b>F</b> full screen · <b>H</b> hide controls.</p>`;

  const sessionHtml = `
    <div class="row-actions">
      <button class="pill primary" id="rec-toggle">Start recording</button>
      <button class="pill" id="replay-load">Replay a ride file</button>
      <button class="pill" id="replay-stop" hidden>Stop replay</button>
      <button class="pill" id="snapshot">Save a picture</button>
      <input type="file" id="replay-file" accept="application/json,.json" hidden>
    </div>
    <label class="check"><input type="checkbox" id="rec-video"> Also save a video of the screen, with the ride sound if it is on</label>
    <p class="note" id="rec-status" role="status">Not recording.</p>`;

  const aboutHtml = `${about}
    <details><summary>Safety and privacy</summary>
      <p>A limiter slows large changes in brightness. The automated flicker check measures this build against the WCAG general-flash threshold. That is a measured screen, not a medical guarantee. If flashing or moving light affects you, take care, and turn on your system's reduced-motion setting, which tightens the limiter and calms the camera.</p>
      <p>Cadence is read in this browser and never sent anywhere. The page makes no network requests after it loads. Your scene and settings stay in this browser's storage.</p>
    </details>
    <details><summary>Ideas credited</summary>
      <p>No outside code is included. The feedback loop follows the idea of Milkdrop's warp, as in <a href="https://github.com/jberg/butterchurn" rel="noopener">Butterchurn</a> (MIT).</p>
    </details>
    <p class="note"><a href="field-guide.html#endless">Read the field guide</a> · <a href="__REPO_URL__" rel="noopener">Source</a></p>`;

  const ride = createRide();
  const COARSE = matchMedia('(hover: none) and (pointer: coarse)').matches;      // a phone or tablet: no Space key to hold
  const BANDS = 64;
  const brand = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 3 4 25M12 3l8 22M12 9v3M12 15v3M12 21v4"/></svg>';
  const btView = () => {
    if (S.bt === 'live' || S.bt === 'connected') {
      const fresh = performance.now() - S.bleT < 3000;
      return fresh ? ['good', `Sensor · ${Math.round(S.ble || 0)} rpm`, `Live · ${Math.round(S.ble || 0)} rpm`, S.btName] : ['warn', 'Sensor · no cadence yet', 'Connected · no cadence yet', `${S.btName}. Start pedaling. Some sensors send nothing until the crank turns.`];
    }
    return {
      idle: ['idle', 'Sensor · not connected', 'Not connected', 'A Bluetooth cadence sensor or smart trainer connects straight from Chrome or Edge.'],
      unsupported: ['bad', 'Sensor · no Bluetooth here', 'No Web Bluetooth in this browser', 'Chrome or Edge on a computer can connect a sensor. Pedal by hand here instead.'],
      requesting: ['wait', 'Sensor · choosing', 'Choose a sensor in the browser prompt', ''],
      'no-choice': ['warn', 'Sensor · none chosen', 'No sensor chosen', 'The prompt closed without a sensor. Wake the sensor by turning the crank, then try again.'],
      failed: ['bad', 'Sensor · could not connect', 'Could not connect', S.btWhy || 'The sensor did not answer. Turn the crank to wake it and try again.'],
      lost: ['bad', 'Sensor · disconnected', 'Sensor disconnected', `${S.btName || 'The sensor'} went away. Connect again when it is back.`],
    }[S.bt];
  };
  const source = () => {
    if (S.demo) return ['demo', 'Demo · a synthetic ride, not your cadence'];
    if (ride.replayOn) return ['replay', 'Replay · a recorded ride, not live'];
    const v = btView();
    if (S.bt === 'live' || S.bt === 'connected') return [v[0] === 'good' ? 'live' : 'open', v[2]];
    if (S.pedal) return ['live', 'Pedaling by hand'];
    if (S.steady != null) return ['live', `Steady cadence · ${S.steady} rpm`];
    return ['ambient', 'Ambient · no cadence'];
  };
  const toggleDemo = () => { S.demo = !S.demo; S.demoT = 0; if (S.demo && ride.replayOn) ride.stopReplay(); renderStates(); };
  const shell = mountChrome({
    id: 'endless-cockpit', name: 'Endless Cockpit', brand,
    intro: { eyebrow: 'Endless Cockpit · a road that keeps your pace', title: 'Ride as far as you like.', subtitle: COARSE ? 'Connect a cadence sensor, or hold the pedal button. No helper app, no server.' : 'Connect a cadence sensor, or hold Space to pedal. No helper app, no server.' },
    stage: sceneBar,
    hud: hudHtml,
    badges: `
      <button class="source-badge" id="source-badge" data-source="ambient" title="Open the cadence settings"><span class="dot" aria-hidden="true"></span><span id="source-label">Ambient · no cadence</span></button>
      <button class="chip chrome" id="chip-sensor" data-tone="idle"><span class="dot" aria-hidden="true"></span><span id="chip-sensor-text">Sensor · not connected</span></button>`,
    truth: 'Procedural road with no model. Your cadence sets the speed, and nothing leaves this browser.',
    sheets: [
      { id: 'connect', label: 'Connect', icon: 'connect', title: 'Bring your ride.', intro: 'Speed comes from your cadence: a Bluetooth sensor, the pedal button, or a steady setting.', html: connectHtml },
      { id: 'route', label: 'Scenery', icon: 'route', title: 'Fine-tune the road.', intro: 'Scenes, time of day and looks are on the main screen. These fine-tune how it looks and moves, and never change the readings.', html: routeSheet },
      { id: 'session', label: 'Session', icon: 'session', title: 'Keep what you rode.', intro: 'A ride file holds your cadence, scene and route over time. Nothing leaves this computer unless you share the file.', html: sessionHtml },
      { id: 'about', label: 'About', icon: 'about', title: 'What drives what.', html: aboutHtml },
    ],
    onOpenSheet: (name) => { if (name === 'route') { drawElStrip(); drawCurve(); } },
    toggleDemo,
    onKey: (e, key) => { if (key === 'b') nextBiome(); else if (key === 't') setTod((S.tod + 1) % TOD.length); },
  });
  ['source-badge', 'chip-sensor'].forEach((id) => $(id).addEventListener('click', () => shell.openSheet('connect')));

  /* ---- what the page says about its source, in the same words everywhere ---- */
  function renderStates() {
    const [src, label] = source(), v = btView();
    const badge = $('source-badge');
    if (badge.dataset.source !== src) badge.dataset.source = src;
    if ($('source-label').textContent !== label) $('source-label').textContent = label;
    const chip = $('chip-sensor');
    if (chip.dataset.tone !== v[0]) chip.dataset.tone = v[0];
    if ($('chip-sensor-text').textContent !== v[1]) $('chip-sensor-text').textContent = v[1];
    $('demo-button').textContent = S.demo ? 'End demo' : 'Try a demo';
    $('bt-info').dataset.tone = v[0]; $('bt-state').textContent = v[2]; $('bt-why').textContent = v[3];
    $('ble-connect').textContent = S.bt === 'live' || S.bt === 'connected' ? 'Connected' : S.bt === 'idle' ? 'Connect' : 'Try again';
    $('ble-connect').disabled = S.bt === 'unsupported' || S.bt === 'requesting';
    $('demo-sheet-ride').textContent = S.demo ? 'End demo' : 'Run demo';
    $('replay-stop').hidden = !ride.replayOn;
    const spoken = `${label}.`;
    if ($('sr-status').textContent !== spoken) $('sr-status').textContent = spoken;
  }
  ride.on('state', renderStates);

  /* ---- per frame: the frame's own state, ten times a second ---- */
  let lastText = 0;
  function pageFrame(now) {
    const playing = S.demo || ride.replayOn || S.rpm > 2;
    document.body.classList.toggle('playing', playing);
    shell.quietTick(now, playing);
    if (now - lastText > 120) { lastText = now; renderStates(); }
  }

  const cv = $('stage');
  const G = createGL(cv);
  // A CPU WebGL renderer cannot afford the hardware pixel budget even for its
  // first frame. UI remains full resolution; only the scenery is scaled.
  const softwareRenderer = (() => {
    if (!G) return false;
    const g = G.gl, ext = g.getExtension('WEBGL_debug_renderer_info');
    const renderer = g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER) || '';
    return /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(renderer);
  })();
  const sceneBudget = softwareRenderer ? 80000 : 1.35e6;
  const minScale = (softwareRenderer ? 20000 : 60000) / sceneBudget;
  const maxScale = softwareRenderer ? 1 : 1.9;
  let gl, Post, pScene, pDream, pMote, tNoise, tSpec;
  let scene, dreamA, dreamB, rw = 0, rh = 0, frameIdx = 0, lastScale = 1;
  const specBytes = new Uint8Array(BANDS), ridge = new Float32Array(BANDS);

  const ringData = new Float32Array(12 * 4);
  const rings = [];
  ride.on('recording', () => {
    ride.noteLane('routeStart', { biome: S.biomeNext, seed: S.seed, tod: S.tod, vis: S.vis, dist: S.dist, map: { ...S.map } });
  });
  ride.on('lane', (l) => {
    if (l.name === 'routeStart') {
      const v = l.value;
      if (!v || typeof v !== 'object') return;
      if (BIOMES[v.biome]) setBiome(v.biome, true);
      if (TOD[v.tod]) setTod(v.tod, true);
      for (const k of ['seed','vis','dist']) if (Number.isFinite(v[k])) S[k] = v[k];
      const limits = { idle: [0,60], max: [60,130], maxZoom: [.004,.04], gamma: [.6,3.2] };
      if (v.map) for (const k of Object.keys(limits)) if (Number.isFinite(v.map[k])) S.map[k] = clamp(v.map[k], ...limits[k]);
      for (const [id,key,scale,label,suffix] of [['idle','idle',1,'v-idle',' rpm'],['max','max',1,'v-max',' rpm'],['zoom','maxZoom',1000,'v-zoom','%'],['gamma','gamma',100,'v-gamma','']]) {
        const input = $('m-'+id); input.value = S.map[key]*scale; shell.syncRange(input);
        $(label).textContent = (id==='zoom' ? (S.map[key]*100).toFixed(1) : id==='gamma' ? S.map[key].toFixed(2) : S.map[key]) + suffix;
      }
      S.nextSceneAt = S.dist + M_PER_MI;
      thumbAt = 0;
    }
    else if (l.name === 'rpm') S.replayRpm = l.value;
    else if (l.name === 'biome') setBiome(l.value);
    else if (l.name === 'seed') { S.seed = l.value; thumbAt = 0; }
    else if (l.name === 'tod') setTod(l.value, true);
  });
  ride.on('replay', (on) => { if (!on) S.replayRpm = null; });

  /* ---- scenery: five scenes, the time of day and a look, all on the main screen, and remembered ---- */
  const SAVE_KEY = 'endless-cockpit-scenery';
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ b: S.biomeNext, tod: S.tod, look: S.look, dream: S.dream, wild: S.wild, auto: S.autoScene })); } catch (e) { /* storage can be off */ } };
  const pressOnly = (sel, on) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(on(b))));
  function setBiome(i, instant) {
    if (i === S.biomeNext && !instant) return;
    S.fromMix = instant ? null : sceneNow();
    S.biome = instant ? i : S.biomeNext; S.biomeNext = i; S.biomeT = instant ? 1 : 0;
    ride.noteLane('biome', i);
    pressOnly('.scene-tile', (b) => +b.dataset.b === i);
    document.body.style.setProperty('--accent', BIOMES[i].edge);
    $('route-caption').textContent = BIOMES[i].description;
    save();
  }
  function nextBiome() { setBiome((S.biomeNext + 1) % BIOMES.length); }
  function setTod(i, quiet) {
    S.tod = i; S.duskHold = TOD[i].v;
    pressOnly('[data-tod]', (b) => +b.dataset.tod === i);
    ride.noteLane('tod', i);
    if (!quiet) shell.toast(`Time of day · ${TOD[i].label}`);
    save();
  }
  function setLook(k, quiet) {
    const L = LOOKS[k];
    if (!quiet) shell.toast(`Look · ${L.label}`);
    S.look = k; S.dream = L.dream; S.wild = L.wild;
    ['dream', 'wild'].forEach((id) => { const r = $(id); if (!r) return; r.value = Math.round(S[id] * 100); shell.syncRange(r); $(`${id}-v`).textContent = `${r.value}%`; });
    pressOnly('[data-look]', (b) => b.dataset.look === k);
    save();
  }
  function setAuto(on) {
    S.autoScene = on; S.nextSceneAt = S.dist + M_PER_MI;
    $('auto-scene').setAttribute('aria-pressed', String(on));
    save();
  }
  $('scene-tiles').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) setBiome(+b.dataset.b); });
  document.querySelectorAll('[data-tod]').forEach((b) => b.addEventListener('click', () => setTod(+b.dataset.tod)));
  document.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => setLook(b.dataset.look)));
  $('auto-scene').addEventListener('click', () => setAuto(!S.autoScene));
  $('new-route').addEventListener('click', () => { S.seed = (Math.random() * 40) | 0; thumbAt = 0; ride.noteLane('seed', S.seed); shell.toast('New route'); });
  S.tod = 0; S.look = 'clear'; S.autoScene = true; S.nextSceneAt = M_PER_MI;
  document.body.style.setProperty('--accent', BIOMES[0].edge);

  /* ---- sheet controls ---- */
  const bind = (id, get, set, fmt, label) => {
    const r = $(id);
    r.value = get();
    shell.syncRange(r);
    const lab = $(label);
    if (lab) lab.textContent = fmt(+r.value);
    r.addEventListener('input', () => { shell.syncRange(r); set(+r.value); if (lab) lab.textContent = fmt(+r.value); drawCurve(); });
  };
  bind('dream', () => S.dream * 100, (v) => { S.dream = v / 100; }, (v) => `${Math.round(v)}%`, 'dream-v');
  bind('wild', () => S.wild * 100, (v) => { S.wild = v / 100; }, (v) => `${Math.round(v)}%`, 'wild-v');
  ['dream', 'wild'].forEach((id) => $(id).addEventListener('input', () => { S.look = null; pressOnly('[data-look]', () => false); save(); }));
  // A visit picks up where the last one left off.
  (() => {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { /* storage can be off */ }
    if (!v) return;
    if (BIOMES[v.b]) setBiome(v.b, true);
    if (TOD[v.tod]) setTod(v.tod, true);
    if (LOOKS[v.look]) setLook(v.look, true);
    else if (typeof v.dream === 'number' && typeof v.wild === 'number') { setLook('dreamy', true); S.look = null; S.dream = clamp(v.dream, 0, 1); S.wild = clamp(v.wild, 0, 1); pressOnly('[data-look]', () => false); ['dream', 'wild'].forEach((id) => { const r = $(id); r.value = Math.round(S[id] * 100); shell.syncRange(r); $(`${id}-v`).textContent = `${r.value}%`; }); }
    if (typeof v.auto === 'boolean') setAuto(v.auto);
  })();
  bind('m-idle', () => S.map.idle, (v) => { S.map.idle = v; }, (v) => `${v} rpm`, 'v-idle');
  bind('m-max', () => S.map.max, (v) => { S.map.max = v; }, (v) => `${v} rpm`, 'v-max');
  bind('m-zoom', () => S.map.maxZoom * 1000, (v) => { S.map.maxZoom = v / 1000; }, (v) => `${(v / 10).toFixed(1)}%`, 'v-zoom');
  bind('m-gamma', () => S.map.gamma * 100, (v) => { S.map.gamma = v / 100; }, (v) => (v / 100).toFixed(2), 'v-gamma');
  bind('steady', () => 0, (v) => { S.steady = v > 0 ? v : null; }, (v) => (v > 0 ? `${v} rpm` : 'off'), 'steady-v');
  $('demo-sheet-ride').addEventListener('click', () => { S.demo = !S.demo; S.demoT = 0; if (S.demo) $('connect-sheet').close(); });

  /* the pedal button lives on the stage */
  const pedalBtn = document.createElement('button');
  pedalBtn.className = 'pill primary chrome'; pedalBtn.id = 'pedal'; pedalBtn.textContent = 'Hold to pedal';
  document.querySelector('.dock-wrap').insertBefore(pedalBtn, document.querySelector('.badges'));
  const pedalOn = () => { S.pedal = true; pedalBtn.classList.add('on'); };
  const pedalOff = () => { S.pedal = false; pedalBtn.classList.remove('on'); };
  pedalBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pedalOn(); });
  pedalBtn.addEventListener('contextmenu', (e) => e.preventDefault());     // a long press on a phone is pedaling, not a menu
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => pedalBtn.addEventListener(ev, pedalOff));
  addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && !e.target.closest('dialog[open], input, select, button')) { e.preventDefault(); pedalOn(); } });
  addEventListener('keyup', (e) => { if (e.code === 'Space') pedalOff(); });
  /* ---- recording and replay: cadence, scene and route, with an optional video of the screen ---- */
  let recorder = null;
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  $('rec-toggle').addEventListener('click', () => {
    if (!ride.recording) {
      ride.startRecording('endless-cockpit', S.demo);
      if ($('rec-video').checked && cv.captureStream && window.MediaRecorder) {
        const st = cv.captureStream(60);
        const sound = rideSoundStream();
        if (sound) sound.getAudioTracks().forEach((t) => st.addTrack(t));
        const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
        const chunks = [];
        const activeRecorder = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: 14e6 } : {});
        recorder = activeRecorder;
        activeRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        activeRecorder.onstop = () => {
          shell.download(new Blob(chunks, { type: activeRecorder.mimeType }), `endless-cockpit-${stamp()}.${(activeRecorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`);
          st.getVideoTracks().forEach((track) => track.stop());
        };
        activeRecorder.start(1000);
      }
      $('rec-toggle').textContent = 'Stop and save';
      $('session-button').classList.add('rec');
      $('rec-status').textContent = 'Recording. Ride, then press Stop and save.';
    } else {
      const s = ride.stopRecording();
      if (recorder) { recorder.stop(); recorder = null; }
      shell.download(new Blob([JSON.stringify(s)], { type: 'application/json' }), `endless-cockpit-ride-${stamp()}.json`);
      $('rec-toggle').textContent = 'Start recording';
      $('session-button').classList.remove('rec');
      $('rec-status').textContent = `Saved ${Math.round(s.durationMs / 1000)} s of riding.`;
    }
  });
  $('replay-load').addEventListener('click', () => $('replay-file').click());
  $('replay-stop').addEventListener('click', () => ride.stopReplay());
  $('replay-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      S.demo = false;
      ride.startReplay(s);
      $('rec-status').textContent = `Replaying a ride from ${new Date(s.created).toLocaleString()}.`;
      $('session-sheet').close();
    } catch (err) { $('rec-status').textContent = `That file could not be replayed: ${err.message}`; }
  });
  $('snapshot').addEventListener('click', () => snap((blob) => shell.download(blob, `endless-cockpit-${stamp()}.png`)));

  /* ---- Bluetooth cadence, ported unchanged from the first version: CSC and FTMS ---- */
  let lastCrankRev = null, lastCrankT = null;
  function onCSC(e) {
    const dv = e.target.value, flags = dv.getUint8(0);
    let off = 1;
    if (flags & 0x01) off += 6;
    if (flags & 0x02) {
      const crankRev = dv.getUint16(off, true); off += 2;
      const crankT = dv.getUint16(off, true);
      if (lastCrankRev != null) {
        let dRev = crankRev - lastCrankRev; if (dRev < 0) dRev += 65536;
        let dT = crankT - lastCrankT; if (dT < 0) dT += 65536;
        const secs = dT / 1024;
        if (secs > 0 && S.bt !== 'lost') { const rpm = (dRev / secs) * 60; if (rpm < 250) { S.ble = rpm; S.bleT = performance.now(); S.bt = 'live'; } }
        if (dRev === 0 && secs > 1.5) { S.ble = 0; S.bleT = performance.now(); }
      }
      lastCrankRev = crankRev; lastCrankT = crankT;
    }
  }
  function onFTMS(e) {
    const dv = e.target.value, flags = dv.getUint16(0, true);
    let off = 2;
    if (!(flags & 0x0001)) off += 2;
    if (flags & 0x0002) off += 2;
    if (flags & 0x0004 && S.bt !== 'lost') { const cad = dv.getUint16(off, true) * 0.5; if (cad >= 0 && cad < 250) { S.ble = cad; S.bleT = performance.now(); S.bt = 'live'; } }
  }
  $('ble-connect').addEventListener('click', async () => {
    if (!navigator.bluetooth) { S.bt = 'unsupported'; return; }
    try {
      S.bt = 'requesting';
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['cycling_speed_and_cadence'] }, { services: ['fitness_machine'] }], optionalServices: ['cycling_speed_and_cadence', 'fitness_machine'] });
      S.btName = dev.name || 'Cadence sensor';
      const gatt = await dev.gatt.connect();
      let svc, ch, kind;
      try { svc = await gatt.getPrimaryService('cycling_speed_and_cadence'); ch = await svc.getCharacteristic('csc_measurement'); kind = 'csc'; } catch (e) { svc = await gatt.getPrimaryService('fitness_machine'); ch = await svc.getCharacteristic('indoor_bike_data'); kind = 'ftms'; }
      await ch.startNotifications();
      ch.addEventListener('characteristicvaluechanged', kind === 'csc' ? onCSC : onFTMS);
      S.ble = 0; S.bleT = -1e12; S.bt = 'connected';     // no reading yet: a zero time would look fresh for the page's first 3 s
      dev.addEventListener('gattserverdisconnected', () => { S.ble = null; S.bt = 'lost'; });
    } catch (err) {
      S.ble = null;
      if (err.name === 'NotFoundError') S.bt = 'no-choice';
      else { S.bt = 'failed'; S.btWhy = `The sensor did not connect: ${err.message}`; }
    }
  });
  if (!navigator.bluetooth) S.bt = 'unsupported';

  /* ---- ride sound: cadence-driven atoms, ported from the first version, off by default ---- */
  const ATOMS = [[98, 130.81, 196, 246.94, 293.66, 392, 493.88], [110, 146.83, 220, 277.18, 329.63, 440, 554.37], [130.81, 164.81, 196, 261.63, 392, 523.25, 659.25], [123.47, 164.81, 246.94, 329.63, 493.94, 659.25, 987.77], [82.41, 110, 164.81, 220, 277.18, 329.63, 415.3]];
  let AC = null, sndOn = false, sndGain = null, sndDest = null, nextGrain = 0;
  const rideSoundStream = () => (sndOn && sndDest ? sndDest.stream : null);
  function curAtoms() { const a = ATOMS[S.biome], b = ATOMS[S.biomeNext], t = S.biomeT; return a.map((v, i) => lerp(v, b[i], t)); }
  function grainTick() {
    if (!AC || !sndOn) return;
    const rate = Math.min(24, (S.rpm / 130) * 24);
    if (nextGrain < AC.currentTime) nextGrain = AC.currentTime + 0.02;
    if (rate < 0.5) { nextGrain = AC.currentTime + 0.08; return; }
    const atoms = curAtoms();
    let budget = 0;
    while (nextGrain < AC.currentTime + 0.12 && budget < 8) {
      const t = nextGrain, o = AC.createOscillator(), g = AC.createGain();
      o.type = S.wild > 0.6 ? 'triangle' : 'sine';
      o.frequency.value = atoms[(Math.random() * atoms.length) | 0] * (1 + (Math.random() - 0.5) * 0.012);
      const dur = 0.07 + Math.random() * 0.1, peak = 0.1 + S.wild * 0.06;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(sndGain); o.start(t); o.stop(t + dur + 0.01);
      nextGrain += 1 / rate; budget++;
    }
  }
  $('ride-sound').addEventListener('click', function () {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); sndGain = AC.createGain(); sndGain.gain.value = 0; sndGain.connect(AC.destination); sndDest = AC.createMediaStreamDestination(); sndGain.connect(sndDest); setInterval(grainTick, 45); }
    if (AC.state === 'suspended') AC.resume();
    sndOn = !sndOn;
    this.textContent = `Ride sound: ${sndOn ? 'on' : 'off'}`; this.classList.toggle('on', sndOn);
    sndGain.gain.linearRampToValueAtTime(sndOn ? 0.5 : 0, AC.currentTime + 0.25);
  });

  /* ---- small canvases in the Route sheet ---- */
  function drawElStrip() {
    const c = $('elstrip').getContext('2d'), w = 880, h = 110;
    c.clearRect(0, 0, w, h);
    const pts = [], span = 1400;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 200; i++) { const y = roadY(S.vis + (i / 200) * span); pts.push(y); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const Y = (v) => h - 14 - ((v - lo) / Math.max(1, hi - lo)) * (h - 34);
    c.beginPath(); pts.forEach((v, i) => { const x = (i / 200) * w; if (i) c.lineTo(x, Y(v)); else c.moveTo(x, Y(v)); });
    c.lineTo(w, h); c.lineTo(0, h); c.closePath();
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `${BIOMES[S.biomeNext].edge}66`); g.addColorStop(1, `${BIOMES[S.biomeNext].edge}05`);
    c.fillStyle = g; c.fill();
    c.beginPath(); pts.forEach((v, i) => { const x = (i / 200) * w; if (i) c.lineTo(x, Y(v)); else c.moveTo(x, Y(v)); });
    c.strokeStyle = BIOMES[S.biomeNext].edge; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(4, Y(pts[0]), 4.5, 0, 6.3); c.fill();
    $('grade-read').textContent = `grade ${(S.grade * 100 >= 0 ? '+' : '') + (S.grade * 100).toFixed(1)}%`;
  }
  function drawCurve() {
    const c = $('curve').getContext('2d'), w = 880, h = 170;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(191,194,236,.16)'; c.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f) => { c.beginPath(); c.moveTo(0, f * h); c.lineTo(w, f * h); c.stroke(); });
    const X = (rpm) => (rpm / 130) * w, Y = (m) => h - 10 - m * (h - 20);
    c.beginPath();
    for (let r = 0; r <= 130; r += 1) { const y = Y(motion01(r)); if (r) c.lineTo(X(r), y); else c.moveTo(X(r), y); }
    c.strokeStyle = BIOMES[S.biomeNext].edge; c.lineWidth = 2.4; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(X(clamp(S.rpm, 0, 130)), Y(motion01(S.rpm)), 6, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(238,237,251,.7)'; c.font = '19px ui-sans-serif,-apple-system,sans-serif';
    c.fillText(`${Math.round(S.rpm)} rpm → ${(S.zoom * 100).toFixed(2)}% a frame`, 14, 28);
  }

  /* ---- snapshot ---- */
  let wantSnap = null;
  function snap(done) { wantSnap = done; }

  /* ---- motion: fixed step, so a replay lands in the same place at any frame rate ---- */
  function targetRpm(h) {
    if (S.replayRpm != null) return S.replayRpm;
    if (S.ble != null) return performance.now() - S.bleT < 3000 ? S.ble : 0;
    if (S.pedal) return 88;
    if (S.steady != null) return S.steady;
    if (S.demo) { S.demoT += h; const t = S.demoT % 40; return t < 12 ? 62 : t < 24 ? 92 : t < 30 ? 108 : 48; }
    return 0;
  }
  let acc = 0, rpmAcc = 0;
  const H = 1 / 120;
  function step() {
    const tau = S.ble != null ? 0.18 : 0.32;
    S.rpm += (targetRpm(H) - S.rpm) * (1 - Math.exp(-H / tau));
    if (S.rpm < 0.3) S.rpm = Math.max(0, S.rpm - H * 8);
    const m = motion01(S.rpm);
    S.zoom = m * S.map.maxZoom;
    S.grade = gradeAt(S.vis);
    S.speed = m * MAX_SPEED * gradeFactor(S.grade);
    S.surge *= Math.exp(-H / 0.28);
    S.rev += (S.rpm / 60) * H;
    while (S.rev >= 1) { S.rev -= 1; rings.push({ z: S.vis + 2, t: performance.now(), v: 0.35 + 0.4 * m, k: 0 }); if (rings.length > 12) rings.shift(); }
    const surgeV = (RM.matches ? 0.2 : 1) * S.surge * 6;
    S.dist += S.speed * H;                                 // distance counts driven speed only, never the idle drift
    S.vis += (S.speed + surgeV + S.ambient * (1 - m)) * H;
    S.shakeV += -S.shake * 90 * H; S.shakeV *= Math.exp(-H / 0.09); S.shake += S.shakeV * H;
  }

  /* ---- one scene's sky and land at a time of day: the road and the scene tiles both draw from this ---- */
  const NUMS = ['amp', 'ridge', 'trees', 'sea', 'snow', 'strata', 'grid', 'fogK', 'sunAz', 'sunEl', 'coast', 'forest', 'meadow', 'alpine', 'canyon', 'width', 'turn', 'rise', 'winding'];
  // The scene on screen right now, frozen, so a new choice blends from it instead of jumping back to a scene's start.
  function sceneNow() {
    const a = S.fromMix || BIOMES[S.biome], b = BIOMES[S.biomeNext], t = S.biomeT * S.biomeT * (3 - 2 * S.biomeT);
    const m = { c: {} };
    Object.keys(b.c).forEach((k) => { m.c[k] = a.c[k].map((v, i) => lerp(v, b.c[k][i], t)); });
    NUMS.forEach((k) => { m[k] = lerp(a[k], b[k], t); });
    return m;
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
      uCoast: mixN('coast'), uForest: mixN('forest'), uMeadow: mixN('meadow'), uAlpine: mixN('alpine'), uCanyon: mixN('canyon'), uWidth: mixN('width'), uRouteA: ['coast','forest','meadow','alpine'].map(mixN), uRouteB: mixN('canyon'),
      uAmp: mixN('amp'), uRidge: mixN('ridge'), uSea: mixN('sea'), uSnow: mixN('snow'), uStrata: mixN('strata'), uGrid: mixN('grid'), uTrees: mixN('trees'), uDusk: dusk, uFogK: mixN('fogK'),
    };
  }
  /* ---- the camera on the road at z, looking ahead along it, toward the low sun ---- */
  function camAt(z, roll, b) {
    const cx = pathX(z, b), cy = roadY(z, b) + 1.65, look = 26;
    let fx = pathX(z + look, b) - cx, fy = roadY(z + look, b) + 1.1 - cy, fz = look;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = fz, ry = 0, rz = -fx;
    const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    let ux = -ry * fz + rz * fy, uy = rx * fz - rz * fx, uz = ry * fx - rx * fy;
    if (uy < 0) { ux = -ux; uy = -uy; uz = -uz; }
    const cr = Math.cos(roll), sr = Math.sin(roll);
    return { cx, cy, fwd: [fx, fy, fz], right: [rx * cr + ux * sr, ry * cr + uy * sr, rz * cr + uz * sr], up: [ux * cr - rx * sr, uy * cr - ry * sr, uz * cr - rz * sr] };
  }

  /* ---- scene tiles: each scene drawn small by the road's own shader, at the current time of day ---- */
  const THUMB_FS = FS_HEAD + `
uniform sampler2D uScene; uniform float uExposure;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){ vec3 c=aces(texture(uScene,vUv).rgb*uExposure); vec2 q=vUv-.5; c*=1.-.45*smoothstep(.25,.95,dot(q,q)*2.1); o=vec4(pow(c,vec3(1./2.2)),1.); }`;
  const noRings = new Float32Array(12 * 4);
  let pThumb = null, thumbHDR = null, thumbLDR = null, thumbPx = null, thumbAt = 0, thumbDusk = -1;
  function drawThumbs(now) {
    const small = softwareRenderer || lastScale < .2, TW = small ? 144 : 336, TH = small ? 84 : 196;
    if (!pThumb) pThumb = G.program(THUMB_FS);
    if (!thumbHDR || thumbHDR.w !== TW) {
      if (thumbHDR) { G.freeTarget(thumbHDR); G.freeTarget(thumbLDR); }
      thumbHDR = G.target(TW, TH);
      thumbLDR = G.target(TW, TH, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE }); thumbPx = new Uint8Array(TW * TH * 4);
    }
    const z = S.vis + 60, tiles = document.querySelectorAll('.scene-tile canvas');
    gl.disable(gl.BLEND);
    BIOMES.forEach((b, i) => {
      const cam = camAt(z, 0, b);
      G.into(thumbHDR); G.bindTex(0, tNoise); G.bindTex(1, tSpec);
      G.use(pScene, Object.assign({ uN: 0, uS: 1, uRes: [TW, TH], uT: now / 1000, uFocal: 1.08, uBeat: 6, uSeed: S.seed, uCam: [cam.cx, cam.cy, z], uRight: cam.right, uUp: cam.up, uFwd: cam.fwd, uSpark: 0, uRing: noRings }, landAt(b, b, 1, S.dusk)));
      G.draw();
      G.into(thumbLDR); G.bindTex(0, thumbHDR.tex);
      G.use(pThumb, { uScene: 0, uExposure: 0.98 + S.dusk * 0.25 });
      G.draw();
      gl.readPixels(0, 0, TW, TH, gl.RGBA, gl.UNSIGNED_BYTE, thumbPx);
      tiles[i].width = TW; tiles[i].height = TH;
      const c = tiles[i].getContext('2d'), img = c.createImageData(TW, TH);
      for (let y = 0; y < TH; y++) img.data.set(thumbPx.subarray((TH - 1 - y) * TW * 4, (TH - y) * TW * 4), y * TW * 4);     // GL rows run bottom up
      c.putImageData(img, 0, 0);
    });
    thumbAt = now; thumbDusk = S.dusk;
  }

  /* ---- frame ---- */
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.max(320, Math.min(3840, Math.round(cv.clientWidth * dpr))), Hh = Math.max(240, Math.min(2160, Math.round(cv.clientHeight * dpr)));
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    const budget = sceneBudget * lastScale, asp = W / Hh;
    let h = Math.round(Math.sqrt(budget / asp)), w = Math.round(h * asp);
    if (w > W) { w = W; h = Hh; }
    if (w === rw && h === rh) return;
    rw = w; rh = h;
    [scene, dreamA, dreamB].forEach((T) => T && G.freeTarget(T));
    scene = G.target(rw, rh); dreamA = G.target(rw, rh); dreamB = G.target(rw, rh);
    Post.resize(rw, rh, 5);
  }

  let last = performance.now(), slow = 0, fast = 0, stalled = 0, fails = 0;
  function render(now) {
    requestAnimationFrame(render);
    try {
      const frameMs = now - last, dtMs = Math.min(100, frameMs);
      last = now;
      ride.tick(now);
      pageFrame(now);
      if (!G || gl.isContextLost()) return;

      acc += dtMs / 1000;
      let n = 0;
      while (acc >= H && n < 24) { step(); acc -= H; n++; }
      if (n === 24) acc = 0;
      rpmAcc += dtMs;
      if (rpmAcc > 100) { rpmAcc = 0; ride.noteLane('rpm', +S.rpm.toFixed(1)); }
      if (S.biomeT < 1) { S.biomeT = Math.min(1, S.biomeT + dtMs / 6000); if (S.biomeT === 1) S.fromMix = null; }
      if (S.autoScene && !ride.replayOn && S.dist >= S.nextSceneAt) {
        S.nextSceneAt = S.dist + M_PER_MI;
        nextBiome();
        shell.toast(`New scenery · ${BIOMES[S.biomeNext].name}`);
      }
      if (frameIdx > 2 && (!thumbAt || (now - thumbAt > 4000 && Math.abs(S.dusk - thumbDusk) > 0.04 && !document.body.classList.contains('quiet')))) drawThumbs(now);
      S.dusk = S.duskHold != null ? S.dusk + (S.duskHold - S.dusk) * Math.min(1, dtMs / 900) : RM.matches ? S.dusk : 0.5 - 0.5 * Math.cos((now / 1000 / 240 + 0.14) * Math.PI * 2);

      // React to sustained stalls before waiting 90 expensive frames. This also
      // covers browsers that hide renderer metadata and genuinely weak GPUs.
      if (frameMs > 120) stalled++; else stalled = 0;
      if (frameMs > 26) slow++; else if (frameMs < 20) fast++;
      frameIdx++;
      if (stalled >= 2 && lastScale > minScale) {
        lastScale = Math.max(minScale, lastScale * .5); resize();
        stalled = 0; slow = 0; fast = 0;
      } else if (frameIdx % 15 === 0 && slow > 10 && lastScale > minScale) {
        lastScale = Math.max(minScale, lastScale * .75); resize();
        slow = 0; fast = 0;
      } else if (frameIdx % 90 === 0) {
        if (fast > 80 && lastScale < maxScale) { lastScale = Math.min(maxScale, lastScale * 1.2); resize(); }
        slow = 0; fast = 0;
      }

      /* uniforms */
      const land = landAt(S.fromMix || BIOMES[S.biome], BIOMES[S.biomeNext], S.biomeT, S.dusk);
      const z = S.vis;
      const curveRoll = RM.matches ? 0 : clamp((pathX(z + 12) - 2 * pathX(z + 6) + pathX(z)) * 0.012, -0.07, 0.07);
      S.roll += (curveRoll + S.shake * 0.02 - S.roll) * Math.min(1, dtMs / 200);
      const cam = camAt(z, S.roll), right = cam.right, up = cam.up, fwd = cam.fwd;
      const camX = cam.cx + S.shake * 0.05, camY = cam.cy + (RM.matches ? 0 : Math.sin(S.vis * 0.9) * 0.018 * motion01(S.rpm));
      const focal = 1.08;

      for (let i = 0; i < 12; i++) {
        const r = rings[rings.length - 1 - i], o = i * 4;
        if (r) { ringData[o] = r.z; ringData[o + 1] = (now - r.t) / 1000; ringData[o + 2] = r.v; ringData[o + 3] = r.k; } else { ringData[o + 2] = 0; }
      }
      for (let i = 0; i < BANDS; i++) {
        // A far range that drifts past as you ride: stated value noise, not a measurement.
        const x = i * 0.23 + S.vis * 0.0012 + S.seed;
        const n = 0.5 * Math.sin(x * 1.7) + 0.3 * Math.sin(x * 3.1 + 1.3) + 0.2 * Math.sin(x * 6.3 + 2.1);
        ridge[i] = 0.16 + 0.12 * n + 0.08 * motion01(S.rpm);
        specBytes[i] = Math.round(Math.max(0, Math.min(1, ridge[i])) * 255);
      }
      G.bindTex(1, tSpec);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BANDS, 1, gl.RED, gl.UNSIGNED_BYTE, specBytes);

      const beatLen = Math.max(6, (S.rpm > 5 ? 60 / S.rpm : 0.6) * Math.max(10, S.speed));   // one dash per revolution

      /* scene */
      gl.disable(gl.BLEND);
      G.into(scene);
      G.bindTex(0, tNoise); G.bindTex(1, tSpec);
      G.use(pScene, Object.assign({
        uN: 0, uS: 1, uRes: [rw, rh], uT: now / 1000, uFocal: focal, uBeat: beatLen, uSeed: S.seed,
        uCam: [camX, camY, z], uRight: right, uUp: up, uFwd: fwd,
        uSpark: 0.12 * motion01(S.rpm), uRing: ringData,
      }, land));
      G.draw();

      /* motes */
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      G.use(pMote, { uCam: [camX, camY, z], uRight: right, uUp: up, uFwd: fwd, uFocal: focal, uAsp: rw / rh, uZ: z, uPx: rh * 0.09, uSeed: S.seed, uSpeedN: motion01(S.rpm), uEdge: land.uEdge, uRouteA: land.uRouteA, uRouteB: land.uRouteB });
      if(S.look !== 'clear') gl.drawArrays(gl.POINTS, 0, 650);
      gl.disable(gl.BLEND);

      /* feedback */
      const asp = rw / rh;
      const vpP = [pathX(z + 90) - camX, roadY(z + 90) + 1 - camY, 90];
      const cz = vpP[0] * fwd[0] + vpP[1] * fwd[1] + vpP[2] * fwd[2];
      const vp = [0.5 + ((vpP[0] * right[0] + vpP[1] * right[1] + vpP[2] * right[2]) * focal) / cz / asp / 2, 0.5 + ((vpP[0] * up[0] + vpP[1] * up[1] + vpP[2] * up[2]) * focal) / cz / 2];
      const fpsScale = dtMs / 16.67;
      const zoomNow = RM.matches ? S.zoom * 0.4 : 1 - Math.pow(1 - (S.zoom + S.surge * 0.003 + 0.0012), fpsScale);
      G.into(dreamB);
      G.bindTex(0, scene.tex); G.bindTex(1, dreamA.tex);
      G.use(pDream, { uScene: 0, uPrev: 1, uVP: vp, uZoom: zoomNow, uDream: RM.matches ? S.dream * 0.5 : S.dream, uWild: S.wild, uT: now / 1000 });
      G.draw();
      const tmp = dreamA; dreamA = dreamB; dreamB = tmp;

      /* bloom and grade */
      const bloom = Post.bloom(dreamA.tex, 1.15);
      Post.finish(dreamA.tex, bloom, {
        uBloomK: 0.25, uExposure: 0.98 + S.dusk * 0.25,
        uFlash: 0, uFlashC: [1, 0.93, 0.82], uGrain: 0.022, uT: now / 1000, uVig: 0.25, uSat: 1.02, rate: RM.matches ? 0.16 : 0.36, maxGain: 1,
      }, dtMs / 1000);

      if (lumaRec) lumaRec(now);
      if (wantSnap) { const done = wantSnap; wantSnap = null; cv.toBlob((blob) => done(blob), 'image/png'); }

      /* readouts */
      if (frameIdx % 6 === 0) {
        $('g-speed').textContent = ((S.speed * 3600) / M_PER_MI).toFixed(1);
        $('g-dist').textContent = (S.dist / M_PER_MI).toFixed(2);
        const heroVal = S.rpm > 0.5 ? Math.round(S.rpm) : '--';
        $('g-hero').textContent = heroVal;
        if ($('route-sheet').open) { drawElStrip(); drawCurve(); }
      }
    } catch (e) {
      if (fails++ < 3) console.error(e);
    }
  }

  /* ---- boot ---- */
  if (!G) {
    shell.glFail('This page draws with WebGL2, which this browser did not provide. The cadence readings below still work.');
    const idle = (now) => { requestAnimationFrame(idle); ride.tick(now); pageFrame(now); };
    requestAnimationFrame(idle);
  } else {
    gl = G.gl;
    try {
      Post = createPost(G);
      pScene = G.program(SCENE_FS);
      pDream = G.program(DREAM_FS);
      pMote = G.program(MOTE_FS, MOTE_VS);
      tNoise = G.noiseTexture(20261102);
      tSpec = G.tex(BANDS, 1, { internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE });
      resize();
      addEventListener('resize', resize);
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); shell.glFail('The graphics context was lost. Reload the page to get the picture back.'); });
      requestAnimationFrame(render);
    } catch (e) {
      console.error(e);
      shell.glFail(`The picture could not start on this graphics card: ${String(e.message).slice(0, 140)}`);
    }
  }

  // For the flicker check: record the picture's brightness on a small grid, on every frame, straight after it is drawn.
  let lumaRec = null;
  function recordLuma(ms) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const g = c.getContext('2d', { willReadFrequently: true }), frames = [], t0 = performance.now();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';        // a true area average, not a few sampled pixels
    return new Promise((res) => {
      lumaRec = (now) => {
        g.drawImage(cv, 0, 0, 64, 36);
        const d = g.getImageData(0, 0, 64, 36).data, grid = [];
        for (let i = 0; i < d.length; i += 4) grid.push(+(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]).toFixed(1));
        frames.push({ t: +(now - t0).toFixed(1), grid });
        if (now - t0 > ms) { lumaRec = null; res(frames); }
      };
    });
  }

  /* for the checks: read what is really on the canvas and in the engine */
  window.__app = {
    S, ride, BIOMES, pathX, roadY, gradeAt, motion01, recordLuma, setBiome, nextBiome, setTod, setLook, setAuto, drawThumbs,
    get renderInfo() { return { softwareRenderer, width: rw, height: rh, pixelBudget: sceneBudget * lastScale }; },
    pixel() {
      const c = document.createElement('canvas'); c.width = 32; c.height = 18;
      const g = c.getContext('2d');
      return new Promise((res) => { wantSnap = (blob) => { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, 32, 18); const d = g.getImageData(0, 0, 32, 18).data; let sum = 0, min = 1e9, max = 0; const grid = []; for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722; sum += l; min = Math.min(min, l); max = Math.max(max, l); grid.push(l); } res({ mean: sum / (d.length / 4), min, max, grid }); }; im.src = URL.createObjectURL(blob); }; });
    },
  };
})();
