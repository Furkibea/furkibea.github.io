// ui.js — boot sequence, HUD, reveals, gate, cursor
(function () {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const FL = window.FL || {};

  // ---------- name letters + fit ----------
  const nameEl = $('#name');
  nameEl.innerHTML = [...nameEl.textContent].map((c, i) => `<span style="transition-delay:${i * 45}ms">${c}</span>`).join('');
  function fitName() {
    const box = $('#hname'); nameEl.style.fontSize = '100px';
    const w = nameEl.scrollWidth, avail = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) * 2;
    nameEl.style.fontSize = Math.floor(100 * avail / w * .995) + 'px';
  }
  addEventListener('resize', fitName); fitName();
  if (document.fonts) { document.fonts.ready.then(fitName); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', fitName); document.fonts.load('800 100px Anybody').then(fitName).catch(() => {}); }

  // ---------- word split (rise-in text) ----------
  $$('.split').forEach((el) => {
    let wi = 0; const walk = (n) => { [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) { f.appendChild(document.createTextNode(w)); return; } const o = document.createElement('span'); o.className = 'sw'; const i = document.createElement('span'); i.textContent = w; i.style.transitionDelay = (wi++ * 60) + 'ms'; o.appendChild(i); f.appendChild(o); }); c.replaceWith(f); }
      else if (c.nodeType === 1) walk(c); }); };
    walk(el);
  });

  // ---------- scramble text (section headings, game names) ----------
  // the final text keeps its place invisibly while the scramble runs in an overlay, so nothing around it moves;
  // starting a new scramble on an element cancels the one still running there
  const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/_', RMQ = matchMedia('(prefers-reduced-motion: reduce)'), scrRaf = new WeakMap();
  function scramble(el, text, pace) {
    const fin = text != null ? String(text) : (el.dataset.f || el.textContent); el.dataset.f = fin;
    cancelAnimationFrame(scrRaf.get(el));
    if (RMQ.matches) { el.textContent = fin; return; }
    el.innerHTML = '<span class="scr-f"></span><span class="scr-o" aria-hidden="true"></span>'; el.firstChild.textContent = fin;
    const o = el.lastChild, ch = [...fin], k = pace || 2; let f = 0;
    (function tick() { f++; o.textContent = ch.map((c, i) => c === ' ' ? ' ' : (i < f / k ? c : GL[(Math.random() * GL.length) | 0])).join(''); if (f / k < ch.length) scrRaf.set(el, requestAnimationFrame(tick)); else el.textContent = fin; })();
  }
  FL.scramble = scramble;

  // ---------- reveals ----------
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; const el = e.target; io.unobserve(el);
    if (el.classList.contains('scr')) { scramble(el); el.classList.add('in'); }
    else { const sib = [...el.parentNode.children].filter((c) => c.classList.contains('rv')); el.style.transitionDelay = Math.min(sib.indexOf(el), 10) * 55 + 'ms'; el.classList.add('in'); }
  }), { threshold: .15 });
  let armed = false;
  function arm() { armed = true; $$('.rv,.scr,.split,.kicker').forEach((el) => io.observe(el)); manual(); }
  function manual() { if (!armed) return; $$('.rv:not(.in),.split:not(.in),.kicker:not(.in),.scr:not([data-f])').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight * .9 && r.bottom > 0) { if (el.classList.contains('scr')) scramble(el); else el.classList.add('in'); } }); }
  addEventListener('scroll', manual, { passive: true });

  // ---------- stats ----------
  function count() { $$('.stat').forEach((el, j) => { const to = +el.dataset.to, t0 = performance.now() + j * 120; (function st(now) { const k = Math.max(0, Math.min((now - t0) / 1600, 1)); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(st); })(t0); }); }

  // ---------- profile from content (links, availability, hero numbers) ----------
  (FL.data || Promise.resolve({})).then((D) => {
    const P = D.profile || {}, L = P.links || {}, S = P.stats || {};
    $$('a[data-link]').forEach((a) => { const url = L[a.dataset.link]; if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.hidden = false; } });
    const st = $$('.stat'); [S.games, S.visits, S.years].forEach((v, i) => { if (st[i] && v !== undefined && v !== '' && !isNaN(+v)) st[i].dataset.to = +v; });
    const av = $('#avail'); if (av && P.available === false) av.innerHTML = '<span class="dot off"></span>Booked for now';
  });

  // ---------- boot ----------
  const LOG = ['<b>FURKANLUA STATION OS</b> 4.0', '› mounting hull plates ........ ok', '› pressurising deck 01–03 ..... ok', '› loading pilot  sa.obj', '› calibrating optics .......... ok', '› all systems nominal'];
  const bl = $('#bootlog'), bn = $('#bootn'), bb = $('#bootbar'), bs = $('#bootst');
  let shown = 0, disp = 0, lastB = performance.now(), booted = false; const t0 = performance.now();
  // every visit starts at deck 01: stop the browser restoring a mid-page scroll under the boot screen
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  const bootIv = setInterval(() => boot(performance.now()), 16);
  function boot(now) {
    // watchdog: never hold the page behind the boot screen for more than 12 s, whatever the 3D side is doing
    const el = (now - t0) / 1000, real = el > 12 ? 1 : FL.progress || 0;
    const target = Math.min(real, Math.min(1, el / 1.8));
    const bdt = Math.min((now - lastB) / 1000, .25); lastB = now; disp += (target - disp) * Math.min(1, bdt * 9); if (target >= 1 && disp > .995) disp = 1;
    bn.textContent = String(Math.round(disp * 100)).padStart(3, '0'); bb.style.width = disp * 100 + '%';
    const want = Math.min(LOG.length, Math.floor(el / .28) + 1);
    while (shown < want) { bl.insertAdjacentHTML('beforeend', `<div>${LOG[shown++]}</div>`); }
    if (disp < 1 || el < 1.9) return;
    finishBoot();
  }
  function finishBoot() {
    if (booted) return; booted = true;
    clearInterval(bootIv);
    bs.textContent = 'Access granted';
    const b = $('#boot'); b.classList.add('done');
    setTimeout(() => { b.classList.add('open'); FL.intro && FL.intro(); }, 520);
    setTimeout(() => { fitName(); document.body.classList.add('live'); $('#hname').classList.add('in'); arm(); count(); }, 900);
    setTimeout(() => { b.remove(); document.body.classList.remove('locked'); }, 1900);
  }

  // ---------- HUD / cursor / depth / gate loop ----------
  const secs = $$('[data-sec]');
  const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { $('#secn').textContent = e.target.dataset.sec; $('#secl').textContent = e.target.dataset.lbl; } }), { rootMargin: '-45% 0px -45% 0px' });
  secs.forEach((s) => spy.observe(s));
  const menu = $('#secmenu'), mid = $('#secbtn');
  mid.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('on'); mid.setAttribute('aria-expanded', menu.classList.contains('on')); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#secmenu')) menu.classList.remove('on'); });
  $$('a', menu).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); menu.classList.remove('on'); const t = $(a.getAttribute('href')); if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - 40, behavior: 'smooth' }); }));
  const mags = $$('.btn,.ico,.mag'); let magE = null, magQ = false;
  addEventListener('pointermove', (ev) => { magE = ev; if (magQ) return; magQ = true; requestAnimationFrame(() => { magQ = false; const e = magE; mags.forEach((b) => { if (!b.offsetParent) return; const r = b.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2), d = Math.hypot(x, y), R = Math.max(r.width, r.height) * .9; b.style.transform = d < R ? `translate(${x * .18}px,${y * .25}px)` : ''; }); }); }, { passive: true });
  const tt = $('#totop'); if (tt) tt.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  const clock = $('#clock');
  const tickClock = () => { const s = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()); clock.textContent = 'IST ' + s; };
  tickClock(); setInterval(tickClock, 1000);

  const cur = $('#cur'), lb = $('.lb', cur); let cx = innerWidth / 2, cy = innerHeight / 2, mx = cx, my = cy;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  document.addEventListener('mouseover', (e) => { const a = e.target.closest('a,button,[data-cur]'); cur.classList.toggle('big', !!a); const l = a && a.dataset.cur; cur.classList.toggle('lab', !!l); if (l) lb.textContent = l; });
  const ticks = $$('.depth .tick'), dmk = $('#dmk'), drd = $('#drd'), gate = $('#gate'), gst = $('#gatest'), gbar = $('#gatebar'), cue = $('#cue'), tip = $('#hitip');
  FL.uiTick = loop; FL.skipBoot = finishBoot; (function raf() { requestAnimationFrame(raf); loop(); })();
  function loop() {
    cx += (mx - cx) * .2; cy += (my - cy) * .2; cur.style.transform = `translate(${cx}px,${cy}px)`;
    const S = FL.state || { z: 0, door: 0, hero: 1 };
    if (S.hoverAvatar) { cur.classList.add('big', 'lab'); lb.textContent = 'Say hi'; } else if (lb.textContent === 'Say hi') { cur.classList.remove('big', 'lab'); lb.textContent = ''; }
    const p = Math.min(1, -S.z / 50); dmk.style.top = p * 100 + '%'; ticks.forEach((tk) => tk.classList.toggle('on', Math.abs(parseFloat(tk.style.top) / 100 - p) < .05)); drd.textContent = 'Z ' + (S.z <= 0 ? '−' : '') + Math.abs(S.z).toFixed(2) + ' m';
    const gv = Math.max(0, Math.min(1, 1 - Math.abs(-S.z - 36) / 6.5)) * (scrollY > innerHeight ? 1 : 0);
    gate.style.opacity = gv; gbar.style.width = S.door * 100 + '%';
    const ok = S.door > .04; if (gate.classList.contains('ok') !== ok) { gate.classList.toggle('ok', ok); gst.textContent = ok ? 'Access granted' : 'Locked'; }
    cue.style.opacity = scrollY > 80 ? 0 : 1; tip.style.opacity = scrollY > 40 ? 0 : .9;
  }
})();
