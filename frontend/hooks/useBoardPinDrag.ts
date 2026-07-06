'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { bulkUpdatePoiPositions } from '@/lib/api'
import type { BoardPoi } from '@/lib/board'
import type { BoardCamera } from '@/lib/boardCoords'
import {
  poiFromRoot,
  poiToRoot,
  subgroupContainingRootPoint,
  type BoardSubgroupTree,
} from '@/lib/boardSpace'
import {
  clearGospelEntry,
  commitGospelEntry,
  DEFAULT_BOARD_CAMERA,
  type GospelByPoiId,
} from '@/lib/boardViewport'
import {
  buildPendingPinPointer,
  dragPointerMatches,
  pendingPinToDragState,
  pendingPointerMatches,
  pinPosFromPointer,
  shouldPromotePendingDrag,
  type DragState,
  type PendingPinPointer,
} from '@/lib/boardPointer'
import { pruneStaleGospel, resolvePinPosition } from '@/lib/boardPin'
import type { POIBase } from '@/lib/getaway'
import type { BoardSubgroup } from '@/lib/subgroup'

export function useBoardPinDrag(opts: {
  listId: string
  pois: POIBase[]
  subgroups: BoardSubgroup[]
  subgroupTree: BoardSubgroupTree
  viewportRef: RefObject<HTMLDivElement | null>
  cameraRef: RefObject<BoardCamera | null>
  lockedPoiIds: ReadonlySet<string>
  peerDragByPoiId: ReadonlyMap<string, { wx?: number; wy?: number }>
  setPois: React.Dispatch<React.SetStateAction<BoardPoi[]>>
  setError: (msg: string) => void
  broadcastDragStart: (poiId: string, wx: number, wy: number) => void
  broadcastDragMove: (poiId: string, wx: number, wy: number) => void
  broadcastDragEnd: (poiId: string, wx: number, wy: number) => void
  onSelectPoi?: (poiId: string | null) => void
  onActivity?: () => void
}) {
  const {
    listId,
    pois,
    subgroups,
    subgroupTree,
    viewportRef,
    cameraRef,
    lockedPoiIds,
    peerDragByPoiId,
    setPois,
    setError,
    broadcastDragStart,
    broadcastDragMove,
    broadcastDragEnd,
    onSelectPoi,
    onActivity,
  } = opts

  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragPos, setDragPos] = useState<{ wx: number; wy: number } | null>(null)
  const [pendingPoiId, setPendingPoiId] = useState<string | null>(null)
  const [gospelByPoiId, setGospelByPoiId] = useState<GospelByPoiId>({})

  const dragRef = useRef(drag)
  dragRef.current = drag
  const dragPosRef = useRef(dragPos)
  dragPosRef.current = dragPos
  const pendingPinRef = useRef<PendingPinPointer | null>(null)
  const broadcastDragEndRef = useRef(broadcastDragEnd)
  broadcastDragEndRef.current = broadcastDragEnd
  const onSelectPoiRef = useRef(onSelectPoi)
  onSelectPoiRef.current = onSelectPoi
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity

  const subgroupsRef = useRef(subgroups)
  subgroupsRef.current = subgroups

  const pingActivity = useCallback(() => {
    onActivityRef.current?.()
  }, [])

  const commitGospel = useCallback((poiId: string, wx: number, wy: number) => {
    setGospelByPoiId((prev) => commitGospelEntry(prev, poiId, wx, wy))
  }, [])

  const handlePeerDragEnd = useCallback(
    (poiId: string, wx: number, wy: number) => {
      commitGospel(poiId, wx, wy)
    },
    [commitGospel],
  )

  useEffect(() => {
    setGospelByPoiId((prev) => pruneStaleGospel(prev, pois))
  }, [pois])

  const dragPosOverride =
    drag && dragPos ? { poiId: drag.poiId, wx: dragPos.wx, wy: dragPos.wy } : null

  const promotePendingToDrag = useCallback(
    (pending: PendingPinPointer) => {
      pendingPinRef.current = null
      setPendingPoiId(null)
      const next = pendingPinToDragState(pending)
      dragRef.current = next
      setDrag(next)
      setDragPos({ wx: pending.startWx, wy: pending.startWy })
      broadcastDragStart(pending.poiId, pending.startWx, pending.startWy)
    },
    [broadcastDragStart],
  )

  const subgroupTreeRef = useRef(subgroupTree)
  subgroupTreeRef.current = subgroupTree

  const finishDrag = useCallback(
    async (state: DragState, pos: { wx: number; wy: number }) => {
      const poi = pois.find((p) => p.id === state.poiId)
      if (!poi) return

      const subgroupsNow = subgroupsRef.current
      const root = poiToRoot(poi, subgroupsNow, pos)
      const dropSubgroupId = subgroupContainingRootPoint(
        root,
        subgroupTreeRef.current,
      )
      const offset = poiFromRoot(root, dropSubgroupId, subgroupsNow, {
        clamp: true,
      })

      const prevSubgroupId = poi.subgroup_id ?? null
      const reparented = dropSubgroupId !== prevSubgroupId

      commitGospel(state.poiId, offset.wx, offset.wy)
      broadcastDragEnd(state.poiId, offset.wx, offset.wy)
      setPois((prev) =>
        prev.map((p) =>
          p.id === state.poiId
            ? {
                ...p,
                board_x: offset.wx,
                board_y: offset.wy,
                subgroup_id: dropSubgroupId,
              }
            : p,
        ),
      )
      try {
        await bulkUpdatePoiPositions(listId, [
          {
            id: state.poiId,
            board_x: offset.wx,
            board_y: offset.wy,
            ...(reparented ? { subgroup_id: dropSubgroupId } : {}),
          },
        ])
      } catch {
        setError('Failed to save pin position')
        setGospelByPoiId((prev) => clearGospelEntry(prev, state.poiId))
        setPois((prev) =>
          prev.map((p) =>
            p.id === state.poiId
              ? {
                  ...p,
                  board_x: state.startWx,
                  board_y: state.startWy,
                  subgroup_id: prevSubgroupId,
                }
              : p,
          ),
        )
      }
    },
    [listId, pois, setPois, setError, broadcastDragEnd, commitGospel],
  )

  const onPinPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pending = pendingPinRef.current
      if (pending && pending.pointerId === e.pointerId && !dragRef.current) {
        if (shouldPromotePendingDrag(pending, e.clientX, e.clientY)) {
          promotePendingToDrag(pending)
          pingActivity()
          const vp = viewportRef.current
          const poi = pois.find((p) => p.id === pending.poiId)
          if (vp && poi) {
            const pos = pinPosFromPointer(
              vp,
              cameraRef.current ?? DEFAULT_BOARD_CAMERA,
              pending,
              e.clientX,
              e.clientY,
              poi,
              subgroupsRef.current,
            )
            if (pos) {
              setDragPos(pos)
              broadcastDragMove(pending.poiId, pos.wx, pos.wy)
            }
          }
          return true
        }
      }

      const activeDrag = dragRef.current
      if (activeDrag && activeDrag.pointerId === e.pointerId) {
        pingActivity()
        const vp = viewportRef.current
        const poi = pois.find((p) => p.id === activeDrag.poiId)
        if (!vp || !poi) return true
        const pos = pinPosFromPointer(
          vp,
          cameraRef.current ?? DEFAULT_BOARD_CAMERA,
          activeDrag,
          e.clientX,
          e.clientY,
          poi,
          subgroupsRef.current,
        )
        if (!pos) return true
        setDragPos(pos)
        broadcastDragMove(activeDrag.poiId, pos.wx, pos.wy)
        return true
      }

      return false
    },
    [
      viewportRef,
      cameraRef,
      pingActivity,
      broadcastDragMove,
      promotePendingToDrag,
      pois,
    ],
  )

  const onPinPointerUp = useCallback(
    (pointerId: number) => {
      const pending = pendingPinRef.current
      if (pendingPointerMatches(pending, pointerId)) {
        pendingPinRef.current = null
        setPendingPoiId(null)
        if (!dragRef.current) {
          broadcastDragEnd(pending.poiId, pending.startWx, pending.startWy)
          onSelectPoiRef.current?.(pending.poiId)
        }
        return true
      }

      const activeDrag = dragRef.current
      if (dragPointerMatches(activeDrag, pointerId)) {
        const wx = dragPosRef.current?.wx ?? activeDrag.startWx
        const wy = dragPosRef.current?.wy ?? activeDrag.startWy
        commitGospel(activeDrag.poiId, wx, wy)
        dragRef.current = null
        setDrag(null)
        setDragPos(null)
        void finishDrag(activeDrag, { wx, wy })
        return true
      }

      return false
    },
    [broadcastDragEnd, commitGospel, finishDrag],
  )

  const onPinPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, poi: POIBase) => {
      e.stopPropagation()
      if (e.button !== 0) return
      if (lockedPoiIds.has(poi.id)) return
      setGospelByPoiId((prev) => clearGospelEntry(prev, poi.id))
      pingActivity()
      e.currentTarget.setPointerCapture(e.pointerId)
      const wx = poi.board_x ?? 0.5
      const wy = poi.board_y ?? 0.5
      const vp = viewportRef.current
      if (!vp) return
      pendingPinRef.current = buildPendingPinPointer({
        poiId: poi.id,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        anchorWx: wx,
        anchorWy: wy,
        pinEl: e.currentTarget,
        viewport: vp,
        camera: cameraRef.current ?? DEFAULT_BOARD_CAMERA,
        poi,
        subgroups: subgroupsRef.current,
      })
      setPendingPoiId(poi.id)
      broadcastDragStart(poi.id, wx, wy)
    },
    [viewportRef, cameraRef, pingActivity, lockedPoiIds, broadcastDragStart],
  )

  useEffect(() => {
    return () => {
      pendingPinRef.current = null
      setPendingPoiId(null)
      const d = dragRef.current
      const pos = dragPosRef.current
      if (d) {
        broadcastDragEndRef.current(
          d.poiId,
          pos?.wx ?? d.startWx,
          pos?.wy ?? d.startWy,
        )
      }
    }
  }, [])

  const getPinPos = useCallback(
    (poi: POIBase) =>
      resolvePinPosition(poi, {
        localDragPoiId: drag?.poiId,
        localDragPos: dragPos,
        peerDrag: peerDragByPoiId.get(poi.id),
        gospel: gospelByPoiId[poi.id],
      }),
    [drag, dragPos, peerDragByPoiId, gospelByPoiId],
  )

  return {
    drag,
    pendingPoiId,
    dragPosOverride,
    handlePeerDragEnd,
    onPinPointerDown,
    onPinPointerMove,
    onPinPointerUp,
    getPinPos,
  }
}
