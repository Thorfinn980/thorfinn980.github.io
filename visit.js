(() => {
  'use strict';
  const endpoint = 'https://script.google.com/macros/s/AKfycbxKaMdHLgruzJkzsEzFrhD6GhBqufwFSQ5cxfqytmPShEsFespK9XSr7hdZ6WRRM03L/exec';
  const page = {'/': 1, '/index.html': 1, '/capstone_page.html': 2, '/hobbies_page.html': 4}[location.pathname];
  if (!page || location.hostname !== 'thorfinn980.github.io' || navigator.globalPrivacyControl ||
      navigator.doNotTrack === '1' || !endpoint.startsWith('https://script.google.com/')) return;

  const storageKey = 'portfolio.visit.v1';
  const timeout = 5 * 60 * 1000;
  let visit;
  let visibleSince = null;
  function resume() {
    if (document.visibilityState !== 'visible' || visibleSince !== null) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (saved && Date.now() - saved.last < timeout) visit = saved;
    } catch (_) {}
    if (!visit || Date.now() - visit.last >= timeout) {
      visit = {id: crypto.randomUUID(), ms: 0, pages: 0, last: Date.now()};
    }
    visit.pages |= page;
    visibleSince = performance.now();
    checkpoint();
  }
  function checkpoint() {
    if (visibleSince === null) return;
    const now = performance.now();
    visit.ms += Math.max(0, now - visibleSince);
    visit.last = Date.now();
    visibleSince = now;
    try { sessionStorage.setItem(storageKey, JSON.stringify(visit)); } catch (_) {}
    const body = JSON.stringify({id: visit.id, seconds: Math.min(86400, Math.floor(visit.ms / 1000)), pages: visit.pages});
    fetch(endpoint, {method: 'POST', body, keepalive: true, credentials: 'omit', mode: 'no-cors', referrerPolicy: 'no-referrer'}).catch(() => {});
  }
  function pause() {
    checkpoint();
    visibleSince = null;
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' ? resume() : pause());
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  setInterval(checkpoint, 30000);
  resume();
})();
