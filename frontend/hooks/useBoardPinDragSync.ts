'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  subscribePinDragBroadcast,
  type PinDragBroadcastPayload,
  type PresenceUser,
} from '@/lib/realtime'

const DRAG_SEND_MS = 100
const DRAG_TTL_MS = 2000
const DRAG_SWEEP_MS = 500

export type PeerPinDrag = {
  userId: string
  poiId: string
  wx: number
  wy: number
  active: boolean
  ts: number
}

export function useBoardPinDragSync({
  listId,
  enabled,
  userId,
  otherViewers,
  onPeerDragEnd,
}: {
  listId: string
  enabled: boolean
  userId: string | undefined
  otherViewers: PresenceUser[]
  /** Last broadcast position when a peer releases a pin (before DB confirms). */
  onPeerDragEnd?: (poiId: string, wx: number, wy: number) => void
}) {
  const [peerDrags, setPeerDrags] = useState<Record<string, PeerPinDrag>>({})
  const lastSendRef = useRef(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const hasOtherViewers = otherViewers.length > 0

  useEffect(() => {
    if (!enabled || !userId) {
      channelRef.current = null
      return
    }
    channelRef.current = supabase.channel(`list:${listId}`, {
      config: { private: true },
    })
    return () => {
      channelRef.current = null
    }
  }, [listId, enabled, userId])

  const onPeerDragEndRef = useRef(onPeerDragEnd)
  onPeerDragEndRef.current = onPeerDragEnd

  useEffect(() => {
    if (!enabled || !userId) return

    const unsub = subscribePinDragBroadcast(listId, (payload: PinDragBroadcastPayload) => {
      const pu = payload.user_id
      const poiId = payload.poi_id
      const wx = payload.wx
      const wy = payload.wy
      const active = payload.active

      if (!pu || pu === userId || !poiId) return
      if (typeof wx !== 'number' || typeof wy !== 'number') return

      if (active === false) {
        onPeerDragEndRef.current?.(poiId, wx, wy)
        setPeerDrags((prev) => {
          const cur = prev[pu]
          if (!cur || cur.poiId !== poiId) return prev
          const next = { ...prev }
          delete next[pu]
          return next
        })
        return
      }

      setPeerDrags((prev) => ({
        ...prev,
        [pu]: {
          userId: pu,
          poiId,
          wx,
          wy,
          active: true,
          ts: Date.now(),
        },
      }))
    })

    return unsub
  }, [listId, enabled, userId])

  useEffect(() => {
    if (!enabled || !userId) return
    const id = window.setInterval(() => {
      const now = Date.now()
      setPeerDrags((prev) => {
        let changed = false
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          if (now - next[k].ts > DRAG_TTL_MS) {
            delete next[k]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, DRAG_SWEEP_MS)
    return () => window.clearInterval(id)
  }, [enabled, userId])

  useEffect(() => {
    if (hasOtherViewers) return
    setPeerDrags((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [hasOtherViewers])

  const send = useCallback(
    (payload: PinDragBroadcastPayload, force = false) => {
      const ch = channelRef.current
      if (!ch || !userId || !hasOtherViewers) return
      const now = Date.now()
      if (!force && now - lastSendRef.current < DRAG_SEND_MS) return
      lastSendRef.current = now
      void ch
        .send({
          type: 'broadcast',
          event: 'pin_drag',
          payload: { user_id: userId, ...payload },
        })
        .catch(() => {})
    },
    [userId, hasOtherViewers],
  )

  const broadcastDragStart = useCallback(
    (poiId: string, wx: number, wy: number) => {
      send({ poi_id: poiId, wx, wy, active: true }, true)
    },
    [send],
  )

  const broadcastDragMove = useCallback(
    (poiId: string, wx: number, wy: number) => {
      send({ poi_id: poiId, wx, wy, active: true })
    },
    [send],
  )

  const broadcastDragEnd = useCallback(
    (poiId: string, wx: number, wy: number) => {
      lastSendRef.current = 0
      send({ poi_id: poiId, wx, wy, active: false }, true)
    },
    [send],
  )

  const lockedPoiIds = useMemo(() => {
    const ids = new Set<string>()
    for (const drag of Object.values(peerDrags)) {
      if (drag.active) ids.add(drag.poiId)
    }
    return ids
  }, [peerDrags])

  const peerDragByPoiId = useMemo(() => {
    const m = new Map<string, PeerPinDrag>()
    for (const drag of Object.values(peerDrags)) {
      if (!drag.active) continue
      m.set(drag.poiId, drag)
    }
    return m
  }, [peerDrags])

  return {
    lockedPoiIds,
    peerDragByPoiId,
    broadcastDragStart,
    broadcastDragMove,
    broadcastDragEnd,
  }
}
