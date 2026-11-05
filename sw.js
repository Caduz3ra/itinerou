// Service worker: guarda o app no aparelho para abrir rápido, mesmo sem internet
const CACHE = 'itinerou-app-v1';
const ARQUIVOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const ESPERA_REDE = 2000;   // internet ruim: espera no máximo 2s pela versão nova

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

// Apaga só caches antigos DO APP (o cache 'itinerou-vouchers' guarda os vouchers offline)
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('itinerou-app-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(req, copia));
      return res;
    })));
    return;
  }

  if (url.origin !== location.origin) return; // Supabase não passa por aqui

  const rede = fetch(req).then(res => {
    if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  });
  e.waitUntil(rede.catch(() => {}));

  e.respondWith((async () => {
    const guardado = (await caches.match(req, { ignoreSearch: true, cacheName: CACHE })) ||
                     (req.mode === 'navigate' ? await caches.match('./index.html', { cacheName: CACHE }) : null);
    if (!guardado) return rede.catch(() => caches.match('./index.html', { cacheName: CACHE }));
    const limite = new Promise(resolve => setTimeout(() => resolve(null), ESPERA_REDE));
    const resposta = await Promise.race([rede.catch(() => null), limite]);
    return resposta || guardado;
  })());
});
