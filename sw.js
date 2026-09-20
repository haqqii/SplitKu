// ============================================================================
// SERVICE WORKER - PWA Offline Support
// ============================================================================

// Cache version: BUMP on every deploy so the SW doesn't serve stale assets
// (otherwise the browser keeps running the old app.js when new code is pushed)
const CACHE_NAME = 'splitku-v30';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/dark.css',
    '/js/app.js',
    '/js/storage.js',
    '/js/validation.js',
    '/js/charts.js',
    '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                console.log('[SW] Caching app assets into', CACHE_NAME);
                // Use Promise.allSettled so one failed asset doesn't break install
                const results = await Promise.allSettled(
                    ASSETS_TO_CACHE.map(url =>
                        fetch(url)
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                    )
                );
                const failed = results.filter(r => r.status === 'rejected').length;
                if (failed > 0) console.warn(`[SW] ${failed} assets failed to cache (non-fatal)`);
            } catch (err) {
                console.error('[SW] Cache install error (non-fatal):', err);
            } finally {
                // Activate immediately regardless
                await self.skipWaiting();
            }
        })()
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            try {
                const cacheNames = await caches.keys();
                await Promise.allSettled(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName).catch(err => {
                                console.warn('[SW] Cache delete failed (non-fatal):', cacheName, err);
                            });
                        }
                    })
                );
                await self.clients.claim();
                console.log('[SW] Activated, claimed clients');
            } catch (err) {
                console.error('[SW] Activate failed:', err);
            }
        })()
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip external requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached response and update cache in background
                    event.waitUntil(
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => cache.put(event.request, networkResponse.clone()))
                                        .catch(err => console.warn('[SW] Cache update failed:', err));
                                }
                            })
                            .catch(() => {
                                // Network failed, that's ok - we have cache
                            })
                    );
                    return cachedResponse;
                }

                // No cache, fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache the new response
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, responseToCache))
                                .catch(err => console.warn('[SW] Cache put failed:', err));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Offline and no cache - return offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        // For other requests, just fail
                        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
            .catch(err => {
                console.error('[SW] Fetch handler error:', err);
                return new Response('Service worker error', { status: 503 });
            })
    );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('Cache cleared');
        });
    }
});
