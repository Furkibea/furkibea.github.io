// gl-space.js — sky, horizon world, ringed ice giant, moon, far planet, sun
(function () {
  const FL = window.FL;
  FL.buildSpace = function (scene) {
    const C = FL.C, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const SUN = V(-760, 170, -640);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 64, 32), FL.skyMat()); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
    const mats = [sky.material];
    function body(r, pos, mat, rx, rz, ws, hs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws || 96, hs || 64), mat); m.position.copy(pos); m.rotation.set(rx || 0, 0, rz || 0);
      mat.uniforms.uSun.value.copy(SUN).sub(pos).normalize(); scene.add(m); mats.push(mat); return m;
    }
    function atmo(r, pos, col, I, k) {
      const mat = FL.atmoMat(col, I, Math.sqrt(1 - 1 / (k * k)));
      const m = new THREE.Mesh(new THREE.SphereGeometry(r * k, 128, 64), mat); m.position.copy(pos); mat.uniforms.uSun.value.copy(SUN).sub(pos).normalize(); scene.add(m); return m;
    }
    // horizon: cloud world filling the lower window
    const hp = V(0, -532, -330);
    body(520, hp, FL.planetMat({ type: 1, c: ['#123a66', '#5d5a48', '#857a60', '#ffb46a'], atm: '#78aaff', atmI: 1.0, atmP: 2.6, freq: 7, cloud: .85, spin: .0025, seed: 3, sunI: 1.15 }), 0, 0, 256, 128);
    atmo(520, hp, '#5d9cff', 1.5, 1.02);
    // ringed ice giant
    const gp = V(-104, 74, -420);
    const giant = body(58, gp, FL.planetMat({ type: 0, c: ['#a9c9cc', '#5f8e9a', '#dde9e6', '#f4f7f3'], atm: '#bfe6ff', atmI: .7, atmP: 3.2, spin: .018, seed: 1.3, sunI: 1.6 }), .5, .36);
    atmo(58, gp, '#9fd6ff', 1.1, 1.05);
    const rm = FL.ringMat({ r: 58, inner: 58 * 1.32, outer: 58 * 2.3, c1: '#8f9aa0', c2: '#e6e2d8' });
    rm.uniforms.uSun.value.copy(SUN).sub(gp).normalize(); rm.uniforms.uPP.value.copy(gp);
    const ring = new THREE.Mesh(new THREE.RingGeometry(58 * 1.3, 58 * 2.32, 256, 1), rm); ring.rotation.x = Math.PI / 2; giant.add(ring);
    // moon
    body(8.5, V(64, 36, -250), FL.planetMat({ type: 2, c: ['#8f8c88', '#55524e', '#34322f'], atmI: 0, seed: 7, spin: .006, sunI: 1.8 }), 0, .1, 64, 48);
    // distant rust world
    body(6, V(190, 104, -760), FL.planetMat({ type: 0, c: ['#b0643e', '#6f3520', '#d9a070', '#f3d6a6'], atm: '#ffb080', atmI: .35, spin: .03, seed: 5 }), 0, .2, 48, 32);
    // sun: core + halo + anamorphic streak
    const sunC = FL.cv(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.08, 'rgba(255,244,228,.95)'); r.addColorStop(.25, 'rgba(255,214,170,.3)'); r.addColorStop(1, 'rgba(255,190,140,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
    const sunT = FL.tx(sunC);
    const spr = (sx, sy, k, op) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunT, color: C('#fff1de').multiplyScalar(k), transparent: true, opacity: op || 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.position.copy(SUN); s.scale.set(sx, sy, 1); scene.add(s); return s; };
    spr(380, 380, 3.5); spr(90, 90, 12); const streak = spr(2400, 9, 1.6, .35);
    // moonlet orbiting the ice giant
    const moonlet = body(3.2, V(0, 0, 0), FL.planetMat({ type: 2, c: ['#b9b3aa', '#6d6860', '#4a4640'], atmI: 0, seed: 11, spin: .01, sunI: 1.8 }), 0, 0, 48, 32);
    // meteors
    const metT = FL.tx(FL.cv(256, 16, (g) => { const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.85, 'rgba(220,235,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 5, 256, 6); }));
    const mets = [0, 1, 2].map((i) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: metT, color: C('#dfeaff').multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 })); sp.userData = { t: 0, dur: 1, wait: 2 + i * 3 }; scene.add(sp); return sp; });
    const spawnMet = (sp) => { const a = Math.PI + .35 + Math.random() * .5; sp.userData = { t: 0, dur: .7 + Math.random() * .6, wait: 4 + Math.random() * 7, a, x: -120 + Math.random() * 280, y: 70 + Math.random() * 90, z: -380 - Math.random() * 200 }; sp.material.rotation = a; sp.scale.set(30 + Math.random() * 40, 1.4, 1); };
    // shuttle drifting past the window
    const sh = new THREE.Group();
    const hullM = new THREE.MeshStandardMaterial({ color: C('#c9ccd1'), roughness: .5, metalness: .6 }), darkM = new THREE.MeshStandardMaterial({ color: C('#2a2d33'), roughness: .6, metalness: .5 });
    const part = (g, m, x, y, z, rz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.z = rz || 0; sh.add(o); return o; };
    part(new THREE.CylinderGeometry(1.1, 1.3, 7, 12), hullM, 0, 0, 0, Math.PI / 2);
    part(new THREE.ConeGeometry(1.1, 2, 12), hullM, 4.5, 0, 0, -Math.PI / 2);
    part(new THREE.BoxGeometry(9, .08, 2.6), darkM, -.6, 0, 3.1); part(new THREE.BoxGeometry(9, .08, 2.6), darkM, -.6, 0, -3.1);
    part(new THREE.BoxGeometry(.2, .2, 3.6), hullM, -.6, 0, 0);
    const glowS = (c, k, x, z, s) => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunT, color: C(c).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); o.position.set(x, 0, z); o.scale.set(s, s, 1); sh.add(o); return o; };
    glowS('#9fd0ff', 5, -3.9, 0, 3.5);
    const nav = [glowS('#ff3b30', 6, -.6, 4.6, 1.2), glowS('#38ff7a', 6, -.6, -4.6, 1.2)];
    sh.rotation.set(.12, -.25, .06); scene.add(sh);
    // orbital platform (truss + solar arrays) drifting off the right side
    const plat = new THREE.Group(); plat.position.set(92, 22, -190); plat.rotation.set(.3, -.6, .2); scene.add(plat);
    const solC = FL.cv(256, 128, (g) => { g.fillStyle = '#0b1a33'; g.fillRect(0, 0, 256, 128); g.strokeStyle = 'rgba(160,190,230,.5)'; g.lineWidth = 1; for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); } for (let y = 0; y <= 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } });
    const solM = new THREE.MeshStandardMaterial({ map: FL.tx(solC), color: C('#9fb8e0'), roughness: .25, metalness: .8, side: THREE.DoubleSide });
    const trM = new THREE.MeshStandardMaterial({ color: C('#b8bcc4'), roughness: .45, metalness: .7 });
    const pp = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); plat.add(o); return o; };
    pp(new THREE.BoxGeometry(46, .5, .5), trM, 0, 0, 0);
    for (let i = -2; i <= 2; i++) { if (!i) continue; [-1, 1].forEach((s) => pp(new THREE.BoxGeometry(5, .06, 11), solM, i * 9, 0, s * 6.2)); pp(new THREE.BoxGeometry(.3, .3, 24), trM, i * 9, 0, 0); }
    const core = pp(new THREE.CylinderGeometry(2.2, 2.2, 7, 16), trM, 0, 0, 0); core.rotation.z = Math.PI / 2;
    pp(new THREE.TorusGeometry(4.2, .45, 10, 40), trM, 0, 0, 0).rotation.y = Math.PI / 2;
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunT, color: C('#ff5b1f').multiplyScalar(8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); beacon.scale.set(3, 3, 1); beacon.position.set(23.5, 0, 0); plat.add(beacon);
    // faint coloured nebula behind the planets
    const nebC = FL.cv(256, 256, (g) => { for (let i = 0; i < 60; i++) { const x = 40 + Math.random() * 176, y = 40 + Math.random() * 176, r = 20 + Math.random() * 60, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, Math.random() < .5 ? 'rgba(90,120,255,.09)' : 'rgba(255,110,90,.06)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 256); } });
    const neb = new THREE.Sprite(new THREE.SpriteMaterial({ map: FL.tx(nebC), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: .9 })); neb.position.set(40, 160, -1400); neb.scale.set(1500, 1000, 1); scene.add(neb);
    return { sky, update(t, dt) {
      plat.rotation.x = .3 + t * .01; beacon.material.opacity = Math.sin(t * 2.5) > .3 ? 1 : .1;
      dt = dt || .016;
      mats.forEach((m) => { m.uniforms.uT.value = t; }); streak.material.opacity = .32 + Math.sin(t * .7) * .05;
      const a = t * .045; moonlet.position.set(gp.x + Math.cos(a) * 150, gp.y + Math.sin(a) * 38, gp.z + Math.sin(a) * 150); moonlet.material.uniforms.uSun.value.copy(SUN).sub(moonlet.position).normalize();
      mets.forEach((sp) => { const u = sp.userData; u.t += dt; const k = u.t / u.dur; if (k > 1) { sp.material.opacity = 0; if (u.t > u.dur + u.wait) spawnMet(sp); return; } if (u.a == null) return; const d = k * 160; sp.position.set(u.x + Math.cos(u.a) * d, u.y + Math.sin(u.a) * d, u.z); sp.material.opacity = Math.sin(k * Math.PI); });
      const sk = (t * .012) % 1; sh.position.set(-110 + sk * 220, 14 + Math.sin(t * .2) * 1.5, -130); sh.visible = sk > .02 && sk < .98;
      nav.forEach((n, i) => { n.material.opacity = Math.sin(t * 5 + i * 3) > .6 ? 1 : .15; });
    } };
  };
})();
