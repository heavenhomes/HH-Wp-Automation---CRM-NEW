'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const getFirebaseMessaging = () => {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.messagingSenderId) {
    console.error('[fcm] NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is not configured');
    return null;
  }
  return getMessaging(app);
};

export async function registerAndSaveFcmToken() {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[fcm] Notification permission not granted');
    return null;
  }

  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js'
  );
  // Wait until the SW is fully active
  await navigator.serviceWorker.ready;

  const messaging = getFirebaseMessaging();
  if (!messaging) return null;

  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) return null;

  // Save to MongoDB
  const response = await fetch('/api/team-members/save-fcm-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    throw new Error(`[fcm] Saving device token failed with status ${response.status}`);
  }

  return token;
}

export function listenForegroundMessages(callback) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}