// gallery.js — curved 3D footage arc + theater player. Clips come from content.js through FL.data.
(window.FL = window.FL || {}).data.then((D) => {
  const $ = (s, r) => (r || document).querySelector(s);
  const FL = window.FL;
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (s) => { s = Math.max(0, s || 0); return pad(Math.floor(s / 60)) + ':' + pad(Math.floor(s % 60)); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"></path></svg>';
  const MAX = 16, FRESH = 14 * 864e5;
  const reels = (D.reels || []).filter((r) => r && r.src).slice(0, MAX).map((r, i) => ({ title: r.title || 'Clip ' + pad(i + 1), src: r.src, poster: r.poster || '', dur: +r.dur || 0, fresh: !!r.date && Date.now() - Date.parse(r.date) < FRESH }));
  const N = reels.length, sec = $('#reel'), th = $('#theater'); if (!sec || !th) return;
  if (!N) { sec.style.display = 'none'; const a = $('#secmenu a[href="#reel"]'); if (a) a.remove(); return; }
  const rc = $('#rcount'); if (rc) rc.textContent = pad(N);

  // ---------- arc ----------
  const arcv = $('#arcv'), arc = $('#arc'), arcn = $('#arcn'), arct = $('#arct'), arcd = $('#arcd'), rail = $('#rail'), amb = $('#amb'), ambG = amb.getContext('2d');
  let R = 1100, step = 16, rot = 0, vel = 0, tgt = 0, intro = 0, visible = false, lastF = -1, lastRot = NaN, lastIntro = -1, ambT = 0;
  const drag = { on: false, x: 0, moved: 0, card: -1 };
  const solo = N < 2, few = N < 3;
  // a single clip needs no rail, arrows or "next" in the player
  sec.classList.toggle('solo', solo); th.classList.toggle('solo', solo);
  const rt = $('.r-meta span:last-child'); if (rt && solo) rt.textContent = 'Click or Enter to play';
  if (rc && rc.nextSibling) rc.nextSibling.textContent = N === 1 ? ' clip on file' : ' clips on file';
  rail.innerHTML = reels.map((_, i) => `<button aria-label="Clip ${i + 1}"><i></i></button>`).join('');
  const ticks = [...rail.children]; ticks.forEach((b, i) => b.addEventListener('click', () => snapTo(i)));
  $('#arcplay').addEventListener('click', () => open(focusIdx()));
  const vids = [], pos = [];
  const load = (i, pre) => { const v = vids[i]; if (!v.dataset.on) { v.dataset.on = '1'; v.preload = pre || 'auto'; v.src = reels[i].src; } else if (pre !== 'metadata') v.preload = 'auto'; return v; };
  const play = (i) => { if (visible && !th.classList.contains('on')) load(i).play().catch(() => {}); };
  const cards = reels.map((r, i) => {
    const f = document.createElement('figure'); f.className = 'card' + (r.poster ? ' has-po' : ''); f.dataset.cur = 'Play';
    f.innerHTML = `<div class="cin"><div class="cv">${r.poster ? `<img class="po" src="${esc(r.poster)}" alt="" decoding="async">` : ''}<video muted loop playsinline preload="none"></video>${r.fresh ? '<span class="nw mono">New</span>' : ''}<span class="pl">${PLAY}</span></div><figcaption class="mono"><span class="no">${pad(i + 1)}</span><span class="ti">${esc(r.title)}</span><span class="du">${r.dur ? fmt(r.dur) : '--:--'}</span></figcaption><span class="sh"></span></div>`;
    const v = $('video', f), cin = $('.cin', f); vids.push(v); pos.push($('.po', f));
    v.addEventListener('loadedmetadata', () => { if (!r.dur && isFinite(v.duration)) { r.dur = v.duration; $('.du', f).textContent = fmt(r.dur); if (i === lastF) arcd.textContent = fmt(r.dur); } if (!r.poster) { try { v.currentTime = Math.min(.6, v.duration / 2); } catch (e) {} } });
    v.addEventListener('playing', () => f.classList.add('vp'));
    v.addEventListener('pause', () => f.classList.remove('vp'));
    f.addEventListener('pointerenter', () => { if (!drag.on) play(i); });
    f.addEventListener('pointerleave', () => { if (i !== lastF) v.pause(); cin.style.transform = ''; });
    f.addEventListener('pointermove', (e) => { const b = f.getBoundingClientRect(), mx = (e.clientX - b.left) / b.width, my = (e.clientY - b.top) / b.height; cin.style.transform = `translateZ(46px) rotateX(${(.5 - my) * 14}deg) rotateY(${(mx - .5) * 18}deg)`; f.style.setProperty('--mx', mx * 100 + '%'); f.style.setProperty('--my', my * 100 + '%'); });
    arc.appendChild(f); return f;
  });

  // card size: one or two clips get a big screen, more clips the arc; phones nearly full width
  function dims() {
    const cw = innerWidth < 700 ? Math.min(innerWidth * .84, 480) : few ? Math.max(340, Math.min(640, innerWidth * .46)) : Math.max(220, Math.min(340, innerWidth * .24));
    arcv.style.setProperty('--cw', cw + 'px'); arcv.style.setProperty('--ah', few ? .8 : 1.05); R = cw * 3.9; step = (cw + 34) / R * 180 / Math.PI; lastRot = NaN;
  }
  dims();
  const minR = () => -(N - 1) * step;
  const focusIdx = () => Math.max(0, Math.min(N - 1, Math.round(-rot / step)));
  function snapTo(i) { vel = 0; tgt = -Math.max(0, Math.min(N - 1, i)) * step; }
  addEventListener('resize', () => { const fi = focusIdx(); dims(); rot = tgt = -fi * step; if (!visible) layout(); });
  arcv.addEventListener('pointerdown', (e) => { const c = e.target.closest('.card'); drag.on = true; drag.x = e.clientX; drag.moved = 0; drag.card = c ? cards.indexOf(c) : -1; vel = 0; tgt = null; arcv.setPointerCapture(e.pointerId); arcv.classList.add('grab'); });
  arcv.addEventListener('pointermove', (e) => { if (!drag.on) return; const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx); const k = dx * .075; let nr = rot + k; if (nr > 0 || nr < minR()) nr = rot + k * .35; vel = nr - rot; rot = nr; });
  // pointer capture (needed for dragging) sends the click to the arc instead of the card, so a tap is resolved here:
  // tapping a side card brings it to the front, tapping the front card plays it
  const endDrag = (e) => {
    if (!drag.on) return; drag.on = false; arcv.classList.remove('grab');
    const i = drag.card; drag.card = -1;
    if (e && e.type === 'pointerup' && i >= 0 && drag.moved <= 6) { if (Math.abs(i * step + rot) > step * .6) snapTo(i); else open(i); }
    setTimeout(() => { drag.moved = 0; }, 0);
  };
  arcv.addEventListener('pointerup', endDrag); arcv.addEventListener('pointercancel', endDrag);
  arcv.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); tgt = null; vel -= e.deltaX * .012; } }, { passive: false });
  $('#arcprev').addEventListener('click', () => snapTo(focusIdx() - 1));
  $('#arcnext').addEventListener('click', () => snapTo(focusIdx() + 1));
  addEventListener('keydown', (e) => { if (!visible || th.classList.contains('on') || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; if (e.key === 'ArrowRight') snapTo(focusIdx() + 1); else if (e.key === 'ArrowLeft') snapTo(focusIdx() - 1); else if (e.key === 'Enter') open(focusIdx()); });
  new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; if (visible) { sec.classList.add('in'); if (lastF >= 0) play(lastF); } else vids.forEach((v) => v.pause()); }), { threshold: .05 }).observe(arcv);
  (function tick() { requestAnimationFrame(tick); if (visible) render(); })();

  function layout() {
    arc.style.transform = `translateZ(${R - (few ? 40 : 170)}px)`;
    for (let i = 0; i < N; i++) {
      const f = cards[i], a = i * step + rot, ab = Math.abs(a);
      const d = Math.max(0, Math.min(1, intro * 1.6 - Math.min(i, 8) * .07)), e = 1 - Math.pow(1 - d, 3);
      const op = Math.max(0, Math.min(1, (74 - ab) / 20)) * e;
      f.style.transform = `translate(-50%,-50%) rotateY(${-a}deg) translateZ(${-R - (1 - e) * 700}px)`;
      f.style.opacity = op; f.style.visibility = op <= .01 ? 'hidden' : 'visible';
      f.classList.toggle('fo', ab < step / 2);
    }
  }
  function render() {
    if (sec.classList.contains('in') && intro < 1) intro = Math.min(1, intro + .012);
    if (!drag.on) {
      if (tgt != null) { rot += (tgt - rot) * .1; if (Math.abs(tgt - rot) < .002) rot = tgt; }
      else { rot += vel; vel *= .9; if (Math.abs(vel) < .04) tgt = Math.max(minR(), Math.min(0, Math.round(rot / step) * step)); }
      if (rot > 0) { rot *= .8; if (rot < .002) rot = 0; }
      if (rot < minR()) { rot += (minR() - rot) * .2; if (minR() - rot < .002) rot = minR(); }
    }
    if (rot !== lastRot || intro !== lastIntro) { lastRot = rot; lastIntro = intro; layout(); }
    const fi = focusIdx();
    if (fi !== lastF) {
      if (lastF >= 0) vids[lastF].pause();
      lastF = fi; arcn.textContent = pad(fi + 1) + ' / ' + pad(N);
      arct.classList.add('sw'); arct.textContent = reels[fi].title; void arct.offsetWidth; arct.classList.remove('sw');
      arcd.textContent = reels[fi].dur ? fmt(reels[fi].dur) : '--:--';
      ticks.forEach((b, j) => b.classList.toggle('on', j === fi));
      for (let k = Math.max(0, fi - 2); k <= Math.min(N - 1, fi + 2); k++) if (!reels[k].poster) load(k, 'metadata');
      play(fi); ambT = 0;
    }
    const now = performance.now();
    if (now - ambT > 120) { ambT = now; const v = vids[fi], p = pos[fi]; try { if (v.readyState >= 2 && (!v.paused || !p)) ambG.drawImage(v, 0, 0, 64, 36); else if (p && p.complete && p.naturalWidth) ambG.drawImage(p, 0, 0, 64, 36); } catch (e) {} }
  }

  // ---------- theater player ----------
  const vid = $('#vid'), stage = $('#stage'), scrub = $('#scrub'), fill = $('.fill', scrub), buf = $('.buf', scrub), head = $('.head', scrub), hov = $('.hov', scrub);
  const pp = $('#pp'), big = $('#bigplay'), time = $('#time'), tc = $('#tc'), mute = $('#mute'), fs = $('#fs'), vol = $('#vol');
  let cur = 0;
  function open(i) {
    cur = i; const r = reels[i];
    $('#thn').textContent = pad(i + 1) + ' / ' + pad(N); $('#tht').textContent = r.title;
    if (vid.dataset.src !== r.src) { vid.dataset.src = r.src; vid.poster = r.poster || ''; vid.src = r.src; }
    try { vid.currentTime = 0; } catch (e) {}
    vids.forEach((v) => v.pause()); th.classList.add('on'); th.setAttribute('aria-hidden', 'false'); FL.theaterOpen = true;
    th.classList.remove('swap'); void th.offsetWidth; th.classList.add('swap');
    vid.play().catch(() => {});
  }
  function close() { vid.pause(); th.classList.remove('on', 'playing'); th.setAttribute('aria-hidden', 'true'); FL.cinema = 0; FL.theaterOpen = false; lastF = -1; }
  const step2 = (d) => { if (solo) return; const i = (cur + d + N) % N; snapTo(i); open(i); };
  $('#thx').addEventListener('click', close); $('.th-bg', th).addEventListener('click', close);
  $('#thprev').addEventListener('click', () => step2(-1)); $('#thnext').addEventListener('click', () => step2(1));
  function setState() { const on = !vid.paused && !vid.ended; th.classList.toggle('playing', on); FL.cinema = on && th.classList.contains('on') ? 1 : 0; }
  const toggle = () => { if (vid.paused || vid.ended) vid.play().catch(() => {}); else vid.pause(); };
  [pp, big].forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); toggle(); }));
  stage.addEventListener('click', (e) => { if (!e.target.closest('button')) toggle(); });
  ['play', 'pause', 'ended'].forEach((ev) => vid.addEventListener(ev, setState));
  vid.addEventListener('progress', () => { if (vid.buffered.length && vid.duration) buf.style.width = vid.buffered.end(vid.buffered.length - 1) / vid.duration * 100 + '%'; });
  (function loop() {
    requestAnimationFrame(loop); if (!th.classList.contains('on')) return;
    const d = vid.duration || 0, p = d ? vid.currentTime / d : 0;
    fill.style.transform = `scaleX(${p})`; head.style.left = p * 100 + '%';
    time.textContent = fmt(vid.currentTime) + ' / ' + fmt(d);
    const s = vid.currentTime || 0; tc.textContent = pad(Math.floor(s / 60)) + ':' + pad(Math.floor(s % 60)) + ':' + pad(Math.floor((s % 1) * 24));
  })();
  let sd = false;
  const seekAt = (x) => { const r = scrub.getBoundingClientRect(), k = Math.min(1, Math.max(0, (x - r.left) / r.width)); if (vid.duration) vid.currentTime = k * vid.duration; };
  scrub.addEventListener('pointerdown', (e) => { sd = true; scrub.setPointerCapture(e.pointerId); seekAt(e.clientX); scrub.classList.add('drag'); });
  scrub.addEventListener('pointermove', (e) => { const r = scrub.getBoundingClientRect(), k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); hov.style.left = k * 100 + '%'; hov.textContent = fmt(k * (vid.duration || 0)); if (sd) seekAt(e.clientX); });
  scrub.addEventListener('pointerup', () => { sd = false; scrub.classList.remove('drag'); });
  vid.volume = .8;
  const syncVol = () => { th.classList.toggle('muted', vid.muted || vid.volume === 0); vol.value = vid.muted ? 0 : vid.volume; vol.style.setProperty('--v', (vid.muted ? 0 : vid.volume) * 100 + '%'); };
  mute.addEventListener('click', () => { vid.muted = !vid.muted; syncVol(); });
  vol.addEventListener('input', () => { vid.volume = +vol.value; vid.muted = +vol.value === 0; syncVol(); });
  syncVol();
  fs.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else (stage.requestFullscreen || stage.webkitRequestFullscreen || (() => {})).call(stage); });
  addEventListener('keydown', (e) => {
    if (!th.classList.contains('on') || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'Escape') close();
    else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' || e.key === 'l') vid.currentTime += 5;
    else if (e.key === 'ArrowLeft' || e.key === 'j') vid.currentTime -= 5;
    else if (e.key === 'm') { vid.muted = !vid.muted; syncVol(); }
    else if (e.key === 'f') fs.click();
    else if (e.key === 'n') step2(1); else if (e.key === 'p') step2(-1);
  });

  intro = 1; render(); intro = 0; lastIntro = -1;
});
