'use client'

import { useCallback, useMemo } from 'react'
import { presenceColorForUserId } from '@/lib/presenceColors'
import type { POIBase } from '@/lib/getaway'
import type { PresenceUser } from '@/lib/realtime'
import {
  pinHighlightColor,
  pinHoldState,
  sortPinsByStackZ,
} from '@/lib/boardPin'

export function useBoardPinPresence(opts: {
  pois: POIBase[]
  otherViewers: PresenceUser[]
  currentUserId?: string
  dragPoiId?: string | null
  pendingPoiId?: string | null
  peerDragByPoiId: ReadonlyMap<string, { userId: string }>
  peerSelectByPoiId: ReadonlyMap<string, { userId: string }>
  hiddenCursorUserIds: ReadonlySet<string>
}) {
  const {
    pois,
    otherViewers,
    currentUserId,
    dragPoiId,
    pendingPoiId,
    peerDragByPoiId,
    peerSelectByPoiId,
    hiddenCursorUserIds,
  } = opts

  const sortedPins = useMemo(() => sortPinsByStackZ(pois), [pois])

  const viewerColorById = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of otherViewers) {
      m.set(v.user_id, v.cursor_color ?? presenceColorForUserId(v.user_id))
    }
    return m
  }, [otherViewers])

  const hiddenCursorUserIdsWithDrag = useMemo(() => {
    const ids = new Set(hiddenCursorUserIds)
    if ((dragPoiId || pendingPoiId) && currentUserId) ids.add(currentUserId)
    return ids
  }, [hiddenCursorUserIds, dragPoiId, pendingPoiId, currentUserId])

  const peerDragPoiIds = useMemo(
    () => new Set(peerDragByPoiId.keys()),
    [peerDragByPoiId],
  )

  const pinHoldOpts = useMemo(
    () => ({
      localDragPoiId: dragPoiId ?? null,
      pendingPoiId: pendingPoiId ?? null,
      peerDragPoiIds,
    }),
    [dragPoiId, pendingPoiId, peerDragPoiIds],
  )

  const getPinHoldState = useCallback(
    (poiId: string) => pinHoldState(poiId, pinHoldOpts),
    [pinHoldOpts],
  )

  const getPinHighlightColor = useCallback(
    (poiId: string) => {
      const hold = getPinHoldState(poiId)
      const peerDrag = peerDragByPoiId.get(poiId)
      const peerSelect = peerSelectByPoiId.get(poiId)
      return pinHighlightColor(hold, {
        currentUserId,
        peerDragUserId: hold === 'remote' ? peerDrag?.userId : undefined,
        peerSelectUserId: peerSelect?.userId,
        viewerColorById,
      })
    },
    [
      getPinHoldState,
      currentUserId,
      peerDragByPoiId,
      peerSelectByPoiId,
      viewerColorById,
    ],
  )

  return {
    sortedPins,
    getPinHoldState,
    getPinHighlightColor,
    hiddenCursorUserIdsWithDrag,
  }
}
