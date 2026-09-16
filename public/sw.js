// Push Notification handlers for the VitePWA service worker
// IMPORTANT: Do NOT add install/activate handlers here — they conflict with Workbox.
// VitePWA's workbox config (skipWaiting, clientsClaim) handles SW lifecycle.
// This file is merged via importScripts in the Workbox-generated SW.

// Handle SKIP_WAITING message from the app to force immediate activation
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Kretopia', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
