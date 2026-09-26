// discord.js — live Discord profile card. Live data from Lanyard (avatar GIF, decoration, status, server tag, activity);
// banner, badges, bio and connections come from the panel (Discord's public API doesn't expose them).
(function () {
  const FL = window.FL || {}, CDN = 'https://cdn.discordapp.com';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+|discord\.gg\/[\w-]+)/g, (u) => `<a href="${u.startsWith('http') ? u : 'https://' + u}" target="_blank" rel="noopener noreferrer">${u}</a>`).replace(/\n/g, '<br>');
  const ST = { online: ['#23a55a', 'Online'], idle: ['#f0b232', 'Idle'], dnd: ['#f23f43', 'Do Not Disturb'], offline: ['#80848e', 'Offline'] };

  // your 8 profile badges (Nitro, boosts and quests aren't in Discord's public data, so they ship with the site)
  const DEF_BADGES = [['Nitro'], [''], ['Server Booster'], ['Originally known as'], [''], [''], ['Completed a Quest'], ['']].map(([title], i) => ({ icon: 'media/dc-b' + (i + 1) + '.png', title }));
  const DEF_CONNS = [['Furkibea', 'https://github.com/Furkibea'], ['FurkanLua', 'https://www.roblox.com/users/11610042641/profile'], ['FurkanDev', ''], ['Furkan', '']].map(([name, url], i) => ({ icon: 'media/dc-c' + (i + 1) + '.png', name, url }));
  (FL.data || Promise.resolve({})).then((D) => {
    const P = D.profile || {}, L = P.links || {}, K = P.discordCard || {};
    const url = L.discord || '', id = K.userId || (url.match(/users\/(\d+)/) || [])[1] || '', user = String(L.discordUser || '').replace(/^@/, '').trim();
    if (!url && !user) return;
    let live = null, fetchedAt = 0;
    const pop = document.createElement('div'); pop.className = 'dpop card'; pop.id = 'dpop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Discord profile'); pop.setAttribute('data-lenis-prevent', '');
    document.querySelectorAll('.dpop').forEach((p) => p.remove());
    document.body.appendChild(pop);

    function render() {
      const u = live && live.discord_user, st = ST[(live && live.discord_status) || K.status || 'dnd'] || ST.offline;
      const avatar = u && u.avatar ? `${CDN}/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256` : K.avatarLive || '';
      const deco = u && u.avatar_decoration_data ? `${CDN}/avatar-decoration-presets/${u.avatar_decoration_data.asset}.png?size=240&passthrough=true` : K.decoration || '';
      const pg = u && u.primary_guild && u.primary_guild.identity_enabled !== false && u.primary_guild.tag ? u.primary_guild : null;
      const tag = pg ? pg.tag : K.tag, tagIcon = pg && pg.badge ? `${CDN}/guild-tag-badges/${pg.identity_guild_id}/${pg.badge}.png?size=32` : K.tagIcon || '';
      const uname = (u && u.username) || user, gname = (u && (u.global_name || u.display_name)) || K.name || uname;
      const badges = (Array.isArray(K.badges) && K.badges.length >= DEF_BADGES.length ? K.badges : DEF_BADGES).map((b) => ({ t: b.title || '', src: b.icon }));
      const acts = (live && live.activities) || [], cs = acts.find((a) => a.type === 4), play = acts.find((a) => a.type === 0 || a.type === 2);
      const csLine = cs && (cs.state || (cs.emoji && cs.emoji.name)) ? `<p class="dp-cs">${cs.emoji && !cs.emoji.id ? esc(cs.emoji.name) + ' ' : ''}${esc(cs.state || '')}</p>` : '';
      const playLine = play ? `<div class="dp-act"><span class="mono">${play.type === 2 ? 'Listening to' : 'Playing'}</span><b>${esc(play.type === 2 && live.spotify ? live.spotify.song : play.name)}</b>${play.type === 2 && live.spotify ? `<em>${esc(live.spotify.artist)}</em>` : play.details ? `<em>${esc(play.details)}</em>` : ''}</div>` : '';
      const liveAv = !!avatar;
      const avHtml = liveAv
        ? `<div class="dp-avw"><img class="dp-avi" src="${esc(avatar)}" alt="">${deco ? `<img class="dp-deco" src="${esc(deco)}" alt="">` : ''}<i class="dp-st" style="--st:${st[0]}" title="${st[1]}"></i></div>`
        : K.avatar ? `<img class="dp-av" src="${esc(K.avatar)}" alt="">` : '';
      const conns = (Array.isArray(K.connections) && K.connections.length ? K.connections : DEF_CONNS).filter((c) => c && c.name);
      const since = K.since ? new Date(K.since + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      pop.innerHTML = `<div class="dp-ban">${K.banner ? `<img src="${esc(K.banner)}" alt="">` : ''}</div>${avHtml}
<span class="dp-chip mono">Discord${live ? '<i class="dp-live"></i>' : ''}</span><button class="dp-x" aria-label="Close">✕</button>
<div class="dp-body">
<div class="dp-names">${K.nameImg && !(u && u.global_name && u.global_name !== K.name) ? `<img class="dp-nm" src="${esc(K.nameImg)}" alt="${esc(gname)}">` : `<b class="dp-u">${esc(gname)}</b>`}
<div class="dp-id"><span>${esc(uname)}</span>${tag ? `<i class="dp-tag">${tagIcon ? `<img src="${esc(tagIcon)}" alt="">` : ''}${esc(tag)}</i>` : ''}</div>
${badges.length ? `<div class="dp-bdg">${badges.map((b, i) => `<img src="${esc(b.src)}" alt="${esc(b.t)}"${b.t ? ` title="${esc(b.t)}"` : ''} style="--i:${i}" >`).join('')}</div>` : ''}</div>
${csLine}${playLine}
<div class="dp-panel">
${K.bio ? `<div class="dp-sec"><h4 class="mono">About me</h4><p class="dp-bio">${linkify(K.bio)}</p></div>` : ''}
${since ? `<div class="dp-sec"><h4 class="mono">Member since</h4><p>${since}</p></div>` : ''}
${conns.length ? `<div class="dp-sec"><h4 class="mono">Connections</h4><div class="dp-con">${conns.map((c) => `<${c.url ? `a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer"` : 'span'} class="dp-ci">${c.icon ? `<img src="${esc(c.icon)}" alt="">` : ''}<span>${esc(c.name)}</span>${c.url ? '<em>↗</em>' : ''}</${c.url ? 'a' : 'span'}>`).join('')}</div></div>` : ''}
</div>
<div class="dp-a">${user ? '<button class="btn sm dp-c" data-cur="Copy">Copy username</button>' : ''}${url ? `<a class="cb wide" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open profile ↗</a>` : ''}${id ? `<a class="cb wide" href="discord://-/users/${id}">Open in app</a>` : ''}${L.discordServer ? `<a class="cb wide dp-sv" href="${esc(L.discordServer)}" target="_blank" rel="noopener noreferrer">Join the server ↗</a>` : ''}</div>
<p class="dp-n">discord.com blocked where you are? Use <b>Open in app</b>${user ? ', or add <b>' + esc(user) + '</b> from Friends → Add Friend' : ''}.</p>
</div>`;
    }

    function pull() {
      if (!id || Date.now() - fetchedAt < 60000) return Promise.resolve();
      fetchedAt = Date.now();
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 5000);
      return fetch('https://api.lanyard.rest/v1/users/' + id, { signal: ac.signal }).then((r) => r.json()).then((j) => { if (j && j.success && j.data) { live = j.data; render(); if (anchor) place(anchor); } }).catch(() => {}).finally(() => clearTimeout(t));
    }
    render(); pull();

    let anchor = null, sy = 0;
    const close = () => { pop.classList.remove('on'); anchor = null; };
    function place(a) {
      if (innerWidth < 600) { pop.classList.add('sheet'); pop.style.cssText = ''; return; }
      pop.classList.remove('sheet'); const w = 340; pop.style.width = w + 'px';
      const r = a.getBoundingClientRect(), h = Math.min(pop.scrollHeight, innerHeight - 24);
      pop.style.left = Math.min(Math.max(12, r.left), innerWidth - w - 12) + 'px';
      pop.style.top = (r.top - h - 12 > 12 ? r.top - h - 12 : Math.max(12, Math.min(r.bottom + 12, innerHeight - h - 12))) + 'px';
    }
    function open(a) { anchor = a; sy = scrollY; place(a); pop.scrollTop = 0; pop.classList.add('on'); const cb = pop.querySelector('.dp-c'); if (cb) cb.focus({ preventScroll: true }); pull(); }
    pop.addEventListener('click', async (e) => {
      if (e.target.closest('.dp-x')) { e.stopPropagation(); close(); return; }
      const cb = e.target.closest('.dp-c'); if (!cb) return;
      try { await navigator.clipboard.writeText(user); } catch (x) { const ta = document.createElement('textarea'); ta.value = user; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (y) {} ta.remove(); }
      cb.textContent = 'Copied ✓'; setTimeout(() => { cb.textContent = 'Copy username'; }, 1800);
    });
    const purge = () => document.querySelectorAll('.dpop').forEach((p) => { if (p !== pop) p.remove(); });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-link="discord"]');
      if (a) { e.preventDefault(); e.stopImmediatePropagation(); purge(); if (anchor === a) close(); else open(a); return; }
      if (anchor && !pop.contains(e.target)) close();
    }, true);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && anchor) close(); });
    addEventListener('scroll', () => { if (anchor && Math.abs(scrollY - sy) > 60) close(); }, { passive: true });
  });
})();
