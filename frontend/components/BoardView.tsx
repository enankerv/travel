'use client'

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPoi, updatePoi } from '@/lib/api'
import { useBoardContext } from '@/lib/BoardContext'
import { useBoardPinFocusSync } from '@/hooks/useBoardPinFocusSync'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'
import { presenceColorForUserId } from '@/lib/presenceColors'
import {
  BOARD_WORLD_H,
  BOARD_WORLD_W,
  screenToBoardNorm,
  type BoardCamera,
} from '@/lib/boardCoords'
import {
  anchorFromDragPointer,
  cameraTransform,
  computeFitCamera,
  computePinGrabOffsets,
  exceedsDragThreshold,
  pinCoordsEqual,
  zoomCameraAtPoint,
  type PinDragGrab,
} from '@/lib/boardMath'
import type { POIBase } from '@/lib/getaway'
import {
  BOARD_POI_TYPE_OPTIONS,
  defaultTitleForPoiType,
  iconForPoiType,
  poiImageSources,
  type BoardCreatablePoiType,
} from '@/lib/poi'
import type { BoardPoi } from '@/lib/board'
import BoardCursorLayer from './BoardCursorLayer'

export type BoardViewHandle = {
  fitCamera: () => void
  addPoiAtCenter: (poiType: BoardCreatablePoiType) => void
}

function pinLabel(poi: POIBase): string {
  if (poi.title?.trim()) return poi.title.trim()
  const opt = BOARD_POI_TYPE_OPTIONS.find((o) => o.type === poi.poi_type)
  if (opt) return opt.label
  if (poi.poi_type === 'getaway') return 'Getaway'
  return 'Pin'
}

/** Stable slight tilt per pin — scattered polaroids on a cork board. */
function pinTilt(poiId: string): number {
  let h = 0
  for (let i = 0; i < poiId.length; i++) {
    h = (h * 31 + poiId.charCodeAt(i)) | 0
  }
  return (h % 70) / 10 - 3.5
}

/** How this pin is being held — drives lift animation + movement smoothing. */
type PinHoldState = 'none' | 'grab' | 'local' | 'remote'

const BoardPin = memo(function BoardPin({
  poi,
  wx,
  wy,
  holdState,
  isSelected,
  lockedByPeer,
  highlightColor,
  onPointerDown,
}: {
  poi: POIBase
  wx: number
  wy: number
  holdState: PinHoldState
  isSelected: boolean
  lockedByPeer: boolean
  highlightColor?: string
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>, poi: POIBase) => void
}) {
  const signedUrls = useSignedImageUrls(poiImageSources(poi))
  const img = signedUrls[0] ?? ''
  const isHeld = holdState !== 'none'
  const showHighlight = isSelected || isHeld || !!highlightColor
  const label = pinLabel(poi)
  return (
    <button
      type="button"
      className={`board-pin board-pin--${poi.poi_type}${isHeld ? ' board-pin--dragging' : ''}${holdState === 'local' ? ' board-pin--local-drag' : ''}${holdState === 'remote' ? ' board-pin--remote-drag' : ''}${lockedByPeer ? ' board-pin--locked' : ''}${showHighlight ? ' board-pin--selected' : ''}`}
      style={{
        left: `${wx * 100}%`,
        top: `${wy * 100}%`,
        zIndex: Math.round(
          (poi.board_z ?? 0) + (isHeld || lockedByPeer || isSelected ? 1000 : 0),
        ),
        ...(showHighlight
          ? ({
              '--pin-highlight':
                highlightColor ?? 'var(--board-pin-select, #5b8cff)',
            } as CSSProperties)
          : {}),
        ['--pin-tilt' as string]: `${pinTilt(poi.id)}deg`,
      }}
      disabled={lockedByPeer}
      onPointerDown={(e) => onPointerDown(e, poi)}
      aria-label={label}
    >
      <span className="board-pin__tack" aria-hidden />
      <span className="board-pin__polaroid">
        <span className="board-pin__photo">
          {img ? (
            <img className="board-pin__thumb" src={img} alt="" draggable={false} />
          ) : (
            <span className="board-pin__placeholder" aria-hidden>
              {iconForPoiType(poi.poi_type)}
            </span>
          )}
        </span>
        <span className="board-pin__caption">{label}</span>
      </span>
    </button>
  )
})

type DragState = {
  poiId: string
  startWx: number
  startWy: number
  pointerId: number
} & PinDragGrab

type PendingPinPointer = {
  poiId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startWx: number
  startWy: number
} & PinDragGrab

const BoardView = forwardRef<
  BoardViewHandle,
  {
    listId: string
    enabled: boolean
    onActivity?: () => void
    selectedPoiId?: string | null
    onSelectPoi?: (poiId: string | null) => void
  }
>(function BoardView(
  {
    listId,
    enabled,
    onActivity,
    selectedPoiId = null,
    onSelectPoi,
  },
  ref,
) {
  const { pois, setPois, otherViewers, setError, currentUserId } = useBoardContext()
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragPos, setDragPos] = useState<{ wx: number; wy: number } | null>(null)
  const [pendingPoiId, setPendingPoiId] = useState<string | null>(null)
  /** Drop position we trust over stale context/realtime until the server confirms. */
  const [gospelByPoiId, setGospelByPoiId] = useState<
    Record<string, { wx: number; wy: number }>
  >({})

  const commitGospel = useCallback((poiId: string, wx: number, wy: number) => {
    setGospelByPoiId((prev) => ({ ...prev, [poiId]: { wx, wy } }))
  }, [])

  const handlePeerDragEnd = useCallback(
    (poiId: string, wx: number, wy: number) => {
      commitGospel(poiId, wx, wy)
    },
    [commitGospel],
  )

  const {
    lockedPoiIds,
    peerDragByPoiId,
    peerSelectByPoiId,
    hiddenCursorUserIds,
    broadcastDragStart,
    broadcastDragMove,
    broadcastDragEnd,
  } = useBoardPinFocusSync({
    listId,
    enabled,
    userId: currentUserId,
    otherViewers,
    selectedPoiId: selectedPoiId ?? null,
    onPeerDragEnd: handlePeerDragEnd,
  })
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<BoardCamera>({ x: 0, y: 0, scale: 0.35 })
  const cameraRafRef = useRef(0)
  const pendingCameraRef = useRef<BoardCamera | null>(null)
  const panningRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    camX: number
    camY: number
  } | null>(null)
  const [creating, setCreating] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const spaceDownRef = useRef(false)
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity
  const dragRef = useRef(drag)
  dragRef.current = drag
  const dragPosRef = useRef(dragPos)
  dragPosRef.current = dragPos
  const broadcastDragEndRef = useRef(broadcastDragEnd)
  broadcastDragEndRef.current = broadcastDragEnd
  const pendingPinRef = useRef<PendingPinPointer | null>(null)
  const onSelectPoiRef = useRef(onSelectPoi)
  onSelectPoiRef.current = onSelectPoi

  const pingActivity = useCallback(() => {
    onActivityRef.current?.()
  }, [])

  const applyCamera = useCallback((cam: BoardCamera) => {
    cameraRef.current = cam
    const world = worldRef.current
    if (world) world.style.transform = cameraTransform(cam)
  }, [])

  const flushCamera = useCallback(() => {
    cameraRafRef.current = 0
    const next = pendingCameraRef.current
    if (!next) return
    pendingCameraRef.current = null
    applyCamera(next)
  }, [applyCamera])

  const scheduleCamera = useCallback(
    (cam: BoardCamera) => {
      pendingCameraRef.current = cam
      pingActivity()
      if (cameraRafRef.current) return
      cameraRafRef.current = requestAnimationFrame(flushCamera)
    },
    [flushCamera, pingActivity],
  )

  const sortedPins = useMemo(() => {
    return [...pois].sort((a, b) => (a.board_z ?? 0) - (b.board_z ?? 0))
  }, [pois])

  const viewerColorById = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of otherViewers) {
      m.set(v.user_id, v.cursor_color ?? presenceColorForUserId(v.user_id))
    }
    return m
  }, [otherViewers])

  const hiddenCursorUserIdsWithDrag = useMemo(() => {
    const ids = new Set(hiddenCursorUserIds)
    if ((drag || pendingPoiId) && currentUserId) ids.add(currentUserId)
    return ids
  }, [hiddenCursorUserIds, drag, pendingPoiId, currentUserId])

  const pinHoldState = useCallback(
    (poiId: string): PinHoldState => {
      if (drag?.poiId === poiId) return 'local'
      if (pendingPoiId === poiId) return 'grab'
      if (peerDragByPoiId.has(poiId)) return 'remote'
      return 'none'
    },
    [drag, pendingPoiId, peerDragByPoiId],
  )

  const pinHighlightColor = useCallback(
    (poiId: string) => {
      const hold = pinHoldState(poiId)
      if (hold === 'local' || hold === 'grab') {
        return currentUserId
          ? presenceColorForUserId(currentUserId)
          : undefined
      }
      const peerDrag = peerDragByPoiId.get(poiId)
      if (peerDrag) {
        return (
          viewerColorById.get(peerDrag.userId) ??
          presenceColorForUserId(peerDrag.userId)
        )
      }
      const peerSelect = peerSelectByPoiId.get(poiId)
      if (peerSelect) {
        return (
          viewerColorById.get(peerSelect.userId) ??
          presenceColorForUserId(peerSelect.userId)
        )
      }
      return undefined
    },
    [pinHoldState, currentUserId, peerDragByPoiId, peerSelectByPoiId, viewerColorById],
  )

  useEffect(() => {
    setGospelByPoiId((prev) => {
      let next: Record<string, { wx: number; wy: number }> | null = null
      for (const poiId of Object.keys(prev)) {
        const poi = pois.find((p) => p.id === poiId)
        if (!poi) continue
        const gospel = prev[poiId]
        const server = { wx: poi.board_x ?? 0.5, wy: poi.board_y ?? 0.5 }
        if (pinCoordsEqual(gospel, server)) {
          if (!next) next = { ...prev }
          delete next[poiId]
        }
      }
      return next ?? prev
    })
  }, [pois])

  const fitCamera = useCallback((): boolean => {
    const vp = viewportRef.current
    if (!vp) return false
    const { width, height } = vp.getBoundingClientRect()
    if (width <= 0 || height <= 0) return false

    const posOverride =
      drag && dragPos ? { poiId: drag.poiId, wx: dragPos.wx, wy: dragPos.wy } : null
    applyCamera(computeFitCamera(width, height, pois, posOverride))
    return true
  }, [applyCamera, pois, drag, dragPos])

  const addPoiAt = useCallback(
    async (wx: number, wy: number, poiType: BoardCreatablePoiType) => {
      if (creating) return
      pingActivity()
      setCreating(true)
      try {
        const poi = await createPoi(listId, {
          poi_type: poiType,
          title: defaultTitleForPoiType(poiType),
          board_x: wx,
          board_y: wy,
        })
        setPois((prev) => {
          if (prev.some((p) => p.id === poi.id)) return prev
          return [...prev, { ...poi, comments: [], votes: [] } as BoardPoi]
        })
      } catch {
        setError('Failed to add item')
      } finally {
        setCreating(false)
      }
    },
    [creating, listId, setPois, setError, pingActivity],
  )

  const fitCameraRef = useRef(fitCamera)
  fitCameraRef.current = fitCamera
  const applyCameraRef = useRef(applyCamera)
  applyCameraRef.current = applyCamera
  const initialFitDone = useRef(false)

  useImperativeHandle(
    ref,
    () => ({
      fitCamera: () => {
        fitCameraRef.current()
      },
      addPoiAtCenter: (poiType: BoardCreatablePoiType) => void addPoiAt(0.5, 0.5, poiType),
    }),
    [addPoiAt],
  )

  // Fit once when the viewport has real dimensions; re-sync transform when the tab
  // returns from background (browsers may drop the GPU layer / report 0×0 while hidden).
  useEffect(() => {
    let raf = 0

    const syncCameraDom = () => {
      const vp = viewportRef.current
      if (!vp) return
      const { width, height } = vp.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      applyCameraRef.current(cameraRef.current)
    }

    const tryInitialFit = () => {
      if (initialFitDone.current) return true
      if (fitCameraRef.current()) {
        initialFitDone.current = true
        return true
      }
      return false
    }

    const scheduleFitRetry = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(function tick() {
        if (tryInitialFit()) return
        if (document.visibilityState !== 'visible') return
        raf = requestAnimationFrame(tick)
      })
    }

    const onViewportReady = () => {
      if (tryInitialFit()) return
      syncCameraDom()
    }

    scheduleFitRetry()

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      raf = requestAnimationFrame(onViewportReady)
      if (!initialFitDone.current) scheduleFitRetry()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const ro = new ResizeObserver(() => {
      raf = requestAnimationFrame(onViewportReady)
    })
    const vp = viewportRef.current
    if (vp) ro.observe(vp)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      ro.disconnect()
      if (cameraRafRef.current) cancelAnimationFrame(cameraRafRef.current)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) spaceDownRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      pingActivity()
      const rect = vp.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      pendingCameraRef.current = zoomCameraAtPoint(
        cameraRef.current,
        mx,
        my,
        e.deltaY,
      )
      if (!cameraRafRef.current) {
        cameraRafRef.current = requestAnimationFrame(flushCamera)
      }
    }

    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [flushCamera, pingActivity])

  const onViewportPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement
      const onBackground =
        t.classList.contains('board-view__world') ||
        t.classList.contains('board-view__cork') ||
        t === e.currentTarget
      const isPan =
        e.button === 1 ||
        e.button === 2 ||
        spaceDownRef.current ||
        (e.button === 0 && onBackground)
      if (!isPan) return
      onSelectPoiRef.current?.(null)
      pingActivity()
      e.currentTarget.setPointerCapture(e.pointerId)
      setInteracting(true)
      panningRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        camX: cameraRef.current.x,
        camY: cameraRef.current.y,
      }
    },
    [pingActivity],
  )

  const promotePendingToDrag = useCallback(
    (pending: PendingPinPointer) => {
      pendingPinRef.current = null
      setPendingPoiId(null)
      const next: DragState = {
        poiId: pending.poiId,
        startWx: pending.startWx,
        startWy: pending.startWy,
        pointerId: pending.pointerId,
        grabOffsetWx: pending.grabOffsetWx,
        grabOffsetWy: pending.grabOffsetWy,
        anchorFromCenterWx: pending.anchorFromCenterWx,
        anchorFromCenterWy: pending.anchorFromCenterWy,
      }
      dragRef.current = next
      setDrag(next)
      setDragPos({ wx: pending.startWx, wy: pending.startWy })
      broadcastDragStart(pending.poiId, pending.startWx, pending.startWy)
    },
    [broadcastDragStart],
  )

  const onViewportPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pan = panningRef.current
      if (pan && pan.pointerId === e.pointerId) {
        scheduleCamera({
          ...cameraRef.current,
          x: pan.camX + (e.clientX - pan.startX),
          y: pan.camY + (e.clientY - pan.startY),
        })
        return
      }

      const pending = pendingPinRef.current
      if (pending && pending.pointerId === e.pointerId && !dragRef.current) {
        if (exceedsDragThreshold(pending.startClientX, pending.startClientY, e.clientX, e.clientY)) {
          promotePendingToDrag(pending)
          pingActivity()
          const vp = viewportRef.current
          if (vp) {
            const norm = screenToBoardNorm(vp, cameraRef.current, e.clientX, e.clientY)
            if (norm) {
              const pos = anchorFromDragPointer(pending, norm.wx, norm.wy)
              setDragPos(pos)
              broadcastDragMove(pending.poiId, pos.wx, pos.wy)
            }
          }
          return
        }
      }

      const activeDrag = dragRef.current
      if (activeDrag && activeDrag.pointerId === e.pointerId) {
        pingActivity()
        const vp = viewportRef.current
        if (!vp) return
        const norm = screenToBoardNorm(vp, cameraRef.current, e.clientX, e.clientY)
        if (!norm) return
        const pos = anchorFromDragPointer(activeDrag, norm.wx, norm.wy)
        setDragPos(pos)
        broadcastDragMove(activeDrag.poiId, pos.wx, pos.wy)
      }
    },
    [scheduleCamera, pingActivity, broadcastDragMove, promotePendingToDrag],
  )

  const finishPan = useCallback((pointerId: number) => {
    if (panningRef.current?.pointerId === pointerId) {
      panningRef.current = null
      setInteracting(false)
    }
  }, [])

  const finishDrag = useCallback(
    async (state: DragState, pos: { wx: number; wy: number }) => {
      commitGospel(state.poiId, pos.wx, pos.wy)
      broadcastDragEnd(state.poiId, pos.wx, pos.wy)
      setPois((prev) =>
        prev.map((p) =>
          p.id === state.poiId ? { ...p, board_x: pos.wx, board_y: pos.wy } : p,
        ),
      )
      try {
        await updatePoi(listId, state.poiId, { board_x: pos.wx, board_y: pos.wy })
      } catch {
        setError('Failed to save pin position')
        setGospelByPoiId((prev) => {
          const next = { ...prev }
          delete next[state.poiId]
          return next
        })
        setPois((prev) =>
          prev.map((p) =>
            p.id === state.poiId
              ? { ...p, board_x: state.startWx, board_y: state.startWy }
              : p,
          ),
        )
      }
    },
    [listId, setPois, setError, broadcastDragEnd, commitGospel],
  )

  const onViewportPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      finishPan(e.pointerId)

      const pending = pendingPinRef.current
      if (pending && pending.pointerId === e.pointerId) {
        pendingPinRef.current = null
        setPendingPoiId(null)
        if (!dragRef.current) {
          broadcastDragEnd(pending.poiId, pending.startWx, pending.startWy)
          onSelectPoiRef.current?.(pending.poiId)
        }
      }

      const activeDrag = dragRef.current
      if (activeDrag && activeDrag.pointerId === e.pointerId) {
        const wx = dragPosRef.current?.wx ?? activeDrag.startWx
        const wy = dragPosRef.current?.wy ?? activeDrag.startWy
        commitGospel(activeDrag.poiId, wx, wy)
        dragRef.current = null
        setDrag(null)
        setDragPos(null)
        void finishDrag(activeDrag, { wx, wy })
      }
    },
    [finishDrag, finishPan, commitGospel, broadcastDragEnd],
  )

  const onPinPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, poi: POIBase) => {
      e.stopPropagation()
      if (e.button !== 0) return
      if (lockedPoiIds.has(poi.id)) return
      setGospelByPoiId((prev) => {
        if (!(poi.id in prev)) return prev
        const next = { ...prev }
        delete next[poi.id]
        return next
      })
      pingActivity()
      e.currentTarget.setPointerCapture(e.pointerId)
      const wx = poi.board_x ?? 0.5
      const wy = poi.board_y ?? 0.5
      const vp = viewportRef.current
      const grab = vp
        ? computePinGrabOffsets(
            e.currentTarget,
            vp,
            cameraRef.current,
            e.clientX,
            e.clientY,
            wx,
            wy,
          )
        : {
            grabOffsetWx: 0,
            grabOffsetWy: 0,
            anchorFromCenterWx: 0,
            anchorFromCenterWy: 0,
          }
      pendingPinRef.current = {
        poiId: poi.id,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startWx: wx,
        startWy: wy,
        ...grab,
      }
      setPendingPoiId(poi.id)
      broadcastDragStart(poi.id, wx, wy)
    },
    [pingActivity, lockedPoiIds, broadcastDragStart],
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

  const resolvePinPos = useCallback(
    (poi: POIBase) => {
      if (drag?.poiId === poi.id && dragPos) return dragPos
      const peer = peerDragByPoiId.get(poi.id)
      if (peer && peer.wx != null && peer.wy != null) {
        return { wx: peer.wx, wy: peer.wy }
      }
      const gospel = gospelByPoiId[poi.id]
      if (gospel) return gospel
      return { wx: poi.board_x ?? 0.5, wy: poi.board_y ?? 0.5 }
    },
    [drag, dragPos, peerDragByPoiId, gospelByPoiId],
  )

  return (
    <div className="board-view board-view--fullscreen">
      <div
        ref={viewportRef}
        className={`board-view__viewport${interacting ? ' board-view__viewport--active' : ''}`}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={worldRef}
          className="board-view__world"
          style={{ width: BOARD_WORLD_W, height: BOARD_WORLD_H }}
        >
          <div className="board-view__cork" aria-hidden />

          {sortedPins.map((poi) => {
            const pos = resolvePinPos(poi)
            const lockedByPeer = lockedPoiIds.has(poi.id) && drag?.poiId !== poi.id
            return (
              <BoardPin
                key={poi.id}
                poi={poi}
                wx={pos.wx}
                wy={pos.wy}
                holdState={pinHoldState(poi.id)}
                isSelected={selectedPoiId === poi.id}
                lockedByPeer={lockedByPeer}
                highlightColor={pinHighlightColor(poi.id)}
                onPointerDown={onPinPointerDown}
              />
            )
          })}

          <BoardCursorLayer
            listId={listId}
            enabled={enabled}
            otherViewers={otherViewers}
            viewportRef={viewportRef}
            cameraRef={cameraRef}
            hiddenCursorUserIds={hiddenCursorUserIdsWithDrag}
          />
        </div>
      </div>
    </div>
  )
})

export default BoardView
