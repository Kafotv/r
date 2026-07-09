// Import Firebase Messaging support for PWA background push notifications
try {
    importScripts('/firebase-messaging-sw.js');
} catch (e) {
    console.error("Firebase messaging script import failed in SW:", e);
}

const CACHE_NAME = 'my-store-v1';
const URLS_TO_CACHE = ['/', '/js/cart.js'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Only handle http/https — skip chrome-extension and others
    if (!url.startsWith('http://') && !url.startsWith('https://')) return;
    // Only handle GET requests
    if (event.request.method !== 'GET') return;
    // Skip external placeholder/unsplash (not cacheable cross-origin reliably)
    if (url.includes('placeholder.com') || url.includes('unsplash.com')) return;

    // Skip API and Dashboard routes from caching to prevent stale data
    if (url.includes('/api/') || url.includes('account=dashboard') || url.includes('account=')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(event.request);
                return cached || new Response('Network error and no cache available', { status: 503 });
            })
    );
});
