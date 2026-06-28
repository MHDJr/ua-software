// =========================================================================
// PROGRESSIVE WEB APP SERVICE WORKER (UA CONSOLE ENGINE)
// =========================================================================

// 1. Listen for standard incoming Web Push events
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const title = data.title || 'New UA Update';
      const options = {
        body: data.body || '',
        icon: data.icon || '/logo.png',
        badge: data.badge || '/logo.png',
        image: data.image || undefined, // Large banner image if provided
        vibrate: data.vibrate || [200, 100, 200], // Vibration pattern
        tag: data.tag || undefined, // Tag for grouping notifications
        renotify: data.tag ? true : false,
        requireInteraction: data.requireInteraction || false,
        timestamp: Date.now(),
        data: {
          url: data.url || '/',
          dateOfArrival: Date.now(),
          primaryKey: 'ua-push-alert'
        },
        actions: [
          { action: 'explore', title: 'View Update' },
          { action: 'close', title: 'Dismiss' }
        ]
      };

      event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
          // If the dashboard is open, active, and focused, suppress the push notification banner
          // as the user is already online and interacting with the app UI directly.
          const isAppFocused = windowClients.some(client => client.focused);
          if (isAppFocused) {
            console.log('[ServiceWorker] App tab is active and focused. Suppressing push notification.');
            return;
          }

          return self.registration.showNotification(title, options);
        })
      );
    } catch (err) {
      console.warn('[ServiceWorker] Push payload was not JSON, falling back to plain text:', err);
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('New UA Update', {
          body: text,
          icon: '/logo.png',
          badge: '/logo.png',
          data: { url: '/' }
        })
      );
    }
  }
});

// 2. Handle notification interactions (clicks on action buttons or notification card)
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Automatically close notification UI

  // If the user clicked the 'Dismiss'/'close' action button, do nothing
  if (event.action === 'close') {
    return;
  }

  // Retrieve destination path from payload metadata
  const targetUrl = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/';

  // Navigate to deep-linked resource or open new tab context
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Parse targets relative to base origin
      const absoluteTarget = new URL(targetUrl, self.location.origin).toString();

      // Check if there is an active tab open belonging to our PWA origin
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        try {
          const clientUrl = new URL(client.url);
          // If we find an active tab, redirect that tab to our target page and focus
          if ('focus' in client && 'navigate' in client) {
            return client.navigate(absoluteTarget).then(c => {
              if (c && 'focus' in c) return c.focus();
            });
          }
        } catch (e) {
          console.warn('[ServiceWorker] Window client check failed:', e);
        }
      }
      
      // If no tab is open, launch a new window targeting the deep link
      if (clients.openWindow) {
        return clients.openWindow(absoluteTarget);
      }
    })
  );
});

// 3. Service Worker Lifecycle Events
self.addEventListener('install', function(event) {
  // Activate immediately without waiting for old worker to terminate
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Claim all active client tabs to start intercepting fetches immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Intercept historical/deprecated assets and serve clean local SVGs
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
