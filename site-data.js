// site-data.js — resolves site content: the published content.js, or the panel's draft when the page is opened with ?preview
(function () {
  const FL = window.FL = window.FL || {};
  const pub = window.FL_CONTENT || {};
  const preview = /[?&]preview\b/.test(location.search);
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
  FL.data = (preview ? draft().then((d) => d || pub) : Promise.resolve(pub)).then(norm);
  if (preview) addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div'); b.textContent = 'Preview · unpublished draft';
    b.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:300;background:#ff5b1f;color:#050506;font:600 11px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;padding:8px 12px;pointer-events:none';
    document.body.appendChild(b);
  });
})();
