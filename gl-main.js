// gl-main.js — renderer, post, camera choreography, scroll markers, adaptive quality
(function () {
  const FL = window.FL, C = FL.C;
  const canvas = document.getElementById('gl');
  // no three.js or no WebGL (old GPU, blocked drivers, some in-app browsers): run the site without the 3D scene instead of hanging on the boot screen
  let renderer = null;
  try { if (window.THREE && FL.FinalShader) renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) {}
  if (!renderer) { FL.noGL = true; FL.progress = 1; document.documentElement.classList.add('nogl'); return; }
  let DPR = Math.max(1.25, Math.min(devicePixelRatio || 1, 1.6));
  renderer.setPixelRatio(DPR);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C('#06070a'), .0105);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 5000);

  const station = FL.buildStation(scene, renderer);
  const space = FL.buildSpace(scene);
  FL.progress = 0;
  if (station.reflector) { const ob = station.reflector.onBeforeRender; station.reflector.onBeforeRender = function (r, s, c) { space.sky.visible = false; ob.call(this, r, s, c); space.sky.visible = true; }; }
  const avatar = FL.loadAvatar(scene, (p) => { FL.progress = p; });
  FL.avatar = avatar;

  scene.add(new THREE.HemisphereLight(C('#9fb0c4'), C('#0a0b0e'), .55));
  const key = new THREE.PointLight(C('#ffeedd'), 1.8, 15); scene.add(key);
  const rim = new THREE.PointLight(C('#79b4ff'), 5, 10); scene.add(rim);
  const rimBase = rim.color.clone(), tintC = new THREE.Color(); let tintK = 0;
  const fill = new THREE.PointLight(C('#dfe8f6'), 1.6, 20); scene.add(fill);
  const sunL = new THREE.DirectionalLight(C('#ffe2c0'), 0); sunL.position.set(-.8, .35, -.6); scene.add(sunL);

  // post: HDR (half-float, MSAA on WebGL2) -> bloom -> grade
  const gl2 = renderer.capabilities.isWebGL2;
  const rtO = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const rt = new THREE.WebGLRenderTarget(2, 2, rtO);
  const composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .62, .48, 1.05);
  composer.addPass(bloom);
  const fin = new THREE.ShaderPass(FL.FinalShader); composer.addPass(fin);
  const FU = fin.uniforms;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(DPR); renderer.setSize(w, h, false);
    composer.setPixelRatio(DPR); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    FU.uRes.value.set(w * DPR, h * DPR);
    if (station.reflector) station.reflector.getRenderTarget().setSize(Math.round(w * DPR * rq), Math.round(h * DPR * rq));
    readMarks();
  }
  let rq = .5;

  // scroll markers: <i data-cam="z,cx,cy,dist,lookY,lookAhead,fov">
  let marks = [];
  function readMarks() {
    const maxS = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    marks = [...document.querySelectorAll('[data-cam]')].map((el) => ({ s: Math.min(Math.max(el.getBoundingClientRect().top + scrollY - innerHeight * .5, 0), maxS), v: el.dataset.cam.split(',').map(Number) }));
    if (marks.length) { marks[0].s = 0; marks[marks.length - 1].s = maxS; }
    marks.sort((a, b) => a.s - b.s);
  }
  function sample(s) {
    if (!marks.length) return [0, 0, 3, 7, 2.5, 0, 40];
    if (s <= marks[0].s) return marks[0].v;
    for (let i = 0; i < marks.length - 1; i++) { const a = marks[i], b = marks[i + 1]; if (s <= b.s) { let k = (s - a.s) / Math.max(b.s - a.s, 1); k = k * k * (3 - 2 * k); return a.v.map((x, j) => x + (b.v[j] - x) * k); } }
    return marks[marks.length - 1].v;
  }
  addEventListener('resize', resize);
  addEventListener('load', readMarks);
  setTimeout(readMarks, 1200);

  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1 };
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; mouse.px = e.clientX; mouse.py = e.clientY; }, { passive: true });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
  function avatarHit(x, y) { if (!avatar.ready) return false; ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return !!ray.ray.intersectBox(avatar.bounds(), hitP); }
  addEventListener('click', (e) => { if (FL.state.hero > .5 && !e.target.closest('a,button') && avatarHit(e.clientX, e.clientY)) avatar.wave(); });

  // intro: materialize
  let introT = -1;
  FL.intro = () => { introT = 0; };

  FL.state = { z: 0, door: 0, hero: 1, deck: 0, hoverAvatar: false, quality: 0 };
  const clock = new THREE.Clock();
  let zCur = 0, camZ = 7.6, face = Math.PI, t = 0, faceDir = Math.PI, stillT = 0;
  const cam = { v: null };
  const lookAt = new THREE.Vector3();
  let level = 0, zTgt = 0;

  function degrade() {
    level++; FL.state.quality = level;
    if (level === 1) { DPR = Math.min(DPR, 1); rq = .35; }
    if (level === 2) { if (station.reflector) { station.reflector.visible = false; station.floorStd.visible = true; } bloom.strength = .5; DPR = .85; }
    if (level === 3) { bloom.enabled = false; DPR = .7; }
    resize();
  }

  // cadence: full rate while something moves, half rate when idle, a third while the video theater covers the scene
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastInput = performance.now(), lastRaw = 0, fr = 0, fAcc = 0, fN = 0;
  ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchmove', 'scroll'].forEach((ev) => addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true }));
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = lastRaw ? Math.min((now - lastRaw) / 1000, .25) : 1 / 60; lastRaw = now;
    const idle = now - lastInput > 2500 && introT < 0 && Math.abs(zTgt - zCur) < .02;
    const div = FL.theaterOpen ? 3 : idle ? 2 : 1;
    if (div === 1 && t > 4 && level < 3 && !document.hidden) { fAcc += raw; fN++; if (fAcc > 2) { if (fN / fAcc < 40) degrade(); fAcc = 0; fN = 0; } } else { fAcc = 0; fN = 0; }
    if (++fr % div) return;
    step(Math.min(clock.getDelta(), .05));
  }
  FL.dbg = { bloom, composer, renderer, station, scene, camera, fin };
  FL.tick = (n, d) => { for (let i = 0; i < (n || 1); i++) step(d || 1 / 60); };
  function step(dt) {
    t += dt;

    const SY = FL.scrollOverride != null ? FL.scrollOverride : scrollY;
    const v = sample(SY);
    if (!cam.v) cam.v = v.slice();
    const kc = 1 - Math.exp(-dt * 3.2);
    for (let i = 0; i < cam.v.length; i++) cam.v[i] += (v[i] - cam.v[i]) * kc;
    const [, cx, cy, cd, ly, lz, fov] = cam.v;
    // avatar walks toward scroll target at a capped pace
    // walk over short scrolls, run to catch up after long ones (either way), so the pilot stays in step with the page
    const zT = v[0], dz = zT - zCur, maxStep = (5.2 + Math.abs(dz) * 2.4) * dt; zTgt = zT;
    const step = Math.sign(dz) * Math.min(Math.abs(dz) * (1 - Math.exp(-dt * 3.2)), maxStep);
    zCur += step;
    mouse.sx += (mouse.x - mouse.sx) * .06; mouse.sy += (mouse.y - mouse.sy) * .06;
    const hero = Math.max(0, Math.min(1, 1 - (-zT) / 1.2)) * (SY < innerHeight * .25 ? 1 : 0);
    // face the way the pilot actually moves (no moonwalking back on short scrolls up); standing still: toward the camera in
    // the hero, and after a beat, back down the corridor elsewhere
    const vz = step / Math.max(dt, 1e-3);
    if (Math.abs(vz) > .8) { faceDir = vz > 0 ? Math.PI : 0; stillT = 0; } else { stillT += dt; if (hero > .5) faceDir = Math.PI; else if (stillT > 1.2) faceDir = 0; }
    const faceT = faceDir;
    const pf = face; face += (faceT - face) * (1 - Math.exp(-dt * 3.4));
    const deck = Math.max(0, Math.min(1, (-zCur - 41) / 6));
    const back = Math.max(0, Math.min(1, (-zCur - 48.6) / 1.2));
    FL.state.z = zCur; FL.state.hero = hero; FL.state.deck = deck;

    avatar.root.position.set(0, 0, zCur);
    avatar.root.rotation.y = face;
    avatar.update({ dist: Math.abs(step), turn: face - pf, dt, t, lookX: mouse.sx * 2, lookY: mouse.sy * 2, hero, deck, back });

    // intro materialize
    if (introT >= 0) {
      introT += dt; const k = Math.min(1, introT / 2.2), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      avatar.setReveal(-.1 + e * (avatar.height + .6)); station.padMat.color.copy(C('#ffffff')).multiplyScalar(.9 + Math.sin(k * Math.PI) * 3);
      FU.uFade.value = Math.min(1, introT / .8);
      if (introT > 2.6 && introT - dt <= 2.6 && hero > .5) avatar.wave();
      if (introT > 3) introT = -1;
    }

    // camera
    camZ += (zCur - camZ) * (1 - Math.exp(-dt * 2.4));
    const sw = RM ? 0 : 1, hx = (Math.sin(t * .5) * .05 + Math.sin(t * 1.3) * .02) * sw, hy = (Math.sin(t * .7) * .04 + Math.sin(t * 1.9) * .015) * sw;
    camera.position.set(cx + mouse.sx * 1.4 * hero + mouse.sx * .35 + hx, cy - mouse.sy * .6 * hero + hy, camZ + cd);
    lookAt.set(cx * .55 + mouse.sx * .3, ly - mouse.sy * .2, camZ - lz);
    camera.lookAt(lookAt);
    if (!RM) camera.rotation.z += Math.sin(t * .23) * .004;
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }

    // lights follow the pilot
    key.position.set(2.2, 5.6, zCur + (hero > .5 ? 4.5 : 3.8)); key.intensity = 1.0 + hero * .8;
    rim.position.set(-1.6, 5.2, zCur + (hero > .5 ? -3.2 : -3.4));
    tintK += ((FL.tintOn ? 1 : 0) - tintK) * (1 - Math.exp(-dt * 3));
    rim.intensity = (3.4 - deck * 1.6) * (1 + tintK * .5);
    rim.color.lerp(FL.tintOn && FL.tint ? tintC.set(FL.tint).convertSRGBToLinear() : rimBase, 1 - Math.exp(-dt * 3));
    fill.position.set(0, 9, zCur - 7);
    sunL.intensity = deck * .8;
    if (station.reflector && station.reflector.material.uniforms.uL) { station.reflector.material.uniforms.uL.value.set(0, 0, zCur); station.reflector.material.uniforms.uLI.value = 1; }

    // door
    const door = Math.max(0, Math.min(1, (-zCur - 31) / 5.5));
    FL.state.door = door; station.setDoor(door);
    FU.uFlash.value = 0;

    // hover avatar (hero only)
    FL.state.hoverAvatar = hero > .5 && mouse.px >= 0 && avatarHit(mouse.px, mouse.py);

    station.update(t, zCur); space.update(t, dt);
    FL.cin = (FL.cin || 0) + (((FL.cinema || 0) ? 1 : 0) - (FL.cin || 0)) * (1 - Math.exp(-dt * 2.5));
    FU.uExpo.value = 1 - FL.cin * .5; fill.intensity = 1.6 * (1 - FL.cin * .8);
    FU.uT.value = t;
    if (document.fullscreenElement || document.hidden) return;
    composer.render(dt);
  }
  resize(); FU.uFade.value = 0;
  if (matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 560 || (navigator.hardwareConcurrency || 8) <= 4) degrade();
  requestAnimationFrame(frame);
})();
