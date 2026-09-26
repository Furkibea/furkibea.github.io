// admin.js — content panel UI: clips, worlds, transmissions, profile · preview · publish
(function () {
  const A = window.FLA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cssu = (u) => String(u || '').replace(/"/g, '%22').replace(/'/g, '%27').replace(/\\/g, '%5C').replace(/[\n\r]/g, '');
  const bg = (u) => (u ? `background-image:url('${cssu(u)}')` : '');
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (s) => { s = Math.max(0, +s || 0); return pad(Math.floor(s / 60)) + ':' + pad(Math.floor(s % 60)); };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const fdate = (d) => String(d || '').replace(/-/g, '.');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pretty = (n) => String(n || '').replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) || 'Untitled clip';
  const isVidPath = (p) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(p || '');
  const MB = 1048576;
  const I_PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 4.5v15l13-7.5z"></path></svg>';
  const I_PAUSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"></path></svg>';
  const SW = ['#ff5b1f', '#8c7bff', '#5ec8ff', '#2fb5a3', '#4fe39a', '#e8d36a', '#ff8a4c', '#ff6fae', '#b36bff', '#7fd8ff'];
  const COL = {
    reels: { label: 'Footage', one: 'Clip', cap: 16, fresh: () => ({ id: A.uid('r'), title: 'Untitled clip', src: '', poster: '', date: today(), dur: 0 }) },
    worlds: { label: 'Games', one: 'Game', fresh: () => ({ id: A.uid('w'), name: 'New game', studio: '', genre: '', desc: '', visits: 0, ccu: 0, color: SW[1], thumb: '', url: '', placeId: '', universeId: 0, favorites: 0, maxPlayers: 0, thumbs: [], status: 'live', release: '' }) },
    logs: { label: 'Transmissions', one: 'Transmission', cap: 8, fresh: () => ({ id: A.uid('t'), date: today(), text: '', media: '' }) },
  };
  const S = { tab: 'reels', sel: {}, sizes: {}, stale: false, busy: false, draft: null, base: null, live: null, stamp: '', local: null };
  // publishing is ready when the panel runs through admin-local.py (git push, no token) or a GitHub token is saved in this browser
  const pubReady = () => !!S.local || A.ghReady(A.ghCfg());
  const pane = $('#pane');
  const list = () => (S.draft && S.draft[S.tab]) || [];
  const cur = () => (COL[S.tab] ? list().find((x) => x.id === S.sel[S.tab]) : null);
  const stateOf = () => A.diff(S.draft, S.base).state;

  function norm(d) {
    d = d && typeof d === 'object' ? d : {};
    const p = d.profile || {};
    const out = { version: 1, updated: d.updated || '', profile: { available: p.available !== false, links: Object.assign({ discord: '', x: '', roblox: '', github: '', discordUser: '', discordServer: '' }, p.links || {}), stats: Object.assign({ games: 0, visits: 0, years: 0 }, p.stats || {}), discordCard: Object.assign({ banner: '', bio: '', tag: '', since: '' }, p.discordCard || {}) } };
    Object.keys(COL).forEach((k) => { out[k] = (Array.isArray(d[k]) ? d[k] : []).filter((x) => x && typeof x === 'object').map((x) => Object.assign(COL[k].fresh(), x, { id: x.id || A.uid(k[0]) })); });
    return out;
  }

  // ---------- saving ----------
  let saveT = 0;
  function status(s) { const el = $('#save'); el.className = 'save mono ' + (s || ''); $('#savet').textContent = s === 'saving' ? 'Saving…' : s === 'err' ? 'Not saved — browser storage is blocked' : 'Saved in this browser · ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  async function persist() { clearTimeout(saveT); saveT = 0; try { await A.put('kv', 'draft', S.draft); await A.put('kv', 'base', S.base); status(''); } catch (e) { status('err'); } }
  function touch() { status('saving'); clearTimeout(saveT); saveT = setTimeout(persist, 180); chrome(); }

  // ---------- header ----------
  function chrome() {
    const d = A.diff(S.draft, S.base);
    $$('.tab').forEach((b) => { const k = b.dataset.tab, n = $('.n', b); b.classList.toggle('on', k === S.tab); b.setAttribute('aria-current', k === S.tab ? 'page' : 'false'); if (n && S.draft[k]) n.textContent = S.draft[k].length; b.classList.toggle('chg', !!d.by[k]); });
    $('#chg').textContent = d.count; $('#pub').classList.toggle('has', d.count > 0);
    $('#chgtxt').textContent = d.count ? d.count + ' unpublished change' + (d.count === 1 ? '' : 's') : 'Everything is live';
  }

  // ---------- panes ----------
  function renderPane() {
    $('#banner').innerHTML = S.stale ? '<div class="banner mono"><span>The live site has a newer version than this draft. It was published from another device or uploaded by hand.</span><button class="cb wide" data-act="loadlive">Load live version</button><button class="cb wide" data-act="keepdraft">Keep my draft</button></div>' : '';
    if (COL[S.tab]) { pane.innerHTML = '<div class="split"><div class="lcol" id="lcol"></div><div class="rcol" id="rcol"></div></div>'; renderList(); renderEditor(); }
    else pane.innerHTML = S.tab === 'profile' ? profileHTML() : settingsHTML();
  }
  function renderList() {
    const el = $('#lcol'); if (!el) return; const k = S.tab, c = COL[k], L = list(), st = stateOf();
    const top = k === 'reels'
      ? '<label class="drop" id="adddrop"><input type="file" accept="video/*,.mov,.m4v" multiple hidden data-add="reels"><span class="disp">Drop this week\'s clip</span><span class="dm mono">MP4, WEBM or MOV — or click to browse. Title, length and poster are filled in for you.</span></label>'
      : `<button class="drop sm" data-act="add"><span class="disp">+ ${k === 'worlds' ? 'Add a game' : 'New transmission'}</span><span class="dm mono">${k === 'worlds' ? 'New games go to the top. Paste the Roblox link to pull in images and live numbers.' : 'Dated today. The site shows the latest ' + c.cap + '.'}</span></button>`;
    el.innerHTML = top + `<div class="lh mono"><span>${c.label} · ${pad(L.length)}</span><span>${L.length > 1 ? 'Drag to reorder' : ''}</span></div>` +
      (L.length ? '<ol class="items">' + L.map((x, i) => rowHTML(k, x, i, st[x.id], L.length) + (c.cap && i === c.cap - 1 && L.length > c.cap ? '<li class="capline mono">Below this line: saved, not shown on the site</li>' : '')).join('') + '</ol>' : '');
  }
  function renderRow(x) { const row = $(`.it[data-id="${CSS.escape(x.id)}"]`); if (!row) return; const L = list(); row.outerHTML = rowHTML(S.tab, x, L.indexOf(x), stateOf()[x.id], L.length); }
  function rowHTML(k, x, i, s, n) {
    let th, t, sub;
    if (k === 'reels') { th = `<span class="th" style="${bg(A.resolve(x.poster))}">${x.poster ? '' : 'NO POSTER'}</span>`; t = x.title || 'Untitled clip'; sub = [fdate(x.date), x.dur ? fmt(x.dur) : '', x.src ? '' : 'needs a video'].filter(Boolean).join(' · '); }
    else if (k === 'worlds') { th = `<span class="th w${x.thumb || (x.thumbs || []).length ? ' img' : ''}" style="--pc:${esc(x.color)};${bg(A.resolve(x.thumb) || (x.thumbs || [])[0])}"><i>${pad(i + 1)}</i></span>`; t = x.name || 'Untitled game'; sub = [x.studio, (x.status === 'soon' ? 'coming soon' : (+x.visits || 0) + 'M visits' + (x.universeId ? ' · live' : ''))].filter(Boolean).join(' · '); }
    else { th = `<span class="th tx">TX-${String(n - i).padStart(3, '0')}</span>`; t = x.text || 'Empty transmission'; sub = [fdate(x.date), x.media ? 'attachment' : ''].filter(Boolean).join(' · '); }
    const chip = s === 'new' ? '<span class="chip new">New</span>' : s === 'ed' ? '<span class="chip ed">Edited</span>' : '';
    return `<li class="it${x.id === S.sel[k] ? ' on' : ''}${COL[k].cap && i >= COL[k].cap ? ' off' : ''}" draggable="true" data-id="${esc(x.id)}"><span class="grip" aria-hidden="true">⋮⋮</span>${th}<span class="tt"><b>${esc(t)}</b><span class="sub mono">${esc(sub)}</span></span>${chip}</li>`;
  }
  function head(k, x, i, n, s) {
    const chip = s === 'new' ? '<span class="chip new">New</span>' : s === 'ed' ? '<span class="chip ed">Edited</span>' : '<span class="chip live">Live</span>';
    const need = k === 'reels' && !x.src ? 'Needs a video' : k === 'logs' && !x.text ? 'Needs a message' : k === 'worlds' && !x.name ? 'Needs a name' : COL[k].cap && i >= COL[k].cap ? 'Hidden on site' : '';
    return `<div class="ed-h"><div><span class="mono acc">${COL[k].one} ${pad(i + 1)} / ${pad(n)}</span>${chip}${need ? `<span class="chip">${need}</span>` : ''}</div><div class="tools"><button class="cb" data-act="up" aria-label="Move up"${i ? '' : ' disabled'}>↑</button><button class="cb" data-act="down" aria-label="Move down"${i < n - 1 ? '' : ' disabled'}>↓</button><button class="cb wide danger" data-act="del">Delete</button></div></div>`;
  }
  function renderEditor() {
    const r = $('#rcol'); if (!r) return; const L = list(), x = cur(), i = L.indexOf(x);
    if (!x) { r.innerHTML = `<div class="empty"><span class="disp">${S.tab === 'reels' ? 'No clips yet' : S.tab === 'worlds' ? 'No games yet' : 'No transmissions yet'}</span><span class="mono">${S.tab === 'reels' ? 'Drop a video on the left to add your first clip.' : 'Use the button on the left to add one.'}</span></div>`; return; }
    const s = stateOf()[x.id];
    r.innerHTML = '<div class="ed">' + (S.tab === 'reels' ? reelEd(x, i, L.length, s) : S.tab === 'worlds' ? worldEd(x, i, L.length, s) : logEd(x, i, L.length, s)) + '</div>';
    if (S.tab === 'reels') bindVideo(x);
  }
  function reelEd(x, i, n, s) {
    const size = S.sizes[x.src], local = A.hasLocal(x.src) && !A.refs(S.base).has(x.src);
    const info = !x.src ? 'No video yet.' : local ? `${x.src.split('/').pop()} · ${A.mb(size)} · uploads when you publish` : `${x.src} · live`;
    const warn = local && size > 95 * MB ? '<p class="warn bad mono">This file is over GitHub\'s 100 MB limit. Trim or compress it, or host it elsewhere and paste its link below.</p>' : local && size > 25 * MB ? `<p class="warn mono">Large file (${A.mb(size)}). Clips under 25 MB start faster for visitors.</p>` : '';
    return head('reels', x, i, n, s) +
      `<div class="med"><div class="vbox">${x.src ? `<video id="edv" src="${esc(A.resolve(x.src))}" muted playsinline preload="auto"${x.poster ? ` poster="${esc(A.resolve(x.poster))}"` : ''}></video>` : '<label class="drop in-box"><input type="file" accept="video/*,.mov,.m4v" hidden data-media="src"><span class="disp">Add the video</span><span class="dm mono">Drop a file here or click to browse</span></label>'}</div>` +
      (x.src ? `<div class="scrub"><button class="cb" data-act="vplay" aria-label="Play or pause">${I_PLAY}</button><input type="range" id="edscrub" min="0" max="1000" value="0" aria-label="Scrub through the clip"><span class="mono" id="edt">00:00 / ${fmt(x.dur)}</span></div><div class="brow"><button class="cb wide" data-act="frame">Use this frame as poster</button><label class="cb wide">Upload poster<input type="file" accept="image/*" hidden data-media="poster"></label><label class="cb wide">Replace video<input type="file" accept="video/*,.mov,.m4v" hidden data-media="src"></label></div>` : '') + '</div>' +
      `<div class="prow"><span class="pv" id="pv" style="${bg(A.resolve(x.poster))}">${x.poster ? '' : '<i class="mono">No poster</i>'}</span><p class="mono mute">Poster — shown on the card until the clip starts.<br>${esc(info)}</p></div>${warn}` +
      `<label class="fld"><span class="mono">Title <i class="cnt">${(x.title || '').length} / 70</i></span><input class="in" data-f="title" maxlength="70" value="${esc(x.title)}"></label>` +
      `<div class="g2"><label class="fld"><span class="mono">Date</span><input class="in" type="date" data-f="date" value="${esc(x.date)}"></label><label class="fld"><span class="mono">Length</span><input class="in" id="edlen" value="${x.dur ? fmt(x.dur) : '—'}" readonly tabindex="-1"></label></div>` +
      `<label class="fld"><span class="mono">Video source</span><input class="in" data-f="src" value="${esc(x.src)}" placeholder="Upload above, or paste https://…/clip.mp4" spellcheck="false"><em class="hint mono">Uploads are stored in media/. A direct link to an .mp4 hosted elsewhere also works.</em></label>`;
  }
  function wPrev(x, i) {
    const th = A.resolve(x.thumb) || (x.thumbs || [])[0] || '';
    return `<div class="wprev" style="--pc:${esc(x.color)}"><div class="wcov${th ? ' img' : ''}" style="${bg(th)}"><span class="big">${pad(i + 1)}</span><span class="gn mono">${esc(x.genre || 'Genre')}</span></div><b class="wn">${esc(x.name || 'Name')}</b><p>${esc(x.desc || 'One line about the game.')}</p><div class="wst"><span><em class="mono">Visits</em>${esc(String(+x.visits || 0))}M+</span><span><em class="mono">Playing now</em>${(+x.ccu || 0).toLocaleString('en-US')}</span></div></div>`;
  }
  function worldEd(x, i, n, s) {
    const hex = /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '#8c7bff';
    return head('worlds', x, i, n, s) +
      `<div class="wgrid">${wPrev(x, i)}<div class="wside"><label class="drop sm"><input type="file" accept="image/*" hidden data-media="thumb"><span class="disp">${x.thumb ? 'Replace thumbnail' : 'Add thumbnail'}</span><span class="dm mono">16:10 works best. Large images are resized for you.</span></label>${x.thumb ? '<button class="cb wide danger" data-act="rmthumb">Remove thumbnail</button>' : ''}` +
      `<div class="fld"><span class="mono">Accent colour</span><div class="sw">${SW.map((c) => `<button class="swb${c === x.color ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}<label class="swb cust" style="background:${esc(hex)}" title="Custom colour"><input type="color" data-f="color" value="${esc(hex)}" aria-label="Custom colour"></label></div><em class="hint mono">Tints the card and the hangar lights.</em></div></div></div>` +
      `<label class="fld"><span class="mono">Name <i class="cnt">${(x.name || '').length} / 40</i></span><input class="in" data-f="name" maxlength="40" value="${esc(x.name)}"></label>` +
      `<div class="g2"><label class="fld"><span class="mono">Studio</span><input class="in" data-f="studio" maxlength="40" value="${esc(x.studio)}"></label><label class="fld"><span class="mono">Genre</span><input class="in" data-f="genre" maxlength="32" placeholder="Simulator · RPG" value="${esc(x.genre)}"></label></div>` +
      `<label class="fld"><span class="mono">Description <i class="cnt">${(x.desc || '').length} / 110</i></span><textarea class="in" data-f="desc" maxlength="110" rows="2">${esc(x.desc)}</textarea></label>` +
      `<div class="g2"><label class="fld"><span class="mono">Visits (millions)</span><input class="in" type="number" min="0" step="0.1" data-f="visits" data-num value="${esc(x.visits)}"></label><label class="fld"><span class="mono">Playing now (CCU)</span><input class="in" type="number" min="0" step="1" data-f="ccu" data-num value="${esc(x.ccu)}"></label></div>` +
      `<div class="g2"><div class="fld"><span class="mono">Status</span><div class="seg"><button class="cb wide${x.status !== 'soon' ? ' on' : ''}" data-act="stlive">Live</button><button class="cb wide${x.status === 'soon' ? ' on' : ''}" data-act="stsoon">Coming soon</button></div></div><label class="fld"><span class="mono">Release date</span><input class="in" type="date" data-f="release" value="${esc(x.release)}"${x.status === 'soon' ? '' : ' disabled'}></label></div><em class="hint mono">${x.status === 'soon' ? 'Coming soon: the site shows a live countdown to the release date (or "In development" without one) and a Discord button when there is no Roblox link.' : 'Live: players, visits and images come from Roblox automatically.'}</em><div class="fld"><span class="mono">Roblox game link</span><input class="in" type="url" data-f="url" placeholder="https://www.roblox.com/games/…" value="${esc(x.url)}" spellcheck="false"><div class="brow"><button class="btn sm" data-act="rbx">Fetch from Roblox</button></div><em class="hint mono">${x.universeId ? 'Linked to Roblox · ' + (x.thumbs || []).length + ' images. The site reads live players, visits and images by itself; the numbers here are only a fallback.' : 'Paste the game link and press Fetch. Images, studio and live numbers are pulled in for you.'}</em></div>`;
  }
  function logEd(x, i, n, s) {
    const m = A.resolve(x.media);
    return head('logs', x, i, n, s) +
      `<label class="fld"><span class="mono">Message <i class="cnt">${(x.text || '').length} / 140</i></span><textarea class="in big" data-f="text" maxlength="140" rows="3" placeholder="What did you build this week?">${esc(x.text)}</textarea></label>` +
      `<div class="g2"><label class="fld"><span class="mono">Date</span><input class="in" type="date" data-f="date" value="${esc(x.date)}"></label><div class="fld"><span class="mono">Signal</span><input class="in" value="TX-${String(n - i).padStart(3, '0')}" readonly tabindex="-1"></div></div>` +
      `<div class="fld"><span class="mono">Attachment (optional)</span>${x.media ? `<div class="att">${isVidPath(x.media) ? `<video src="${esc(m)}" muted loop playsinline autoplay></video>` : `<img src="${esc(m)}" alt="">`}<button class="cb wide danger" data-act="rmmedia">Remove attachment</button></div>` : '<label class="drop sm"><input type="file" accept="image/*,video/*" hidden data-media="media"><span class="disp">Add image or clip</span><span class="dm mono">Shown under the message on its card.</span></label>'}</div>`;
  }
  function profileHTML() {
    const P = S.draft.profile, tot = Math.round(S.draft.worlds.reduce((a, w) => a + (+w.visits || 0), 0));
    return `<div class="pgrid">
<section class="card"><h3 class="mono">Availability</h3><label class="tog"><input type="checkbox" data-p="available"${P.available ? ' checked' : ''}><span class="sl"></span><span class="tl">${P.available ? 'Open for work' : 'Booked for now'}</span></label><p class="hint mono">Shown in the top-right corner of the site.</p></section>
<section class="card"><h3 class="mono">Links</h3><label class="fld"><span class="mono">Discord invite or profile</span><input class="in" type="url" data-p="links.discord" value="${esc(P.links.discord)}" placeholder="https://discord.gg/…" spellcheck="false"></label><label class="fld"><span class="mono">Discord username</span><input class="in" data-p="links.discordUser" value="${esc(P.links.discordUser)}" placeholder="yourname" spellcheck="false"><em class="hint mono">Shown in the Discord card with a Copy button, for visitors where discord.com is blocked.</em></label><label class="fld"><span class="mono">Discord server invite</span><input class="in" type="url" data-p="links.discordServer" value="${esc(P.links.discordServer)}" placeholder="https://discord.gg/…" spellcheck="false"></label><label class="fld"><span class="mono">X</span><input class="in" type="url" data-p="links.x" value="${esc(P.links.x)}" placeholder="https://x.com/…" spellcheck="false"></label><label class="fld"><span class="mono">Roblox profile</span><input class="in" type="url" data-p="links.roblox" value="${esc(P.links.roblox)}" placeholder="https://www.roblox.com/users/…" spellcheck="false"></label><label class="fld"><span class="mono">GitHub</span><input class="in" type="url" data-p="links.github" value="${esc(P.links.github)}" placeholder="https://github.com/…" spellcheck="false"></label><p class="hint mono">Used by the hero buttons and the contact list. Discord: https://discord.com/users/ followed by your user ID opens your profile. An empty GitHub link hides that row.</p></section>
<section class="card"><h3 class="mono">Discord card</h3><label class="fld"><span class="mono">Banner (GIF, image or URL)</span><input class="in" data-p="discordCard.banner" value="${esc(P.discordCard.banner)}" placeholder="media/banner.gif or https://…" spellcheck="false"><em class="hint mono">Discord doesn't share banners publicly. Put your banner GIF in the media folder and write its path here, e.g. media/banner.gif.</em></label><label class="fld"><span class="mono">About me</span><textarea class="in" rows="3" data-p="discordCard.bio">${esc(P.discordCard.bio)}</textarea></label><div class="g2"><label class="fld"><span class="mono">Server tag</span><input class="in" data-p="discordCard.tag" value="${esc(P.discordCard.tag)}" maxlength="4"></label><label class="fld"><span class="mono">Member since</span><input class="in" type="date" data-p="discordCard.since" value="${esc(P.discordCard.since)}"></label></div><p class="hint mono">Avatar GIF, avatar decoration, online status, server tag and what you're playing update live once you join discord.gg/lanyard.</p></section>
<section class="card"><h3 class="mono">Hero numbers</h3><div class="g3"><label class="fld"><span class="mono">Games +</span><input class="in" type="number" min="0" step="1" data-p="stats.games" data-num value="${esc(P.stats.games)}"></label><label class="fld"><span class="mono">Visits M+</span><input class="in" type="number" min="0" step="1" data-p="stats.visits" data-num value="${esc(P.stats.visits)}"></label><label class="fld"><span class="mono">Years +</span><input class="in" type="number" min="0" step="1" data-p="stats.years" data-num value="${esc(P.stats.years)}"></label></div><div class="brow"><button class="cb wide" data-act="sumvis">Use total from Games · ${tot}M</button></div></section>
</div>`;
  }
  function settingsHTML() {
    const g = A.ghCfg();
    const local = S.local ? `<section class="card wide"><h3 class="mono">Publishing from this PC · ready</h3><p class="p">This panel was opened with <b>admin-ac.bat</b>, so Publish runs <b>git push</b> with the GitHub login already on this computer. No token needed: press Publish and the site updates in about a minute.</p><p class="hint mono">${esc(S.local.owner + '/' + S.local.repo)} · branch ${esc(S.local.branch)}</p></section>` : '';
    return `<div class="pgrid">${local}
<section class="card wide"><h3 class="mono">${S.local ? 'Publishing from other devices' : 'One-click publishing'}</h3><ol class="steps"><li><b>On your PC:</b> double-click <b>admin-ac.bat</b> in the site folder. The panel opens and Publish pushes with your own git login, no token.</li><li><b>From any browser:</b> save a GitHub token here once. <a class="lnk" href="${esc(A.tokenURL(g))}" target="_blank" rel="noopener noreferrer">Create the token on GitHub ↗</a> (the form opens pre-filled), choose <b>Only select repositories → ${esc(g.repo || 'your site repository')}</b>, press <b>Generate token</b>, then paste it below. The connection is tested automatically.</li></ol></section>
<section class="card"><h3 class="mono">Repository</h3><div class="g2"><label class="fld"><span class="mono">Owner</span><input class="in" data-g="owner" value="${esc(g.owner)}" placeholder="your-github-name" spellcheck="false"></label><label class="fld"><span class="mono">Repository</span><input class="in" data-g="repo" value="${esc(g.repo)}" placeholder="portfolio" spellcheck="false"></label></div><div class="g2"><label class="fld"><span class="mono">Branch</span><input class="in" data-g="branch" value="${esc(g.branch || 'main')}" spellcheck="false"></label><label class="fld"><span class="mono">Site folder in repo</span><input class="in" data-g="path" value="${esc(g.path)}" placeholder="empty = repository root" spellcheck="false"></label></div><label class="fld"><span class="mono">Token</span><input class="in" type="password" data-g="token" value="${esc(g.token)}" autocomplete="off" placeholder="github_pat_…" spellcheck="false"><em class="hint mono">Stored only in this browser. Never share it.</em></label><div class="brow"><button class="btn sm" data-act="ghtest">Test connection</button>${g.token ? '<button class="cb wide danger" data-act="ghforget">Forget token</button>' : ''}</div><p class="res mono" id="ghres"></p></section>
<section class="card"><h3 class="mono">Other hosting</h3><p class="p">Download your changes as a package and copy its contents into the site folder on your host.</p><div class="brow"><button class="cb wide" data-act="zip">Download package</button><button class="cb wide" data-act="cjs">Download content.js</button></div><h3 class="mono gap">Draft</h3><p class="p">Your draft is saved in this browser until you publish. Discarding it loads the live version again.</p><div class="brow"><button class="cb wide danger" data-act="discard">Discard draft</button></div></section>
</div>`;
  }

  // ---------- clip editor video ----------
  function bindVideo(x) {
    const v = $('#edv'); if (!v) return; const sc = $('#edscrub'), tl = $('#edt'), pb = $('[data-act="vplay"]');
    const upd = () => { const d = isFinite(v.duration) ? v.duration : x.dur; tl.textContent = fmt(v.currentTime) + ' / ' + fmt(d); if (document.activeElement !== sc && d) sc.value = v.currentTime / d * 1000; };
    v.addEventListener('timeupdate', upd); v.addEventListener('seeked', upd);
    v.addEventListener('loadedmetadata', () => { if (isFinite(v.duration) && Math.abs((x.dur || 0) - v.duration) > .2) { x.dur = Math.round(v.duration * 10) / 10; touch(); renderRow(x); const l = $('#edlen'); if (l) l.value = fmt(x.dur); } upd(); });
    v.addEventListener('play', () => { pb.innerHTML = I_PAUSE; }); v.addEventListener('pause', () => { pb.innerHTML = I_PLAY; });
    sc.addEventListener('input', () => { if (isFinite(v.duration)) { v.pause(); v.currentTime = sc.value / 1000 * v.duration; } });
    v.addEventListener('click', () => (v.paused ? v.play() : v.pause()));
  }

  // ---------- media ----------
  async function setMedia(x, field, blob) {
    const p = `media/${x.id}-${field}-${Date.now().toString(36)}.${A.ext(blob, blob.name)}`;
    await A.saveMedia(p, blob); S.sizes[p] = blob.size; x[field] = p; touch(); return p;
  }
  const movWarn = (f) => { if (/\.mov$/i.test(f.name || '') || f.type === 'video/quicktime') toast('MOV files may not play in Firefox. Export as MP4 if you can.'); };
  async function probe(x) {
    try { const r = await A.probeVideo(A.resolve(x.src)); if (r.dur) x.dur = Math.round(r.dur * 10) / 10; if (r.poster) await setMedia(x, 'poster', r.poster); touch(); }
    catch (e) { toast('Could not read that video (' + e.message + '). MP4 with H.264 works in every browser.'); }
  }
  async function addReels(files) {
    const vids = [...files].filter(A.isVideo); if (!vids.length) { toast('Those files are not videos.'); return; }
    if (S.tab !== 'reels') go('reels');
    for (const f of vids.reverse()) {
      const x = COL.reels.fresh(); x.title = pretty(f.name);
      S.draft.reels.unshift(x); S.sel.reels = x.id;
      await setMedia(x, 'src', f); renderList(); renderEditor(); toast('Reading ' + f.name + '…');
      await probe(x); movWarn(f);
    }
    renderList(); renderEditor(); chrome();
    toast(vids.length > 1 ? vids.length + ' clips added. Check their titles.' : 'Clip added. Give it a title.');
    const t = $('[data-f="title"]'); if (t) { t.focus(); t.select(); }
  }
  async function onFiles(input, files) {
    files = [...(files || [])]; if (!files.length) return;
    if (input.dataset.add === 'reels') return addReels(files);
    const field = input.dataset.media, x = cur(), f = files[0]; if (!field || !x) return;
    try {
      if (field === 'src') { if (!A.isVideo(f)) return toast('That file is not a video.'); await setMedia(x, 'src', f); movWarn(f); await probe(x); }
      else if (field === 'poster' || field === 'thumb') { if (!A.isImage(f)) return toast('Pick an image file.'); await setMedia(x, field, await A.compressImage(f, 1280)); }
      else if (field === 'media') { if (A.isImage(f)) await setMedia(x, 'media', await A.compressImage(f, 1600)); else if (A.isVideo(f)) { await setMedia(x, 'media', f); movWarn(f); } else return toast('Pick an image or a video.'); }
      renderList(); renderEditor();
    } catch (e) { toast(e.message || 'Could not add that file.'); }
  }
  async function cleanup(keepVideos) { const refs = A.refs(S.draft); for (const [p] of await A.all()) if (!refs.has(p) || (!keepVideos && isVidPath(p))) { await A.dropMedia(p); delete S.sizes[p]; } }

  // ---------- actions ----------
  function armed(t, label) { if (t.classList.contains('arm')) return true; const old = t.textContent; t.classList.add('arm'); t.textContent = label || 'Click again to confirm'; setTimeout(() => { if (t.isConnected) { t.classList.remove('arm'); t.textContent = old; } }, 2800); return false; }
  function move(d) { const L = list(), i = L.findIndex((x) => x.id === S.sel[S.tab]), j = i + d; if (i < 0 || j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; touch(); renderList(); renderEditor(); }
  function adopt(c) { S.draft = clone(c); S.base = clone(c); S.stale = false; Object.keys(COL).forEach((k) => { S.sel[k] = (S.draft[k][0] || {}).id; }); }
  const ACT = {
    add() { const k = S.tab, x = COL[k].fresh(); if (k === 'worlds') x.color = SW[(S.draft.worlds.length + 1) % SW.length]; list().unshift(x); S.sel[k] = x.id; touch(); renderList(); renderEditor(); const f = $(k === 'logs' ? '[data-f="text"]' : '[data-f="name"]'); if (f) { f.focus(); if (f.select) f.select(); } },
    up() { move(-1); }, down() { move(1); },
    del(t) {
      if (!armed(t)) return; const k = S.tab, L = list(), i = L.findIndex((x) => x.id === S.sel[k]); if (i < 0) return;
      const [x] = L.splice(i, 1); S.sel[k] = (L[i] || L[i - 1] || {}).id; touch(); renderList(); renderEditor();
      toast(COL[k].one + ' deleted.', { label: 'Undo', fn: () => { L.splice(i, 0, x); S.sel[k] = x.id; touch(); if (S.tab === k) { renderList(); renderEditor(); } } });
    },
    vplay() { const v = $('#edv'); if (v) { if (v.paused) v.play(); else v.pause(); } },
    async frame() {
      const v = $('#edv'), x = cur(); if (!v || v.readyState < 2) { toast('Let the video load first.'); return; }
      try { const b = await A.grabFrame(v); if (!b) throw new Error('empty'); await setMedia(x, 'poster', b); renderRow(x); const pv = $('#pv'); if (pv) { pv.style.backgroundImage = `url('${cssu(A.resolve(x.poster))}')`; pv.innerHTML = ''; } toast('Poster updated.'); }
      catch (e) { toast('This video is hosted on another site, so its frames cannot be captured. Upload a poster image instead.'); }
    },
    rmthumb() { const x = cur(); if (x) { x.thumb = ''; touch(); renderList(); renderEditor(); } },
    rmmedia() { const x = cur(); if (x) { x.media = ''; touch(); renderList(); renderEditor(); } },
    stlive() { const x = cur(); if (x) { x.status = 'live'; touch(); renderRow(x); renderEditor(); } },
    stsoon() { const x = cur(); if (x) { x.status = 'soon'; touch(); renderRow(x); renderEditor(); } },
    async rbx(t) {
      const x = cur(); if (!x) return; const m = String(x.url || '').match(/games\/(\d+)/) || String(x.placeId || '').match(/^(\d+)$/);
      if (!m) { toast('Paste the Roblox game link first.'); return; }
      const place = m[1], J = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
      t.disabled = true; t.textContent = 'Fetching…';
      try {
        const u = (await J('https://apis.roproxy.com/universes/v1/places/' + place + '/universe')).universeId; if (!u) throw new Error('game not found');
        const g = ((await J('https://games.roproxy.com/v1/games?universeIds=' + u)).data || [])[0] || {};
        const th = ((((await J('https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=' + u + '&countPerUniverse=20&defaults=false&size=768x432&format=Webp&isCircular=false')).data || [])[0] || {}).thumbnails || []).filter((q) => q.imageUrl).map((q) => q.imageUrl);
        Object.assign(x, { placeId: place, universeId: u, visits: Math.round((g.visits || 0) / 1e4) / 100, ccu: g.playing || 0, favorites: g.favoritedCount || 0, maxPlayers: g.maxPlayers || 0, thumbs: th });
        if (!x.studio && g.creator) x.studio = g.creator.name;
        if (!x.genre && g.genre_l2) x.genre = g.genre_l2;
        if ((!x.name || x.name === 'New game') && g.name) x.name = g.name.replace(/[^\p{L}\p{N}\s!?'&.:-]/gu, '').trim().slice(0, 40);
        touch(); renderList(); renderEditor(); toast('Fetched ' + th.length + ' images and live numbers from Roblox.');
      } catch (e) { toast('Could not reach Roblox (' + e.message + '). Try again in a minute.'); t.disabled = false; t.textContent = 'Fetch from Roblox'; }
    },
    sumvis() { S.draft.profile.stats.visits = Math.round(S.draft.worlds.reduce((a, w) => a + (+w.visits || 0), 0)); touch(); renderPane(); toast('Visits updated from your games.'); },
    // Publish publishes: review drawer + commit in one click when publishing is set up; otherwise explain how to set it up
    async publish() {
      if (S.busy) { showDrawer(); return; }
      if (!A.diff(S.draft, S.base).count) { toast('Nothing to publish: the live site already matches this draft.'); return; }
      await openDrawer(); const b = $('[data-act="ghpub"]'); if (b && !b.disabled) ghPublish();
    },
    close() { closeDrawer(); },
    gosettings() { closeDrawer(); go('publish'); },
    async ghtest(t) {
      const g = A.ghCfg(), r = $('#ghres');
      if (!g.owner || !g.repo || !g.token) { r.className = 'res mono bad'; r.textContent = 'Fill in owner, repository and token first.'; return; }
      r.className = 'res mono'; r.textContent = 'Checking…'; t.disabled = true;
      try { const j = await A.ghTest(g); r.className = 'res mono ok'; r.textContent = `Connected to ${j.full_name} · branch ${g.branch} · write access OK` + (j.has_pages ? ' · Pages is on' : ' · Pages is off, turn it on in the repository settings'); }
      catch (e) { r.className = 'res mono bad'; r.textContent = e.message; }
      t.disabled = false;
    },
    ghforget() { const g = A.ghCfg(); g.token = ''; A.ghSave(g); renderPane(); toast('Token removed from this browser.'); },
    ghpub() { ghPublish(); }, zip() { exportZip(); }, cjs() { exportCJS(); }, markpub() { markPublished(); },
    async discard(t) { if (!armed(t)) return; adopt(S.live); await cleanup(true); await persist(); renderPane(); chrome(); toast('Draft discarded. Showing the live version.'); },
    async loadlive() { adopt(S.live); await cleanup(true); await persist(); renderPane(); chrome(); toast('Loaded the live version.'); },
    keepdraft() { S.base = clone(S.live); S.stale = false; persist(); renderPane(); chrome(); toast('Keeping your draft. Publishing replaces the live version.'); },
  };

  // ---------- publish ----------
  async function pendingUp() { const now = A.refs(S.draft), base = A.refs(S.base), out = []; for (const [p, b] of await A.all()) if (b && now.has(p) && !base.has(p)) out.push([p, b]); return out; }
  function showDrawer() { $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on'); }
  async function openDrawer() {
    const d = A.diff(S.draft, S.base), g = A.ghCfg(), ok = pubReady(), up = await pendingUp(), tot = up.reduce((a, [, b]) => a + b.size, 0), big = up.some(([, b]) => b.size > 95 * MB) || S.noLive;
    const target = S.local ? 'Publish · git push from this PC' : 'Publish to ' + g.owner + '/' + g.repo;
    $('#drb').innerHTML = `<div class="sum">${d.count ? d.lines.map(([s, t]) => `<div class="ln"><b>${s}</b><span>${esc(t)}</span></div>`).join('') : '<div class="ln"><b>✓</b><span class="mute">No changes. The live site matches this draft.</span></div>'}</div>` +
      (up.length ? `<div class="upl mono"><span>Media to upload</span><span>${up.length} file${up.length === 1 ? '' : 's'} · ${A.mb(tot)}</span></div><div>${up.map(([p, b]) => `<div class="fr mono"><span>${esc(p.split('/').pop())}</span><span class="${b.size > 95 * MB ? 'bad' : ''}">${A.mb(b.size)}</span></div>`).join('')}</div>` : '') +
      (S.noLive ? '<p class="warn bad mono">The live content (content.js) did not load, so publishing is paused to protect the site. Reload the panel from your site folder and try again.</p>' : big ? '<p class="warn bad mono">One file is over GitHub\'s 100 MB limit. Trim it, or host it elsewhere and paste its link.</p>' : '') +
      `<label class="fld"><span class="mono">Commit message</span><input class="in" id="cmsg" value="Weekly update — ${today()}"></label>` +
      `<div class="go">${ok ? `<button class="btn" data-act="ghpub"${d.count && !big ? '' : ' disabled'}><span>${esc(target)}</span><span class="ar">→</span></button>` : '<button class="btn" data-act="gosettings"><span>Set up publishing</span><span class="ar">→</span></button><p class="warn mono">Publishing isn\'t set up in this browser yet. On your PC, open the panel with <b>admin-ac.bat</b> (no token), or save a GitHub token once under Publishing.</p>'}<button class="cb wide" data-act="zip"${d.count ? '' : ' disabled'}>Download package instead</button></div><ol class="plog mono" id="plog"></ol>`;
    showDrawer();
  }
  function closeDrawer() { if (S.busy) return; $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }
  const plog = (t, c, html) => { const l = $('#plog'); if (l) l.insertAdjacentHTML('beforeend', `<li class="${c || ''}">${html || esc(t)}</li>`); };
  async function ghPublish() {
    if (S.busy || S.noLive || !pubReady()) return; S.busy = true; const btn = $('[data-act="ghpub"]'); if (btn) btn.disabled = true; $('#plog').innerHTML = '';
    try {
      const up = await pendingUp(), now = A.refs(S.draft), rm = [...A.refs(S.base)].filter((p) => !now.has(p));
      const out = clone(S.draft); out.updated = new Date().toISOString();
      const msg = ($('#cmsg').value || '').trim() || 'Update content', log = (t) => plog(t);
      const r = S.local ? await A.localPublish(up, rm, A.serialize(out), msg, log) : await A.ghPublish(A.ghCfg(), up, rm, A.serialize(out), msg, log);
      S.draft.updated = out.updated; S.base = clone(S.draft); S.live = clone(S.draft); await cleanup(false); await persist(); chrome(); if (COL[S.tab]) { renderList(); renderEditor(); }
      if (r.nothing) { plog('Nothing new to commit: the repository already has these changes.', 'ok'); toast('Already published.'); }
      else {
        plog('', 'ok', `Published. <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">View commit ↗</a>`);
        const site = A.siteURL(S.local || A.ghCfg());
        if (site) {
          plog('GitHub Pages is updating the site (about a minute)…'); toast('Published. The site updates in about a minute.');
          A.waitLive(site, out.updated).then((ok) => { plog('', ok ? 'ok' : '', ok ? `Live now. <a href="${esc(site)}" target="_blank" rel="noopener noreferrer">Open the site ↗</a>` : 'Still updating. GitHub Pages can take a few minutes; the site refreshes on its own.'); if (ok) toast('Your changes are live.'); });
        } else toast('Published.');
      }
    } catch (e) { plog('Publish failed: ' + e.message, 'bad'); if (btn) btn.disabled = false; }
    S.busy = false;
  }
  function stamped() { const out = clone(S.draft); out.updated = new Date().toISOString(); S.stamp = out.updated; return out; }
  async function exportZip() { try { const up = await pendingUp(); toast('Preparing package…'); await A.exportZip(up, A.serialize(stamped()), 'furkanlua-update-' + today() + '.zip'); afterExport(); } catch (e) { toast(e.message); } }
  function exportCJS() { A.download(new Blob([A.serialize(stamped())], { type: 'text/javascript' }), 'content.js'); afterExport(); }
  function afterExport() { const msg = 'Downloaded. After you upload it to your host, mark this draft as published.'; if ($('#drawer').classList.contains('on')) plog('', '', esc(msg) + ' <button class="lnk mono" data-act="markpub">Mark as published</button>'); else toast(msg, { label: 'Mark as published', fn: markPublished }); }
  async function markPublished() { S.draft.updated = S.stamp || new Date().toISOString(); S.base = clone(S.draft); S.live = clone(S.draft); await cleanup(true); await persist(); chrome(); if (COL[S.tab]) { renderList(); renderEditor(); } plog('Marked as published.', 'ok'); toast('Marked as published.'); }

  // ---------- events ----------
  // the header wraps to two rows on narrower windows; the sticky list column follows its real height
  const hdr = $('.top'), hh = () => document.documentElement.style.setProperty('--hh', hdr.offsetHeight + 'px');
  hh(); if (window.ResizeObserver) new ResizeObserver(hh).observe(hdr); else addEventListener('resize', hh);
  function go(k) { S.tab = k; history.replaceState(null, '', '#' + k); renderPane(); chrome(); scrollTo(0, 0); }
  function setP(el) { const path = el.dataset.p.split('.'); let o = S.draft.profile; for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {}; o[path[path.length - 1]] = el.type === 'checkbox' ? el.checked : el.hasAttribute('data-num') ? Math.max(0, +el.value || 0) : el.value.trim(); touch(); }
  function refreshW() { const x = cur(), p = $('.wprev'); if (!x || !p) return; p.outerHTML = wPrev(x, list().indexOf(x)); $$('.swb[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === x.color)); const cu = $('.swb.cust'); if (cu) cu.style.background = x.color; }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-act],[data-color],.it'); if (!t) return;
    if (t.dataset.tab) { e.preventDefault(); go(t.dataset.tab); return; }
    if (t.dataset.color) { const x = cur(); if (x) { x.color = t.dataset.color; touch(); renderRow(x); refreshW(); } return; }
    if (t.classList.contains('it')) { S.sel[S.tab] = t.dataset.id; renderList(); renderEditor(); if (innerWidth < 1000) { const r = $('#rcol'); if (r) scrollTo({ top: r.getBoundingClientRect().top + scrollY - 12, behavior: 'smooth' }); } return; }
    const f = ACT[t.dataset.act]; if (f) { e.preventDefault(); f(t); }
  });
  pane.addEventListener('input', (e) => {
    const el = e.target, x = cur();
    if (el.dataset.f && x) {
      x[el.dataset.f] = el.hasAttribute('data-num') ? Math.max(0, +el.value || 0) : el.value; touch(); renderRow(x);
      const fl = el.closest('.fld'), c = fl && $('.cnt', fl); if (c && el.maxLength > 0) c.textContent = el.value.length + ' / ' + el.maxLength;
      if (S.tab === 'worlds') refreshW(); return;
    }
    if (el.dataset.p) { setP(el); return; }
    if (el.dataset.g) {
      const g = A.ghCfg(); g[el.dataset.g] = el.value.trim(); A.ghSave(g); const r = $('#ghres'); if (r) { r.textContent = ''; r.className = 'res mono'; }
      // a pasted token is tested straight away
      if (el.dataset.g === 'token' && /^(github_pat_|ghp_)\w{20,}$/.test(el.value.trim())) { clearTimeout(S.tt); S.tt = setTimeout(() => { const b = $('[data-act="ghtest"]'); if (b && !b.disabled) ACT.ghtest(b); }, 350); }
    }
  });
  pane.addEventListener('change', (e) => {
    const el = e.target;
    if (el.type === 'file') { onFiles(el, el.files).finally(() => { el.value = ''; }); return; }
    if (el.dataset.p) { setP(el); if (el.type === 'checkbox') { const tl = $('.tl', el.closest('.tog')); if (tl) tl.textContent = el.checked ? 'Open for work' : 'Booked for now'; } return; }
    if (el.dataset.f === 'src' && S.tab === 'reels') { const x = cur(); renderEditor(); if (x && x.src) probe(x).then(() => { renderRow(x); renderEditor(); }); }
  });
  let dragId = null;
  const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files');
  document.addEventListener('dragstart', (e) => { const li = e.target.closest && e.target.closest('.it'); if (!li) return; dragId = li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
  document.addEventListener('dragend', () => { dragId = null; $$('.it').forEach((l) => l.classList.remove('dragging', 'da', 'db')); });
  document.addEventListener('dragover', (e) => {
    if (hasFiles(e)) { e.preventDefault(); const z = e.target.closest('.drop') || (S.tab === 'reels' ? $('#adddrop') : null); $$('.drop.over').forEach((d) => { if (d !== z) d.classList.remove('over'); }); if (z) z.classList.add('over'); return; }
    if (!dragId) return; e.preventDefault(); const li = e.target.closest('.it'); $$('.it.da,.it.db').forEach((l) => l.classList.remove('da', 'db'));
    if (!li || li.dataset.id === dragId) return; const r = li.getBoundingClientRect(); li.classList.add(e.clientY < r.top + r.height / 2 ? 'da' : 'db');
  });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $$('.drop.over').forEach((d) => d.classList.remove('over')); });
  document.addEventListener('drop', (e) => {
    e.preventDefault(); $$('.drop.over').forEach((d) => d.classList.remove('over'));
    if (hasFiles(e)) { const z = e.target.closest('.drop'), inp = z && $('input[type=file]', z); if (inp) onFiles(inp, e.dataTransfer.files); else if (S.tab === 'reels') addReels(e.dataTransfer.files); return; }
    if (!dragId) return; const li = e.target.closest('.it'); if (!li || li.dataset.id === dragId) return;
    const L = list(), from = L.findIndex((x) => x.id === dragId), [it] = L.splice(from, 1); let to = L.findIndex((x) => x.id === li.dataset.id); if (li.classList.contains('db')) to++; L.splice(to, 0, it);
    touch(); renderList(); renderEditor();
  });
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); persist().then(() => toast('Saved in this browser.')); } else if (e.key === 'Escape') closeDrawer(); });
  addEventListener('beforeunload', () => { if (saveT) persist(); });
  const prev = $('#prev'); ['mousedown', 'keydown', 'touchstart'].forEach((ev) => prev.addEventListener(ev, () => { persist(); }, { passive: true }));

  function toast(msg, act) {
    const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>` + (act ? `<button class="lnk mono" id="tact">${esc(act.label)}</button>` : '');
    t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), act ? 7000 : 3400);
    if (act) $('#tact').onclick = () => { t.classList.remove('on'); act.fn(); };
  }

  // ---------- boot ----------
  (async function boot() {
    let ok = true; try { await A.ready(); } catch (e) { ok = false; }
    S.local = await A.localPing();
    S.live = norm(window.FL_CONTENT);
    let d = null, b = null;
    if (ok) { try { d = await A.get('kv', 'draft'); b = await A.get('kv', 'base'); await A.cacheAll(); for (const [p, bl] of await A.all()) if (bl) S.sizes[p] = bl.size; } catch (e) { ok = false; } }
    S.base = b ? norm(b) : clone(S.live); S.draft = d ? norm(d) : clone(S.live);
    const empty = (c) => !c.reels.length && !c.worlds.length && !c.logs.length;
    S.noLive = !window.FL_CONTENT;
    // recover from a draft saved while content.js failed to load: start from live, keep anything added since
    if (!S.noLive && !empty(S.live) && empty(S.base) && !S.base.updated) {
      const extra = clone(S.draft); adopt(S.live);
      Object.keys(COL).forEach((k) => { const ids = new Set(S.draft[k].map((x) => x.id)); S.draft[k] = extra[k].filter((x) => !ids.has(x.id)).concat(S.draft[k]); });
    }
    if ((S.live.updated || '') > (S.base.updated || '')) { if (same(S.draft, S.base)) adopt(S.live); else S.stale = true; }
    Object.keys(COL).forEach((k) => { if (!S.sel[k]) S.sel[k] = (S.draft[k][0] || {}).id; });
    const h = location.hash.slice(1); if (['reels', 'worlds', 'logs', 'profile', 'publish'].includes(h)) S.tab = h;
    renderPane(); chrome(); status(ok ? '' : 'err');
    if (ok) persist();
    if (S.noLive) toast('content.js did not load, so publishing is paused. Open the panel from your site folder.');
    if (/^https?:$/.test(location.protocol)) fetch('index.html', { method: 'HEAD' }).then((r) => { if (r.ok) prev.href = 'index.html?preview'; }).catch(() => {});
  })();
})();
