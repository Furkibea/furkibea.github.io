// comms.js — "Transmissions": field logs as a 3D stack of holo cards. Latest 8 from content.js (FL.data).
// Swipe, tap, arrows, or let it auto-advance.
(window.FL = window.FL || {}).data.then((D) => {
  const $ = (s, r) => (r || document).querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fd = (d) => String(d || '').replace(/-/g, '.');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ALL = (D.logs || []).filter((l) => l && l.text), T = ALL.slice(0, 8);
  const view = $('#txview'), stage = $('#txs'), sec = $('#logs'); if (!stage || !view) return;
  if (!T.length) { if (sec) sec.style.display = 'none'; return; }
  const N = T.length, F = T.map((_, i) => 142.6 - i * 3.35), GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/_<>';
  const tx = (i) => 'TX-' + String(ALL.length - i).padStart(3, '0');
  $('#rxcount').textContent = pad(ALL.length); $('#rxlast').textContent = fd(T[0].date); $('#txtot').textContent = '/ ' + pad(N);
  const media = (m) => !m ? '' : /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(m) ? `<video class="tc-media" src="${esc(m)}" muted loop playsinline preload="metadata"></video>` : `<img class="tc-media" src="${esc(m)}" alt="" loading="lazy" decoding="async">`;
  stage.innerHTML = T.map((l, i) => `<article class="tx-card"><div class="tc-top mono"><span class="acc">${tx(i)}</span><span>${esc(fd(l.date))}</span><span>${F[i].toFixed(2)} MHz</span><span class="sig"><i></i><i></i><i></i><i></i><i></i></span></div><canvas class="tc-wave"></canvas><p class="tc-msg">${esc(l.text)}</p>${media(l.media)}<div class="tc-foot mono"><span>${pad(i + 1)} / ${pad(N)}</span><span>Swipe or tap →</span></div></article>`).join('');
  const cards = [...stage.children];
  cards.forEach((c, i) => { const sv = 5 - Math.min(3, i % 4); [...c.querySelector('.sig').children].forEach((b, j) => b.classList.toggle('on', j < sv)); });
  const idx = $('#txidx');
  idx.innerHTML = T.map((l, i) => `<li><button data-i="${i}" data-cur="Tune"><span class="id">${tx(i)}</span><span>${esc(fd(l.date))}</span><i class="pr"></i></button></li>`).join('');
  const ib = [...idx.querySelectorAll('button')], prs = ib.map((b) => b.querySelector('.pr'));
  ib.forEach((b) => b.addEventListener('click', () => go(+b.dataset.i)));
  $('#txprev').addEventListener('click', () => go(cur - 1));
  $('#txnext').addEventListener('click', () => go(cur + 1));
  const txn = $('#txn');
  let cur = -1, auto = 0, visible = false, hover = false, drag = null, burst = 0, decRaf = 0, decEl = null;

  function layout() {
    cards.forEach((c, i) => {
      const d = i - cur; c.classList.toggle('front', d === 0);
      if (d < 0) { c.style.transform = 'translate3d(-140px,90px,320px) rotateY(16deg) rotateZ(-7deg)'; c.style.opacity = 0; }
      else { c.style.transform = `translate3d(${d * 34}px,${-d * 30}px,${-d * 120}px)`; c.style.opacity = d > 3 ? 0 : 1 - d * .26; }
      const v = c.querySelector('video'); if (v) { if (d === 0 && visible) v.play().catch(() => {}); else v.pause(); }
    });
  }
  // decode left to right; letters not reached yet are already in place but transparent, so the lines never reflow
  function decode(el, text) {
    cancelAnimationFrame(decRaf); if (decEl && decEl !== el) decEl.textContent = decEl.dataset.t; decEl = el; el.dataset.t = text;
    if (RM) { el.textContent = text; return; }
    const ch = [...text], done = document.createTextNode(''), front = document.createTextNode(''), rest = document.createElement('span'); rest.style.opacity = '0';
    el.textContent = ''; el.append(done, front, rest); let f = 0;
    (function tk() {
      f += 1.5; const a = Math.max(0, Math.ceil(f - 6)), b = Math.min(ch.length, Math.ceil(f));
      done.data = ch.slice(0, a).join(''); front.data = ch.slice(a, b).map((c) => (c === ' ' ? ' ' : GL[(Math.random() * GL.length) | 0])).join(''); rest.textContent = ch.slice(b).join('');
      if (a < ch.length) decRaf = requestAnimationFrame(tk); else el.textContent = text;
    })();
  }
  function go(i) {
    i = (i + N) % N; if (i === cur) return; cur = i; auto = 0; burst = 1.4;
    layout(); decode(cards[i].querySelector('.tc-msg'), T[i].text);
    ib.forEach((b, j) => b.classList.toggle('on', j === i)); prs.forEach((p) => { p.style.width = '0'; });
    txn.textContent = pad(i + 1); txn.classList.remove('roll'); void txn.offsetWidth; txn.classList.add('roll');
  }

  // swipe / tap the front card
  stage.addEventListener('pointerdown', (e) => { const c = e.target.closest('.tx-card.front'); if (!c || e.target.closest('video,a')) return; drag = { c, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; c.setPointerCapture(e.pointerId); c.style.transition = 'none'; });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; drag.c.style.transform = `translate3d(${drag.dx}px,${drag.dy * .3}px,0) rotateZ(${drag.dx * .03}deg)`; });
  const up = () => { if (!drag) return; const { c, dx } = drag; drag = null; c.style.transition = ''; if (dx < -80) go(cur + 1); else if (dx > 80) go(cur - 1); else if (Math.abs(dx) < 5) go(cur + 1); else layout(); };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  let tmx = 0, tmy = 0, rx = 0, ry = 0;
  view.addEventListener('pointerenter', () => { hover = true; });
  view.addEventListener('pointerleave', () => { hover = false; tmx = tmy = 0; });
  view.addEventListener('pointermove', (e) => { const r = view.getBoundingClientRect(); tmx = (e.clientX - r.left) / r.width - .5; tmy = (e.clientY - r.top) / r.height - .5; }, { passive: true });
  addEventListener('keydown', (e) => { if (!visible || !(hover || sec.contains(document.activeElement))) return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); });

  // oscilloscope strip on each card; only the front one animates
  const S = cards.map((c) => { const cv = c.querySelector('canvas'); return { cv, g: cv.getContext('2d'), w: 1, h: 1, dpr: 1 }; });
  function wave(i, t, noise) {
    const o = S[i], g = o.g, SW = o.w, SH = o.h; g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); g.clearRect(0, 0, SW, SH);
    g.strokeStyle = 'rgba(236,238,240,.07)'; g.lineWidth = 1;
    for (let x = 0; x <= SW; x += SW / 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, SH); g.stroke(); }
    for (let y = 0; y <= SH; y += SH / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke(); }
    const mid = SH / 2, A = SH * .3; g.beginPath();
    for (let x = 0; x <= SW; x += 2) { const u = x / SW, env = Math.sin(u * Math.PI); const y = mid + env * A * (Math.sin(u * (18 + i * 3) + t * 5) * .55 + Math.sin(u * (47 + i * 7) - t * 9) * .25 + Math.sin(u * 5 + t * 1.3) * .2 + (Math.random() - .5) * noise); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = 'rgba(255,91,31,.28)'; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#ff7a45'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(236,238,240,.55)'; g.font = '500 10px "IBM Plex Mono",monospace'; g.fillText(noise > .5 ? 'ACQUIRING' : 'CARRIER LOCK', 10, 16);
    g.textAlign = 'right'; g.fillText(F[i].toFixed(2) + ' MHz', SW - 10, 16); g.textAlign = 'left';
  }
  const size = () => { const dpr = Math.min(devicePixelRatio || 1, 2); S.forEach((o, i) => { o.w = o.cv.clientWidth || 1; o.h = o.cv.clientHeight || 1; o.dpr = dpr; o.cv.width = o.w * dpr; o.cv.height = o.h * dpr; wave(i, i, 0); }); };
  addEventListener('resize', size);
  let first = true;
  new IntersectionObserver((es) => es.forEach((e) => {
    visible = e.isIntersecting; layout(); if (!visible || !first) return; first = false; size();
    cards.forEach((c, i) => { c.style.transitionDelay = (i * 90) + 'ms'; }); stage.classList.remove('pre');
    setTimeout(() => cards.forEach((c) => { c.style.transitionDelay = ''; }), 1600);
  }), { threshold: .2 }).observe(view);
  let t = 0, last = performance.now();
  (function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; if (!visible) return; t += dt;
    rx += (-tmy * 8 - rx) * .07; ry += (tmx * 12 - ry) * .07; stage.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    burst += (0 - burst) * Math.min(1, dt * 2); wave(cur, t, burst);
    if (!RM && !hover && !drag && !document.hidden) { auto += dt / 7; if (auto >= 1) go(cur + 1); }
    prs[cur].style.width = Math.min(1, auto) * 100 + '%';
  })(last);
  go(0);
});
