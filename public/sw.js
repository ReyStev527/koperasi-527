const CACHE_NAME = 'koperasi527-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
]

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: cleanup old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Skip non-GET and Firebase/external API calls
  if (e.request.method !== 'GET') return
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis')) return
  if (url.hostname.includes('cdn') || url.hostname.includes('fonts')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request).then(cached => cached || new Response('Offline', { status: 503 })))
  )
})
