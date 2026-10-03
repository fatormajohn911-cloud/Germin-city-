/**
 * GEMINI CITY — Production Progressive Web App Service Worker
 * Designed for 100% Offline Gameplay & GitHub Pages Subpath Compatibility
 */

const CACHE_VERSION = 'gemini-city-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const FONTS_CACHE = `${CACHE_VERSION}-fonts`;

// Core App Shell assets required to bootstrap the 3D application offline
const CORE_SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'manifest.json',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
  'apple-touch-icon.png',
  'icon.svg',
  'favicon.ico',
];

/**
 * Installation: Cache the core shell and proactively parse bundled Vite assets from index.html
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      console.log('[SW] Installing Gemini City Service Worker...', CACHE_VERSION);
      const staticCache = await caches.open(STATIC_CACHE);

      // 1. Precache core shell files
      for (const file of CORE_SHELL_FILES) {
        try {
          await staticCache.add(file);
        } catch (err) {
          console.warn('[SW] Core precache item failed:', file, err);
        }
      }

      // 2. Inspect index.html to discover and precache Vite bundled JS & CSS
      try {
        const indexResponse = await fetch('index.html', { cache: 'no-cache' });
        if (indexResponse.ok) {
          await staticCache.put('index.html', indexResponse.clone());
          const htmlText = await indexResponse.text();

          // Regex to extract all hashed assets from scripts and stylesheets
          const assetUrls = new Set();
          const scriptMatches = htmlText.matchAll(/src=["'](\.?\/?assets\/[^"']+)["']/g);
          for (const match of scriptMatches) {
            assetUrls.add(match[1]);
          }
          const linkMatches = htmlText.matchAll(/href=["'](\.?\/?assets\/[^"']+)["']/g);
          for (const match of linkMatches) {
            assetUrls.add(match[1]);
          }

          for (const assetUrl of assetUrls) {
            try {
              await staticCache.add(assetUrl);
              console.log('[SW] Successfully precached bundle asset:', assetUrl);
            } catch (err) {
              console.warn('[SW] Could not precache bundled asset:', assetUrl, err);
            }
          }
        }
      } catch (err) {
        console.warn('[SW] Could not inspect index.html for assets:', err);
      }

      // Activate immediately
      return self.skipWaiting();
    })()
  );
});

/**
 * Activation: Safely remove previous cache versions without touching user saves or IndexedDB
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      console.log('[SW] Activating Gemini City Service Worker...', CACHE_VERSION);
      const activeCacheNames = [STATIC_CACHE, RUNTIME_CACHE, FONTS_CACHE];
      const allCacheKeys = await caches.keys();

      await Promise.all(
        allCacheKeys.map((key) => {
          if (key.startsWith('gemini-city-') && !activeCacheNames.includes(key)) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );

      // Take control of all clients immediately
      return self.clients.claim();
    })()
  );
});

/**
 * Fetch: Intelligent routing for offline-first 3D gameplay
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 1. Never intercept chrome-extension or other non-http(s) schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 2. Bypass API calls (no caching of server API routes)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. Handle Navigation Requests (index.html / App Shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // Try network first with a 2-second timeout, then fall back immediately to cached index.html
        try {
          const networkPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 2000)
          );
          const response = await Promise.race([networkPromise, timeoutPromise]);
          if (response && response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
            return response;
          }
        } catch {
          // Offline or network timeout — proceed to cache fallback
        }

        // Return cached index.html
        const cachedResponse =
          (await caches.match(request)) ||
          (await caches.match('./')) ||
          (await caches.match('index.html'));

        if (cachedResponse) {
          return cachedResponse;
        }

        return new Response(
          '<!doctype html><html><body style="background:#020617;color:#f8fafc;font-family:sans-serif;padding:32px;text-align:center;"><h2>Gemini City</h2><p>Please connect to the internet once to load the game files.</p></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })()
    );
    return;
  }

  // 4. Handle Google Fonts / gstatic (Cache-First)
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      (async () => {
        const fontCache = await caches.open(FONTS_CACHE);
        const cached = await fontCache.match(request);
        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === 'opaque')) {
            fontCache.put(request, response.clone());
          }
          return response;
        } catch {
          // Return empty font fallback so browser renders system font smoothly without error
          return new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } });
        }
      })()
    );
    return;
  }

  // 5. Handle Same-Origin Game Assets (JS, CSS, Images, Icons, Audio)
  const isSameOrigin = url.origin === self.location.origin;
  if (isSameOrigin) {
    event.respondWith(
      (async () => {
        // Cache-First: Check static cache or runtime cache
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        // If not in cache, fetch from network and store for subsequent offline launches
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            // Store hashed assets or media in static or runtime cache
            const targetCacheName = url.pathname.includes('/assets/')
              ? STATIC_CACHE
              : RUNTIME_CACHE;
            const cache = await caches.open(targetCacheName);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // Offline fallback for same-origin requests
          const fallback =
            (await caches.match(request)) ||
            (await caches.match(url.pathname)) ||
            (await caches.match(url.pathname.split('/').pop() || ''));

          if (fallback) {
            return fallback;
          }

          throw err;
        }
      })()
    );
  }
});
