/* Raízes do Futuro — service worker offline-first
   Cacheia o app para funcionar sem internet (realidade da ilha) e
   atualiza em segundo plano quando a rede volta. */
const CACHE = 'raizes-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const emCache = await cache.match(request);
      const daRede = fetch(request)
        .then(resp => {
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        })
        .catch(() => emCache);
      return emCache || daRede;
    })
  );
});
