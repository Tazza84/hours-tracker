const CACHE_NAME = 'hours-tracker-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch Service Worker
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return a custom offline page if available
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Background Sync for saving data offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-session') {
    event.waitUntil(syncTimerData());
  }
});

async function syncTimerData() {
  try {
    // Get pending timer sessions from IndexedDB
    const pendingSessions = await getPendingSessions();
    
    for (const session of pendingSessions) {
      // Try to sync with server (when backend is implemented)
      // For now, just mark as synced in local storage
      console.log('Syncing session:', session);
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error syncing timer data:', error);
    return Promise.reject(error);
  }
}

async function getPendingSessions() {
  // Placeholder for IndexedDB operations
  // This would retrieve unsynced timer sessions
  return [];
}

// Push notifications (for timer reminders)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Time to take a break!',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%236c5ce7"/><circle cx="50" cy="50" r="35" fill="none" stroke="white" stroke-width="4"/><line x1="50" y1="25" x2="50" y2="50" stroke="white" stroke-width="3"/><line x1="50" y1="50" x2="65" y2="50" stroke="white" stroke-width="3"/></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%236c5ce7"/></svg>',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Hours Tracker',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Hours Tracker', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({
        type: 'window'
      }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_TIMER_SESSION') {
    // Cache timer session data for offline use
    event.waitUntil(cacheTimerSession(event.data.session));
  }
});

async function cacheTimerSession(session) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const sessionData = new Response(JSON.stringify(session), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(`/session/${Date.now()}`, sessionData);
  } catch (error) {
    console.error('Error caching timer session:', error);
  }
}
