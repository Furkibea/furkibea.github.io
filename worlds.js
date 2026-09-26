// worlds.js — "Live game": Roblox thumbnails + live player / visit / favorite counts (read through RoProxy,
// which adds the CORS headers Roblox's own API lacks). Values in content.js are the fallback when Roblox can't be reached.
(window.FL = window.FL || {}).data.then((D) => {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const FL = window.FL;
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const cssu = (u) => String(u || '').replace(/"/g, '%22').replace(/'/g, '%27').replace(/\\/g, '%5C');
  const fmtN = (n) => Math.round(n).toLocaleString('en-US');
  const t1 = (x) => { const v = Math.floor(x * 10) / 10; return v % 1 ? v.toFixed(1) : String(v); };
  const fmtV = (n) => n >= 1e9 ? t1(n / 1e9) + 'B+' : n >= 1e6 ? t1(n / 1e6) + 'M+' : n >= 1e3 ? t1(n / 1e3) + 'K+' : fmtN(n);
  const soon = (w) => w.status === 'soon';
  const relLabel = (w) => w.release ? new Date(w.release + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = (D.worlds || []).filter((w) => w && w.name).map((w) => Object.assign({}, w, { live: null, media: null }));
  const sec = $('#work'), view = $('#lgview'); if (!sec || !view) return;
  if (!W.length) { sec.style.display = 'none'; const a = $('#secmenu a[href="#work"]'); if (a) a.remove(); return; }
  const headOf = (w) => soon(w) ? 'Next game' : (W.filter((x) => !soon(x)).length > 1 ? 'Live games' : 'Live game');
  $('#lgh').textContent = headOf(W[0]);
  const placeOf = (w) => String(w.placeId || ((String(w.url || '').match(/games\/(\d+)/) || [])[1] || ''));
  const playURL = (w) => w.url || (placeOf(w) ? 'https://www.roblox.com/games/' + placeOf(w) : '');
  let cur = 0, slide = -1, slides = [], timer = 0, visible = false, hover = false, lastSync = 0, online = null, started = false;

  // ---------- game tabs (only when there is more than one) ----------
  if (W.length > 1) {
    const tb = $('#lgtabs'); tb.hidden = false;
    tb.innerHTML = W.map((w, i) => `<button data-i="${i}" data-cur="Open"><span class="acc">${pad(i + 1)}</span>${esc(w.name)}${soon(w) ? '<em>Soon</em>' : ''}</button>`).join('');
    tb.insertAdjacentHTML('beforeend', '<i class="lg-ind" aria-hidden="true"></i>'); tb.classList.add('has-ind');
    tb.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) switchTo(+b.dataset.i); });
    tb.addEventListener('keydown', (e) => { const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!k) return; e.preventDefault(); const n = (want + k + W.length) % W.length; switchTo(n); tb.querySelectorAll('button')[n].focus(); });
    addEventListener('resize', () => tabsOn(want));
    if (document.fonts) document.fonts.ready.then(() => tabsOn(want));
  }
  // tab indicator slides between tabs
  function tabsOn(i) {
    const tb = $('#lgtabs'); if (!tb || tb.hidden) return; const bs = tb.querySelectorAll('button'), b = bs[i], ind = $('.lg-ind', tb);
    bs.forEach((x, j) => x.classList.toggle('on', j === i)); if (!b || !ind) return;
    ind.style.width = b.offsetWidth + 'px'; ind.style.height = b.offsetHeight + 'px'; ind.style.transform = 'translate(' + b.offsetLeft + 'px,' + b.offsetTop + 'px)';
  }
  // switching games: copy slides out, a panel wipes across the viewer, the new game staggers in and its numbers count up
  let want = 0, busyT = false;
  function switchTo(i) {
    want = i; if (busyT || i === cur) return;
    const body = $('.lg-body'); tabsOn(i);
    if (RM || !body) { show(i); return; }
    busyT = true; body.style.setProperty('--dir', i > cur ? 1 : -1);
    $('#lgwipe span').textContent = pad(i + 1) + ' / ' + pad(W.length) + ' — ' + W[i].name;
    body.classList.remove('in'); body.classList.add('out');
    setTimeout(() => {
      show(want, true); body.classList.remove('out'); void body.offsetWidth; body.classList.add('in');
      setTimeout(() => { body.classList.remove('in'); busyT = false; if (want !== cur) switchTo(want); }, 760);
    }, 340);
  }

  // ---------- numbers: roll to new values, flash on change ----------
  const nums = new Map();
  function setNum(el, v, fm) {
    if (!el) return; fm = fm || fmtN;
    if (v == null || isNaN(v)) { el.textContent = '—'; return; }
    const from = nums.has(el) ? nums.get(el) : null; nums.set(el, v);
    if (from == null || RM || fm(from) === fm(v)) { el.textContent = fm(v); return; }
    el.classList.add('flash'); const t0 = performance.now();
    (function tk(now) { const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = fm(from + (v - from) * e); if (k < 1) requestAnimationFrame(tk); else { el.textContent = fm(v); el.classList.remove('flash'); } })(t0);
  }
  const stats = (w) => { const L = w.live || {}; return { ccu: L.playing != null ? L.playing : +w.ccu || 0, visits: L.visits != null ? L.visits : (+w.visits || 0) * 1e6, fav: L.favoritedCount != null ? L.favoritedCount : +w.favorites || 0, max: L.maxPlayers || +w.maxPlayers || 0, upd: L.updated || '' }; };
  function statsHTML(w) {
    if (soon(w)) return `<div class="st big"><span class="mono"><i class="ldot soon"></i>${w.release ? 'Launches in' : 'Status'}</span><b id="lgcd" class="${w.release ? '' : 'txt'}">${w.release ? '—' : 'In development'}</b></div><div class="st"><span class="mono">Release</span><b>${esc(relLabel(w))}</b></div><div class="st"><span class="mono">Platform</span><b>Roblox</b></div>`;
    return '<div class="st big"><span class="mono"><i class="ldot"></i>Playing now</span><b id="lgccu">—</b><em id="lgdelta" class="mono"></em></div><div class="st"><span class="mono">Visits</span><b id="lgv">—</b></div><div class="st"><span class="mono">Favorites</span><b id="lgfav">—</b></div><div class="st"><span class="mono">Server size</span><b id="lgmax">—</b></div>';
  }
  function countdown() {
    const w = W[cur], el = $('#lgcd'); if (!el || !soon(w) || !w.release) return;
    const ms = Date.parse(w.release + 'T00:00:00') - Date.now();
    if (ms <= 0) { el.textContent = 'Out now'; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, sc = Math.floor(ms / 1e3) % 60;
    el.textContent = d + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(sc);
  }
  function paintStats() {
    const w = W[cur];
    if (soon(w)) { $('#lgupd').textContent = w.release ? 'Release ' + relLabel(w) : 'First look soon'; countdown(); return; }
    const s = stats(w);
    setNum($('#lgccu'), s.ccu); setNum($('#lgv'), s.visits, fmtV); setNum($('#lgfav'), s.fav, fmtV);
    const mx = $('#lgmax'); if (mx) mx.textContent = s.max ? String(s.max) : '—';
    $('#lgupd').textContent = s.upd ? 'Game updated ' + new Date(s.upd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  let dT = 0;
  function delta(d) { const el = $('#lgdelta'); if (!el) return; el.textContent = (d > 0 ? '+' : '−') + Math.abs(d) + ' since last check'; el.className = 'mono on ' + (d > 0 ? 'up' : 'down'); clearTimeout(dT); dT = setTimeout(() => el.classList.remove('on'), 4000); }
  function syncLabel() {
    const el = $('#lgsync'); if (!el) return;
    if (online === false) { el.textContent = 'Offline · last known numbers'; return; }
    if (!lastSync) { el.textContent = 'Connecting to Roblox…'; return; }
    const s = Math.round((Date.now() - lastSync) / 1000); el.textContent = 'Live · synced ' + (s < 5 ? 'just now' : s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago');
  }

  // ---------- media viewer ----------
  const mediaOf = (w) => {
    const out = [], seen = new Set(), push = (o) => { if (o.img && !seen.has(o.img)) { seen.add(o.img); out.push(o); } };
    if (w.thumb) push({ img: w.thumb });
    ((w.media && w.media.thumbs) || w.thumbs || []).forEach((u) => push({ img: u }));
    ((w.media && w.media.videos) || []).forEach((v) => push({ img: 'https://i.ytimg.com/vi/' + v + '/hqdefault.jpg', yt: v }));
    return out;
  };
  function buildSlides() {
    const next = mediaOf(W[cur]); if (slides.length && JSON.stringify(next) === JSON.stringify(slides)) return;
    slides = next; const box = $('#lgslides'), strip = $('#lgstrip'); slide = -1; clearTimeout(timer); killFrame();
    if (!slides.length) { box.innerHTML = `<div class="lg-ph" style="--pc:${esc(W[cur].color || '#5ec8ff')}">${soon(W[cur]) ? '<span class="stamp mono">First look soon</span>' : ''}<span class="disp">${pad(cur + 1)}</span></div>`; strip.innerHTML = ''; $('#lgi').textContent = '01'; $('#lgn').textContent = '01'; view.classList.add('single'); return; }
    box.innerHTML = slides.map((s, k) => `<img src="${esc(s.img)}" alt="${esc(W[cur].name)}, image ${k + 1} of ${slides.length}" decoding="async"${k ? ' loading="lazy"' : ''}>`).join('');
    strip.innerHTML = slides.length > 1 ? slides.map((s, k) => `<button data-k="${k}" aria-label="Show image ${k + 1}" style="background-image:url('${cssu(s.img)}')">${s.yt ? '<i class="yt"></i>' : ''}</button>`).join('') : '';
    $('#lgn').textContent = pad(slides.length); view.classList.toggle('single', slides.length < 2); go(0);
  }
  function go(k) {
    if (!slides.length) return; k = (k + slides.length) % slides.length; if (k === slide) return; slide = k; killFrame();
    [...$('#lgslides').children].forEach((im, j) => im.classList.toggle('on', j === k));
    $$('#lgstrip button').forEach((b, j) => b.classList.toggle('on', j === k));
    $('#lgi').textContent = pad(k + 1); view.classList.toggle('is-yt', !!slides[k].yt);
    const bar = $('#lgbar'); bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)'; void bar.offsetWidth;
    clearTimeout(timer);
    if (slides.length > 1 && !RM) { bar.style.transition = 'transform 6s linear'; bar.style.transform = 'scaleX(1)'; timer = setTimeout(advance, 6000); }
  }
  function advance() { if (hover || !visible || document.hidden || $('iframe', view)) { timer = setTimeout(advance, 1500); return; } go(slide + 1); }
  function killFrame() { const f = $('iframe', view); if (f) f.remove(); }
  $('#lgstrip').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.k); });
  $('#lgprev').addEventListener('click', (e) => { e.stopPropagation(); go(slide - 1); });
  $('#lgnext').addEventListener('click', (e) => { e.stopPropagation(); go(slide + 1); });
  view.addEventListener('click', (e) => {
    if (e.target.closest('button') || sw.moved > 8) return; const s = slides[slide]; if (!s || !s.yt || $('iframe', view)) return;
    const f = document.createElement('iframe'); f.src = 'https://www.youtube-nocookie.com/embed/' + s.yt + '?autoplay=1&rel=0&playsinline=1'; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.title = W[cur].name + ' video'; view.appendChild(f); clearTimeout(timer);
  });
  const sw = { x: 0, on: false, moved: 0 };
  view.addEventListener('pointerdown', (e) => { sw.on = true; sw.x = e.clientX; sw.moved = 0; });
  view.addEventListener('pointermove', (e) => { if (sw.on) sw.moved = Math.abs(e.clientX - sw.x); });
  view.addEventListener('pointerup', (e) => { if (!sw.on) return; sw.on = false; const dx = e.clientX - sw.x; if (Math.abs(dx) > 50) go(slide + (dx < 0 ? 1 : -1)); });
  view.addEventListener('pointerenter', () => { hover = true; }); view.addEventListener('pointerleave', () => { hover = false; sw.on = false; });

  // ---------- game details ----------
  // a single long word ("TENNIS") must never break mid-word: shrink the name until its widest word fits the column
  function fitName(el, text) {
    el.style.fontSize = ''; const m = document.createElement('span'); m.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap'; el.appendChild(m);
    let w = 0; String(text).split(/\s+/).forEach((t) => { m.textContent = t; w = Math.max(w, m.getBoundingClientRect().width); }); m.remove();
    const room = el.clientWidth; if (w > room && room > 0) el.style.fontSize = Math.floor(parseFloat(getComputedStyle(el).fontSize) * room / w * .97) + 'px';
  }
  addEventListener('resize', () => fitName($('#lgname'), W[cur].name));
  if (document.fonts) document.fonts.ready.then(() => fitName($('#lgname'), W[cur].name));
  // text swaps share ui.js's scramble: layout-stable, and a newer swap cancels an older one on the same element
  const swap = (el, t) => (FL.scramble ? FL.scramble(el, t, 1.4) : (el.textContent = t));
  function show(i, anim) {
    cur = i; want = i; const w = W[i];
    tabsOn(i);
    $('#lgno').textContent = pad(i + 1) + ' / ' + pad(W.length); $('#lgstudio').textContent = w.studio || ''; $('#lggenre').textContent = w.genre || '';
    $('#lgdesc').textContent = w.desc || '';
    const disc = (D.profile && D.profile.links && D.profile.links.discord) || '';
    const u = soon(w) ? (w.url || disc) : playURL(w), pl = $('#lgplay'); pl.href = u || '#'; pl.style.visibility = u ? '' : 'hidden';
    pl.innerHTML = (soon(w) ? (w.url ? 'Follow on Roblox' : 'Get notified on Discord') : 'Play on Roblox') + '<span class="ar">→</span>';
    if (soon(w) && !w.url) pl.dataset.link = 'discord'; else delete pl.dataset.link;
    $('#lglive').innerHTML = soon(w) ? '<i class="ldot soon"></i>In development' : '<i class="ldot"></i>Live';
    $('#lgstats').innerHTML = statsHTML(w);
    // heading: before its first reveal just set the text (ui.js scrambles it in); after that, swap it
    const hd = $('#lgh'), ht = headOf(w);
    if ((hd.dataset.f || hd.textContent) !== ht) { if (anim && hd.dataset.f) swap(hd, ht); else { hd.textContent = ht; if (hd.dataset.f) hd.dataset.f = ht; } }
    FL.tint = w.color || '#5ec8ff';
    const nm = $('#lgname'); fitName(nm, w.name); swap(nm, w.name);
    nums.clear(); if (anim) ['#lgccu', '#lgv', '#lgfav'].forEach((q) => { const el = $(q); if (el) nums.set(el, 0); });
    slides = []; paintStats(); buildSlides();
  }

  // ---------- live data ----------
  const RP = (p) => 'https://' + p + '.roproxy.com';
  async function J(u) { const c = new AbortController(), to = setTimeout(() => c.abort(), 9000); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(to); } }
  async function ensureIds() { await Promise.all(W.map(async (w) => { if (w.universeId || !placeOf(w)) return; try { w.universeId = (await J(RP('apis') + '/universes/v1/places/' + placeOf(w) + '/universe')).universeId || 0; } catch (e) {} })); }
  async function refresh() {
    const ids = W.filter((w) => !soon(w)).map((w) => +w.universeId).filter(Boolean); if (!ids.length) return;
    try {
      const j = await J(RP('games') + '/v1/games?universeIds=' + ids.join(','));
      (j.data || []).forEach((g) => { const w = W.find((x) => +x.universeId === g.id); if (!w) return; const prev = w.live && w.live.playing; w.live = g; if (w === W[cur] && prev != null && g.playing !== prev) delta(g.playing - prev); });
      lastSync = Date.now(); online = true; paintStats();
    } catch (e) { online = false; }
    syncLabel();
  }
  async function loadMedia() {
    const ids = W.map((w) => +w.universeId).filter(Boolean); if (!ids.length) return;
    try {
      const t = await J(RP('thumbnails') + '/v1/games/multiget/thumbnails?universeIds=' + ids.join(',') + '&countPerUniverse=20&defaults=false&size=768x432&format=Webp&isCircular=false');
      (t.data || []).forEach((d) => { const w = W.find((x) => +x.universeId === d.universeId); if (w) (w.media = w.media || {}).thumbs = (d.thumbnails || []).filter((x) => x.state === 'Completed' && x.imageUrl).map((x) => x.imageUrl); });
    } catch (e) {}
    await Promise.all(W.map(async (w) => { if (!w.universeId) return; try { const m = await J(RP('games') + '/v2/games/' + w.universeId + '/media'); (w.media = w.media || {}).videos = (m.data || []).filter((x) => x.videoHash && x.approved !== false).map((x) => x.videoHash); } catch (e) {} }));
    buildSlides();
  }
  function start() { if (started) return; started = true; ensureIds().then(() => Promise.all([refresh(), loadMedia()])); setInterval(() => { if (visible && !document.hidden) refresh(); }, 30000); setInterval(() => { if (visible) { syncLabel(); countdown(); } }, 1000); }

  // ---------- visibility + tilt ----------
  new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; FL.tintOn = visible; if (visible) start(); }), { rootMargin: '300px 0px' }).observe(sec);
  const tilt = $('#lgtilt'); let mx = 0, my = 0, rx = 0, ry = 0;
  sec.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  sec.addEventListener('pointerleave', () => { mx = my = 0; });
  (function loop() { requestAnimationFrame(loop); if (!visible || RM) return; const nx = rx + (-my * 8 - rx) * .07, ny = ry + (mx * 12 - ry) * .07; if (Math.abs(nx - rx) + Math.abs(ny - ry) < .002) return; rx = nx; ry = ny; tilt.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`; })();
  show(0); syncLabel();
});
