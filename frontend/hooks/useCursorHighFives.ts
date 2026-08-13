'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createHighFiveTracker,
  detectHighFives,
  HIGH_FIVE_DURATION_MS,
  type HighFiveBurst,
  type HighFivePoint,
} from '@/lib/cursorHighFive'

export function useCursorHighFives() {
  const [bursts, setBursts] = useState<HighFiveBurst[]>([])
  const trackerRef = useRef(createHighFiveTracker())
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      for (const id of timeoutsRef.current) window.clearTimeout(id)
      timeoutsRef.current = []
    }
  }, [])

  const scan = useCallback((points: HighFivePoint[], toScreenPx = 1) => {
    const spawned = detectHighFives(
      points,
      trackerRef.current,
      Date.now(),
      toScreenPx,
    )
    if (!spawned.length) return
    setBursts((prev) => [...prev, ...spawned])
    for (const burst of spawned) {
      const tid = window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== burst.id))
        timeoutsRef.current = timeoutsRef.current.filter((id) => id !== tid)
      }, HIGH_FIVE_DURATION_MS)
      timeoutsRef.current.push(tid)
    }
  }, [])

  return { bursts, scan }
}
