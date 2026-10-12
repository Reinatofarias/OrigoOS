// Service worker do Origo OS: recebe o lembrete (push) e abre o sistema ao tocar na notificação.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let aviso = { title: 'Origo OS', body: '', url: '/' };
  try {
    aviso = { ...aviso, ...event.data.json() };
  } catch {
    if (event.data) aviso.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(aviso.title, {
      body: aviso.body,
      icon: '/brand/app-192.png',
      badge: '/brand/badge.png',
      data: { url: aviso.url },
      tag: 'origo-lembrete',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.location.origin) && 'focus' in j) {
          j.navigate(url);
          return j.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
