// HexGL Service Worker for PWA functionality
const CACHE_NAME = 'hexgl-v1.2.0';
const STATIC_CACHE = 'hexgl-static-v1.2.0';
const RUNTIME_CACHE = 'hexgl-runtime-v1.2.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/multi.css',
  '/css/fonts.css',
  '/icon_32.png',
  '/icon_64.png',
  '/icon_128.png',
  '/icon_256.png',
  '/favicon.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and external requests
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }
  
  // Handle different types of requests
  if (STATIC_FILES.some(file => request.url.includes(file)) || 
      request.url.includes('/css/') || 
      request.url.includes('/icon_')) {
    // Static files - try cache first, then network
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          
          return fetch(request)
            .then((response) => {
              // Don't cache non-successful responses
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response since it can only be consumed once
              const responseToCache = response.clone();
              
              caches.open(STATIC_CACHE)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
              
              return response;
            });
        })
        .catch(() => {
          // Return a fallback for HTML requests if offline
          if (request.headers.get('accept').includes('text/html')) {
            return new Response(
              '<html><body><h1>HexGL - Offline</h1><p>You are currently offline. Please check your internet connection.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
        })
    );
  } else if (request.url.includes('/libs/') || 
             request.url.includes('/bkcore/') || 
             request.url.includes('/audio/') ||
             request.url.includes('/textures/') ||
             request.url.includes('/geometries/')) {
    // Game assets - use network first, then cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response since it can only be consumed once
          const responseToCache = response.clone();
          
          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // Try to serve from cache if network fails
          return caches.match(request);
        })
    );
  } else {
    // For other requests, use network first
    event.respondWith(fetch(request));
  }
});

// Handle background sync for when the app comes back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      // Could sync game data, scores, etc. here
      Promise.resolve()
    );
  }
});

// Handle push notifications (if implemented later)
self.addEventListener('push', (event) => {
  if (event.data) {
    console.log('[SW] Push message received:', event.data.text());
    
    const options = {
      body: event.data.text(),
      icon: '/icon_128.png',
      badge: '/icon_64.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      actions: [
        {
          action: 'explore',
          title: 'Play HexGL',
          icon: '/icon_64.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icon_64.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('HexGL', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle message events from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service worker script loaded');