// gl-station.js — corridor, side viewport, code wall, bulkhead door, observation deck
(function () {
  const FL = window.FL = window.FL || {};
  const C = FL.C;
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const tx = (c, rx, ry) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  FL.cv = cv; FL.tx = tx;
  const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

  function panelCanvas(seed, base, labels) {
    const R = rng(seed);
    return cv(512, 512, (g) => {
      g.fillStyle = base; g.fillRect(0, 0, 512, 512);
      const id = g.getImageData(0, 0, 512, 512);
      for (let i = 0; i < id.data.length; i += 4) { const n = (R() - .5) * 14; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
      g.putImageData(id, 0, 0);
      const rects = [];
      (function sub(x, y, w, h, d) {
        if (d > 2 || (d > 0 && R() < .28) || w < 110 || h < 110) { rects.push([x, y, w, h]); return; }
        if (w > h) { const k = w * (.35 + R() * .3) | 0; sub(x, y, k, h, d + 1); sub(x + k, y, w - k, h, d + 1); }
        else { const k = h * (.35 + R() * .3) | 0; sub(x, y, w, k, d + 1); sub(x, y + k, w, h - k, d + 1); }
      })(0, 0, 512, 512, 0);
      rects.forEach(([x, y, w, h]) => {
        const t = R() * 16 - 8;
        g.fillStyle = t > 0 ? `rgba(255,255,255,${t / 160})` : `rgba(0,0,0,${-t / 90})`; g.fillRect(x + 3, y + 3, w - 6, h - 6);
        g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1; g.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
        [[x + 11, y + 11], [x + w - 11, y + 11], [x + 11, y + h - 11], [x + w - 11, y + h - 11]].forEach(([bx, by]) => {
          g.fillStyle = 'rgba(0,0,0,.65)'; g.beginPath(); g.arc(bx, by, 2.6, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(bx - .7, by - .7, 1.1, 0, 7); g.fill();
        });
        if (R() < .2 && w > 130 && h > 90) for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(x + 22, y + 22 + k * 8, w * .45, 4); }
        if (labels && R() < .22) { g.fillStyle = 'rgba(255,255,255,.22)'; g.font = '600 12px monospace'; g.fillText(labels[(R() * labels.length) | 0], x + 18, y + h - 18); }
        if (R() < .12) { g.fillStyle = 'rgba(255,91,31,.55)'; g.fillRect(x + w - 34, y + 18, 14, 5); }
        const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${R() * .3})`); g.fillStyle = gr; g.fillRect(x, y, w, h);
      });
    });
  }
  function offsetPoly(P, d) {
    const n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
      const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
      const l1 = Math.hypot(e1[0], e1[1]), l2 = Math.hypot(e2[0], e2[1]);
      const n1 = [e1[1] / l1, -e1[0] / l1], n2 = [e2[1] / l2, -e2[0] / l2];
      const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
      out.push([b[0] + (n1[0] + n2[0]) / k * d, b[1] + (n1[1] + n2[1]) / k * d]);
    }
    return out;
  }
  const shapeOf = (P, T) => { const s = new (T || THREE.Shape)(); s.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]); s.closePath(); return s; };
  function roundRect(x0, y0, x1, y1, r, T) {
    const s = new (T || THREE.Shape)();
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0); return s;
  }

  FL.buildStation = function (scene, renderer) {
    const upd = []; let zNow = 0;
    const add = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); scene.add(m); return m; };
    const bx = (w, h, d, mat, x, y, z, rx, ry, rz) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
    const led = (hex, k) => new THREE.MeshBasicMaterial({ color: C(hex).multiplyScalar(k) });

    // environment for metal reflections: long light strips like the corridor ceiling
    {
      const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
      es.add(new THREE.Mesh(new THREE.BoxGeometry(40, 30, 120), new THREE.MeshBasicMaterial({ color: C('#07080a'), side: THREE.BackSide })));
      const sm = new THREE.MeshBasicMaterial({ color: C('#ffffff').multiplyScalar(5) });
      [-1, 1].forEach((s) => { [0, 1].forEach((k) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.5, .2, 110), sm); m.position.set(s * (5.2 + k * .9), 9 + k * .6, 0); m.rotation.z = s * .78; es.add(m); }); });
      const w = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshBasicMaterial({ color: C('#9fb8d8').multiplyScalar(.6) })); w.position.set(0, 4, -55); es.add(w);
      scene.environment = pm.fromScene(es, .03).texture; pm.dispose();
    }

    const wallCanv = [11, 23, 37].map((s) => panelCanvas(s, '#3c4046', ['FL-204', 'DECK 02', 'HV 480V', 'O2 LINE', 'NO STEP', 'SVC 7A']));
    const wallT = wallCanv.map((c) => tx(c));
    const M = {
      wall: wallT.map((t) => new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: .018, color: C('#b4bac2'), roughness: .5, metalness: .62 })),
      ceil: new THREE.MeshStandardMaterial({ map: wallT[1], bumpMap: wallT[1], bumpScale: .015, color: C('#6d7179'), roughness: .6, metalness: .6 }),
      chamf: new THREE.MeshStandardMaterial({ map: wallT[2], bumpMap: wallT[2], bumpScale: .015, color: C('#555a61'), roughness: .55, metalness: .6 }),
      hull: new THREE.MeshStandardMaterial({ color: C('#24272c'), roughness: .38, metalness: .8 }),
      dark: new THREE.MeshStandardMaterial({ color: C('#0e0f12'), roughness: .62, metalness: .5 }),
      shell: new THREE.MeshBasicMaterial({ color: C('#030304') }),
      pipe: new THREE.MeshStandardMaterial({ color: C('#50555c'), roughness: .3, metalness: .9 }),
      white: led('#eef4ff', 4.2), whiteDim: led('#dfe8f5', 1.6), cyan: led('#7fd8ff', 3), orange: led('#ff5b1f', 3.2),
    };

    // ===== FLOOR: planar reflection (fallback: standard) =====
    const floorGeo = new THREE.PlaneGeometry(30, 76);
    const tileC = cv(256, 256, (g) => { g.fillStyle = '#0c0d10'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 252); });
    const floorStd = add(floorGeo, new THREE.MeshStandardMaterial({ map: tx(tileC, 12.5, 31.7), color: C('#8a8f96'), roughness: .22, metalness: .85 }), 0, 0, -26, -Math.PI / 2);
    let reflector = null;
    if (THREE.Reflector) {
      reflector = new THREE.Reflector(floorGeo, { textureWidth: 512, textureHeight: 512, clipBias: .003, color: 0xffffff, shader: FL.FloorShader });
      reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, 0, -26); scene.add(reflector);
      floorStd.visible = false;
    }

    // ===== CORRIDOR (octagonal) =====
    const P = [[-6.6, 0], [6.6, 0], [8, 1.4], [8, 7.6], [4.6, 11], [-4.6, 11], [-8, 7.6], [-8, 1.4]];
    const edges = P.map((a, i) => { const b = P[(i + 1) % 8], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); return { mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, len, ang: Math.atan2(dy, dx), nx: dy / len, ny: -dx / len }; });
    const SEG = [];
    for (let i = 0; i < 8; i++) SEG.push([10 - i * 6, i === 7 ? -39.3 : 4 - i * 6]);
    const WIN = [3, 4];               // left viewport segments
    const CODE = [5, 6];              // right code-wall segments
    const edgeBox = (e, t, off, len, d, mat, zc, along) => { const m = bx(len, t, d, mat, e.mx + e.nx * off + Math.cos(e.ang) * (along || 0), e.my + e.ny * off + Math.sin(e.ang) * (along || 0), zc); m.rotation.z = e.ang; return m; };

    // shell behind everything (so seams read as dark gaps)
    edges.forEach((e, i) => {
      if (i === 0) return;
      if (i === 6) { edgeBox(e, .3, .45, e.len + .6, 18.3, M.shell, 1); edgeBox(e, .3, .45, e.len + .6, 19.3, M.shell, -29.65); edgeBox(e, .3, .45, 1.8, 12, M.shell, -14, 2.3); edgeBox(e, .3, .45, 1.2, 12, M.shell, -14, -2.6); }
      else edgeBox(e, .3, .45, e.len + .6, 49.3, M.shell, -14.65);
    });
    const ribShape = shapeOf(offsetPoly(P, .22)); ribShape.holes.push(shapeOf(offsetPoly(P, -.62), THREE.Path));
    const ribGeo = new THREE.ExtrudeGeometry(ribShape, { depth: .6, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2, curveSegments: 1 }); ribGeo.translate(0, 0, -.3);
    const lip = shapeOf(offsetPoly(P, -.6)); lip.holes.push(shapeOf(offsetPoly(P, -.68), THREE.Path));
    const lipGeo = new THREE.ExtrudeGeometry(lip, { depth: .08, bevelEnabled: false }); lipGeo.translate(0, 0, -.04);
    const R = rng(5); const guides = [], ribLights = [];
    SEG.forEach(([za, zb], si) => {
      const len = za - zb, zc = (za + zb) / 2;
      add(ribGeo, M.hull, 0, 0, za);
      { const lm = led('#dfe8f5', 1.2); add(lipGeo, lm, 0, 0, za); ribLights.push([lm, si]); }   // every rib glows; a pulse runs down the corridor
      edges.forEach((e, i) => {
        if (i === 0) return;
        const isWall = i === 2 || i === 6, s = i === 2 ? 1 : -1;
        if (i === 6 && WIN.includes(si)) {
          edgeBox(e, .16, .08, 1.5, len - .08, M.wall[0], zc, 2.35);   // below glass
          edgeBox(e, .16, .08, .9, len - .08, M.wall[0], zc, -2.65);    // above glass
          return;
        }
        const mat = isWall ? M.wall[(si + i) % 3] : (i === 4 ? M.ceil : M.chamf);
        edgeBox(e, .16, .08, e.len - .06, len - .1, mat, zc);
        if (i === 3 || i === 5) [-.55, .55].forEach((a) => { const st = edgeBox(e, .05, -.02, .2, len - 1.4, M.white, zc, a); if (R() < .08) upd.push((t) => { st.visible = Math.sin(t * 23 + si) > -.92 || Math.random() > .5; }); });
        if (isWall && !(i === 2 && CODE.includes(si))) {
          bx(.1, 1.6, len - .9, M.dark, s * 7.93, 2.3, zc);                       // wainscot
          bx(.08, 3.3, len - 1.8, M.wall[(si + 1) % 3], s * 7.94, 5.1, zc);       // raised plate
          bx(.04, .06, len - 1.1, M.whiteDim, s * 7.96, 7.25, zc);               // cove line
          for (let k = 0; k < 3; k++) bx(.04, .07, .16, k === 0 && si % 3 === 1 ? M.orange : M.cyan, s * 7.9, 3.35, zc + len / 2 - .9 - k * .28);
        }
      });
      bx(1.9, .35, len - .3, M.dark, 0, 10.85, zc);                               // cable tray
      [-1, 1].forEach((s) => {
        const gm = new THREE.MeshBasicMaterial({ color: C('#dfe8f5').multiplyScalar(1.6) }); bx(.9, .06, len - 1.6, gm, s * 3.0, .012, zc); guides.push([gm, si]);
        bx(.3, .28, .4, M.hull, s * 7.55, 3.45, za - .5);                         // pipe clamps
      });
    });
    [-1, 1].forEach((s) => {
      [[3.45, .09], [3.75, .06]].forEach(([y, r]) => { const p = add(new THREE.CylinderGeometry(r, r, 49.3, 10), M.pipe, s * 7.62, y, -14.65); p.rotation.x = Math.PI / 2; });
      const big = add(new THREE.CylinderGeometry(.2, .2, 49.3, 12), M.pipe, s * 7.05, 1.05, -14.65); big.rotation.x = Math.PI / 2;
    });
    { const sp = add(new THREE.CylinderGeometry(.34, .34, 49.3, 16), M.pipe, 0, 10.45, -14.65); sp.rotation.x = Math.PI / 2; }

    // ===== left viewport =====
    {
      const zc = -14;
      bx(.5, .22, 12, M.hull, -7.8, 2.72, zc); bx(.5, .22, 12, M.hull, -7.8, 6.46, zc);
      bx(.06, .05, 11.6, M.white, -7.62, 2.86, zc);
      const gl = add(new THREE.PlaneGeometry(12, 3.6), new THREE.MeshBasicMaterial({ color: C('#9fc0e0'), transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false }), -7.98, 4.6, zc, 0, Math.PI / 2);
    }

    // ===== wall decals (deck numbers) =====
    const decal = (txt, sub, x, y, z, ry, w) => {
      const c = cv(512, 256, (g) => { g.fillStyle = 'rgba(230,232,235,.9)'; g.font = '800 170px "Anybody",Arial Black,sans-serif'; g.fillText(txt, 8, 170); g.font = '500 26px "IBM Plex Mono",monospace'; g.fillText(sub, 14, 224); g.fillStyle = '#ff5b1f'; g.fillRect(14, 238, 60, 6); });
      const m = new THREE.MeshStandardMaterial({ map: tx(c), transparent: true, roughness: .8, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      return add(new THREE.PlaneGeometry(w, w / 2), m, x, y, z, 0, ry);
    };
    const decals = [];
    const redrawDecals = () => { decals.forEach((d) => d.remove && scene.remove(d)); decals.length = 0;
      decals.push(decal('01', 'CREW DECK · INTRO', 7.85, 5.0, -3.6, -Math.PI / 2, 2.6));
      decals.push(decal('02', 'HANGAR · MANIFEST', 7.85, 5.0, -14.4, -Math.PI / 2, 2.6));
      decals.push(decal('03', 'FIELD LOGS', -7.85, 5.0, -27.4, Math.PI / 2, 2.6)); };
    redrawDecals();
    if (document.fonts) document.fonts.ready.then(redrawDecals);

    // ===== screens =====
    const statusC = document.createElement('canvas'); statusC.width = 512; statusC.height = 288;
    const statusT = tx(statusC);
    add(new THREE.PlaneGeometry(3.4, 1.9), new THREE.MeshBasicMaterial({ map: statusT, color: C('#ffffff').multiplyScalar(1.5) }), -7.86, 5.1, 1, 0, Math.PI / 2);
    bx(.12, 2.2, 3.7, M.dark, -7.92, 5.1, 1);
    const codeC = document.createElement('canvas'); codeC.width = 1024; codeC.height = 300;
    const codeT = tx(codeC); codeT.repeat.set(.5, 1); const codeM = new THREE.MeshBasicMaterial({ map: codeT, color: C('#ffffff').multiplyScalar(1.7) });
    [[-20.9, 0], [-26.9, 1]].forEach(([z0, half]) => {
      bx(.14, 3.5, 5.0, M.dark, 7.9, 5.0, z0 - 2.1);
      const pg = new THREE.PlaneGeometry(4.7, 3.1); if (half) { const uv = pg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) + 1); } add(pg, codeM, 7.82, 5.0, z0 - 2.1, 0, -Math.PI / 2);
      bx(.1, 1.6, 5.0, M.dark, 7.93, 2.3, z0 - 2.1);
    });
    const CODE_TXT = `local Players = game:GetService("Players")
local DataStore = game:GetService("DataStoreService"):GetDataStore("FL_v4")
local RunService = game:GetService("RunService")

local Profile = {}
Profile.__index = Profile

function Profile.new(player: Player)
  local self = setmetatable({}, Profile)
  self.Player = player
  self.Data = { Coins = 0, Level = 1, Streak = 0 }
  return self
end

function Profile:Load()
  local ok, data = pcall(DataStore.GetAsync, DataStore, self.Player.UserId)
  if ok and data then self.Data = data end
end

function Profile:Save()
  return pcall(DataStore.UpdateAsync, DataStore, self.Player.UserId, function()
    return self.Data
  end)
end

RunService.Heartbeat:Connect(function(dt)
  for _, npc in ipairs(workspace.NPCs:GetChildren()) do
    npc:PivotTo(npc:GetPivot() * CFrame.Angles(0, dt, 0))
  end
end)

Players.PlayerAdded:Connect(function(p)
  local prof = Profile.new(p)
  prof:Load()
end)`.split('\n');
    const KW = /\b(local|function|end|return|if|then|for|do|in|and|not|nil|true|false)\b/g;
    function drawCode(t) {
      const g = codeC.getContext('2d'); g.fillStyle = '#04070b'; g.fillRect(0, 0, 1024, 300);
      g.font = '500 15px "IBM Plex Mono",monospace';
      const lh = 21, scroll = (t * 26) % (CODE_TXT.length * lh), first = Math.floor(scroll / lh);
      for (let i = 0; i < 16; i++) {
        const li = (first + i) % CODE_TXT.length, y = 26 + i * lh - (scroll % lh), line = CODE_TXT[li];
        g.fillStyle = 'rgba(160,175,190,.45)'; g.fillText(String(li + 1).padStart(3, ' '), 14, y);
        let x = 60; const parts = line.split(/(\b(?:local|function|end|return|if|then|for|do|in|and|not|nil|true|false)\b|"[^"]*"|\d+)/);
        parts.forEach((p) => { if (!p) return; g.fillStyle = /^"/.test(p) ? '#9fe0b8' : /^\d+$/.test(p) ? '#ffb07a' : KW.test(p) ? '#ff7a45' : '#d6e2ee'; KW.lastIndex = 0; g.fillText(p, x, y); x += g.measureText(p).width; });
      }
      g.fillStyle = 'rgba(255,255,255,.035)'; for (let y = 0; y < 300; y += 3) g.fillRect(0, y, 1024, 1);
      g.fillStyle = '#ff5b1f'; g.fillRect(512 + 14, 12, 3, 3);
      codeT.needsUpdate = true;
    }
    function drawStatus(t) {
      const g = statusC.getContext('2d'); g.fillStyle = '#05080c'; g.fillRect(0, 0, 512, 288);
      g.strokeStyle = 'rgba(160,200,230,.12)'; g.lineWidth = 1; for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 288); g.stroke(); }
      g.fillStyle = '#e8eef4'; g.font = '700 22px "IBM Plex Mono",monospace'; g.fillText('FL//STATION OS', 22, 38);
      g.fillStyle = '#ff5b1f'; g.fillRect(470, 24, 18, 18);
      g.font = '500 14px "IBM Plex Mono",monospace'; g.fillStyle = 'rgba(232,238,244,.6)';
      g.fillText('PILOT   FURKANLUA', 22, 232); g.fillText('STATUS  ONLINE', 22, 256); g.fillText('ORBIT   ' + (408 + Math.sin(t * .3) * .4).toFixed(2) + ' KM', 280, 232); g.fillText('O2      98.2%', 280, 256);
      g.strokeStyle = '#7fd8ff'; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x <= 468; x += 4) { const y = 135 + Math.sin(x * .045 + t * 3) * 26 * Math.sin(x * .011 + t * .7) + Math.sin(x * .19 + t * 7) * 4; x ? g.lineTo(22 + x, y) : g.moveTo(22, y); } g.stroke();
      statusT.needsUpdate = true;
    }
    let lastDraw = -1;
    upd.push((t) => { if (t - lastDraw > .066) { lastDraw = t; if (zNow < -4 && zNow > -38) drawCode(t); if (zNow > -18) drawStatus(t); } });
    drawCode(0); drawStatus(0); if (document.fonts) document.fonts.ready.then(() => { drawCode(0); drawStatus(0); });

    // ===== spawn pad at hero =====
    const padC = cv(512, 512, (g) => {
      g.translate(256, 256); g.strokeStyle = 'rgba(220,235,255,.9)';
      [[236, 2], [200, 1], [150, 1.5]].forEach(([r, w]) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); });
      for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, l = i % 10 === 0 ? 22 : 9; g.lineWidth = i % 10 === 0 ? 2 : 1; g.beginPath(); g.moveTo(Math.cos(a) * 214, Math.sin(a) * 214); g.lineTo(Math.cos(a) * (214 - l), Math.sin(a) * (214 - l)); g.stroke(); }
      g.fillStyle = 'rgba(255,91,31,1)'; [0, 1, 2, 3].forEach((k) => { g.save(); g.rotate(k * Math.PI / 2); g.fillRect(-10, -246, 20, 5); g.restore(); });
    });
    const padMat = new THREE.MeshBasicMaterial({ map: tx(padC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: C('#ffffff').multiplyScalar(.9) });
    const pad = add(new THREE.PlaneGeometry(4.4, 4.4), padMat, 0, .02, 0, -Math.PI / 2);
    upd.push((t) => { pad.rotation.z = t * .05; });

    // ===== BULKHEAD + DOOR =====
    const DZ = -40;
    const D = [[-3.4, 0], [3.4, 0], [3.4, 6.9], [2.1, 8.2], [-2.1, 8.2], [-3.4, 6.9]];
    const bh = shapeOf([[-14, -.5], [14, -.5], [14, 13.6], [-14, 13.6]]); bh.holes.push(shapeOf(D, THREE.Path));
    const bhGeo = new THREE.ExtrudeGeometry(bh, { depth: 1.6, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 1 }); bhGeo.translate(0, 0, -.8);
    const bhMat = new THREE.MeshStandardMaterial({ map: tx(wallCanv[0], 3, 1.6), bumpMap: wallT[0], bumpScale: .01, color: C('#6c7178'), roughness: .5, metalness: .7 });
    add(bhGeo, bhMat, 0, 0, DZ);
    const trim = shapeOf(offsetPoly(D, .75)); trim.holes.push(shapeOf(offsetPoly(D, .04), THREE.Path));
    add(new THREE.ExtrudeGeometry(trim, { depth: .3, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 }), M.hull, 0, 0, DZ + .86);
    const glow = shapeOf(offsetPoly(D, .2)); glow.holes.push(shapeOf(offsetPoly(D, .1), THREE.Path));
    const lampMat = new THREE.MeshBasicMaterial({ color: C('#ff3b1f').multiplyScalar(4) });
    add(new THREE.ExtrudeGeometry(glow, { depth: .04, bevelEnabled: false }), lampMat, 0, 0, DZ + 1.2);
    const leafC = (right) => cv(256, 608, (g) => {
      g.fillStyle = '#3a3e45'; g.fillRect(0, 0, 256, 608);
      const id = g.getImageData(0, 0, 256, 608); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - .5) * 12; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } g.putImageData(id, 0, 0);
      g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3; [[12, 12, 232, 180], [12, 200, 232, 90], [12, 300, 232, 296]].forEach(([x, y, w, h]) => g.strokeRect(x, y, w, h));
      g.save(); g.beginPath(); g.rect(12, 200, 232, 90); g.clip(); g.fillStyle = '#16171a'; g.fillRect(12, 200, 232, 90); g.fillStyle = '#ff5b1f'; for (let x = -120; x < 300; x += 36) { g.beginPath(); g.moveTo(x, 290); g.lineTo(x + 18, 290); g.lineTo(x + 108, 200); g.lineTo(x + 90, 200); g.fill(); } g.restore();
      g.fillStyle = 'rgba(235,238,242,.9)'; g.font = '800 120px "Anybody",Arial Black,sans-serif'; g.textAlign = right ? 'left' : 'right'; g.fillText(right ? '3' : '0', right ? 18 : 238, 150);
      g.font = '500 15px "IBM Plex Mono",monospace'; g.fillText(right ? 'DECK' : 'OBSERVATION', right ? 22 : 234, 180);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(right ? 0 : 248, 0, 8, 608);
    });
    const mkLeaf = (right) => {
      const face = new THREE.MeshStandardMaterial({ map: tx(leafC(right)), color: C('#c9ced5'), roughness: .45, metalness: .7 });
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.45, 8.25, .42), [M.hull, M.hull, M.hull, M.hull, face, face]);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(.05, 8.0, .44), lampMat); edge.position.x = right ? -1.7 : 1.7; leaf.add(edge);
      leaf.position.set(right ? 1.725 : -1.725, 4.12, DZ); scene.add(leaf); return leaf;
    };
    const leafL = mkLeaf(false), leafR = mkLeaf(true);
    const doorLight = new THREE.PointLight(C('#ff4a24'), 1.4, 14); doorLight.position.set(0, 7, DZ + 3); scene.add(doorLight);

    // ===== OBSERVATION DECK =====
    const WZ = -58;
    const deckT = tx(wallCanv[1], 2, 2);
    const deckM = new THREE.MeshStandardMaterial({ map: deckT, bumpMap: deckT, bumpScale: .015, color: C('#9aa1a9'), roughness: .5, metalness: .55 });
    [-1, 1].forEach((s) => {
      [-44.9, -53.4].forEach((z) => bx(.3, 10.2, 8.4, deckM, s * 13.65, 5.1, z));
      bx(.3, 4.2, 17.1, deckM, s * 12.2, 11.6, -49.3, 0, 0, s * .8);
      bx(.06, .06, 16.4, M.white, s * 13.42, 10.05, -49.3);
      bx(1.2, 1.1, 16.6, M.dark, s * 12.9, .55, -49.3);
    });
    bx(21, .3, 17.2, deckM, 0, 13.25, -49.3);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bx(.9, .04, .9, led('#ffe8cc', 3), -6 + i * 6, 13.08, -44.5 - j * 5);
    const ww = roundRect(-14, -.5, 14, 13.6, 0); const hole = roundRect(-11.2, 1.3, 11.2, 11.3, 2.6, THREE.Path);
    const wShape = shapeOf([[-14, -.5], [14, -.5], [14, 13.6], [-14, 13.6]]); wShape.holes.push(hole);
    const wGeo = new THREE.ExtrudeGeometry(wShape, { depth: 1.0, bevelEnabled: true, bevelThickness: .35, bevelSize: .38, bevelSegments: 5, curveSegments: 16 }); wGeo.translate(0, 0, -1);
    add(wGeo, new THREE.MeshStandardMaterial({ map: tx(wallCanv[2], 3, 1.6), color: C('#a9afb7'), roughness: .42, metalness: .55 }), 0, 0, WZ);
    bx(20, .05, .1, M.white, 0, 1.05, WZ + .45);
    add(new THREE.PlaneGeometry(23, 10.4), new THREE.MeshBasicMaterial({ color: C('#a8c6e8'), transparent: true, opacity: .035, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 6.3, WZ - .6);
    // consoles
    const conC = cv(512, 200, (g) => { g.fillStyle = '#04070b'; g.fillRect(0, 0, 512, 200); g.strokeStyle = '#7fd8ff'; g.lineWidth = 1.5; g.strokeRect(12, 12, 488, 176); for (let i = 0; i < 12; i++) { g.fillStyle = i % 5 === 0 ? '#ff5b1f' : 'rgba(127,216,255,.7)'; g.fillRect(28 + i * 38, 150 - (20 + ((i * 37) % 90)), 22, 20 + ((i * 37) % 90)); } g.fillStyle = '#e8eef4'; g.font = '600 16px monospace'; g.fillText('NAV · ORBITAL TRACK', 28, 40); });
    [-1, 1].forEach((s) => {
      bx(6.4, 1.05, 1.8, M.hull, s * 7.2, .52, WZ + 2.2);
      const top = bx(6.2, .12, 1.8, M.dark, s * 7.2, 1.1, WZ + 2.2); top.rotation.x = .22;
      const sc = add(new THREE.PlaneGeometry(3.4, 1.3), new THREE.MeshBasicMaterial({ map: tx(conC), color: C('#ffffff').multiplyScalar(1.3) }), s * 7.2, 1.18, WZ + 2.2, -Math.PI / 2 + .22);
    });
    // god rays through the glass
    const rayC = cv(64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,240,220,.9)'); gr.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 256); });
    const rayM = new THREE.MeshBasicMaterial({ map: tx(rayC), transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const rays = [];
    [[-6, 3.2], [-1, 4.5], [4, 2.6]].forEach(([x, w]) => { const r = add(new THREE.PlaneGeometry(w, 16), rayM, x + 3, 6.5, WZ + 6, -Math.PI / 2 + .55, 0, .5); rays.push(r); });
    // deck dust motes
    const dn = 260, da = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) { da[i * 3] = (Math.random() - .5) * 24; da[i * 3 + 1] = Math.random() * 12; da[i * 3 + 2] = -42 - Math.random() * 15; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(da, 3));
    const dotC = cv(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
    scene.add(new THREE.Points(dg, new THREE.PointsMaterial({ size: .06, map: tx(dotC), color: C('#ffe9d2').multiplyScalar(1.2), transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })));
    upd.push((t) => { if (zNow > -26) return; for (let i = 0; i < dn; i++) { da[i * 3 + 1] += Math.sin(t * .3 + i) * .002; da[i * 3] += .003; if (da[i * 3] > 12) da[i * 3] = -12; } dg.attributes.position.needsUpdate = true; });

    // ===== crew quarters dressing (hero area) =====
    const leather = new THREE.MeshStandardMaterial({ color: C('#16171a'), roughness: .42, metalness: .15, envMapIntensity: .8 });
    [-1, 1].forEach((s) => {
      bx(1.5, .78, 7.6, M.dark, s * 6.05, .39, 3.4);
      bx(1.56, .05, 7.7, M.hull, s * 6.05, .8, 3.4);
      for (let k = 0; k < 7; k++) {
        const z = 6.75 - k * 1.1;
        bx(1.36, .2, 1.02, leather, s * 6.0, .93, z);
        const b = bx(.24, 1.15, 1.02, leather, s * 6.72, 1.72, z); b.rotation.z = s * .1;
        bx(.02, .9, .02, M.pipe, s * 6.62, 1.72, z + .52);
      }
      bx(.06, .04, 7.4, M.orange, s * 5.3, .5, 3.4);
    });
    // cargo crates (left) + equipment rack (right) further down
    const crateC = cv(256, 256, (g) => { g.fillStyle = '#2b2e33'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#0c0d0f'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246); g.lineWidth = 4; g.beginPath(); g.moveTo(20, 20); g.lineTo(236, 236); g.stroke(); g.fillStyle = '#ff5b1f'; g.fillRect(18, 206, 70, 14); g.fillStyle = 'rgba(235,238,242,.75)'; g.font = '600 20px monospace'; g.fillText('FL-CARGO', 100, 220); });
    const crateM = new THREE.MeshStandardMaterial({ map: tx(crateC), roughness: .6, metalness: .45 });
    [[-6.2, .7, -4.2, 1.4], [-6.3, .6, -5.8, 1.2], [-6.25, 2.05, -4.4, 1.3], [-4.9, .45, -4.8, .9]].forEach(([x, y, z, s]) => bx(s, s, s, crateM, x, y, z, 0, (x * 7 % 1) * .3));
    const rackC = cv(128, 256, (g) => { g.fillStyle = '#0a0b0d'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 12; i++) { g.fillStyle = '#1c1e22'; g.fillRect(8, 8 + i * 20, 112, 16); for (let j = 0; j < 5; j++) { g.fillStyle = Math.random() < .5 ? '#7fd8ff' : (Math.random() < .2 ? '#ff5b1f' : '#2c3036'); g.fillRect(14 + j * 8, 14 + i * 20, 4, 4); } } });
    const rackT = tx(rackC);
    const rackM = new THREE.MeshBasicMaterial({ map: rackT, color: C('#ffffff').multiplyScalar(1.4) });
    [-4.4, -5.9].forEach((z) => { bx(1.0, 3.6, 1.3, M.hull, 7.3, 1.8, z); add(new THREE.PlaneGeometry(1.1, 3.2), rackM, 6.79, 1.8, z, 0, -Math.PI / 2); });
    let rackT0 = 0; upd.push((t) => { if (zNow > -24 && t - rackT0 > .35) { rackT0 = t; const g = rackC.getContext('2d'); for (let n = 0; n < 8; n++) { const i = Math.random() * 12 | 0, j = Math.random() * 5 | 0; g.fillStyle = Math.random() < .6 ? '#7fd8ff' : (Math.random() < .3 ? '#ff5b1f' : '#2c3036'); g.fillRect(14 + j * 8, 14 + i * 20, 4, 4); } rackT.needsUpdate = true; } });
    // maintenance drone patrolling the ceiling
    const drone = new THREE.Group(); scene.add(drone);
    const dBody = new THREE.Mesh(new THREE.SphereGeometry(.32, 20, 14), M.pipe); drone.add(dBody);
    const dRing = new THREE.Mesh(new THREE.TorusGeometry(.5, .05, 8, 32), M.hull); dRing.rotation.x = Math.PI / 2; drone.add(dRing);
    const dEye = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), led('#ff5b1f', 6)); dEye.position.set(0, -.12, -.28); drone.add(dEye);
    const dBeam = new THREE.Mesh(new THREE.ConeGeometry(.9, 3, 24, 1, true), new THREE.MeshBasicMaterial({ color: C('#bfe6ff'), transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); dBeam.position.y = -1.6; dBeam.visible = false; drone.add(dBeam);
    upd.push((t) => { const a = t * .35; drone.position.set(Math.sin(a) * 3.2, 8.2 + Math.sin(t * 1.7) * .15, -3 + Math.cos(a) * 3.5); drone.rotation.y = a + Math.PI / 2; dRing.rotation.z = t * 3; dEye.visible = Math.sin(t * 6) > -.6; });

    // chase lights on the floor guides — a pulse that runs toward the door
    upd.push((t) => { guides.forEach(([m, si]) => { const k = Math.pow(.5 + .5 * Math.sin(t * 3.2 - si * 1.1), 6); m.color.setRGB(.75 + k * 1.7, .8 + k * 1.8, .9 + k * 2.0); }); });
    // hologram over the right console: the ice giant in miniature
    const holo = new THREE.Group(); holo.position.set(7.2, 2.6, WZ + 2.4); scene.add(holo);
    const hm = new THREE.MeshBasicMaterial({ color: C('#7fd8ff').multiplyScalar(.9), wireframe: true, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false });
    holo.add(new THREE.Mesh(new THREE.SphereGeometry(.55, 14, 9), hm));
    const hr = new THREE.Mesh(new THREE.RingGeometry(.8, 1.15, 48, 1), new THREE.MeshBasicMaterial({ color: C('#7fd8ff').multiplyScalar(1.6), transparent: true, opacity: .35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); hr.rotation.x = Math.PI / 2 - .4; holo.add(hr);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.3, 32, 1, true), new THREE.MeshBasicMaterial({ color: C('#7fd8ff'), transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.position.y = -.75; holo.add(cone);
    upd.push((t) => { holo.children[0].rotation.y = t * .6; hr.rotation.z = t * .3; holo.position.y = 2.6 + Math.sin(t * 1.4) * .06; hm.opacity = .35 + Math.sin(t * 9) * .04 + (Math.random() < .02 ? -.25 : 0); });

    // ===== LIFE ON BOARD: light, machinery and small details =====
    // rib light rings: a soft warm pulse travels from the crew deck toward the bulkhead
    upd.push((t) => { ribLights.forEach(([m, si]) => { const k = Math.pow(.5 + .5 * Math.sin(t * 1.7 - si * .8), 10); m.color.setRGB(1 + k * 2.4, 1.05 + k * 1.3, 1.15 + k * .5); }); });

    // ceiling lamps with soft light shafts (two crossed planes read as a volume from any angle); the first one spotlights the pilot
    const shaftT = tx(cv(64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,244,228,1)'); gr.addColorStop(.55, 'rgba(255,244,228,.32)'); gr.addColorStop(1, 'rgba(255,244,228,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 256); }));
    shaftT.wrapS = shaftT.wrapT = THREE.ClampToEdgeWrapping;
    const shaftM = new THREE.MeshBasicMaterial({ map: shaftT, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const lampM = led('#fff1de', 3.2);
    [0, -11, -23, -35].forEach((z) => { bx(1.8, .08, .7, lampM, 0, 10.55, z); [0, Math.PI / 2].forEach((ry) => add(new THREE.PlaneGeometry(3.4, 10.4), shaftM, 0, 5.3, z, 0, ry)); });

    // cable runs sagging between the ribs along the upper walls, merged into two meshes
    const mergeGeos = (gs) => {
      const pos = [], nor = [], idx = []; let off = 0;
      gs.forEach((g) => { const p = g.attributes.position, n = g.attributes.normal, ix = g.index; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); off += p.count; g.dispose(); });
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx); return out;
    };
    const cables = [[], []];
    SEG.forEach(([za, zb], si) => [-1, 1].forEach((s) => [[5.55, .95, 0], [5.85, 1.25, 1]].forEach(([x, sag, alt]) => {
      const a = new THREE.Vector3(s * x, 9.35, za - .35), b = new THREE.Vector3(s * x, 9.35, zb + .35), c = new THREE.Vector3(s * x, 9.35 - sag * 2, (za + zb) / 2);
      cables[alt && si % 2 ? 1 : 0].push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, c, b), 14, alt ? .035 : .05, 5, false));
    })));
    add(mergeGeos(cables[0]), new THREE.MeshStandardMaterial({ color: C('#141519'), roughness: .55, metalness: .2 }), 0, 0, 0);
    add(mergeGeos(cables[1]), new THREE.MeshStandardMaterial({ color: C('#6b2a12'), roughness: .5, metalness: .1, emissive: C('#2a0c04') }), 0, 0, 0);

    // soft round glow shared by the beacon halos and the steam puffs
    const puffT = tx(cv(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }));
    // warning beacons over the bulkhead: a red sweep while it is sealed, steady green once it opens
    const beamT = tx(cv(256, 64, (g) => { const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); const v = g.createLinearGradient(0, 0, 0, 64); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, 256, 64); }));
    beamT.wrapS = beamT.wrapT = THREE.ClampToEdgeWrapping;
    const RED = C('#ff3b1f').multiplyScalar(5), GREEN = C('#3dff8a').multiplyScalar(4);
    const beacons = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.position.set(s * 4.7, 8.75, DZ + 1.35); scene.add(g);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(.24, .28, .22, 16), M.dark));
      const dm = new THREE.MeshBasicMaterial({ color: RED.clone() }), dome = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), dm); dome.position.y = .1; g.add(dome);
      const beam = new THREE.Group(); beam.position.y = .2; g.add(beam);
      const bm = new THREE.MeshBasicMaterial({ map: beamT, color: C('#ff3b1f').multiplyScalar(1.2), transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      [0, Math.PI].forEach((r) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .45), bm); p.position.x = Math.cos(r) * 1.3; p.rotation.y = r; beam.add(p); });
      const gm = new THREE.SpriteMaterial({ map: puffT, color: RED.clone().multiplyScalar(.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const glow = new THREE.Sprite(gm); glow.position.y = .15; glow.scale.set(1.1, 1.1, 1); g.add(glow);
      return { dm, gm, beam, s };
    });
    let doorOpen = 0;
    upd.push((t) => { beacons.forEach((b) => { b.beam.visible = doorOpen < .6; if (b.beam.visible) b.beam.rotation.y = t * 3.2 * b.s; }); });

    // steam venting from floor grilles
    const vents = [[1, -6.5], [-1, -12.5], [1, -18.5], [-1, -30.5]].map(([s, z], vi) => {
      bx(.9, .04, .6, M.dark, s * 6.3, .02, z);
      const ps = [0, 1, 2, 3, 4].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, color: C('#c9d2dc'), transparent: true, opacity: 0, depthWrite: false })); scene.add(sp); return sp; });
      return { s, z, ps, ph: vi * .37 };
    });
    upd.push((t) => { vents.forEach((v) => { const near = Math.abs(zNow - v.z) < 26; v.ps.forEach((sp, k) => { sp.visible = near; if (!near) return; const a = (t * .28 + k / 5 + v.ph) % 1; sp.position.set(v.s * (6.3 - a * .9), .25 + a * 2.6, v.z + Math.sin(t + k) * .15); sp.scale.setScalar(.5 + a * 2.2); sp.material.opacity = Math.sin(a * Math.PI) * .12; }); }); });

    // a faulty junction box above the code wall that throws sparks every few seconds
    bx(.3, .5, .4, M.dark, 7.78, 7.3, -24.6); const jled = led('#ff5b1f', 5), jBase = jled.color.clone(); bx(.04, .06, .06, jled, 7.62, 7.45, -24.5);
    const SPN = 40, spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN);
    const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    const sparkT = tx(cv(16, 16, (g) => { const r = g.createRadialGradient(8, 8, 0, 8, 8, 8); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,220,160,.8)'); r.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = r; g.fillRect(0, 0, 16, 16); }));
    const sparks = new THREE.Points(spG, new THREE.PointsMaterial({ size: .09, map: sparkT, color: C('#ffd2a0').multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sparks.frustumCulled = false; scene.add(sparks); for (let i = 0; i < SPN; i++) spPos[i * 3 + 1] = -99;
    let spNext = 2, spLast = 0;
    upd.push((t) => {
      const dt = Math.min(.05, Math.max(0, t - spLast)); spLast = t; const near = zNow < -10 && zNow > -38; sparks.visible = near; if (!near) return;
      if (t > spNext) { spNext = t + 2.5 + Math.random() * 4; for (let i = 0; i < SPN; i++) { spPos.set([7.6, 7.3, -24.6], i * 3); spVel.set([-(.8 + Math.random() * 2.6), Math.random() * 2.8 - .4, (Math.random() - .5) * 2.4], i * 3); spLife[i] = .35 + Math.random() * .8; } jled.color.setRGB(12, 6, 3); }
      else jled.color.lerp(jBase, .1);
      for (let i = 0; i < SPN; i++) {
        const j = i * 3; if (spLife[i] <= 0) { spPos[j + 1] = -99; continue; }
        spLife[i] -= dt; spVel[j + 1] -= 9 * dt; spPos[j] += spVel[j] * dt; spPos[j + 1] += spVel[j + 1] * dt; spPos[j + 2] += spVel[j + 2] * dt;
        if (spPos[j + 1] < .02) { spPos[j + 1] = .02; spVel[j + 1] *= -.35; spVel[j] *= .6; spVel[j + 2] *= .6; }
      }
      spG.attributes.position.needsUpdate = true;
    });

    // proximity radar on the crew deck wall
    const radC = document.createElement('canvas'); radC.width = radC.height = 256; const radT = tx(radC);
    bx(.12, 2.3, 2.3, M.dark, -7.92, 5.2, -4.8);
    add(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ map: radT, color: C('#ffffff').multiplyScalar(1.4) }), -7.845, 5.2, -4.8, 0, Math.PI / 2);
    const blips = [...Array(7)].map(() => [Math.random() * 6.28, .25 + Math.random() * .7]);
    const drawRadar = (t) => {
      const g = radC.getContext('2d'), c = 128, a = t * 1.6;
      g.fillStyle = '#031008'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(98,227,154,.25)'; g.lineWidth = 1;
      [40, 80, 118].forEach((r) => { g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }); g.beginPath(); g.moveTo(c - 120, c); g.lineTo(c + 120, c); g.moveTo(c, c - 120); g.lineTo(c, c + 120); g.stroke();
      for (let k = 0; k < 24; k++) { const aa = a - k * .035; g.fillStyle = `rgba(98,227,154,${(1 - k / 24) * .22})`; g.beginPath(); g.moveTo(c, c); g.arc(c, c, 118, aa - .035, aa); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(160,255,200,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 118, c + Math.sin(a) * 118); g.stroke();
      blips.forEach(([ba, br]) => { const d = ((a - ba) % 6.283 + 6.283) % 6.283, k = Math.max(0, 1 - d / 5); if (k > 0) { g.fillStyle = `rgba(160,255,200,${k})`; g.beginPath(); g.arc(c + Math.cos(ba) * br * 118, c + Math.sin(ba) * br * 118, 3.2, 0, 7); g.fill(); } });
      g.fillStyle = 'rgba(160,255,200,.7)'; g.font = '600 13px "IBM Plex Mono",monospace'; g.fillText('PROX SCAN', 12, 22); g.textAlign = 'right'; g.fillText(blips.length + ' CONTACTS', 244, 244); g.textAlign = 'left';
      radT.needsUpdate = true;
    };
    let radLast = -1; upd.push((t) => { if (zNow > -16 && t - radLast > .066) { radLast = t; drawRadar(t); } }); drawRadar(0);

    // observation deck: a glowing rim around the window and a star map projected on the floor around the pilot
    // (the opening's bevel narrows it by ~.38 at the front, so the rim sits just inside that visible edge, in front of the wall)
    const rim = roundRect(-10.84, 1.66, 10.84, 10.94, 2.24); rim.holes.push(roundRect(-10.72, 1.78, 10.72, 10.82, 2.12, THREE.Path));
    add(new THREE.ShapeGeometry(rim, 24), new THREE.MeshBasicMaterial({ color: C('#bfe6ff').multiplyScalar(1.6) }), 0, 0, WZ + .42);
    const mapC = cv(512, 512, (g) => {
      const c = 256, R2 = rng(21); g.translate(c, c); g.strokeStyle = 'rgba(160,220,255,.8)';
      [250, 200, 120, 60].forEach((r, i) => { g.lineWidth = i ? 1 : 2; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); });
      for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, l = i % 6 ? 6 : 16; g.beginPath(); g.moveTo(Math.cos(a) * 250, Math.sin(a) * 250); g.lineTo(Math.cos(a) * (250 - l), Math.sin(a) * (250 - l)); g.stroke(); }
      const st = [...Array(26)].map(() => { const a = R2() * Math.PI * 2, r = 30 + R2() * 190; return [Math.cos(a) * r, Math.sin(a) * r]; });
      g.lineWidth = 1; g.strokeStyle = 'rgba(160,220,255,.45)'; for (let i = 0; i < 18; i++) { const p = st[i], q = st[(i * 7 + 3) % st.length]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 150) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); } }
      st.forEach(([x, y], i) => { g.fillStyle = i % 5 ? 'rgba(200,235,255,.9)' : 'rgba(255,140,90,1)'; g.beginPath(); g.arc(x, y, i % 5 ? 2.2 : 3.4, 0, 7); g.fill(); });
    });
    const smap = add(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: tx(mapC), color: C('#7fd8ff').multiplyScalar(.9), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }), 0, .025, -50, -Math.PI / 2);
    upd.push((t) => { if (zNow < -38) smap.rotation.z = t * .02; });

    return {
      reflector, floorStd, padMat,
      setDoor(o) {
        const e = o * o * (3 - 2 * o);
        leafL.position.x = -1.725 - e * 3.7; leafR.position.x = 1.725 + e * 3.7;
        const c = new THREE.Color().setRGB(1, .23 + e * .72, .12 + e * .85).multiplyScalar(4);
        lampMat.color.copy(c); doorLight.color.setRGB(1, .3 + e * .6, .15 + e * .8); doorLight.intensity = 1.4 + e * .6;
        doorOpen = e; beacons.forEach((b) => { b.dm.color.copy(e > .6 ? GREEN : RED); b.gm.color.copy(b.dm.color).multiplyScalar(.5); });
      },
      update(t, z) { if (z != null) zNow = z; upd.forEach((f) => f(t)); },
    };
  };
})();
