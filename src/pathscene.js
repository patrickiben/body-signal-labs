/* pathscene.js: Biofeedback Path Cockpit's road. Forked from endless.js: the same height field, feedback and biomes,
   plus a gas cloud in the sky, haze that hides the sun, a breathing halo, a ghost light and a dotted orbit. */
(function (global) {
  'use strict';
  const { FS_HEAD, srgb } = GLKit;

  const BIOMES = [
    { name: 'Golden coast', skyTop: '#2e4f8a', skyHz: '#ffb077', sun: '#ffd49a', ground: '#55452e', rock: '#7a5a3c', fog: '#ffc898', edge: '#ffd36b', amp: 58, ridge: 0.38, trees: 0.25, sea: 1, snow: 0, strata: 0, grid: 0, fogK: 0.0034, sunAz: 0.12, sunEl: 0.1 },
    { name: 'Misty pines', skyTop: '#1f3a50', skyHz: '#a7c9c2', sun: '#ffe8c6', ground: '#1e3a2f', rock: '#39494a', fog: '#b0d3cc', edge: '#7ff0dd', amp: 64, ridge: 0.22, trees: 1, sea: 0, snow: 0, strata: 0, grid: 0, fogK: 0.0062, sunAz: -0.3, sunEl: 0.16 },
    { name: 'Neon forest', skyTop: '#120829', skyHz: '#5e2496', sun: '#ff74d4', ground: '#120b26', rock: '#28144d', fog: '#7c42bb', edge: '#ef86ff', amp: 48, ridge: 0.55, trees: 0.8, sea: 0, snow: 0, strata: 0, grid: 1, fogK: 0.0052, sunAz: 0.02, sunEl: 0.07 },
    { name: 'High alpine', skyTop: '#23548f', skyHz: '#c6def2', sun: '#fff2d8', ground: '#465660', rock: '#56626e', fog: '#d6e7f5', edge: '#9fe0ff', amp: 66, ridge: 0.7, trees: 0.1, sea: 0, snow: 1, strata: 0, grid: 0, fogK: 0.0027, sunAz: 0.42, sunEl: 0.26 },
    { name: 'Red canyon', skyTop: '#472833', skyHz: '#d27f5c', sun: '#f2bd8c', ground: '#7a3b24', rock: '#a9522c', fog: '#eaa27a', edge: '#ff8f70', amp: 54, ridge: 0.8, trees: 0, sea: 0, snow: 0, strata: 1, grid: 0, fogK: 0.0039, sunAz: -0.16, sunEl: 0.09 },
  ].map((b) => ({ ...b, c: { skyTop: srgb(b.skyTop), skyHz: srgb(b.skyHz), sun: srgb(b.sun), ground: srgb(b.ground), rock: srgb(b.rock), fog: srgb(b.fog), edge: srgb(b.edge) } }));

  const SCENE_FS = FS_HEAD + `
#define RINGS 12
uniform vec2 uRes; uniform float uT,uFocal,uBeat,uSeed;
uniform vec3 uCam,uRight,uUp,uFwd;
uniform sampler2D uN,uS;
uniform vec3 uSkyTop,uSkyHz,uSunC,uGround,uRock,uFog,uEdge,uSunDir;
uniform float uAmp,uRidge,uSea,uSnow,uStrata,uGrid,uTrees,uDusk,uFogK;
uniform float uSpark,uShimmer,uAurora;
uniform vec4 uRing[RINGS];
uniform float uHaze,uWeather,uWarm,uBreath,uBreathOn,uNebula;
uniform vec4 uGhost;
float pathX(float z){return 14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7);}
float roadY(float z){return 7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return textureLod(uN,(i+f+.5)/256.,0.).r;}
const mat2 R=mat2(.8,.6,-.6,.8);
float fbm2(vec2 p){return (vn(p)+.5*vn(R*p*2.03+3.1))/1.5;}
float fbm4(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=R*p*2.03+1.7;a*=.5;}return s/.9375;}
const float SEA=-14.;
float height(vec2 p,bool hi){
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
float surface(vec2 p,bool hi){float h=height(p,hi);return uSea>0.?max(h,SEA):h;}
float march(vec3 ro,vec3 rd,out float last){
  float t=.8,h=0.;last=0.;
  for(int i=0;i<76;i++){
    vec3 p=ro+rd*t;h=p.y-surface(p.xz,false);
    if(h<.002*t||t>680.)break;
    last=t;t+=max(h*.62,.03+t*.011);
  }
  if(t<680.&&last>0.){float a=last,b=t;for(int i=0;i<5;i++){float m=.5*(a+b);vec3 q=ro+rd*m;if(q.y-surface(q.xz,false)>0.)a=m;else b=m;}t=.5*(a+b);}
  return t;
}
float skyTrail=0.;
vec3 nebula(vec3 rd,float s){
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
vec3 sky(vec3 rd,vec2 sv){
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
  if(uNebula>.002)c+=nebula(rd,s)*uNebula*smoothstep(-.01,.12,rd.y);
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
  skyTrail=exp(-abs(rd.y-top)*90.)*a*.8*smoothstep(-.02,.01,rd.y);
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
  float t=rd.y<.32?march(ro,rd,last):1e4;
  if(t<680.){
    vec3 p=ro+rd*t;
    bool water=uSea>0.&&p.y<=SEA+.02;
    float e=.05+t*.0018;
    vec3 N=normalize(vec3(surface(p.xz-vec2(e,0.),true)-surface(p.xz+vec2(e,0.),true),2.*e,surface(p.xz-vec2(0.,e),true)-surface(p.xz+vec2(0.,e),true)));
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
      float keep=skyTrail;c=mix(uFog*.22+uSkyTop*.18,sky(vec3(rf.x,abs(rf.y),rf.z),vec2(0.)),.72);skyTrail=keep;
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
    // rings of light that run ahead of you
    for(int i=0;i<RINGS;i++){
      vec4 r=uRing[i];
      if(r.z<=0.)continue;
      float zr=r.x+r.y*78.;
      float w=.9+r.y*2.2;
      float g=exp(-pow((p.z-zr)/w,2.))*exp(-r.y*1.9)*r.z;
      g*=exp(-d*.3)*(.12+.88*smoothstep(1.,20.,t));
      emC+=uEdge*1.2*g*2.4;
    }
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
  o=vec4(col,max(trail,skyTrail));
}`;

  const MOTE_VS = `#version 300 es
precision highp float;
uniform vec3 uCam,uRight,uUp,uFwd; uniform float uFocal,uAsp,uZ,uPx,uSeed,uSpark,uShimmer,uSpeedN;
out float vA;
float h(float n){return fract(sin(n)*43758.5453);}
float pathX(float z){return 14.*sin(z*.0113+1.+uSeed)+6.5*sin(z*.0271+2.2+uSeed*1.7);}
float roadY(float z){return 7.*sin(z*.0071+.4+uSeed)+3.4*sin(z*.0193+1.9+uSeed*2.3)+1.1*sin(z*.0471+3.1);}
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

  global.PathScene = { BIOMES, SCENE_FS, MOTE_VS, MOTE_FS, DREAM_FS, ORBIT_VS, ORBIT_FS };
})(window);
