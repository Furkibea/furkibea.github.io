// gl-avatar.js — FurkanLua avatar: OBJ split into a joint hierarchy (hips/knees/shoulders/elbows/neck).
// The same rig also builds copies of the character for the station (the avatar bay and the hologram) through api.onReady(kit).
(function () {
  const FL = window.FL;
  // The character is a Roblox Studio export (right-click the character > Export Selection) kept in avatar/: fl.obj (and a
  // gzipped copy), plus the diffuse textures Studio writes next to it. Joint pivots below are in the OBJ's own units (studs):
  // body centre CX/CZ, feet at Y0, top of the tallest accessory at TOP. [joint, parent, pivot, parts]; unlisted parts ride
  // on the torso. R15 body with a one-piece (Korblox) right leg.
  const CX = 70.975, CZ = 24.859, Y0 = .111, TOP = 5.257;
  const RIG = [
    ['hips', null, [CX, 2.08, CZ], ['Furkanlua2']],                                      // lower torso
    ['skirt', 'hips', [CX, 2.18, CZ], ['Handle7']],
    ['torso', 'hips', [CX, 2.22, CZ], ['Furkanlua7', 'Handle5']],                        // upper torso, cape
    ['neck', 'torso', [CX, 3.69, CZ], ['Furkanlua1', 'Handle1', 'Handle2', 'Handle3', 'Handle6']],
    ['shA', 'torso', [72.025, 3.56, CZ], ['Furkanlua8', 'Handle4']],                     // right arm
    ['elA', 'shA', [72.025, 3.1, CZ], ['Furkanlua9', 'Furkanlua10']],
    ['shB', 'torso', [69.925, 3.56, CZ], ['Furkanlua11']],                               // left arm
    ['elB', 'shB', [69.925, 3.1, CZ], ['Furkanlua12', 'Furkanlua13']],
    ['hipA', 'hips', [71.325, 2.08, CZ], ['Furkanlua3']],                                // right leg
    ['knA', 'hipA', [71.325, 1.58, CZ], []],
    ['hipB', 'hips', [70.625, 2.08, CZ], ['Furkanlua4']],                                // left leg
    ['knB', 'hipB', [70.625, 1.58, CZ], ['Furkanlua5', 'Furkanlua6']],
  ];

  FL.loadAvatar = function (scene, onProgress) {
    const C = FL.C;
    const reveal = { value: -20 }, edgeCol = { value: C('#ff6a2a').multiplyScalar(7) };
    const tl = new THREE.TextureLoader();
    const mk = (f) => {
      const t = tl.load('avatar/' + f); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
      const m = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, alphaTest: .45, roughness: .74, metalness: .05, envMapIntensity: .35 });
      m.onBeforeCompile = (s) => {
        s.uniforms.uReveal = reveal; s.uniforms.uEdge = edgeCol;
        s.vertexShader = 'varying float vFlY;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlY=(modelMatrix*vec4(transformed,1.)).y;');
        s.fragmentShader = 'uniform float uReveal;uniform vec3 uEdge;varying float vFlY;\n' + s.fragmentShader
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(vFlY>uReveal)discard;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=uEdge*smoothstep(.3,0.,uReveal-vFlY);');
      };
      return m;
    };
    const bodyMat = mk('Furkanlua1_diff.png'); const hMats = {}; for (let i = 1; i <= 7; i++) hMats['Handle' + i] = mk('Handle' + i + '_diff.png');
    hMats.Handle1.normalMap = tl.load('avatar/Handle1_nmap.png'); hMats.Handle1.roughness = .55;   // the hat has a relief map
    const matOf = (n) => hMats[n] || bodyMat;

    const root = new THREE.Group(); scene.add(root);           // world placement + facing
    const api = { root, ready: false, reveal, height: 4.3 };
    // contact shadow
    const shC = FL.cv(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.85)'); r.addColorStop(.5, 'rgba(0,0,0,.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshBasicMaterial({ map: FL.tx(shC), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; scene.add(shadow);
    // scan ring used during materialize
    const scan = new THREE.Mesh(new THREE.TorusGeometry(1.25, .015, 6, 96), new THREE.MeshBasicMaterial({ color: C('#ff6a2a').multiplyScalar(6) }));
    scan.rotation.x = Math.PI / 2; scan.visible = false; scene.add(scan);

    // one copy of the character: feet at y 0, centred on x/z, facing -z; mats(part) gives a material, or several for several passes
    const geos = {};
    function assemble(mats, height) {
      const S = (height || api.height) / (TOP - Y0), model = new THREE.Group(), J = {}, left = new Set(Object.keys(geos));
      model.scale.setScalar(S); model.position.set(-CX * S, -Y0 * S, -CZ * S);
      const put = (g, n, abs) => [].concat(mats(n)).forEach((m) => { const o = new THREE.Mesh(geos[n], m); o.position.set(-abs[0], -abs[1], -abs[2]); o.frustumCulled = false; g.add(o); });
      RIG.forEach(([n, p, abs, parts]) => {
        const pa = p ? J[p].userData.abs : [0, 0, 0], g = new THREE.Group();
        g.position.set(abs[0] - pa[0], abs[1] - pa[1], abs[2] - pa[2]); (p ? J[p] : model).add(g); g.userData.abs = abs; J[n] = g;
        parts.forEach((pn) => { if (geos[pn]) { left.delete(pn); put(g, pn, abs); } });
      });
      left.forEach((pn) => put(J.torso, pn, J.torso.userData.abs));
      J.hips.userData.y0 = J.hips.position.y;
      return { model, J };
    }
    // a relaxed idle for the copies: breathing, a slow look around, and a wave when w (seconds into it) is >= 0
    function idle(J, t, w, seed) {
      const b = Math.sin(t * 1.7 + seed) * .014;
      J.torso.rotation.set(b, Math.sin(t * .23 + seed) * .06, 0);
      J.neck.rotation.set(Math.sin(t * .41 + seed) * .05, Math.sin(t * .31 + seed) * .3, 0);
      J.shA.rotation.set(b, 0, .09 + Math.sin(t * 1.7 + seed) * .01); J.shB.rotation.set(b, 0, -.09 - Math.sin(t * 1.7 + seed) * .01);
      J.elA.rotation.set(.12, 0, 0); J.elB.rotation.set(.12, 0, 0);
      if (w >= 0) {
        const env = Math.min(1, w / .35) * Math.min(1, Math.max(0, (2.3 - w) / .4));
        J.shA.rotation.z += env * 2.46; J.shA.rotation.x -= env * .15;
        J.elA.rotation.set(.06 + .06 * (1 - env), 0, env * (.35 + Math.sin(w * 13) * .45));
        J.neck.rotation.z = env * Math.sin(w * 6.5) * .05;
      }
    }
    const waiters = [];
    api.kit = { build: assemble, idle, tex: (n) => matOf(n).map };
    api.onReady = (cb) => { if (api.ready) cb(api.kit); else waiters.push(cb); };

    const J = {};
    let wave = -1, phase = 0, amp = 0;
    // fl.obj.gz is fl.obj gzipped. Static hosts like GitHub Pages send .obj uncompressed (3.1 MB); this is 0.5 MB, with real
    // download progress for the boot bar. Browsers without DecompressionStream, or any failure, fall back to the plain file.
    const loadObj = (ok, prog, fail) => {
      const plain = () => new THREE.OBJLoader().load('avatar/fl.obj', ok, prog, fail);
      if (!window.DecompressionStream || !window.fetch) return plain();
      fetch('avatar/fl.obj.gz').then(async (r) => {
        if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
        const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = []; let got = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (total) prog({ loaded: got, total }); }
        return new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      }).then((txt) => ok(new THREE.OBJLoader().parse(txt)), plain);
    };
    loadObj((obj) => {
      obj.traverse((o) => { if (o.isMesh) geos[o.name] = o.geometry; });
      const pilot = assemble(matOf); root.add(pilot.model); Object.assign(J, pilot.J);
      api.ready = true;
      onProgress && onProgress(1);
      waiters.splice(0).forEach((f) => f(api.kit));
    }, (x) => { if (x.total && onProgress) onProgress(Math.min(x.loaded / x.total, .99)); }, () => { api.error = true; onProgress && onProgress(1); });

    const d = (v, tgt, k) => v + (tgt - v) * k;
    api.wave = () => { if (wave < 0) wave = 0; };
    api.bounds = () => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(root.position.x, root.position.y + api.height / 2, root.position.z), new THREE.Vector3(2.4, api.height, 1.6));
    // st: { dist (units moved this frame), dt, t, lookX, lookY, hero (0..1), deck (0..1), back (0..1) }
    api.update = (st) => {
      shadow.position.set(root.position.x, .03, root.position.z);
      if (!api.ready) return;
      const { dt, t } = st, k = Math.min(1, dt * 7);
      const spd = st.dist / Math.max(dt, 1e-3);
      amp = d(amp, Math.min(spd / 3.4, 1), Math.min(1, dt * 5));
      // legs cycle at most at a running cadence, however fast the pilot is catching up with the page; lean into a run
      phase += Math.min(st.dist, dt * 7.5) * (Math.PI * 2 / 2.7) + st.turn * 1.4;
      const run = Math.max(0, Math.min(1, (spd - 5) / 9));
      const A = Math.max(amp, Math.min(Math.abs(st.turn) / Math.max(dt, 1e-3) / 2.5, .6)), s = Math.sin(phase), c = Math.cos(phase), I = 1 - A;
      J.hips.position.y = J.hips.userData.y0 + ((.5 + .5 * Math.cos(2 * phase)) * .075 - .05) * A / (api.height / (TOP - Y0));
      J.hips.rotation.set(0, s * .1 * A, s * .035 * A + Math.sin(t * .6) * .012 * I);
      J.hipA.rotation.x = s * .55 * A; J.hipB.rotation.x = -s * .55 * A;
      J.knA.rotation.x = -Math.max(0, c) * .8 * A; J.knB.rotation.x = -Math.max(0, -c) * .8 * A;
      J.skirt.rotation.x = -Math.sin(2 * phase) * .03 * A;
      const breathe = Math.sin(t * 1.7) * .014;
      J.torso.rotation.x = d(J.torso.rotation.x, -.06 * A - .14 * run + breathe, k);
      J.torso.rotation.y = d(J.torso.rotation.y, -s * .15 * A + st.lookX * .28 * st.hero + st.back * .32, k);
      const lookY = st.lookX * .75 * st.hero + Math.sin(t * .31) * .18 * I * (1 - st.hero) * (1 - st.back) + st.back * 1.0;
      const lookX = -st.lookY * .45 * st.hero + st.deck * .22 * (1 - st.back) - .04 * A;
      J.neck.rotation.y = d(J.neck.rotation.y, lookY - J.torso.rotation.y * .6 - J.hips.rotation.y, k);
      J.neck.rotation.x = d(J.neck.rotation.x, lookX, k);
      J.shA.rotation.x = -s * (.5 + .3 * run) * A + breathe; J.shB.rotation.x = s * (.5 + .3 * run) * A + breathe;
      J.shA.rotation.z = .07 + Math.sin(t * 1.7) * .01; J.shB.rotation.z = -.07 - Math.sin(t * 1.7) * .01;
      J.elA.rotation.x = (.12 + .32 * Math.max(0, -s)) * A + .06; J.elB.rotation.x = (.12 + .32 * Math.max(0, s)) * A + .06;
      J.elA.rotation.z = 0;
      if (wave >= 0) {
        wave += dt; const w = wave, env = Math.min(1, w / .35) * Math.min(1, Math.max(0, (2.3 - w) / .4));
        J.shA.rotation.z = .07 + env * 2.55; J.shA.rotation.x += env * -.15;
        J.elA.rotation.z = env * (.35 + Math.sin(w * 13) * .45); J.elA.rotation.x = .06;
        J.neck.rotation.z = env * Math.sin(w * 6.5) * .05;
        if (w > 2.3) wave = -1;
      } else J.neck.rotation.z = 0;
    };
    api.setReveal = (y) => { reveal.value = y; const on = y > .02 && y < api.height + .2; scan.visible = on; scan.position.set(root.position.x, Math.max(y, .02), root.position.z); };
    return api;
  };
})();
