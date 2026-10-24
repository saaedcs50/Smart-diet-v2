// Service Worker — PWA notifications
// BRAND_INJECT_START
const CACHE_NAME = "nutrition-عيادة-التغذية-v4";
const BRAND_APP_NAME = "منصة التغذية والصحة";
const BRAND_SHORT_NAME = "عيادة التغذية";
const BRAND_LOGO_PATH = "/icon.svg";
// BRAND_INJECT_END

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

const defaultReminderTitle = () => `تذكير ${BRAND_SHORT_NAME || BRAND_APP_NAME} 🥗`;
const logoSrc = () => (typeof BRAND_LOGO_PATH !== 'undefined' && BRAND_LOGO_PATH ? BRAND_LOGO_PATH : '/icon.svg');

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SW_HEALTH_CHECK') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        status: 'OK',
        active: true,
        version: CACHE_NAME,
        timestamp: Date.now(),
      });
    }
  } else if (event.data.type === 'SCHEDULED_NOTIFICATION_TRIGGER') {
    const { title, body, tag, url, vibrate } = event.data;
    self.registration.showNotification(title || defaultReminderTitle(), {
      body: body || 'حان موعد وجبتك أو شرب الماء!',
      icon: logoSrc(),
      badge: logoSrc(),
      tag: tag || 'clinic-reminder',
      vibrate: vibrate || [200, 100, 200, 100, 300],
      renotify: true,
      data: { url: url || '/', timestamp: Date.now() },
      actions: [
        { action: 'open', title: 'فتح التطبيق 📱' },
        { action: 'close', title: 'إغلاق ✕' },
      ],
    });
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: defaultReminderTitle(),
    body: 'حان موعد وجبتك المحددة أو شرب الماء!',
    icon: logoSrc(),
    badge: logoSrc(),
    data: { url: '/' },
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || logoSrc(),
    badge: data.badge || logoSrc(),
    vibrate: data.vibrate || [200, 100, 200, 100, 300],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'فتح التطبيق 📱' },
      { action: 'close', title: 'إغلاق ✕' },
    ],
    tag: data.tag || 'clinic-reminder',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || defaultReminderTitle(), options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            tag: event.notification.tag,
            url: urlToOpen,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
