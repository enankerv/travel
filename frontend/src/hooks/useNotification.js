import { useCallback } from 'react';

export function useNotification() {
  const notify = useCallback((title, options = {}) => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return;
    }

    // Request permission if needed
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/vite.svg',
        badge: '/vite.svg',
        ...options,
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, {
            icon: '/vite.svg',
            badge: '/vite.svg',
            ...options,
          });
        }
      });
    }
  }, []);

  return { notify };
}
