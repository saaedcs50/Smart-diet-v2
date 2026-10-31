// Service Worker لاستقبال إشعارات FCM في الخلفية.
// ملاحظة: إعدادات Firebase تُحقن وقت البناء عبر importScripts —
// هذه النسخة تستخدم القيم من متغيرات البيئة وقت البناء.

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js',
);

// تُستبدل وقت البناء — انظر vite.config.ts (define)
const firebaseConfig = {
  apiKey: '__VITE_FIREBASE_API_KEY__',
  authDomain: '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId: '__VITE_FIREBASE_PROJECT_ID__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__VITE_FIREBASE_APP_ID__',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'إشعار جديد';
  const options = {
    body: payload.notification?.body ?? '',
    icon: '/icon-192.png',
  };
  self.registration.showNotification(title, options);
});
