// gl-avatar.js — FurkanLua avatar: OBJ split into a joint hierarchy (hips/knees/shoulders/elbows/neck)
(function () {
  const FL = window.FL;
  FL.loadAvatar = function (scene, onProgress) {
    const C = FL.C;
    const reveal = { value: -20 }, edgeCol = { value: C('#ff6a2a').multiplyScalar(7) };
    const tl = new THREE.TextureLoader();
    const mk = (f) => {
      const t = tl.load(f); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
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
    const rigMat = mk('Rig1_diff.png'); const hMats = {}; for (let i = 1; i <= 8; i++) hMats['Handle' + i] = mk('Handle' + i + '_diff.png');

    const root = new THREE.Group(); scene.add(root);           // world placement + facing
    const api = { root, ready: false, reveal, height: 4.3 };
    // contact shadow
    const shC = FL.cv(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.85)'); r.addColorStop(.5, 'rgba(0,0,0,.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshBasicMaterial({ map: FL.tx(shC), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; scene.add(shadow);
    // scan ring used during materialize
    const scan = new THREE.Mesh(new THREE.TorusGeometry(1.25, .015, 6, 96), new THREE.MeshBasicMaterial({ color: C('#ff6a2a').multiplyScalar(6) }));
    scan.rotation.x = Math.PI / 2; scan.visible = false; scene.add(scan);

    const J = {};
    let wave = -1, phase = 0, amp = 0;
    // sa.obj.gz is sa.obj gzipped. Static hosts like GitHub Pages send .obj uncompressed (3.8 MB); this is 0.6 MB, with real
    // download progress for the boot bar. Browsers without DecompressionStream, or any failure, fall back to the plain file.
    const loadObj = (ok, prog, fail) => {
      const plain = () => new THREE.OBJLoader().load('sa.obj', ok, prog, fail);
      if (!window.DecompressionStream || !window.fetch) return plain();
      fetch('sa.obj.gz').then(async (r) => {
        if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
        const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = []; let got = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (total) prog({ loaded: got, total }); }
        return new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      }).then((txt) => ok(new THREE.OBJLoader().parse(txt)), plain);
    };
    loadObj((obj) => {
      const meshes = {}; obj.traverse((o) => { if (o.isMesh) { o.material = hMats[o.name] || rigMat; o.frustumCulled = false; meshes[o.name] = o; } });
      const CX = -3.754, CZ = -3.405, Y0 = 2.997, H = 8.359 - Y0;
      const S = api.height / H;
      const model = new THREE.Group(); model.scale.setScalar(S); model.position.set(-CX * S, -Y0 * S, -CZ * S); root.add(model);
      const joint = (name, parent, pAbs, abs, parts) => {
        const g = new THREE.Group(); g.position.set(abs[0] - pAbs[0], abs[1] - pAbs[1], abs[2] - pAbs[2]); parent.add(g);
        (parts || []).forEach((n) => { const m = meshes[n]; if (!m) return; delete meshes[n]; g.add(m); m.position.set(-abs[0], -abs[1], -abs[2]); });
        g.userData.abs = abs; J[name] = g; return g;
      };
      const O = [0, 0, 0];
      const hips = joint('hips', model, O, [CX, 5.05, CZ], ['Rig3']);
      joint('skirt', hips, hips.userData.abs, [CX, 5.15, CZ], ['Handle8']);
      const torso = joint('torso', hips, hips.userData.abs, [CX, 5.2, CZ], ['Rig5', 'Handle6']);
      joint('neck', torso, torso.userData.abs, [CX, 6.74, CZ], ['Rig2', 'Handle1', 'Handle2', 'Handle3', 'Handle4', 'Handle7']);
      const shA = joint('shA', torso, torso.userData.abs, [-2.674, 6.56, CZ], ['Rig8', 'Handle5']);
      joint('elA', shA, shA.userData.abs, [-2.674, 5.98, CZ], ['Rig10', 'Rig12']);
      const shB = joint('shB', torso, torso.userData.abs, [-4.834, 6.56, CZ], ['Rig9']);
      joint('elB', shB, shB.userData.abs, [-4.834, 5.98, CZ], ['Rig11', 'Rig13']);
      const hipA = joint('hipA', hips, hips.userData.abs, [-3.394, 5.0, CZ], ['Rig1']);
      joint('knA', hipA, hipA.userData.abs, [-3.394, 4.25, CZ], []);
      const hipB = joint('hipB', hips, hips.userData.abs, [-4.114, 5.0, CZ], ['Rig4']);
      joint('knB', hipB, hipB.userData.abs, [-4.114, 4.25, CZ], ['Rig6', 'Rig7']);
      Object.keys(meshes).forEach((n) => { const m = meshes[n]; J.torso.add(m); m.position.set(-5.2 * 0 - CX, -5.2, -CZ); });
      J.hips.userData.y0 = J.hips.position.y;
      api.ready = true;
      onProgress && onProgress(1);
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
      phase += st.dist * (Math.PI * 2 / 2.7) + st.turn * 1.4;
      const A = Math.max(amp, Math.min(Math.abs(st.turn) / Math.max(dt, 1e-3) / 2.5, .6)), s = Math.sin(phase), c = Math.cos(phase), I = 1 - A;
      J.hips.position.y = J.hips.userData.y0 + ((.5 + .5 * Math.cos(2 * phase)) * .075 - .05) * A / (api.height / 5.36);
      J.hips.rotation.set(0, s * .1 * A, s * .035 * A + Math.sin(t * .6) * .012 * I);
      J.hipA.rotation.x = s * .55 * A; J.hipB.rotation.x = -s * .55 * A;
      J.knA.rotation.x = -Math.max(0, c) * .8 * A; J.knB.rotation.x = -Math.max(0, -c) * .8 * A;
      J.skirt.rotation.x = -Math.sin(2 * phase) * .03 * A;
      const breathe = Math.sin(t * 1.7) * .014;
      J.torso.rotation.x = d(J.torso.rotation.x, -.06 * A + breathe, k);
      J.torso.rotation.y = d(J.torso.rotation.y, -s * .15 * A + st.lookX * .28 * st.hero + st.back * .32, k);
      const lookY = st.lookX * .75 * st.hero + Math.sin(t * .31) * .18 * I * (1 - st.hero) * (1 - st.back) + st.back * 1.0;
      const lookX = -st.lookY * .45 * st.hero + st.deck * .22 * (1 - st.back) - .04 * A;
      J.neck.rotation.y = d(J.neck.rotation.y, lookY - J.torso.rotation.y * .6 - J.hips.rotation.y, k);
      J.neck.rotation.x = d(J.neck.rotation.x, lookX, k);
      J.shA.rotation.x = -s * .5 * A + breathe; J.shB.rotation.x = s * .5 * A + breathe;
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
