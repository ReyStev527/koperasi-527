// Versi 3 — naikkan angka ini setiap kali aplikasi diperbarui,
// supaya semua perangkat otomatis mengambil versi terbaru.
const CACHE_NAME = 'koperasi527-v3'

const STATIC_ASSETS = [
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
]

// Alamat yang TIDAK BOLEH disimpan di cache.
// Data koperasi harus selalu diambil langsung dari server, jangan dari salinan lama.
function jangenCache(url) {
  const h = url.hostname
  return (
    h.includes('supabase.co') ||     // <-- PENTING: data Supabase
    h.includes('firestore') ||
    h.includes('googleapis') ||
    h.includes('cdn') ||
    h.includes('fonts')
  )
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  if (e.request.method !== 'GET') return
  if (jangenCache(url)) return              // biarkan lewat apa adanya
  if (url.origin !== self.location.origin) return

  // index.html & navigasi: SELALU dari jaringan dulu, cache hanya untuk keadaan offline.
  const halamanUtama = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')

  if (halamanUtama) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          const salinan = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, salinan))
          return res
        })
        .catch(() => caches.match(e.request).then(c => c || new Response('Offline', { status: 503 })))
    )
    return
  }

  // File /assets/*.js dan *.css punya nama unik tiap build — aman diambil dari cache dulu.
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok) {
          const salinan = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, salinan))
        }
        return res
      }).catch(() => new Response('Offline', { status: 503 }))
    )
  )
})
