const VERSION = 'sijaka-v13'
const STATIC_CACHE = `${VERSION}-static`
const RUNTIME_CACHE = `${VERSION}-runtime`
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/logo-sijaka.png']

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin
const isStaticAsset = (request) => /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/i.test(new URL(request.url).pathname)

async function cacheResponse(cacheName, request, response) {
  if (response && response.ok) {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !isSameOrigin(request)) return
  if (new URL(request.url).pathname === '/service-worker.js') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(RUNTIME_CACHE, '/index.html', response))
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => cacheResponse(STATIC_CACHE, request, response))),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => cacheResponse(RUNTIME_CACHE, request, response))
      .catch(() => caches.match(request)),
  )
})