importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBw9zs-QKCGHpWOqlCfOdGR44S1kIPbE5o",
  authDomain: "ulpro-102d3.firebaseapp.com",
  projectId: "ulpro-102d3",
  storageBucket: "ulpro-102d3.firebasestorage.app",
  messagingSenderId: "943893735072",
  appId: "1:943893735072:web:e467211472030ea3418bc5",
  measurementId: "G-CN5L2EJY88"
});

const messaging = firebase.messaging();

// Handle background notifications when the app/browser is closed
messaging.onBackgroundMessage((payload) => {
  console.log('Background push message received: ', payload);
  
  const notificationTitle = payload.notification.title || 'طلب جديد وارد! 💰';
  const notificationOptions = {
    body: payload.notification.body || 'تحقق من لوحة التحكم لمشاهدة التفاصيل.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'new-order',
    renotify: true,
    data: { url: '/?account=dashboard', ...payload.data }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// When the user CLICKS on the notification → open dashboard and play sound
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const dashboardUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/?account=dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If dashboard is already open, focus it and trigger sound
      for (const client of clientList) {
        if (client.url.includes('account=dashboard') && 'focus' in client) {
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

