/* Raízes do Futuro — service worker offline-first
   Cacheia o app para funcionar sem internet (realidade da ilha), sem que isso
   impeça uma versão nova de chegar. Ver a nota sobre navegação, abaixo. */
const CACHE = 'raizes-v2';

self.addEventListener('install', () => self.skipWaiting());

/* Ao ativar, apaga os caches das versões anteriores.
   É o que liberta quem ficou preso numa versão antiga: o `raizes-v1` guardava
   o `index.html` e, com ele, os nomes dos arquivos daquele build. Como o cache
   respondia primeiro, o app inteiro continuava rodando da cópia velha e um
   deploy novo simplesmente não aparecia. */
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome !== CACHE) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  /* NAVEGAÇÃO (o HTML): rede primeiro, cache só como rede de segurança.
     O HTML é o único arquivo cujo nome não muda entre builds — é ele que diz
     quais JS e CSS carregar. Servi-lo do cache congela a versão para sempre.
     Buscando da rede primeiro, um deploy aparece na recarga seguinte; e quando
     não há rede, a cópia guardada assume e o app continua abrindo offline, que
     é o que a ilha precisa. */
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const daRede = await fetch(request);
        if (daRede.ok) (await caches.open(CACHE)).put(request, daRede.clone());
        return daRede;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(request))
          || (await cache.match('./index.html'))
          || Response.error();
      }
    })());
    return;
  }

  /* ARQUIVOS COM HASH NO NOME (`/assets/…`): cache primeiro, e pode ser para
     sempre. O Vite põe o hash do conteúdo no nome, então um arquivo com aquele
     nome nunca muda — mudou o conteúdo, mudou o nome, e aí é outra entrada. */
  if (new URL(request.url).pathname.includes('/assets/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const emCache = await cache.match(request);
      if (emCache) return emCache;
      const daRede = await fetch(request);
      if (daRede.ok) cache.put(request, daRede.clone());
      return daRede;
    })());
    return;
  }

  /* O RESTO (ícones, logos, manifesto, dados soltos em `public/`): responde do
     cache na hora e busca a versão nova em segundo plano. Esses nomes não têm
     hash, então valem uma atualização; mas nenhum deles decide qual versão do
     app roda, e por isso servir a cópia de ontem enquanto a nova chega não
     prende ninguém no passado. */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const emCache = await cache.match(request);
    const daRede = fetch(request)
      .then(resp => {
        if (resp.ok) cache.put(request, resp.clone());
        return resp;
      })
      .catch(() => emCache);
    return emCache || daRede;
  })());
});
