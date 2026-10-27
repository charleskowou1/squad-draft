// Offline support. Keeps a copy of the game on the phone so it opens without a connection.
// When online it always fetches the newest files first, so updates show up on the next open.
const CACHE = 'squad-draft-v83';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/roster.js', 'js/engine.js', 'js/story.js', 'js/daily.js', 'js/online.js', 'js/firebase-config.js', 'js/notes.js', 'js/effects.js', 'js/clips.js', 'js/views.js', 'js/sound.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const keep = url.origin === location.origin || FONT_HOSTS.includes(url.hostname);
  if (!keep) return;
  e.respondWith(
    fetch(e.request, {cache: 'no-cache'})   // ask the server every time, so a fresh push isn't hidden by the browser's own cache
      .then(res => {
        // save good copies (pictures included) for offline; skip missing files like pictures not added yet
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, {ignoreSearch: true})
        .then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
