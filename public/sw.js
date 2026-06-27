
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const isEscalated = data.title === 'Critical Operational Delay' || (data.body && data.body.includes('escalated'));
    const options = {
      body: data.body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200, 100, 200, 100, 200], // Distinctive vibration pattern
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        isEscalated: isEscalated
      },
      actions: [
        {action: 'explore', title: 'View Details'},
        {action: 'close', title: 'Close'},
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
  const isEscalated = event.notification.data && event.notification.data.isEscalated;

  // Focus browser window or load the '/staff' route context upon interaction
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(windowClients => {
      // Check if there is already a window/tab open with the staff portal
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        try {
          var clientUrl = new URL(client.url);
          if ((clientUrl.pathname === '/staff' || clientUrl.pathname === '/staff/') && 'focus' in client) {
            if (isEscalated) {
              return client.navigate('/staff?escalated=true').then(c => {
                if (c && 'focus' in c) return c.focus();
              });
            }
            return client.focus();
          }
        } catch (e) {
          // Fallback if URL parsing fails
          if (client.url.indexOf('/staff') !== -1 && 'focus' in client) {
            if (isEscalated) {
              return client.navigate('/staff?escalated=true').then(c => {
                if (c && 'focus' in c) return c.focus();
              });
            }
            return client.focus();
          }
        }
      }
      // If not, open a new window/tab targeting the /staff portal
      if (clients.openWindow) {
        const targetUrl = isEscalated ? '/staff?escalated=true' : '/staff';
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('install', function(event) {
  // Tell the active service worker to take over the page immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Claim all client tabs immediately so the new fetch interceptor takes effect
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Intercept requests for the deprecated logo and serve logo.svg instead
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  const decodedPath = decodeURIComponent(url.pathname);
  if (decodedPath.includes('Usthad Logo Symbol - White.svg')) {
    event.respondWith(
      fetch('/images/logo.svg').catch(function() {
        return new Response('', { status: 404 });
      })
    );
  }
});
