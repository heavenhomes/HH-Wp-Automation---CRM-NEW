/* eslint-disable */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ⚠️ These MUST be hard-coded (SW can't read process.env).
// These are the SAME public values as your NEXT_PUBLIC_FIREBASE_* vars.
firebase.initializeApp({
  apiKey: 'AIzaSyA4NQy240F9r6B4YGJyXF6g1N5UYIUVkWM',
  authDomain: 'heaven-homes-19e6e.firebaseapp.com',
  projectId: 'heaven-homes-19e6e',
  messagingSenderId: '568790502736',
  appId: '1:568790502736:web:615412350b44770d54b055',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'New Notification';
  const options = {
    body: payload.notification?.body || '',
    icon: '/logo-heaven.png',
    badge: '/logo-heaven.png',
    data: { url: payload.fcmOptions?.link || payload.data?.url || '/' },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});