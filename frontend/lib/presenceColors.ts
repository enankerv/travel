/** Stable accent per user for presence rings + remote cursors (same on every client). */
export function presenceColorForUserId(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0
  }
  const hue = h % 360
  return `hsl(${hue} 72% 62%)`
}
