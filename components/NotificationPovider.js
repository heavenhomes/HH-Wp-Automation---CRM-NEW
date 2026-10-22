'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth/useAuth';
import {
  registerAndSaveFcmToken,
  listenForegroundMessages,
} from '@/lib/firebase-client';

export default function NotificationProvider({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const notificationSound = new Audio('/notification.mp3');

    // Register & save token (will prompt permission once)
    registerAndSaveFcmToken().catch((e) =>
      console.error('[fcm] register failed', e)
    );

    // Foreground: show a toast too (background handled by SW)
    const unsub = listenForegroundMessages((payload) => {
      notificationSound.currentTime = 0;
      notificationSound.play().catch((error) => {
        console.warn('[notification sound] Playback failed:', error);
      });
      toast(
        `${payload.notification?.title || ''}\n${payload.notification?.body || ''}`,
        { icon: '🔔', duration: 6000 }
      );
    });

    return () => { if (typeof unsub === 'function') unsub(); };
  }, [user]);

  return children;
}