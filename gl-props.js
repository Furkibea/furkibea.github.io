// gl-props.js — the ship's furniture and equipment, built from simple shapes with canvas-drawn detail:
// the bridge on the observation deck (helm desk, two stations, pilot seats, live screens, overhead switch panel,
// hologram), and in the corridor the pilot's own Roblox character twice: on a turntable in the avatar bay and as a
// hologram over the hangar's holo table; plus lockers, extinguishers, valves and wall panels.
// Scale: the pilot is 4.3 units tall (~1.8 m), so 1 m ≈ 2.4 units. Static parts are merged per material.
(function () {
  const FL = window.FL = window.FL || {};
  FL.buildProps = function (scene, avatar) {
    const C = FL.C, cv = FL.cv, tx = FL.tx;
    const upd = []; let zNow = 0;
    const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
    const add = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || scene).add(m); return m; };
    const box = (w, h, d, mat, x, y, z, rx, ry, rz, p) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, p);
    const cyl = (rt, rb, h, seg, mat, x, y, z, rx, ry, rz, p) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, ry, rz, p);
    const ball = (r, mat, x, y, z, p) => add(new THREE.SphereGeometry(r, 16, 12), mat, x, y, z, 0, 0, 0, p);
    const group = (x, y, z, ry, p) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; (p || scene).add(g); return g; };
    const std = (hex, r, m, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: C(hex), roughness: r, metalness: m }, extra || {}));
    const glow = (hex, k) => new THREE.MeshBasicMaterial({ color: C(hex).multiplyScalar(k) });
    const additive = (hex, k, op, extra) => new THREE.MeshBasicMaterial(Object.assign({ color: C(hex).multiplyScalar(k), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, extra || {}));
    const clamp = (t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
    const round = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const M = {
      gun: std('#2b2f36', .42, .72), gunDark: std('#16181c', .5, .6), trim: std('#a0a6ae', .28, .9), leather: std('#141518', .45, .12),
      orange: std('#c2531f', .5, .2), red: std('#b3261e', .45, .2),
    };

    // merge a group's static, untextured meshes into one mesh per material (far fewer draw calls)
    function bake(root) {
      root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), byMat = new Map(), drop = [];
      root.traverse((o) => {
        if (!o.isMesh || o.material.map || o.userData.keep) return;
        const g = o.geometry.index ? o.geometry.clone() : null; if (!g) return;
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(g); drop.push(o);
      });
      drop.forEach((o) => { o.parent.remove(o); o.geometry.dispose(); });
      byMat.forEach((gs, mat) => {
        const pos = [], nor = [], idx = []; let off = 0;
        gs.forEach((g) => { const p = g.attributes.position, n = g.attributes.normal, ix = g.index; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); off += p.count; g.dispose(); });
        const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
        root.add(new THREE.Mesh(out, mat));
      });
      return root;
    }

    // ---------- screens: canvas UIs, redrawn a few times a second while the bridge is near ----------
    const UI = { bg: '#04090f', grid: 'rgba(120,200,255,.1)', txt: 'rgba(205,236,255,.9)', dim: 'rgba(150,195,225,.5)', cy: '#6fd6ff', or: '#ff7a3d', gr: '#4fe39a', rd: '#ff4b3a' };
    const font = (g, px, w) => { g.font = `${w || 500} ${px}px "IBM Plex Mono",monospace`; };
    const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
    const clock = (t) => 'T+ ' + pad2(t / 3600 + 4) + ':' + pad2((t / 60) % 60 + 12) + ':' + pad2(t % 60);
    function frame(g, W, H, title, t) {
      g.fillStyle = UI.bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = UI.grid; g.lineWidth = 1;
      for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x + .5, 34); g.lineTo(x + .5, H); g.stroke(); }
      for (let y = 34; y < H; y += 32) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
      g.fillStyle = 'rgba(111,214,255,.14)'; g.fillRect(0, 0, W, 30); font(g, 15, 600); g.fillStyle = UI.txt; g.fillText(title, 12, 20);
      font(g, 12); g.fillStyle = UI.dim; g.textAlign = 'right'; g.fillText(clock(t), W - 30, 20); g.textAlign = 'left';
      g.fillStyle = Math.sin(t * 4) > 0 ? UI.or : 'rgba(255,122,61,.3)'; g.fillRect(W - 22, 12, 10, 8);
    }
    const drawNav = (g, W, H, t) => {
      frame(g, W, H, 'NAV · ORBIT', t); const cx = W * .36, cy = H * .58, R = H * .2;
      const pg = g.createRadialGradient(cx - R * .3, cy - R * .3, 2, cx, cy, R); pg.addColorStop(0, '#2e7fb8'); pg.addColorStop(1, '#0a2744');
      g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.strokeStyle = UI.cy; g.lineWidth = 1.5; g.stroke();
      g.save(); g.translate(cx, cy); g.rotate(-.35); g.strokeStyle = 'rgba(255,122,61,.85)'; g.setLineDash([6, 5]); g.beginPath(); g.ellipse(0, 0, R * 2, R * 1.25, 0, 0, 7); g.stroke(); g.setLineDash([]);
      const a = t * .3; g.fillStyle = '#fff'; g.beginPath(); g.arc(Math.cos(a) * R * 2, Math.sin(a) * R * 1.25, 5, 0, 7); g.fill(); g.restore();
      font(g, 14); [['ALT', (408.2 + Math.sin(t * .3) * .4).toFixed(1) + ' km'], ['VEL', (7.66 + Math.sin(t * .2) * .01).toFixed(3) + ' km/s'], ['INC', '51.64°'], ['PER', '92.8 min']].forEach(([k, v], i) => { g.fillStyle = UI.dim; g.fillText(k, W * .7, 74 + i * 32); g.fillStyle = UI.txt; g.fillText(v, W * .7 + 46, 74 + i * 32); });
    };
    const drawSys = (g, W, H, t) => {
      frame(g, W, H, 'SYSTEMS', t); font(g, 14);
      [['REACTOR', .82, UI.gr], ['O2 SUPPLY', .97, UI.gr], ['SHIELDS', .64, UI.cy], ['HULL', .91, UI.gr], ['COOLANT', .47, UI.or], ['COMMS', .88, UI.cy]].forEach(([k, v, c], i, rows) => {
        const y = 52 + i * ((H - 64) / rows.length), vv = Math.min(1, v + Math.sin(t * (1 + i * .3) + i) * .03);
        g.fillStyle = UI.dim; g.fillText(k, 14, y + 13); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(132, y + 1, W - 212, 14);
        for (let s = 0; s < 20; s++) if (s / 20 < vv) { g.fillStyle = c; g.fillRect(133 + s * ((W - 212) / 20), y + 2, (W - 212) / 20 - 3, 12); }
        g.fillStyle = UI.txt; g.fillText(Math.round(vv * 100) + '%', W - 68, y + 13);
      });
    };
    const drawEng = (g, W, H, t) => {
      frame(g, W, H, 'PROPULSION', t);
      [[W * .27, 'THRUST', UI.cy], [W * .73, 'CORE TEMP', UI.or]].forEach(([cx, lab, c], i) => {
        const cy = H * .6, r = H * .27, v = .55 + Math.sin(t * (.7 + i * .4) + i) * .12;
        g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.arc(cx, cy, r, Math.PI * .75, Math.PI * 2.25); g.stroke();
        g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, r, Math.PI * .75, Math.PI * (.75 + 1.5 * v)); g.stroke();
        g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.25)'; for (let k = 0; k <= 10; k++) { const a = Math.PI * (.75 + .15 * k); g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18)); g.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); g.stroke(); }
        font(g, 24, 600); g.fillStyle = UI.txt; g.textAlign = 'center'; g.fillText(i ? Math.round(820 + v * 400) + ' K' : Math.round(v * 100) + '%', cx, cy + 8); font(g, 12); g.fillStyle = UI.dim; g.fillText(lab, cx, cy + r * .72); g.textAlign = 'left';
      });
    };
    const drawComm = (g, W, H, t) => {
      frame(g, W, H, 'COMMS · 142.61 MHZ', t); g.strokeStyle = UI.cy; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x < W; x += 4) { const u = x / W, y = H * .36 + Math.sin(u * 30 + t * 6) * 18 * Math.sin(u * 3.1 + t) + Math.sin(u * 90 - t * 11) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      const lines = (FL.commsLines && FL.commsLines.length ? FL.commsLines : ['Station online', 'Link stable']).slice(0, 4); font(g, 13);
      lines.forEach((l, i) => { g.fillStyle = i === Math.floor(t * .6) % lines.length ? UI.or : UI.dim; g.fillText('> ' + String(l).toUpperCase().slice(0, 36), 14, H * .6 + i * 20); });
    };
    const drawScan = (g, W, H, t) => {
      frame(g, W, H, 'SENSORS · PROX', t); const c = [W * .5, H * .58], R = H * .38, a = t * 1.4;
      g.strokeStyle = 'rgba(79,227,154,.3)'; g.lineWidth = 1; [.33, .66, 1].forEach((k) => { g.beginPath(); g.arc(c[0], c[1], R * k, 0, 7); g.stroke(); });
      for (let k = 0; k < 22; k++) { const aa = a - k * .04; g.fillStyle = `rgba(79,227,154,${(1 - k / 22) * .22})`; g.beginPath(); g.moveTo(c[0], c[1]); g.arc(c[0], c[1], R, aa - .04, aa); g.closePath(); g.fill(); }
      [[.6, .8], [2.2, .5], [3.9, .9], [5.1, .35]].forEach(([ba, br]) => { const d = ((a - ba) % 6.283 + 6.283) % 6.283, k = Math.max(0, 1 - d / 5); if (k > 0) { g.fillStyle = `rgba(160,255,200,${k})`; g.beginPath(); g.arc(c[0] + Math.cos(ba) * br * R, c[1] + Math.sin(ba) * br * R, 4, 0, 7); g.fill(); } });
      font(g, 13); g.fillStyle = UI.dim; g.fillText('DEBRIS 4 · SAT 3', 14, H - 14);
    };
    const drawHull = (g, W, H, t) => {
      frame(g, W, H, 'HULL · STRUCTURE', t); g.save(); g.translate(W * .42, H * .6); g.strokeStyle = UI.cy; g.lineWidth = 1.4;
      const k = Math.cos(t * .4); for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, 0, 120 - i * 26, (120 - i * 26) * Math.abs(k) * .45 + 4, 0, 0, 7); g.stroke(); }
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * .4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 120, Math.sin(a) * 120 * Math.abs(k) * .45); g.stroke(); }
      g.restore(); font(g, 14); g.fillStyle = UI.txt; g.fillText('INTEGRITY 98.4%', W * .68, 80); g.fillStyle = UI.gr; g.fillText('PRESSURE OK', W * .68, 110); g.fillStyle = UI.dim; g.fillText('DECKS 3 · SEALED 1', W * .68, 140);
    };
    const screens = [];
    function monitor(parent, w, h, x, y, z, rx, ry, draw, fps) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx || 0, ry || 0, 0); parent.add(g);
      box(w + .18, h + .18, .14, M.gunDark, 0, 0, -.08, 0, 0, 0, g);
      box(.16, .55, .16, M.gun, 0, -h / 2 - .22, -.14, 0, 0, 0, g);
      const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const t = clamp(tx(c));
      add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: C('#ffffff').multiplyScalar(1.35) }), 0, 0, .002, 0, 0, 0, g);
      const s = { c, t, draw, fps: fps || 6, last: -9 }; screens.push(s); draw(c.getContext('2d'), c.width, c.height, 0); t.needsUpdate = true;
      return g;
    }
    upd.push((t) => { if (zNow > -35) return; screens.forEach((s) => { if (t - s.last < 1 / s.fps) return; s.last = t; s.draw(s.c.getContext('2d'), s.c.width, s.c.height, t); s.t.needsUpdate = true; }); });

    // ---------- desk tops: keys, knobs, an LCD strip and LEDs; a second canvas carries the backlight (emissive) ----------
    function deskMat(seed) {
      const R = rng(seed), W = 1024, H = 384, keys = [], leds = [], labels = [];
      const cluster = (x0, y0, cols, rows, kw, kh, gap, label) => { labels.push([label, x0, y0 - 12]); for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const h = R(); keys.push([x0 + c * (kw + gap), y0 + r * (kh + gap), kw, kh, R() < .5 ? (h < .55 ? '#ffb46a' : h < .9 ? '#6fd6ff' : '#ff5a4a') : null]); } };
      cluster(40, 72, 6, 3, 44, 34, 10, 'HELM · NAV'); cluster(40, 262, 4, 2, 70, 40, 12, 'THRUST'); cluster(704, 72, 5, 4, 46, 30, 9, 'SYSTEMS'); cluster(704, 268, 3, 2, 80, 40, 12, 'COMM');
      for (let i = 0; i < 14; i++) leds.push([382 + (i % 7) * 42, 152 + Math.floor(i / 7) * 22, R() < .3 ? '#ff4b3a' : R() < .6 ? '#4fe39a' : '#ffb46a']);
      const arcs = [0, 1, 2].map(() => .8 + R() * 2.4);
      const draw = (g, em) => {
        g.fillStyle = em ? '#000' : '#1a1d22'; g.fillRect(0, 0, W, H);
        if (!em) { g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 3; g.strokeRect(10, 10, W - 20, H - 20); g.strokeRect(352, 30, 330, 326); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.strokeRect(15, 15, W - 30, H - 30); }
        keys.forEach(([x, y, w, h, lit]) => {
          if (!em) { g.fillStyle = '#2d3138'; round(g, x, y, w, h, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; round(g, x + 2, y + 2, w - 4, (h - 4) * .45, 3); g.fill(); }
          if (lit) { g.fillStyle = lit; g.globalAlpha = em ? .9 : .35; round(g, x + 5, y + 5, w - 10, h - 10, 3); g.fill(); g.globalAlpha = 1; }
        });
        g.fillStyle = em ? '#0c3444' : '#07141a'; g.fillRect(372, 56, 290, 52); font(g, 22, 600); g.fillStyle = em ? '#7fe3ff' : '#2a6272'; g.fillText('ORB 408.2  V7.66', 386, 90);
        [[430, 250], [520, 250], [610, 250]].forEach(([x, y], i) => { if (em) { g.strokeStyle = '#ff7a3d'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 36, Math.PI * .75, Math.PI * .75 + arcs[i]); g.stroke(); } else { g.fillStyle = '#0d0f12'; g.beginPath(); g.arc(x, y, 28, 0, 7); g.fill(); g.strokeStyle = '#4a4f57'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#a0a6ae'; g.fillRect(x - 2, y - 24, 4, 12); } });
        leds.forEach(([x, y, c]) => { g.fillStyle = em ? c : '#232529'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
        if (!em) { g.fillStyle = 'rgba(205,212,220,.55)'; font(g, 12, 600); labels.forEach(([l, x, y]) => g.fillText(l, x, y)); }
      };
      return new THREE.MeshStandardMaterial({ map: clamp(tx(cv(W, H, (g) => draw(g, false)))), emissiveMap: clamp(tx(cv(W, H, (g) => draw(g, true)))), emissive: C('#ffffff'), emissiveIntensity: 1.7, roughness: .45, metalness: .4 });
    }

    // ---------- bridge pieces ----------
    function station(x, z, ry, w, seed, mons) {
      const g = group(x, 0, z, ry);
      box(w, 1.72, 1.5, M.gun, 0, .86, 0, 0, 0, 0, g);                                               // cabinet (~0.72 m)
      box(w - .4, .08, .05, glow('#6fd6ff', 2.4), 0, .16, .76, 0, 0, 0, g);                         // kick-plate light
      for (let i = 0; i < Math.floor((w - .6) / .45); i++) box(.28, .05, .03, M.gunDark, -w / 2 + .5 + i * .45, 1.0, .755, 0, 0, 0, g);  // vent slats
      add(new THREE.PlaneGeometry(w, 1.6), deskMat(seed), 0, 1.9, .02, -Math.PI / 2 + .24, 0, 0, g);   // sloped desk top
      box(w + .06, .09, .1, M.trim, 0, 1.76, .8, 0, 0, 0, g);                                        // front edge
      box(w + .06, .52, .14, M.gun, 0, 2.02, -.76, 0, 0, 0, g);                                       // back riser
      box(.08, .52, 1.62, M.trim, -w / 2 - .02, 1.95, 0, .24, 0, 0, g); box(.08, .52, 1.62, M.trim, w / 2 + .02, 1.95, 0, .24, 0, 0, g);
      mons.forEach(([mx, mw, mh, yaw, draw, fps]) => monitor(g, mw, mh, mx, 2.52 + mh / 2, -.66, -.16, yaw, draw, fps));
      return g;
    }
    function throttle(p, x, y, z) {
      box(.55, .14, .55, M.gunDark, x, y, z, .24, 0, 0, p);
      [-.12, .12].forEach((dx, i) => { cyl(.03, .03, .5, 8, M.trim, x + dx, y + .26, z + .02, -.45 + i * .18, 0, 0, p); ball(.075, M.orange, x + dx, y + .48, z - .1 + i * .04, p); });
    }
    function joystick(p, x, y, z) {
      cyl(.17, .2, .1, 16, M.gunDark, x, y, z, 0, 0, 0, p); cyl(.05, .05, .5, 10, M.trim, x, y + .28, z, .1, 0, 0, p);
      box(.15, .32, .13, M.leather, x, y + .6, z + .03, .1, 0, 0, p); ball(.035, glow('#ff4b3a', 3), x, y + .78, z + .07, p);
    }
    const inset = std('#26282c', .6, .1), seatLight = glow('#6fd6ff', 2);
    function seat(x, z, ry) {   // faces -z (the console); the backrest leans back toward +z
      const g = group(x, 0, z, ry);
      cyl(.52, .52, .08, 24, M.gunDark, 0, .04, 0, 0, 0, 0, g); cyl(.13, .19, 1.0, 12, M.trim, 0, .55, 0, 0, 0, 0, g);
      box(1.0, .2, 1.15, M.leather, 0, 1.14, 0, 0, 0, 0, g); box(1.29, .07, 1.24, M.orange, 0, 1.01, 0, 0, 0, 0, g);
      [-1, 1].forEach((s) => box(.2, .3, 1.15, M.leather, s * .58, 1.21, 0, 0, 0, s * -.25, g));                  // seat bolsters
      const back = new THREE.Group(); back.position.set(0, 1.25, .6); back.rotation.x = .14; g.add(back);
      box(.82, 1.75, .18, M.leather, 0, .9, 0, 0, 0, 0, back); box(.6, 1.2, .04, inset, 0, .95, -.1, 0, 0, 0, back);   // quilted centre
      [-1, 1].forEach((s) => { box(.26, 1.7, .3, M.leather, s * .5, .88, -.06, 0, s * .35, 0, back); box(.05, 1.7, .05, M.orange, s * .63, .88, .03, 0, s * .35, 0, back); });
      box(.66, .5, .2, M.leather, 0, 2.05, .02, 0, 0, 0, back); [-1, 1].forEach((s) => box(.16, .46, .24, M.leather, s * .38, 2.05, -.04, 0, s * .4, 0, back));
      box(.92, 1.82, .06, M.gun, 0, .9, .12, 0, 0, 0, back); box(.5, .05, .02, seatLight, 0, 1.55, .16, 0, 0, 0, back);  // back shell + light
      for (let i = 0; i < 5; i++) box(.56, .03, .02, M.gunDark, 0, .45 + i * .12, .16, 0, 0, 0, back);
      [-1, 1].forEach((s) => { box(.15, .12, .92, M.gun, s * .72, 1.6, .06, 0, 0, 0, g); box(.1, .42, .1, M.gun, s * .72, 1.38, .45, 0, 0, 0, g); });
      return bake(g);
    }
    // ===== BRIDGE on the observation deck (window at z -58, pilot stands at z -50) =====
    const grateT = tx(cv(256, 256, (g) => { g.fillStyle = '#1c1e22'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#0a0b0d'; g.lineWidth = 6; for (let i = -256; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i, 256); g.lineTo(i + 256, 0); g.stroke(); } g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2; g.strokeRect(4, 4, 248, 248); }), 9, 3);
    box(21.4, .1, 6.3, std('#3e434b', .55, .7, { map: grateT }), 0, .05, -54.5);                     // raised bridge platform
    box(21.4, .04, .08, glow('#6fd6ff', 2), 0, .1, -51.35);
    [-10.72, 10.72].forEach((x) => box(.08, .04, 6.3, glow('#ff5b1f', 2), x, .1, -54.5));

    const helm = station(0, -54.9, 0, 5.4, 11, [[-1.5, 2.3, 1.2, .14, drawSys, 5], [1.5, 2.3, 1.2, -.14, drawEng, 5]]);
    joystick(helm, -.55, 1.84, .32); throttle(helm, .7, 1.82, .3);
    bake(helm);
    const stL = station(-6.3, -54.2, .38, 4.6, 23, [[-1.15, 2.1, 1.15, .1, drawNav, 5], [1.15, 2.1, 1.15, -.1, drawComm, 4]]);
    const stR = station(6.3, -54.2, -.38, 4.6, 37, [[-1.15, 2.1, 1.15, .1, drawScan, 10], [1.15, 2.1, 1.15, -.1, drawHull, 5]]);
    throttle(stL, 1.4, 1.82, .3); joystick(stR, -1.3, 1.84, .32); bake(stL); bake(stR);
    seat(-6.3 + Math.sin(.38) * 1.85, -54.2 + Math.cos(.38) * 1.85, .38);
    seat(6.3 - Math.sin(.38) * 1.85, -54.2 + Math.cos(.38) * 1.85, -.38);

    // overhead switch panel hanging in front of the window's upper frame
    const ohC = (em) => cv(1024, 256, (g) => {
      g.fillStyle = em ? '#000' : '#1b1e23'; g.fillRect(0, 0, 1024, 256); const R2 = rng(77);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 22; i++) {
        const x = 30 + i * 44 + (i > 10 ? 30 : 0), y = 34 + row * 72, on = R2() < .55;
        if (!em) { g.fillStyle = '#0c0d10'; g.fillRect(x, y, 26, 40); g.fillStyle = '#b8bec6'; g.fillRect(x + 10, on ? y + 4 : y + 22, 6, 14); }
        g.fillStyle = em ? (on ? (R2() < .8 ? '#4fe39a' : '#ffb46a') : '#000') : '#26292e'; g.beginPath(); g.arc(x + 13, y + 52, 4, 0, 7); g.fill();
      }
      if (!em) { g.fillStyle = 'rgba(205,212,220,.5)'; font(g, 13, 600); ['PWR BUS A', 'PWR BUS B', 'LIFE SUP', 'THERMAL', 'COMM ARRAY'].forEach((l, i) => g.fillText(l, 30 + i * 205, 24)); }
    });
    const oh = group(0, 11.95, -55.9); oh.rotation.x = -.32;
    box(10, .45, 2.6, M.gunDark, 0, 0, 0, 0, 0, 0, oh);
    [-4.6, 4.6].forEach((x) => box(.12, 1.6, .12, M.trim, x, .95, 0, 0, 0, 0, oh));
    add(new THREE.PlaneGeometry(9.7, 2.4), new THREE.MeshStandardMaterial({ map: clamp(tx(ohC(false))), emissiveMap: clamp(tx(ohC(true))), emissive: C('#ffffff'), emissiveIntensity: 1.8, roughness: .5, metalness: .4 }), 0, -.232, 0, Math.PI / 2, 0, 0, oh);

    // hologram projector between the helm and the right station
    const hp = group(3.55, 0, -56.1);
    cyl(.42, .56, 1.95, 20, M.gun, 0, .975, 0, 0, 0, 0, hp); cyl(.47, .47, .06, 24, glow('#6fd6ff', 3), 0, 1.98, 0, 0, 0, 0, hp);
    const holo = new THREE.Group(); holo.position.y = 3.2; hp.add(holo);
    const hm = additive('#7fd8ff', .9, .4, { wireframe: true, side: THREE.FrontSide });
    const hs = new THREE.Mesh(new THREE.SphereGeometry(.62, 16, 10), hm); holo.add(hs);
    const hr = new THREE.Mesh(new THREE.RingGeometry(.9, 1.3, 48, 1), additive('#7fd8ff', 1.6, .35)); hr.rotation.x = Math.PI / 2 - .4; holo.add(hr);
    add(new THREE.ConeGeometry(.95, 1.2, 32, 1, true), additive('#7fd8ff', 1, .07), 0, 2.6, 0, Math.PI, 0, 0, hp);
    upd.push((t) => { if (zNow > -34) return; hs.rotation.y = t * .6; hr.rotation.z = t * .3; holo.position.y = 3.2 + Math.sin(t * 1.4) * .06; hm.opacity = .35 + Math.sin(t * 9) * .04 + (Math.random() < .02 ? -.25 : 0); });

    // ===== CORRIDOR =====
    // the pilot's own character appears twice: in full colour in the avatar bay, and as the hangar's hologram.
    // Both are built from the avatar's rig once it has loaded (avatar.onReady), sharing its geometry and textures.
    let K = null, bayFig = null, holoFig = null;
    const dialT = tx(cv(256, 256, (g) => { g.translate(128, 128); g.strokeStyle = 'rgba(127,216,255,.9)'; [120, 96, 70, 40].forEach((r, i) => { g.lineWidth = i ? 1.5 : 3; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }); for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 100, Math.sin(a) * 100); g.lineTo(Math.cos(a) * 114, Math.sin(a) * 114); g.stroke(); } }));
    const dotT = tx(cv(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); }));
    // canvas text drawn again once the web fonts are in
    const textTex = (w, h, draw) => { const c = cv(w, h, draw), t = tx(c); if (document.fonts) document.fonts.ready.then(() => { const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; }); return t; };
    // light motes rising through a column, fading in and out at its ends
    function motes(parent, n, r, y0, y1, hex, size) {
      const p = new Float32Array(n * 3), col = new Float32Array(n * 3), sp = new Float32Array(n);
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r; p.set([Math.cos(a) * d, y0 + Math.random() * (y1 - y0), Math.sin(a) * d], i * 3); sp[i] = .2 + Math.random() * .5; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: dotT, color: C(hex).multiplyScalar(2.2), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pts.frustumCulled = false; parent.add(pts);
      return (dt) => {
        for (let i = 0; i < n; i++) { let y = p[i * 3 + 1] + sp[i] * dt; if (y > y1) y = y0; p[i * 3 + 1] = y; const k = Math.sin(Math.PI * (y - y0) / (y1 - y0)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      };
    }
    const FRES_V = 'varying vec3 vN,vV;varying vec2 vUv;varying float vY;void main(){vUv=uv;vY=(modelMatrix*vec4(position,1.)).y;vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}';

    // avatar bay on the right wall past the crew quarters: the character on a slow turntable under a ring light. Open, not
    // behind glass, so any outfit fits: coats and capes flare out wider than a tube this corridor could hold.
    const bay = group(4.85, 0, -11, -.32);          // local +z looks up the corridor, toward the camera
    const bayG = glow('#6fd6ff', 2.4), bayO = glow('#ff7a3d', 2.4);
    cyl(1.9, 2.0, .22, 64, M.gunDark, 0, .11, 0, 0, 0, 0, bay);
    cyl(1.72, 1.8, .3, 64, M.gun, 0, .37, 0, 0, 0, 0, bay);
    for (let i = 0; i < 20; i++) { const a = (i + .5) / 20 * Math.PI * 2; box(.24, .045, .03, i % 5 ? bayG : bayO, Math.sin(a) * 1.775, .3, Math.cos(a) * 1.775, 0, a, 0, bay); }
    add(new THREE.TorusGeometry(1.66, .028, 6, 96), glow('#6fd6ff', 3), 0, .525, 0, Math.PI / 2, 0, 0, bay);
    const tt = group(0, .53, 0, 0, bay);           // turntable
    cyl(1.5, 1.52, .06, 64, M.gunDark, 0, .03, 0, 0, 0, 0, tt);
    add(new THREE.CircleGeometry(1.46, 64), additive('#7fd8ff', 1.1, .45, { map: dialT, side: THREE.FrontSide }), 0, .062, 0, -Math.PI / 2, 0, 0, tt);
    // back pillar with a light strip, and the arm that holds the ring light over the figure
    box(.5, 6.7, .36, M.gun, 0, 3.85, -2.3, 0, 0, 0, bay); box(.07, 6.0, .03, glow('#6fd6ff', 2.6), 0, 3.7, -2.11, 0, 0, 0, bay);
    box(.3, .22, 2.2, M.gun, 0, 6.95, -1.2, 0, 0, 0, bay); cyl(.26, .3, .3, 20, M.gunDark, 0, 6.95, 0, 0, 0, 0, bay);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 3; box(1.3, .06, .08, M.trim, Math.sin(a) * .92, 6.86, Math.cos(a) * .92, 0, a - Math.PI / 2, 0, bay); }   // spokes
    // ring light: a name band outside, dark metal inside, a glowing underside
    const bandDraw = (em) => (g) => {
      g.fillStyle = em ? '#000' : '#2b2f36'; g.fillRect(0, 0, 1024, 92);
      if (!em) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 6, 1024, 3); g.fillRect(0, 83, 1024, 3); }
      g.font = '800 50px "Anybody","Arial Black",sans-serif'; g.fillStyle = em ? '#d4f3ff' : '#59616b'; g.fillText('FURKANLUA', 60, 64);
      g.font = '600 22px "IBM Plex Mono",monospace'; g.fillStyle = em ? '#6fd6ff' : '#48505a'; g.fillText('AVATAR BAY 01', 440, 60);
      g.fillStyle = em ? '#4fe39a' : '#2f3b34'; g.beginPath(); g.arc(648, 52, 7, 0, 7); g.fill(); g.fillStyle = em ? '#4fe39a' : '#48505a'; g.fillText('READY', 662, 60);
      g.fillStyle = em ? 'rgba(111,214,255,.5)' : '#3a4048'; for (let x = 800; x < 1000; x += 14) g.fillRect(x, 40, 6, 14);
    };
    const bandT = textTex(1024, 92, bandDraw(false)), bandE = textTex(1024, 92, bandDraw(true)); bandT.repeat.x = bandE.repeat.x = 2;
    const halo = group(0, 6.55, 0, -.21 * Math.PI * 2, bay);   // turned so a label faces the corridor
    add(new THREE.CylinderGeometry(1.62, 1.62, .46, 96, 1, true), new THREE.MeshStandardMaterial({ map: bandT, emissiveMap: bandE, emissive: C('#ffffff'), emissiveIntensity: 1.7, roughness: .45, metalness: .6 }), 0, 0, 0, 0, 0, 0, halo).userData.keep = true;
    add(new THREE.CylinderGeometry(1.5, 1.5, .46, 64, 1, true), std('#16181c', .5, .6, { side: THREE.BackSide }), 0, 0, 0, 0, 0, 0, halo);
    add(new THREE.RingGeometry(1.5, 1.62, 96), M.gun, 0, .23, 0, -Math.PI / 2, 0, 0, halo);
    add(new THREE.RingGeometry(1.5, 1.62, 96), glow('#e8f7ff', 3.2), 0, -.23, 0, Math.PI / 2, 0, 0, halo);
    const bea = ball(.09, glow('#4fe39a', 4), 0, 7.12, -.3, bay); bea.userData.keep = true;
    // the light falling from the ring onto the stage
    const coneC = cv(64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,.05)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); });
    add(new THREE.CylinderGeometry(1.52, 1.72, 5.85, 64, 1, true), additive('#fff4e8', .9, .045, { map: clamp(tx(coneC)) }), 0, 3.4, 0, 0, 0, 0, bay);
    cyl(.08, .08, 2.4, 10, M.trim, 6.75, 7.0, -13.18, 0, 0, Math.PI / 2);   // conduit from the pillar top into the wall (world space)
    // name tag on the pedestal
    const tagDraw = (em) => (g) => {
      g.fillStyle = em ? '#000' : '#1b1e23'; g.fillRect(0, 0, 512, 128);
      g.font = '800 46px "Anybody","Arial Black",sans-serif'; g.fillStyle = em ? '#ffffff' : '#5a626c'; g.fillText('FURKANLUA', 24, 62);
      g.font = '600 20px "IBM Plex Mono",monospace'; g.fillStyle = em ? '#ff7a3d' : '#48505a'; g.fillText('PILOT · ROBLOX SCRIPTER', 26, 100);
    };
    add(new THREE.PlaneGeometry(1.1, .275), new THREE.MeshStandardMaterial({ map: textTex(512, 128, tagDraw(false)), emissiveMap: textTex(512, 128, tagDraw(true)), emissive: C('#ffffff'), emissiveIntensity: 1.4, roughness: .5, metalness: .4 }), 0, .37, 1.8, -.26, 0, 0, bay);
    const bayMotes = motes(bay, 50, 1.4, .7, 6.2, '#dff4ff', .05);
    // backlit recess in the wall behind it
    box(.1, 6.6, 3.8, M.gunDark, 7.82, 3.9, -11); [-1.85, 1.85].forEach((dz) => box(.04, 6.4, .06, glow('#bfe6ff', 2.2), 7.76, 3.9, -11 + dz));
    // lit by the bay alone, not by the lights that follow the pilot (their blue rim would tint it): a warm key from the ring
    // light, a soft fill, a faint cool edge, and the texture's own colours
    const figU = {
      uKeyDir: { value: new THREE.Vector3(-.3, .85, .45).normalize() }, uKey: { value: C('#fff3e6').multiplyScalar(2.0) },
      uFillDir: { value: new THREE.Vector3(.8, .1, .3).normalize() }, uFill: { value: C('#eef2fa').multiplyScalar(.5) },
      uAmb: { value: C('#ffffff').multiplyScalar(.38) }, uRim: { value: C('#e2f1ff').multiplyScalar(.24) },
    };
    const FIG_V = 'varying vec3 vW,vP,vN,vV;varying vec2 vUv;void main(){vUv=uv;vW=mat3(modelMatrix)*normal;vP=(modelMatrix*vec4(position,1.)).xyz;vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}';
    const FIG_F = `uniform sampler2D map;uniform vec3 uKeyDir,uKey,uFillDir,uFill,uAmb,uRim;varying vec3 vW,vP,vN,vV;varying vec2 vUv;
      void main(){vec4 tx=texture2D(map,vUv);if(tx.a<.45)discard;vec3 alb=pow(tx.rgb,vec3(2.2));float s=gl_FrontFacing?1.:-1.;
        vec3 wn=normalize(vW)*s,n=normalize(vN)*s,v=normalize(vV);float fr=pow(1.-clamp(dot(n,v),0.,1.),3.);
        float kd=max(dot(wn,uKeyDir),0.);vec3 h=normalize(uKeyDir+normalize(cameraPosition-vP));
        vec3 c=alb*(uAmb+uKey*kd+uFill*max(dot(wn,uFillDir),0.))+uKey*pow(max(dot(wn,h),0.),40.)*.06*kd+uRim*fr;
        gl_FragColor=vec4(c,1.);}`;
    const figMats = new Map();
    const figMat = (n) => {
      const map = K.tex(n); if (figMats.has(map)) return figMats.get(map);
      const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ map: { value: map } }, figU), vertexShader: FIG_V, fragmentShader: FIG_F, side: THREE.DoubleSide });
      figMats.set(map, m); return m;
    };
    // crew lockers
    const lockC = cv(256, 512, (g) => { g.fillStyle = '#3a3f47'; g.fillRect(0, 0, 256, 512); g.strokeStyle = '#15171b'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 500); g.fillStyle = '#15171b'; for (let i = 0; i < 6; i++) g.fillRect(40, 40 + i * 14, 176, 6); for (let i = 0; i < 6; i++) g.fillRect(40, 420 + i * 12, 176, 5); g.fillStyle = '#c2531f'; g.fillRect(40, 200, 60, 10); g.fillStyle = 'rgba(230,235,240,.8)'; g.font = '700 26px monospace'; g.fillText('CREW', 40, 250); g.fillStyle = '#9aa0a8'; g.fillRect(200, 262, 12, 80); });
    const lockM = std('#ffffff', .55, .55, { map: tx(lockC) });
    [-1.3, -2.55].forEach((z, i) => { const m = box(.9, 4.2, 1.2, [M.gun, lockM, M.gun, M.gun, M.gun, M.gun], 7.35, 2.1, z); m.userData.n = i; });
    // extinguisher cabinets
    const extC = cv(128, 256, (g) => { g.fillStyle = '#9c1f18'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#e8e8e8'; g.fillRect(10, 10, 108, 28); g.fillStyle = '#9c1f18'; g.font = '800 20px monospace'; g.fillText('FIRE', 36, 31); g.fillStyle = '#1a0a08'; g.fillRect(24, 52, 80, 190); g.fillStyle = '#d8342a'; g.fillRect(40, 80, 48, 150); g.fillStyle = '#222'; g.fillRect(50, 62, 28, 20); });
    const extM = std('#ffffff', .4, .2, { map: tx(extC) });
    [[1, -13.3], [-1, -23.6]].forEach(([s, z]) => box(.3, 1.3, .7, s > 0 ? [M.red, extM, M.red, M.red, M.red, M.red] : [extM, M.red, M.red, M.red, M.red, M.red], s * 7.7, 1.6, z));
    // valve wheels on the low pipes
    const valveM = std('#b3261e', .4, .5);
    [[-1, -5.5], [1, -16.8], [-1, -28.6], [1, -33]].forEach(([s, z]) => {
      const v = group(s * 6.72, 1.05, z, Math.PI / 2);
      add(new THREE.TorusGeometry(.34, .045, 8, 28), valveM, 0, 0, 0, 0, 0, 0, v);
      for (let i = 0; i < 3; i++) box(.04, .66, .04, valveM, 0, 0, 0, 0, 0, i * Math.PI / 3, v);
      cyl(.07, .07, .4, 10, M.trim, 0, 0, s * .2, Math.PI / 2, 0, 0, v); bake(v);
    });
    // wall control panels
    const panC = (em) => cv(256, 192, (g) => { g.fillStyle = em ? '#000' : '#202328'; g.fillRect(0, 0, 256, 192); g.fillStyle = em ? '#0d3b4a' : '#081419'; g.fillRect(16, 16, 150, 70); if (em) { g.fillStyle = '#7fe3ff'; g.font = '600 15px monospace'; g.fillText('PRESS 101.3', 26, 44); g.fillText('TEMP  21.4C', 26, 68); } for (let i = 0; i < 8; i++) { const x = 18 + (i % 4) * 38, y = 106 + Math.floor(i / 4) * 38, lit = i % 3 === 0; g.fillStyle = em ? (lit ? (i % 2 ? '#ffb46a' : '#4fe39a') : '#000') : '#33373e'; g.fillRect(x, y, 28, 26); } g.fillStyle = em ? '#ff4b3a' : '#301010'; g.beginPath(); g.arc(210, 50, 16, 0, 7); g.fill(); });
    const panM = new THREE.MeshStandardMaterial({ map: tx(panC(false)), emissiveMap: tx(panC(true)), emissive: C('#ffffff'), emissiveIntensity: 1.6, roughness: .5, metalness: .4 });
    [[1, -6.95, 4.3], [-1, -21.4, 3.9], [1, -33.7, 3.9]].forEach(([s, z, y]) => box(.12, 1.0, 1.35, s > 0 ? [M.gun, panM, M.gun, M.gun, M.gun, M.gun] : [panM, M.gun, M.gun, M.gun, M.gun, M.gun], s * 7.8, y, z));

    // hangar: a holo table projecting the character. A depth-only pass first, so the additive hologram shows just its
    // outer surface (a clean, readable figure instead of every layer glowing through); texture detail comes through as brightness.
    const ht = group(4.6, 0, -17.2);
    cyl(1.05, .72, 1.8, 32, M.gun, 0, .9, 0, 0, 0, 0, ht); cyl(1.12, 1.12, .08, 40, M.trim, 0, 1.84, 0, 0, 0, 0, ht);
    add(new THREE.TorusGeometry(.76, .02, 6, 48), glow('#6fd6ff', 2.5), 0, .12, 0, Math.PI / 2, 0, 0, ht);
    const disc = add(new THREE.CircleGeometry(1.02, 40), additive('#7fd8ff', 1.4, .8, { map: dialT, side: THREE.FrontSide }), 0, 1.89, 0, -Math.PI / 2, 0, 0, ht);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, e = group(Math.sin(a) * 1.0, 1.88, Math.cos(a) * 1.0, a, ht); box(.12, .34, .12, M.gunDark, 0, .15, 0, -.35, 0, 0, e); ball(.045, glow('#bfeeff', 4), 0, .31, -.06, e); }   // emitters
    const beamC = cv(64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.65, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); g.globalCompositeOperation = 'destination-out'; for (let x = 0; x < 64; x += 4) { g.fillStyle = `rgba(0,0,0,${Math.random() * .6})`; g.fillRect(x, 0, 2, 256); } });
    add(new THREE.CylinderGeometry(1.14, .98, 2.9, 40, 1, true), additive('#7fd8ff', 1, .2, { map: clamp(tx(beamC)) }), 0, 3.35, 0, 0, 0, 0, ht);
    const ringTxt = 'FURKANLUA · PILOT PROFILE · ROBLOX SCRIPTER · ';
    const ring = add(new THREE.CylinderGeometry(1.3, 1.3, .14, 64, 1, true), additive('#9fe6ff', 1.6, .85, { side: THREE.FrontSide, map: textTex(2048, 36, (g) => {
      g.font = '600 24px "IBM Plex Mono",monospace'; const w = g.measureText(ringTxt).width, n = Math.max(1, Math.floor(2048 / w));
      g.setTransform(2048 / (n * w), 0, 0, 1, 0, 0); g.fillStyle = '#fff'; for (let i = 0; i < n; i++) g.fillText(ringTxt, i * w, 26);
    }) }), 0, 2.1, 0, 0, 0, 0, ht);
    const scanR = add(new THREE.TorusGeometry(.95, .01, 6, 64), additive('#bfefff', 3, .8), 0, 2.2, 0, Math.PI / 2, 0, 0, ht); scanR.userData.keep = true;
    const holoMotes = motes(ht, 36, .9, 1.95, 4.7, '#9fe6ff', .045);
    const holoF = group(0, 1.93, 0, 0, ht);
    const holoU = { uT: { value: 0 }, uAmp: { value: 1 }, uCol: { value: C('#5fd0ff') }, uHi: { value: C('#e6fbff') }, uY0: { value: 1.93 }, uH: { value: 2.45 } };
    const HOLO_F = `uniform sampler2D map;uniform vec3 uCol,uHi;uniform float uT,uAmp,uY0,uH;varying vec3 vN,vV;varying vec2 vUv;varying float vY;
      float h1(float x){return fract(sin(x*91.345)*47453.21);}
      void main(){vec4 tx=texture2D(map,vUv);if(tx.a<.45)discard;float lum=dot(tx.rgb,vec3(.299,.587,.114));
        vec3 n=normalize(vN)*(gl_FrontFacing?1.:-1.);float fr=pow(1.-clamp(dot(n,normalize(vV)),0.,1.),2.2);float y=(vY-uY0)/uH;
        float ln=.62+.38*sin(vY*160.-uT*6.);float sw=exp(-pow((fract(uT*.18)*1.5-.25-y)*9.,2.));float fl=step(.97,h1(floor(vY*24.)+floor(uT*13.)*3.7));
        vec3 base=mix(uCol,tx.rgb*vec3(.55,.9,1.2),.28);
        gl_FragColor=vec4((base*(.1+.8*lum)*ln+uCol*fr*1.5+uHi*sw*.55+uCol*fl*.4)*uAmp*smoothstep(-.02,.08,y),1.);}`;
    const holoMats = new Map();
    const holoMat = (n) => {
      const map = K.tex(n); if (holoMats.has(map)) return holoMats.get(map);
      const pair = [
        new THREE.MeshBasicMaterial({ map, alphaTest: .45, side: THREE.DoubleSide, colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.ShaderMaterial({ uniforms: Object.assign({ map: { value: map } }, holoU), vertexShader: FRES_V, fragmentShader: HOLO_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      ];
      holoMats.set(map, pair); return pair;
    };

    bake(bay); bake(ht);
    const noReflect = [];   // the figures' floor reflections sit behind their pedestals' anyway: skip them in the mirror pass
    if (avatar && avatar.onReady) avatar.onReady((kit) => {
      K = kit;
      bayFig = kit.build(figMat); group(0, .062, 0, Math.PI, tt).add(bayFig.model);   // the rig faces -z; turn it to face out
      holoFig = kit.build(holoMat, 2.45); holoF.add(holoFig.model);
      [bayFig.model, holoFig.model].forEach((m) => { m.traverse((o) => { if (o.isMesh) o.frustumCulled = true; }); noReflect.push(m); });
    });

    // the bay only runs while it can be seen; its occupant waves as the pilot walks past. The hologram turns, flickers and
    // now and then waves too.
    let lastT = 0, bayWave = -9, bayArmed = true;
    upd.push((t) => {
      const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t;
      bay.visible = zNow > -24;
      if (bay.visible) {
        tt.rotation.y = Math.sin(t * .3) * .55; bea.visible = Math.sin(t * 3) > -.3; bayMotes(dt);
        if (bayArmed && zNow < -6.5 && zNow > -15) { bayArmed = false; bayWave = t; } else if (zNow > -3 || zNow < -19) bayArmed = true;
        if (bayFig) K.idle(bayFig.J, t, t - bayWave < 2.3 ? t - bayWave : -1, 1.3);
      }
      ht.visible = zNow > -30;
      if (ht.visible) {
        holoU.uT.value = t; holoU.uAmp.value = .92 + Math.sin(t * 17) * .04 + (Math.random() < .012 ? -.45 : 0);
        holoF.rotation.y = t * .45; holoF.position.set(Math.random() < .01 ? (Math.random() - .5) * .06 : 0, 1.93 + Math.sin(t * 1.3) * .03, 0);
        disc.rotation.z = -t * .2; ring.rotation.y = -t * .25; scanR.position.y = 2.1 + (.5 + .5 * Math.sin(t * 1.1)) * 2.5; holoMotes(dt);
        if (holoFig) { const w = t % 11 - 6; K.idle(holoFig.J, t, w >= 0 && w < 2.3 ? w : -1, 0); }
      }
    });

    return { noReflect, update(t, z) { if (z != null) zNow = z; upd.forEach((f) => f(t)); } };
  };
})();
