// site-data.js — resolves site content: the published content.js, or the panel's draft when the page is opened with ?preview
(function () {
  const FL = window.FL = window.FL || {};
  // content.js is revalidated with the server on every visit (ETag, so usually a tiny 304): a publish shows up on the next
  // page load instead of after the host's 10-minute browser cache. Falls back to a plain <script> (file://, old browsers).
  // content.js is read as data (the JSON after "window.FL_CONTENT ="), never run as inline code, so the page's CSP can forbid inline scripts
  const tag = () => new Promise((res) => { const s = document.createElement('script'); s.src = 'content.js'; s.onload = s.onerror = () => res(window.FL_CONTENT || {}); document.head.appendChild(s); });
  const parse = (t) => { const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j < i) throw 0; return JSON.parse(t.slice(i, j + 1)); };
  const pub = window.FL_CONTENT ? Promise.resolve(window.FL_CONTENT) : window.fetch && location.protocol !== 'file:'
    ? fetch('content.js', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw 0; return r.text(); }).then(parse).catch(tag)
    : tag();
  // drafts only exist in the content panel on your own PC, so preview mode only works there
  const preview = /[?&]preview\b/.test(location.search) && /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  const norm = (d) => Object.assign({ profile: {}, reels: [], worlds: [], logs: [] }, d || {});
  function draft() {
    return new Promise((res) => {
      if (!window.indexedDB) return res(null);
      let q; try { q = indexedDB.open('fl-admin', 1); } catch (e) { return res(null); }
      q.onupgradeneeded = () => { const d = q.result; ['kv', 'media'].forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }); };
      q.onerror = () => res(null);
      q.onsuccess = () => {
        try {
          const t = q.result.transaction(['kv', 'media']), dr = t.objectStore('kv').get('draft'), m = t.objectStore('media'), ks = m.getAllKeys(), vs = m.getAll();
          t.oncomplete = () => {
            if (!dr.result) return res(null);
            const map = {}; (ks.result || []).forEach((k, i) => { if (vs.result[i]) map[k] = URL.createObjectURL(vs.result[i]) + '#' + k; });
            const fix = (o) => typeof o === 'string' ? (map[o] || o) : Array.isArray(o) ? o.map(fix) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fix(v)])) : o;
            res(fix(dr.result));
          };
          t.onerror = () => res(null);
        } catch (e) { res(null); }
      };
    });
  }
  FL.preview = preview;
  FL.data = (preview ? draft().then((d) => d || pub) : pub).then(norm);
  if (preview) addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div'); b.textContent = 'Preview · unpublished draft';
    b.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:300;background:#ff5b1f;color:#050506;font:600 11px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;padding:8px 12px;pointer-events:none';
    document.body.appendChild(b);
  });
})();
