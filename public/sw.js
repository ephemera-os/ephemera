import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Precache manifest injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const CACHE_NAME = 'ephemera-v2.0.0';
const DYNAMIC_CACHE = 'ephemera-dynamic-v2.0.0';
const IMAGE_CACHE = 'ephemera-images-v2.0.0';
const FONT_CACHE = 'ephemera-fonts-v2.0.0';

const APP_SCOPE_URL = new URL(self.registration.scope);
const APP_SCOPE_PATH = APP_SCOPE_URL.pathname.endsWith('/')
    ? APP_SCOPE_URL.pathname
    : `${APP_SCOPE_URL.pathname}/`;

function toScopePath(path = '') {
    const clean = String(path || '').replace(/^\/+/, '');
    return `${APP_SCOPE_PATH}${clean}`;
}

function toScopeUrl(path = '') {
    return new URL(String(path || ''), self.registration.scope).toString();
}

const OFFLINE_URL = toScopePath('offline.html');
const API_PREFIX_ROOT = '/api/';
const API_PREFIX_SCOPED = toScopePath('api/');

const EXTERNAL_CACHE_HOSTS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache offline page
            try {
                const offlineResponse = await fetch(OFFLINE_URL);
                if (offlineResponse.ok) {
                    await cache.put(OFFLINE_URL, offlineResponse);
                }
            } catch (e) {
                const offlineHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - Ephemera</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            color: #e8e8f0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
        }
        .container { max-width: 400px; }
        .icon {
            width: 80px; height: 80px;
            background: rgba(0, 212, 170, 0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }
        .icon svg { width: 40px; height: 40px; stroke: #00d4aa; }
        h1 { font-size: 1.5rem; margin-bottom: 12px; }
        p { color: #9898a8; line-height: 1.6; margin-bottom: 24px; }
        .retry-btn {
            display: inline-block;
            padding: 12px 24px;
            background: #00d4aa;
            border: none;
            border-radius: 8px;
            color: #0a0a0f;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }
        .retry-btn:hover { background: #00e6b8; transform: translateY(-1px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
        </div>
        <h1>You're Offline</h1>
        <p>Ephemera needs an internet connection to load. Please check your connection and try again.</p>
        <a class="retry-btn" href="">Try Again</a>
    </div>
</body>
</html>`;
                await cache.put(OFFLINE_URL, new Response(offlineHTML, {
                    headers: { 'Content-Type': 'text/html' }
                }));
            }
        })
    );
    // Activation is user-driven via postMessage('skipWaiting') to avoid
    // interrupting active sessions with an unsolicited reload.
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => !name.includes('v2.0.0') && !name.startsWith('workbox-precache'))
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
        return;
    }

    if (url.hostname === 'openrouter.ai' || 
        url.hostname === 'api.allorigins.win' ||
        url.hostname === 'corsproxy.io') {
        return;
    }

    if (url.pathname.startsWith(API_PREFIX_ROOT) || url.pathname.startsWith(API_PREFIX_SCOPED)) {
        return;
    }

    if (EXTERNAL_CACHE_HOSTS.some(host => url.hostname.includes(host))) {
        event.respondWith(cacheFirst(request, getCacheForHost(url.hostname)));
        return;
    }

    if (url.origin !== location.origin) {
        return;
    }

    if (request.destination === 'image') {
        event.respondWith(cacheFirst(request, IMAGE_CACHE));
        return;
    }

    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    event.respondWith(cacheFirst(request));
});

function getCacheForHost(hostname) {
    if (hostname.includes('fonts')) return FONT_CACHE;
    return DYNAMIC_CACHE;
}

async function cacheFirst(request, cacheName = DYNAMIC_CACHE) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            try {
                const responseForCache = response.clone();
                const cache = await caches.open(cacheName);
                await cache.put(request, responseForCache);
            } catch (_error) {
                // Network response is still valid even if cache write fails.
            }
        }
        return response;
    } catch (e) {
        if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { 
            status: 503, 
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    
    const fetchPromise = fetch(request).then(async (response) => {
        if (response.ok) {
            try {
                const responseForCache = response.clone();
                const cache = await caches.open(DYNAMIC_CACHE);
                await cache.put(request, responseForCache);
            } catch (_error) {
                // Keep serving the network response when cache write fails.
            }
        }
        return response;
    }).catch(() => cached);

    return cached || fetchPromise;
}

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(DYNAMIC_CACHE).then((cache) => {
                return cache.addAll(event.data.urls);
            })
        );
    }
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('[ServiceWorker] Background sync triggered');
    }
});

self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const launchUrl = data?.url ? toScopeUrl(data.url) : self.registration.scope;
        const options = {
            body: data.body || 'New notification from Ephemera',
            icon: toScopePath('favicon.svg'),
            badge: toScopePath('favicon.svg'),
            data: launchUrl
        };
        event.waitUntil(
            self.registration.showNotification(data.title || 'Ephemera', options)
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            const scopePrefix = `${APP_SCOPE_URL.origin}${APP_SCOPE_PATH}`;
            for (const client of clientList) {
                if (client.url.startsWith(scopePrefix) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                const launchUrl = typeof event.notification.data === 'string'
                    ? event.notification.data
                    : self.registration.scope;
                return clients.openWindow(launchUrl);
            }
        })
    );
});
