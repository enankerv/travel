'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  subscribePinFocusBroadcast,
  type PinFocusBroadcastPayload,
  type PresenceUser,
} from '@/lib/realtime'

const FOCUS_SEND_MS = 100
const DRAG_TTL_MS = 2000
const DRAG_SWEEP_MS = 500

export type PeerPinFocus = {
  userId: string
  poiId: string
  wx?: number
  wy?: number
  dragging: boolean
  active: boolean
  ts: number
}

export function useBoardPinFocusSync({
  listId,
  enabled,
  userId,
  otherViewers,
  selectedPoiId,
  onPeerDragEnd,
}: {
  listId: string
  enabled: boolean
  userId: string | undefined
  otherViewers: PresenceUser[]
  selectedPoiId: string | null
  onPeerDragEnd?: (poiId: string, wx: number, wy: number) => void
}) {
  const [peerFocus, setPeerFocus] = useState<Record<string, PeerPinFocus>>({})
  const lastSendRef = useRef(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const hasOtherViewers = otherViewers.length > 0
  const selectedPoiIdRef = useRef(selectedPoiId)
  selectedPoiIdRef.current = selectedPoiId

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

    const unsub = subscribePinFocusBroadcast(listId, (payload: PinFocusBroadcastPayload) => {
      const pu = payload.user_id
      const poiId = payload.poi_id
      const wx = payload.wx
      const wy = payload.wy
      const active = payload.active
      const dragging = payload.dragging === true

      if (!pu || pu === userId) return

      if (active === false || !poiId) {
        if (dragging && poiId && typeof wx === 'number' && typeof wy === 'number') {
          onPeerDragEndRef.current?.(poiId, wx, wy)
        }
        setPeerFocus((prev) => {
          const cur = prev[pu]
          if (!cur) return prev
          if (poiId && cur.poiId !== poiId) return prev
          const next = { ...prev }
          delete next[pu]
          return next
        })
        return
      }

      if (dragging && (typeof wx !== 'number' || typeof wy !== 'number')) return

      setPeerFocus((prev) => ({
        ...prev,
        [pu]: {
          userId: pu,
          poiId,
          wx: dragging ? wx : undefined,
          wy: dragging ? wy : undefined,
          dragging,
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
      setPeerFocus((prev) => {
        let changed = false
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          const f = next[k]
          if (f.dragging && now - f.ts > DRAG_TTL_MS) {
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
    const viewerIds = new Set(otherViewers.map((v) => v.user_id))
    setPeerFocus((prev) => {
      let changed = false
      const next = { ...prev }
      for (const uid of Object.keys(next)) {
        if (!viewerIds.has(uid)) {
          delete next[uid]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [otherViewers])

  useEffect(() => {
    if (hasOtherViewers) return
    setPeerFocus((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [hasOtherViewers])

  const send = useCallback(
    (payload: PinFocusBroadcastPayload, force = false) => {
      const ch = channelRef.current
      if (!ch || !userId || !hasOtherViewers) return
      const now = Date.now()
      if (!force && now - lastSendRef.current < FOCUS_SEND_MS) return
      lastSendRef.current = now
      void ch
        .send({
          type: 'broadcast',
          event: 'pin_focus',
          payload: { user_id: userId, ...payload },
        })
        .catch(() => {})
    },
    [userId, hasOtherViewers],
  )

  useEffect(() => {
    if (!enabled || !userId) return
    if (selectedPoiId) {
      send({ poi_id: selectedPoiId, active: true, dragging: false }, true)
    } else {
      send({ poi_id: null, active: false, dragging: false }, true)
    }
  }, [enabled, userId, selectedPoiId, send])

  useEffect(() => {
    if (!enabled || !userId) return
    return () => {
      if (selectedPoiIdRef.current) {
        send({ poi_id: null, active: false, dragging: false }, true)
      }
    }
  }, [enabled, userId, send])

  const broadcastDragStart = useCallback(
    (poiId: string, wx: number, wy: number) => {
      send({ poi_id: poiId, wx, wy, active: true, dragging: true }, true)
    },
    [send],
  )

  const broadcastDragMove = useCallback(
    (poiId: string, wx: number, wy: number) => {
      send({ poi_id: poiId, wx, wy, active: true, dragging: true })
    },
    [send],
  )

  const broadcastDragEnd = useCallback(
    (poiId: string, wx: number, wy: number) => {
      lastSendRef.current = 0
      send({ poi_id: poiId, wx, wy, active: false, dragging: true }, true)
      if (selectedPoiIdRef.current === poiId) {
        send({ poi_id: poiId, active: true, dragging: false }, true)
      }
    },
    [send],
  )

  const lockedPoiIds = useMemo(() => {
    const ids = new Set<string>()
    for (const focus of Object.values(peerFocus)) {
      if (focus.active && focus.dragging) ids.add(focus.poiId)
    }
    return ids
  }, [peerFocus])

  const peerDragByPoiId = useMemo(() => {
    const m = new Map<string, PeerPinFocus>()
    for (const focus of Object.values(peerFocus)) {
      if (!focus.active || !focus.dragging) continue
      m.set(focus.poiId, focus)
    }
    return m
  }, [peerFocus])

  const peerSelectByPoiId = useMemo(() => {
    const m = new Map<string, PeerPinFocus>()
    for (const focus of Object.values(peerFocus)) {
      if (!focus.active || focus.dragging) continue
      m.set(focus.poiId, focus)
    }
    return m
  }, [peerFocus])

  const hiddenCursorUserIds = useMemo(() => {
    const ids = new Set<string>()
    if (selectedPoiId && userId) ids.add(userId)
    for (const focus of Object.values(peerFocus)) {
      if (focus.active) ids.add(focus.userId)
    }
    return ids
  }, [selectedPoiId, userId, peerFocus])

  return {
    lockedPoiIds,
    peerDragByPoiId,
    peerSelectByPoiId,
    hiddenCursorUserIds,
    broadcastDragStart,
    broadcastDragMove,
    broadcastDragEnd,
  }
}
