importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBpBVstbuy7-QWX2ZZXWInPrD4UUwG_JgY",
  authDomain: "jomla-d4b6d.firebaseapp.com",
  projectId: "jomla-d4b6d",
  storageBucket: "jomla-d4b6d.firebasestorage.app",
  messagingSenderId: "52673843388",
  appId: "1:52673843388:web:29ac3a7a964045eef8c0b9",
  measurementId: "G-9PKK7XG217"
});

const messaging = firebase.messaging();

// Handle background notifications when the app/browser is closed
messaging.onBackgroundMessage((payload) => {
  console.log('Background push message received: ', payload);
  
  const notificationTitle = payload.notification.title || 'طلب جديد وارد! 💰';
  const notificationOptions = {
    body: payload.notification.body || 'تحقق من لوحة التحكم لمشاهدة التفاصيل.',
    icon: 'icon-192.svg',
    badge: 'icon-192.svg',
    tag: 'new-order',
    renotify: true,
    data: { url: 'dashboard.html', ...payload.data }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// When the user CLICKS on the notification → open dashboard
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const dashboardUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : 'dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If dashboard is already open, focus it and trigger sound
      for (const client of clientList) {
        if (client.url.includes('dashboard.html') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'PLAY_ORDER_SOUND' });
          return;
        }
      }
      // Otherwise open a new dashboard window
      if (clients.openWindow) {
        return clients.openWindow(dashboardUrl);
      }
    })
  );
});
