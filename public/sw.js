const CACHE_NAME = 'dumbguiter-v3';
const AUDIO_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/audio/acoustic-guitar/E2.mp3',
  '/audio/acoustic-guitar/G2.mp3',
  '/audio/acoustic-guitar/A2.mp3',
  '/audio/acoustic-guitar/B2.mp3',
  '/audio/acoustic-guitar/C3.mp3',
  '/audio/acoustic-guitar/D3.mp3',
  '/audio/acoustic-guitar/E3.mp3',
  '/audio/acoustic-guitar/G3.mp3',
  '/audio/acoustic-guitar/A3.mp3',
  '/audio/acoustic-guitar/B3.mp3',
  '/audio/acoustic-guitar/C4.mp3',
  '/audio/acoustic-guitar/D4.mp3',
  '/audio/acoustic-guitar/E4.mp3',
  '/audio/acoustic-guitar/G4.mp3',
  '/audio/acoustic-guitar/A4.mp3',
  '/audio/acoustic-guitar/B4.mp3',
  '/audio/acoustic-guitar/C5.mp3',
  '/audio/acoustic-guitar/E5.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(AUDIO_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
