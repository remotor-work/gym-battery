/* ═══════════════════════════════════════════════════════════════════════════
   GYM BATTERY — Service Worker
   ─────────────────────────────
   Стратегия: Cache First для ресурсов, Network First для HTML.
   Новые изображения кэшируются автоматически при первой загрузке.
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE = 'gym-battery-v15';

/* Файлы, кэшируемые сразу при установке */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json'
];

/* ── Установка: кэшируем core-файлы ── */
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    })
  );
});

/* ── Активация: удаляем старые кэши ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Запросы: Cache First, с добавлением в кэш при промахе ── */
self.addEventListener('fetch', function(e) {
  /* Обрабатываем только GET */
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;

      return fetch(e.request).then(function(response) {
        /* Кэшируем успешные ответы (HTML, изображения, манифест) */
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        /* Офлайн и файл не закэширован — возвращаем главную страницу */
        return caches.match('./index.html');
      });
    })
  );
});
