// gl-shaders.js — procedural planets, rings, atmosphere, sky, reflective floor, final grade
(function () {
  const FL = window.FL = window.FL || {};
  const C = (h) => new THREE.Color(h).convertSRGBToLinear();
  FL.C = C;
  const N = `
float h31(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*vnoise(p);p=p*2.03+vec3(3.1,1.7,5.3);a*=.5;}return s;}
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vnoise(p);p=p*2.03+vec3(3.1,1.7,5.3);a*=.5;}return s;}
vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
// craters: only some cells hold one, each with its own size; returns <0 in the bowl, >0 on the raised rim
float crater(vec3 p){vec3 i=floor(p),f=fract(p);float s=0.;
for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 o=vec3(float(x),float(y),float(z));
if(h31(i+o+3.3)<.58)continue;
vec3 c=o+.2+.6*vec3(h31(i+o),h31(i+o+7.1),h31(i+o+13.7));float r=.16+.3*h31(i+o+5.1);float d=length(c-f)/r;
s+=-.55*smoothstep(1.,.25,d)+.4*smoothstep(.72,1.,d)*smoothstep(1.35,1.,d);}
return s;}
`;
  const VS = `varying vec3 vN;varying vec3 vP;varying vec3 vW;
void main(){vP=position;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;

  const PLANET_FS = `uniform vec3 uSun,uC1,uC2,uC3,uC4,uAtm,uSeed;uniform float uT,uType,uAtmI,uAtmP,uSpin,uFreq,uCloud,uSunI;
varying vec3 vN,vP,vW;${N}
void main(){
 vec3 n=normalize(vN),V=normalize(cameraPosition-vW),L=normalize(uSun);
 vec3 s=normalize(vP);vec3 q=rotY(s,uT*uSpin);vec3 p=q*uFreq+uSeed;
 vec3 col;float spec=0.;vec3 emit=vec3(0.);
 if(uType<.5){
  float w=fbm(p*vec3(1.5,4.,1.5)+vec3(0.,0.,uT*.004));
  float b=q.y*11.+w*2.6+fbm(p*vec3(.7,20.,.7))*1.2;
  col=mix(uC1,uC2,.5+.5*sin(b));
  col=mix(col,uC3,smoothstep(.25,1.,.5+.5*sin(b*2.7+1.3))*.55);
  col*=.8+.4*fbm(p*vec3(5.,36.,5.)+w*2.);
  vec3 dq=q-normalize(vec3(.62,-.3,.72));float ds=length(dq*vec3(1.,2.3,1.))+(fbm(q*9.+uT*.01)-.5)*.12;
  col=mix(col,uC4,smoothstep(.2,.04,ds)*.9);
  col*=1.-.3*smoothstep(.19,.22,ds)*smoothstep(.27,.22,ds);
  col*=mix(1.,.6,smoothstep(.72,1.,abs(q.y)));
 } else if(uType<1.5){
  float c=fbm(p*2.2);float land=smoothstep(.54,.58,c);
  col=mix(uC1*(.5+.7*fbm(p*5.)),mix(uC2,uC3,fbm(p*7.)),land);
  spec=(1.-land);
  vec3 cp=rotY(s,uT*uSpin*1.4)*uFreq*2.2+uSeed*1.7;
  float cl=fbm(cp+vec3(fbm3(cp*1.6),fbm3(cp*1.6+4.2),0.)*1.7);
  cl=smoothstep(.52-uCloud*.22,.8,cl);
  col=mix(col,vec3(.9,.92,.95)*(.82+.25*fbm(cp*3.)),cl);spec*=1.-cl;
  emit=uC4*smoothstep(.62,.72,fbm(p*15.))*land*(1.-cl);
  vec3 lc=floor(q*uFreq*9.);float lh=h31(lc+floor(uT*5.)*1.37);
  emit+=vec3(.75,.85,1.)*step(.9965,lh)*smoothstep(.3,.8,cl)*(.6+.4*sin(uT*60.+lh*40.))*3.;
 } else {
  float h=fbm(p*2.4);col=mix(uC1,uC2,smoothstep(.35,.68,h));
  col*=.72+.55*fbm(p*16.);col=mix(col,uC3,smoothstep(.6,.66,fbm(p*5.+2.))*.6);
  // impact craters at two scales: darker bowls with a bright raised rim
  col*=1.+.55*crater(p*2.3)+.3*crater(p*6.1+11.)+.15*crater(p*13.+5.);
 }
 float nl=dot(n,L);
 float dif=smoothstep(-.12,.6,nl)*.8+max(nl,0.)*.25;
 vec3 H=normalize(L+V);
 vec3 c=col*dif*uSunI+pow(max(dot(n,H),0.),80.)*spec*step(0.,nl)*vec3(1.,.9,.75)*1.4;
 c+=emit*smoothstep(.02,-.3,nl)*1.6;
 float fr=pow(1.-max(dot(n,V),0.),uAtmP);
 c+=uAtm*fr*smoothstep(-.35,.5,nl)*uAtmI;
 // earth-like worlds: a thin orange twilight band where day turns to night, as seen from orbit
 if(uType>.5&&uType<1.5)c+=vec3(1.,.42,.16)*fr*smoothstep(.22,0.,abs(nl-.03))*.45*uAtmI;
 c+=col*.01;
 gl_FragColor=vec4(c,1.);
}`;
  FL.planetMat = (o) => new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3(1, 0, 0) }, uT: { value: 0 }, uType: { value: o.type || 0 },
      uC1: { value: C(o.c[0]) }, uC2: { value: C(o.c[1]) }, uC3: { value: C(o.c[2]) }, uC4: { value: C(o.c[3] || '#000') },
      uAtm: { value: C(o.atm || '#8ab8ff') }, uAtmI: { value: o.atmI == null ? .6 : o.atmI }, uAtmP: { value: o.atmP || 3 },
      uSeed: { value: new THREE.Vector3(o.seed || 0, (o.seed || 0) * 1.7, (o.seed || 0) * .6) }, uSpin: { value: o.spin || .01 },
      uFreq: { value: o.freq || 1 }, uCloud: { value: o.cloud == null ? .6 : o.cloud }, uSunI: { value: o.sunI || 1.5 },
    }, vertexShader: VS, fragmentShader: PLANET_FS,
  });

  FL.atmoMat = (col, I, edge) => new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) }, uAtm: { value: C(col) }, uI: { value: I }, uEdge: { value: edge } },
    vertexShader: VS,
    fragmentShader: `uniform vec3 uSun,uAtm;uniform float uI,uEdge;varying vec3 vN,vP,vW;
void main(){vec3 n=normalize(vN),V=normalize(cameraPosition-vW),L=normalize(uSun);
float d=-dot(n,V);float k=smoothstep(0.,uEdge,d);k=pow(k,2.2);
float lit=smoothstep(-.45,.55,dot(n,L));gl_FragColor=vec4(uAtm*k*lit*uI,1.);}`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  FL.ringMat = (o) => new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) }, uPP: { value: new THREE.Vector3() }, uR: { value: o.r }, uIn: { value: o.inner }, uOut: { value: o.outer }, uC1: { value: C(o.c1) }, uC2: { value: C(o.c2) } },
    vertexShader: `varying vec3 vP;varying vec3 vW;void main(){vP=position;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform vec3 uSun,uPP,uC1,uC2;uniform float uR,uIn,uOut;varying vec3 vP,vW;${N}
void main(){float r=length(vP.xy);float t=(r-uIn)/(uOut-uIn);if(t<0.||t>1.)discard;
float b=vnoise(vec3(t*60.,.5,.5))*.5+vnoise(vec3(t*210.,1.5,.5))*.32+vnoise(vec3(t*640.,2.5,.5))*.18;
float a=smoothstep(0.,.06,t)*smoothstep(1.,.88,t)*(.25+.85*b);
a*=1.-smoothstep(.022,0.,abs(t-.61))*.92;a*=1.-smoothstep(.012,0.,abs(t-.82))*.75;
vec3 col=mix(uC1,uC2,b)*(.65+.35*t);
vec3 L=normalize(uSun);vec3 oc=vW-uPP;float bb=dot(oc,L);float c=dot(oc,oc)-uR*uR;float h=bb*bb-c;
float sh=(h>0.&&bb<0.)?.06:1.;
float fwd=pow(max(dot(normalize(vW-cameraPosition),L),0.),5.);
gl_FragColor=vec4(col*sh*(.75+fwd*1.6),a*.6);}`,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  });

  FL.skyMat = () => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec3 vD;void main(){vD=position;vec4 w=modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uT;varying vec3 vD;${N}
float starL(vec3 d,float sc,float th,float sz){vec3 q=d*sc,i=floor(q),f=fract(q);float h=h31(i);if(h<th)return 0.;
vec3 c=vec3(h31(i+11.3),h31(i+27.7),h31(i+41.1))*.7+.15;float b=(h-th)/(1.-th);return smoothstep(sz,0.,length(f-c))*(b*b*3.+.25);}
void main(){vec3 d=normalize(vD);
vec3 bn=normalize(vec3(.34,1.,.46));float a=dot(d,bn);
float band=exp(-a*a*9.),core=exp(-a*a*40.);
float n1=fbm3(d*3.2+1.),n2=fbm(d*9.+5.);
// Milky Way: faint and warm at the core, cut by dark dust rifts; the rest of the sky stays black
vec3 col=mix(vec3(.016,.02,.036),vec3(.15,.12,.095),core)*band*(.1+.95*n1*n1);
col*=1.-smoothstep(.44,.7,n2)*core*.95;
// nebulosity only as a whisper (a coloured haze everywhere reads as fake next to sunlit planets)
col+=vec3(.04,.028,.055)*pow(fbm3(d*2.2+9.),4.)*.7;
col+=vec3(.008,.022,.045)*pow(fbm3(d*2.8+3.),4.)*.7;
float tw=.94+.06*sin(uT*2.3+h31(floor(d*300.))*60.);   // no atmosphere up here: stars barely shimmer
// star field: many faint stars, denser along the band, a few bright ones with real star colours
float st=starL(d,300.,.95-band*.05,.16)*tw+starL(d,640.,.925-band*.08,.2)*.42+starL(d,120.,.993,.11)*3.4;
float ct=h31(floor(d*300.)+3.);
vec3 sc=ct<.2?vec3(1.,.72,.5):ct<.55?vec3(1.,.93,.84):vec3(.74,.84,1.);
col+=st*sc;gl_FragColor=vec4(col,1.);}`,
    side: THREE.BackSide, depthWrite: false,
  });

  FL.FloorShader = {
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uL: { value: new THREE.Vector3() }, uLI: { value: 1 } },
    vertexShader: `uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vW;
void main(){vUv=textureMatrix*vec4(position,1.);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform vec3 color;uniform sampler2D tDiffuse;uniform vec3 uL;uniform float uLI;varying vec4 vUv;varying vec3 vW;
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 bool lane=abs(vW.x)<1.3&&vW.z>-40.;
 vec2 ts=lane?vec2(2.6,.55):vec2(2.4,2.4);
 vec2 g=vW.xz/ts;vec2 id=floor(g);vec2 f=abs(fract(g)-.5);
 float seam=lane?smoothstep(.44,.5,f.y)*.7:smoothstep(.476,.5,max(f.x,f.y));
 float tn=h2(id+(lane?7.:0.));
 vec3 V=normalize(cameraPosition-vW);
 float fr=.05+.95*pow(1.-max(V.y,0.),5.);
 float rough=lane?1.6:.6+tn*.9;
 vec3 r=vec3(0.);
 for(int i=-3;i<=3;i++){vec4 u=vUv;u.y+=float(i)*.0042*rough*u.w;u.x+=float(i)*.0007*u.w;r+=texture2DProj(tDiffuse,u).rgb;}
 r/=7.;
 vec3 base=vec3(.012,.013,.016)*(.7+.6*tn)*(lane?.6:1.);
 float d=distance(vW.xz,uL.xz);float pool=uLI/(1.+d*d*.16);
 vec3 c=base*(1.+pool*5.)+r*mix(.3,1.,fr)*(lane?.35:1.);
 c*=1.-seam*.75;
 gl_FragColor=vec4(c,1.);}`,
  };

  FL.FinalShader = {
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uExpo: { value: 1 }, uCA: { value: 1 }, uGrain: { value: .05 }, uFade: { value: 1 }, uFlash: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uT,uExpo,uCA,uGrain,uFade,uFlash;uniform vec2 uRes;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 uv=vUv;vec2 cc=uv-.5;float r2=dot(cc,cc);
vec2 off=cc*r2*.012*uCA;
vec3 c=vec3(texture2D(tDiffuse,uv+off).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-off).b);
c*=uExpo;c=aces(c);
c=pow(c,vec3(1./2.2));
float l=dot(c,vec3(.299,.587,.114));
c=mix(c,c*vec3(.94,1.,1.07),smoothstep(.5,0.,l)*.6);
c=mix(c,c*vec3(1.05,1.,.93),smoothstep(.5,1.,l)*.4);
c*=1.-smoothstep(.12,.75,r2*1.25)*.62;
float g=fract(sin(dot(uv*uRes+fract(uT)*91.7,vec2(12.9898,78.233)))*43758.5453);
c+=(g-.5)*uGrain;
c=c*uFade+uFlash;
gl_FragColor=vec4(c,1.);}`,
  };
})();
