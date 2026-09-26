// admin-core.js — storage (IndexedDB), media processing, diffing, GitHub publishing and export for the content panel
(function () {
  const A = window.FLA = {};

  // ---------- IndexedDB: kv (draft, base) + media (path -> Blob) ----------
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    let q; try { q = indexedDB.open('fl-admin', 1); } catch (e) { rej(e); return; }
    q.onupgradeneeded = () => { const d = q.result; ['kv', 'media'].forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }); };
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error || new Error('Storage unavailable'));
  }));
  const rq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  A.ready = () => db();
  A.get = async (s, k) => rq((await db()).transaction(s).objectStore(s).get(k));
  A.put = async (s, k, v) => rq((await db()).transaction(s, 'readwrite').objectStore(s).put(v, k));
  A.del = async (s, k) => rq((await db()).transaction(s, 'readwrite').objectStore(s).delete(k));
  A.all = async () => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('media'), s = t.objectStore('media'), k = s.getAllKeys(), v = s.getAll(); t.oncomplete = () => res((k.result || []).map((x, i) => [x, v.result[i]])); t.onerror = () => rej(t.error); }); };

  // ---------- media cache: blob URLs for files that live in this browser ----------
  const urls = new Map();
  A.resolve = (p) => (p && urls.get(p)) || p || '';
  A.hasLocal = (p) => urls.has(p);
  A.cacheAll = async () => { for (const [k, b] of await A.all()) if (b && !urls.has(k)) urls.set(k, URL.createObjectURL(b)); };
  A.saveMedia = async (p, blob) => { await A.put('media', p, blob); if (urls.has(p)) URL.revokeObjectURL(urls.get(p)); urls.set(p, URL.createObjectURL(blob)); };
  A.dropMedia = async (p) => { await A.del('media', p); if (urls.has(p)) { URL.revokeObjectURL(urls.get(p)); urls.delete(p); } };

  // ---------- helpers ----------
  A.uid = (p) => p + '-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  A.mb = (b) => ((b || 0) / 1048576).toFixed(1) + ' MB';
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v' };
  A.ext = (b, name) => EXT[b && b.type] || (String(name || (b && b.name) || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  A.isVideo = (f) => /^video\//.test(f.type) || /\.(mp4|webm|mov|m4v)$/i.test(f.name || '');
  A.isImage = (f) => /^image\//.test(f.type);
  const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));
  const wait = (el, ev, ms) => new Promise((res, rej) => {
    const ok = () => done(res), bad = () => done(rej, new Error('this browser cannot read the file'));
    const to = setTimeout(() => done(rej, new Error('timed out')), ms || 20000);
    function done(f, v) { clearTimeout(to); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); f(v); }
    el.addEventListener(ev, ok); el.addEventListener('error', bad);
  });
  A.grabFrame = (v, W, H) => {
    W = W || 800; H = H || 500; const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), s = Math.max(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
    return toBlob(c, 'image/jpeg', .84);
  };
  A.probeVideo = async (src) => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
    try {
      await wait(v, 'loadedmetadata'); const dur = isFinite(v.duration) ? v.duration : 0;
      v.currentTime = Math.min(dur * .3, 4); await wait(v, 'seeked', 12000);
      let poster = null; try { poster = await A.grabFrame(v); } catch (e) {}
      return { dur, poster };
    } finally { v.removeAttribute('src'); v.load(); }
  };
  A.compressImage = async (file, maxW) => {
    if (/gif|svg/.test(file.type)) return file;
    const u = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = u; await img.decode();
      const s = Math.min(1, (maxW || 1280) / img.naturalWidth), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const b = await toBlob(c, 'image/jpeg', .86); return b && (b.size < file.size || s < 1) ? b : file;
    } finally { URL.revokeObjectURL(u); }
  };

  // ---------- content ----------
  A.serialize = (d) => '// content.js — games, clips, transmissions and profile shown on the site.\n// Managed with the content panel (admin.html). Hand edits are replaced on the next publish.\nwindow.FL_CONTENT = ' + JSON.stringify(d, null, 2) + ';\n';
  A.refs = (d) => { const s = new Set(); (function walk(o) { if (typeof o === 'string') { if (/^media\//.test(o)) s.add(o); } else if (o && typeof o === 'object') Object.values(o).forEach(walk); })(d); return s; };
  const NAMES = { reels: ['clip', 'clips'], worlds: ['game', 'games'], logs: ['transmission', 'transmissions'] };
  A.diff = (dr, bs) => {
    const out = { count: 0, by: {}, lines: [], state: {} };
    Object.keys(NAMES).forEach((k) => {
      const a = dr[k] || [], b = bs[k] || [], bm = new Map(b.map((x) => [x.id, JSON.stringify(x)])), ids = new Set(a.map((x) => x.id));
      let add = 0, ed = 0, rm = 0;
      a.forEach((x) => { if (!bm.has(x.id)) { add++; out.state[x.id] = 'new'; } else if (bm.get(x.id) !== JSON.stringify(x)) { ed++; out.state[x.id] = 'ed'; } });
      b.forEach((x) => { if (!ids.has(x.id)) rm++; });
      const kept = a.filter((x) => bm.has(x.id)).map((x) => x.id).join(), was = b.filter((x) => ids.has(x.id)).map((x) => x.id).join(), mv = kept !== was ? 1 : 0;
      const n = NAMES[k], L = (c, v) => c + ' ' + (c > 1 ? n[1] : n[0]) + ' ' + v;
      if (add) out.lines.push(['+', L(add, 'added')]); if (ed) out.lines.push(['~', L(ed, 'edited')]); if (rm) out.lines.push(['−', L(rm, 'removed')]);
      if (mv) out.lines.push(['↕', n[1][0].toUpperCase() + n[1].slice(1) + ' reordered']);
      out.by[k] = add + ed + rm + mv; out.count += out.by[k];
    });
    if (JSON.stringify(dr.profile) !== JSON.stringify(bs.profile)) { out.by.profile = 1; out.count++; out.lines.push(['~', 'Profile edited']); }
    return out;
  };

  // ---------- GitHub (Git Data API → one commit per publish) ----------
  // on <owner>.github.io the owner and repository are known already: only the token has to be pasted
  const onPages = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname), seg = location.pathname.split('/').filter(Boolean);
  const GK = 'fl-admin-gh', GD = { owner: onPages ? onPages[1] : '', repo: onPages ? (seg.length > 1 ? seg[0] : location.hostname) : '', branch: 'main', path: '', token: '' };
  A.ghCfg = () => { const c = Object.assign({}, GD); try { const s = JSON.parse(localStorage.getItem(GK) || '{}') || {}; Object.keys(s).forEach((k) => { if (s[k]) c[k] = s[k]; }); } catch (e) {} return c; };
  A.tokenURL = (c) => 'https://github.com/settings/personal-access-tokens/new?name=' + encodeURIComponent((c.repo || 'site') + ' admin publish') + '&description=' + encodeURIComponent('Publish button in admin.html') + '&target_name=' + encodeURIComponent(c.owner || '') + '&expires_in=365&contents=write';
  A.ghSave = (c) => { try { localStorage.setItem(GK, JSON.stringify(c)); } catch (e) {} };
  A.ghReady = (c) => !!(c.owner && c.repo && c.token);
  async function api(c, path, opt) {
    opt = opt || {}; let r;
    try { r = await fetch('https://api.github.com' + path, { method: opt.method || 'GET', headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' }, opt.body ? { 'Content-Type': 'application/json' } : {}), body: opt.body ? JSON.stringify(opt.body) : undefined }); }
    catch (e) { throw new Error('Could not reach GitHub. Check your connection.'); }
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      const m = (j && j.message) || 'HTTP ' + r.status;
      const e = new Error(r.status === 401 ? 'GitHub rejected the token (401). Create a new one.' : r.status === 403 ? 'GitHub refused (403): this token cannot write to the repository. Create it with "Only select repositories" → this repository and Contents: Read and write. (' + m + ')' : r.status === 404 ? 'Not found (404). Check owner, repository and branch, and that the token has access to this repository.' : m);
      e.status = r.status; throw e;
    }
    return j;
  }
  const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(',') + 1)); }; r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const R = (c) => '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo);
  A.ghTest = async (c) => {
    const j = await api(c, R(c));
    if (!j.permissions || !j.permissions.push) throw new Error('This token can read ' + j.full_name + ' but cannot write to it. Give it Contents: Read and write.');
    await api(c, R(c) + '/branches/' + c.branch);
    // "permissions" above describe your account, not the token: prove the token can write with a tiny unreferenced blob (changes nothing)
    try { await api(c, R(c) + '/git/blobs', { method: 'POST', body: { content: 'fl-admin connection test', encoding: 'utf-8' } }); }
    catch (e) { if (e.status === 403 || e.status === 404) throw new Error('This token can read ' + j.full_name + ' but cannot write to it. Create it with "Only select repositories" → ' + j.name + ' and Contents: Read and write.'); throw e; }
    return j;
  };
  A.ghPublish = async (c, up, rm, content, message, log) => {
    const base = (c.path || '').replace(/^\/+|\/+$/g, ''), P = (p) => (base ? base + '/' : '') + p;
    log('Reading ' + c.owner + '/' + c.repo + ' @ ' + c.branch);
    const ref = await api(c, R(c) + '/git/ref/heads/' + c.branch), head = ref.object.sha;
    const commit = await api(c, R(c) + '/git/commits/' + head);
    let have = null;
    if (rm.length) { const tr = await api(c, R(c) + '/git/trees/' + commit.tree.sha + '?recursive=1'); if (!tr.truncated) have = new Set(tr.tree.map((x) => x.path)); }
    const tree = [];
    for (let i = 0; i < up.length; i++) {
      const [p, blob] = up[i]; log(`Uploading ${i + 1}/${up.length} · ${p.split('/').pop()} · ${A.mb(blob.size)}`);
      const b = await api(c, R(c) + '/git/blobs', { method: 'POST', body: { content: await b64(blob), encoding: 'base64' } });
      tree.push({ path: P(p), mode: '100644', type: 'blob', sha: b.sha });
    }
    tree.push({ path: P('content.js'), mode: '100644', type: 'blob', content });
    if (have) rm.forEach((p) => { if (have.has(P(p))) tree.push({ path: P(p), mode: '100644', type: 'blob', sha: null }); });
    log('Writing commit');
    const nt = await api(c, R(c) + '/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree } });
    const nc = await api(c, R(c) + '/git/commits', { method: 'POST', body: { message, tree: nt.sha, parents: [head] } });
    await api(c, R(c) + '/git/refs/heads/' + c.branch, { method: 'PATCH', body: { sha: nc.sha } });
    return { url: 'https://github.com/' + c.owner + '/' + c.repo + '/commit/' + nc.sha };
  };

  // ---------- publishing from this PC: admin-local.py serves the panel and publishes with your own git login (no token) ----------
  A.localPing = async () => {
    if (!/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return null;
    try { const r = await fetch('/__local/ping', { cache: 'no-store' }); const j = r.ok ? await r.json() : null; return j && j.ok ? j : null; } catch (e) { return null; }
  };
  async function lp(path, body, type) {
    let r; try { r = await fetch(path, { method: 'POST', headers: { 'X-FL-Local': '1', 'Content-Type': type || 'application/json' }, body }); }
    catch (e) { throw new Error('The local publisher is not running. Start the panel with admin-ac.bat.'); }
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'HTTP ' + r.status);
    return j;
  }
  A.localPublish = async (up, rm, content, message, log) => {
    log('Syncing with GitHub (git pull)'); await lp('/__local/begin', '{}');
    for (let i = 0; i < up.length; i++) { const [p, blob] = up[i]; log(`Saving ${i + 1}/${up.length} · ${p.split('/').pop()} · ${A.mb(blob.size)}`); await lp('/__local/file?path=' + encodeURIComponent(p), blob, 'application/octet-stream'); }
    log('Committing and pushing (git push)');
    return lp('/__local/publish', JSON.stringify({ content, rm, message }));
  };

  // ---------- confirm a publish went live: poll the published content.js until it carries this publish's stamp ----------
  A.siteURL = (c) => {
    if (/\.github\.io$/i.test(location.hostname)) return location.origin + location.pathname.replace(/[^/]*$/, '');
    if (!c || !c.owner || !c.repo) return '';
    const sub = (c.path || '').replace(/^\/+|\/+$/g, '');
    return (/\.github\.io$/i.test(c.repo) ? 'https://' + c.repo.toLowerCase() + '/' : 'https://' + c.owner.toLowerCase() + '.github.io/' + c.repo + '/') + (sub ? sub + '/' : '');
  };
  A.waitLive = async (site, stamp) => {
    for (let i = 0; i < 48; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try { const t = await (await fetch(site + 'content.js?live=' + Date.now(), { cache: 'no-store' })).text(); const m = t.match(/"updated":\s*"([^"]+)"/); if (m && m[1] >= stamp) return true; } catch (e) {}
    }
    return false;
  };

  // ---------- export (any host) ----------
  const loadZip = () => window.JSZip ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the zip tool. Check your connection.')); document.head.appendChild(s); });
  A.download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
  A.exportZip = async (up, content, name) => {
    await loadZip(); const z = new window.JSZip();
    z.file('content.js', content); up.forEach(([p, b]) => z.file(p, b));
    z.file('HOW-TO-UPLOAD.txt', 'Copy content.js and the media folder into your site folder (next to the main HTML file), replacing content.js.\nOnly new media files are included; files already on your host stay as they are.\n');
    A.download(await z.generateAsync({ type: 'blob', compression: 'STORE' }), name);
  };
})();
