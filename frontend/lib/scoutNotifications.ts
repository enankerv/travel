/** Safely show a notification; no-op when Notification API is unavailable (e.g. mobile). */
export function tryShowScoutNotification(
  title: string,
  options?: NotificationOptions,
): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    new Notification(title, options)
  } catch {
    // Notifications not supported — silently ignore
  }
}
