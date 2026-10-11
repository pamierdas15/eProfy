// eProfy · service worker: permite abrir la app sin conexión.
// Los datos los sincroniza Firestore por su cuenta; aquí solo se guarda la app en sí.
// Cambia VERSION al publicar cambios importantes para limpiar las copias antiguas.
const VERSION = 'eprofy-prueba-03';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Firebase, Google, etc.: sin interceptar
  if (url.pathname.startsWith('/__/')) return;  // rutas internas de Firebase Auth

  // Archivos con huella (/assets/…): nunca cambian, primero la copia guardada
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  // Página y demás: primero la red (última versión); sin conexión, la copia guardada
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : undefined))));
});
