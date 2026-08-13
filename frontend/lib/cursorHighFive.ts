export const HIGH_FIVE_HIT_PX = 48
export const HIGH_FIVE_SEPARATE_PX = 76
export const HIGH_FIVE_COOLDOWN_MS = 2800
export const HIGH_FIVE_DURATION_MS = 650

export type HighFivePoint = {
  id: string
  x: number
  y: number
  color: string
}

export type HighFiveBurst = {
  id: string
  x: number
  y: number
  colorA: string
  colorB: string
}

export type HighFiveTracker = {
  overlapping: Set<string>
  lastAt: Map<string, number>
}

export function createHighFiveTracker(): HighFiveTracker {
  return { overlapping: new Set(), lastAt: new Map() }
}

export function highFivePairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/** Detect new cursor collisions. `toScreenPx` converts native-space distance to CSS pixels (board zoom). */
export function detectHighFives(
  points: HighFivePoint[],
  tracker: HighFiveTracker,
  now: number,
  toScreenPx = 1,
): HighFiveBurst[] {
  if (points.length < 2) return []
  const scale = toScreenPx > 0 ? toScreenPx : 1
  const spawned: HighFiveBurst[] = []

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]
      const b = points[j]
      const distPx = Math.hypot(a.x - b.x, a.y - b.y) * scale
      const key = highFivePairKey(a.id, b.id)

      if (distPx <= HIGH_FIVE_HIT_PX) {
        if (tracker.overlapping.has(key)) continue
        tracker.overlapping.add(key)
        const last = tracker.lastAt.get(key) ?? 0
        if (now - last < HIGH_FIVE_COOLDOWN_MS) continue
        tracker.lastAt.set(key, now)
        spawned.push({
          id: `${key}:${now}`,
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          colorA: a.color,
          colorB: b.color,
        })
      } else if (distPx >= HIGH_FIVE_SEPARATE_PX) {
        tracker.overlapping.delete(key)
      }
    }
  }

  return spawned
}
