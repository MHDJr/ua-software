
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/images/alert-icon.png', // Ensure this icon exists or use a placeholder
      badge: '/images/badge-icon.png',
      vibrate: [200, 100, 200, 100, 200, 100, 200], // Distinctive vibration pattern
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      },
      actions: [
        {action: 'explore', title: 'View Details', icon: '/images/checkmark.png'},
        {action: 'close', title: 'Close', icon: '/images/xmark.png'},
      ],
      requireInteraction: true // Keeps notification until user interacts
    };

    // Play a sound
    // Note: Sounds in SW are tricky and support varies. 
    // Best practice is to rely on system notification sounds or open a window that plays sound.
    // However, some implementations allow sound URL in options (rarely supported now).
    // We will attempt to open a client window if possible to ensure sound plays if browser open,
    // but for "browser closed" we rely on system notification sound.

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.matchAll({type: 'window'}).then( windowClients => {
        // Check if there is already a window/tab open with the target URL
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          // If so, just focus it.
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, then open the target URL in a new window/tab.
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

self.addEventListener('install', function(event) {
  // Tell the active service worker to take over the page immediately
  self.skipWaiting();
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
