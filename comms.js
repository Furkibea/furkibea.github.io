// comms.js — "Transmissions": the field log as a timeline feed, newest first (up to 8 from content.js via FL.data).
// Every entry is readable at a glance; the newest carries a live signal trace and decodes in when it scrolls into view.
(window.FL = window.FL || {}).data.then((D) => {
  const $ = (s, r) => (r || document).querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fd = (d) => String(d || '').replace(/-/g, '.');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/_<>';
  const ALL = (D.logs || []).filter((l) => l && l.text), T = ALL.slice(0, 8);
  const list = $('#fxlist'), sec = $('#logs'); if (!list) return;
  if (!T.length) { if (sec) sec.style.display = 'none'; const a = $('#secmenu a[href="#logs"]'); if (a) a.remove(); return; }
  $('#rxcount').textContent = pad(ALL.length); $('#rxlast').textContent = fd(T[0].date);
  const tx = (i) => 'TX-' + String(ALL.length - i).padStart(3, '0');
  const media = (m) => !m ? '' : /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(m) ? `<video class="fx-media" src="${esc(m)}" muted loop playsinline preload="metadata"></video>` : `<img class="fx-media" src="${esc(m)}" alt="" loading="lazy" decoding="async">`;
  list.innerHTML = T.map((l, i) => `<li class="fx-it${i ? '' : ' latest'}"><div class="fx-meta mono"><span class="id">${tx(i)}</span><span>${esc(fd(l.date))}</span>${i ? '' : '<span class="fx-new">Latest</span>'}</div>${i ? '' : '<canvas class="fx-wave" aria-hidden="true"></canvas>'}<p class="fx-msg">${esc(l.text)}</p>${media(l.media)}</li>`).join('');
  const items = [...list.children];

  // decode left to right; letters not reached yet are already in place but transparent, so lines never reflow
  function decode(el, text) {
    if (RM) return;
    const ch = [...text], done = document.createTextNode(''), front = document.createTextNode(''), rest = document.createElement('span'); rest.style.opacity = '0';
    el.textContent = ''; el.append(done, front, rest); let f = 0;
    (function tk() {
      f += 1.5; const a = Math.max(0, Math.ceil(f - 6)), b = Math.min(ch.length, Math.ceil(f));
      done.data = ch.slice(0, a).join(''); front.data = ch.slice(a, b).map((c) => (c === ' ' ? ' ' : GL[(Math.random() * GL.length) | 0])).join(''); rest.textContent = ch.slice(b).join('');
      if (a < ch.length) requestAnimationFrame(tk); else el.textContent = text;
    })();
  }

  // entries rise in as they reach the screen; the newest decodes and its trace settles from noise to a clean carrier
  let burst = 1.4;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target); const el = e.target, i = items.indexOf(el);
    setTimeout(() => { el.classList.add('in'); if (i === 0) { decode($('.fx-msg', el), T[0].text); burst = 1.4; } }, RM ? 0 : Math.min(i, 6) * 90);
  }), { threshold: .2 });
  items.forEach((el) => io.observe(el));

  // attachments only play while on screen
  const vids = [...list.querySelectorAll('video')];
  if (vids.length) { const vio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: .3 }); vids.forEach((v) => vio.observe(v)); }

  // live signal trace on the newest entry (animates only while visible)
  const cv = $('.fx-wave', list); if (!cv) return;
  const g = cv.getContext('2d'), MHZ = (139 + (ALL.length % 7) * .53).toFixed(2) + ' MHz'; let W = 1, H = 1, dpr = 1, visible = false, t = 0, last = performance.now();
  function draw(tt, noise) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(236,238,240,.07)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += W / 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += H / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const mid = H / 2, A = H * .3; g.beginPath();
    for (let x = 0; x <= W; x += 2) { const u = x / W, env = Math.sin(u * Math.PI); const y = mid + env * A * (Math.sin(u * 21 + tt * 5) * .55 + Math.sin(u * 54 - tt * 9) * .25 + Math.sin(u * 5 + tt * 1.3) * .2 + (Math.random() - .5) * noise); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = 'rgba(255,91,31,.28)'; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#ff7a45'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(236,238,240,.55)'; g.font = '500 10px "IBM Plex Mono",monospace'; g.fillText(noise > .5 ? 'ACQUIRING' : 'CARRIER LOCK', 10, 16);
    g.textAlign = 'right'; g.fillText(MHZ, W - 10, 16); g.textAlign = 'left';
  }
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth || 1; H = cv.clientHeight || 1; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); draw(t, 0); };
  addEventListener('resize', size); size(); if (document.fonts) document.fonts.ready.then(size);
  new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; })).observe(cv);
  (function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!visible || RM || document.hidden) return; t += dt; burst += (0 - burst) * Math.min(1, dt * 1.6); draw(t, burst);
  })(last);
});
