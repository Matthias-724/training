// Service Worker: hält alle Dateien der App für den Offline-Betrieb vor.
//
// Strategie: zuerst aus dem Cache. Im Gym ist der Empfang oft schlecht, und
// ein Netzwerkversuch mit langer Wartezeit wäre schlimmer als eine Version,
// die einen Tag alt ist. Neue Versionen kommen über eine geänderte VERSION:
// Der Browser lädt sw.js beim Start neu, erkennt die Änderung, lädt alles
// in einen neuen Cache und die App bietet "Aktualisieren" an.
//
// Auf localhost gilt Netzwerk zuerst, damit Änderungen beim Entwickeln sofort
// sichtbar sind. Offline greift auch dort der Cache.

const VERSION = '1.0.0'; // zusammen mit js/version.js erhöhen
const CACHE = `trainings-app-${VERSION}`;
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/backup.js',
  './js/db.js',
  './js/format.js',
  './js/logic.js',
  './js/seed.js',
  './js/store.js',
  './js/version.js',
  './js/ui/chart.js',
  './js/ui/device.js',
  './js/ui/dom.js',
  './js/ui/picker.js',
  './js/ui/sheets.js',
  './js/ui/timer.js',
  './js/views/ausdauer.js',
  './js/views/heute.js',
  './js/views/mehr.js',
  './js/views/plan.js',
  './js/views/training.js',
  './js/views/verlauf.js',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den HTTP-Cache, sonst landen alte Dateien im neuen Cache.
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((k) => k.startsWith('trainings-app-') && k !== CACHE)
      .map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  return cached ?? fetch(request);
}

async function networkFirst(request) {
  try {
    // no-cache: beim Entwickeln nie eine alte Datei aus dem HTTP-Cache des Browsers.
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error('offline und nicht im Cache');
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe immer auf index.html abbilden: Die App routet über den Hash.
  const target = request.mode === 'navigate' ? new Request('./index.html') : request;
  event.respondWith(DEV ? networkFirst(target) : cacheFirst(target));
});
