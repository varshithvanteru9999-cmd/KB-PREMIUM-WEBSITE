/*
   KB Beauty PWA — Service Worker
   CSS, JS, and images are NOT cached here.
   The server sends Cache-Control: no-cache for all assets,
   so the browser always fetches the latest version automatically.
   This SW only provides offline fallback for navigation requests.
*/

const CACHE_NAME = 'kb-beauty-offline-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    // Cache only the bare minimum for an offline fallback page
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(['/index.html'])
        )
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API calls: always straight to network, never touched
    if (url.pathname.startsWith('/api/')) return;

    // CSS / JS / fonts / images: don't intercept — let browser handle with HTTP cache
    const ext = url.pathname.split('.').pop().toLowerCase();
    if (['css', 'js', 'woff', 'woff2', 'ttf', 'png', 'jpg', 'jpeg', 'svg', 'ico', 'webp'].includes(ext)) return;

    // HTML navigation: network-first, fall back to cached index.html
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        );
    }
});
