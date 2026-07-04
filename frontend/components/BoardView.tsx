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
import type { POIBase } from '@/lib/getaway'
import {
  BOARD_POI_TYPE_OPTIONS,
  defaultTitleForPoiType,
  iconForPoiType,
  poiImageSources,
  type BoardCreatablePoiType,
} from '@/lib/poi'
import type { BoardPoi } from '@/lib/board'
import BoardAddItemButton from './BoardAddItemButton'
import BoardCursorLayer from './BoardCursorLayer'

const MIN_SCALE = 0.08
const MAX_SCALE = 2.5
/** Visual padding around pin anchors when fitting (world px). */
const PIN_PAD_X = 88
const PIN_PAD_TOP = 142
const PIN_PAD_BOTTOM = 14
const MIN_FIT_SPAN = 180
const FIT_MARGIN = 0.88
/** Screen px before a pin pointer down becomes a drag (not a click). */
const PIN_DRAG_THRESHOLD_PX = 6

function poiBoundsWorld(
  pois: POIBase[],
  posOverride?: { poiId: string; wx: number; wy: number } | null,
) {
  if (pois.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const poi of pois) {
    const overridden =
      posOverride?.poiId === poi.id ? posOverride : null
    const wx = overridden?.wx ?? poi.board_x ?? 0.5
    const wy = overridden?.wy ?? poi.board_y ?? 0.5
    const bx = wx * BOARD_WORLD_W
    const by = wy * BOARD_WORLD_H
    minX = Math.min(minX, bx - PIN_PAD_X)
    maxX = Math.max(maxX, bx + PIN_PAD_X)
    minY = Math.min(minY, by - PIN_PAD_TOP)
    maxY = Math.max(maxY, by + PIN_PAD_BOTTOM)
  }

  return { minX, minY, maxX, maxY }
}

function cameraForBounds(
  viewportW: number,
  viewportH: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): BoardCamera {
  let { minX, minY, maxX, maxY } = bounds
  let bw = maxX - minX
  let bh = maxY - minY

  if (bw < MIN_FIT_SPAN) {
    const cx = (minX + maxX) / 2
    minX = cx - MIN_FIT_SPAN / 2
    maxX = cx + MIN_FIT_SPAN / 2
    bw = MIN_FIT_SPAN
  }
  if (bh < MIN_FIT_SPAN) {
    const cy = (minY + maxY) / 2
    minY = cy - MIN_FIT_SPAN / 2
    maxY = cy + MIN_FIT_SPAN / 2
    bh = MIN_FIT_SPAN
  }

  const scale = clamp(
    Math.min(viewportW / bw, viewportH / bh) * FIT_MARGIN,
    MIN_SCALE,
    MAX_SCALE,
  )
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  return {
    x: viewportW / 2 - cx * scale,
    y: viewportH / 2 - cy * scale,
    scale,
  }
}

export type BoardViewHandle = {
  fitCamera: () => void
  addPoiAtCenter: (poiType: BoardCreatablePoiType) => void
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function coordsMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.0001
}

function pinCoordsEqual(
  a: { wx: number; wy: number },
  b: { wx: number; wy: number },
) {
  return coordsMatch(a.wx, b.wx) && coordsMatch(a.wy, b.wy)
}

function cameraTransform(cam: BoardCamera) {
  return `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.scale})`
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
  /** Cursor − pin center at pointer down (normalized). */
  grabOffsetWx: number
  grabOffsetWy: number
  /** Anchor − pin center at pointer down (normalized). */
  anchorFromCenterWx: number
  anchorFromCenterWy: number
}

type PendingPinPointer = {
  poiId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startWx: number
  startWy: number
  grabOffsetWx: number
  grabOffsetWy: number
  anchorFromCenterWx: number
  anchorFromCenterWy: number
}

function pinCenterNorm(
  pinEl: HTMLElement,
  viewport: HTMLDivElement,
  camera: BoardCamera,
): { wx: number; wy: number } | null {
  const rect = pinEl.getBoundingClientRect()
  return screenToBoardNorm(
    viewport,
    camera,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  )
}

/** Map cursor position → anchor, keeping pin center fixed relative to the grab. */
function anchorFromDragPointer(
  drag: Pick<
    PendingPinPointer,
    'grabOffsetWx' | 'grabOffsetWy' | 'anchorFromCenterWx' | 'anchorFromCenterWy'
  >,
  cursorWx: number,
  cursorWy: number,
): { wx: number; wy: number } {
  const centerWx = cursorWx - drag.grabOffsetWx
  const centerWy = cursorWy - drag.grabOffsetWy
  return {
    wx: clamp(centerWx + drag.anchorFromCenterWx, 0, 1),
    wy: clamp(centerWy + drag.anchorFromCenterWy, 0, 1),
  }
}

const BoardView = forwardRef<
  BoardViewHandle,
  {
    listId: string
    enabled: boolean
    fullscreen?: boolean
    onActivity?: () => void
    selectedPoiId?: string | null
    onSelectPoi?: (poiId: string | null) => void
  }
>(function BoardView(
  {
    listId,
    enabled,
    fullscreen = false,
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
    const bounds = poiBoundsWorld(pois, posOverride)

    if (!bounds) {
      const scale = clamp(
        Math.min(width / (BOARD_WORLD_W * 0.35), height / (BOARD_WORLD_H * 0.35)) *
          FIT_MARGIN,
        MIN_SCALE,
        MAX_SCALE,
      )
      applyCamera({
        x: width / 2 - (BOARD_WORLD_W * 0.5) * scale,
        y: height / 2 - (BOARD_WORLD_H * 0.5) * scale,
        scale,
      })
      return true
    }

    applyCamera(cameraForBounds(width, height, bounds))
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
      const cam = cameraRef.current
      const wx = (mx - cam.x) / cam.scale
      const wy = (my - cam.y) / cam.scale
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const newScale = clamp(cam.scale * factor, MIN_SCALE, MAX_SCALE)
      pendingCameraRef.current = {
        x: mx - wx * newScale,
        y: my - wy * newScale,
        scale: newScale,
      }
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
        const dx = e.clientX - pending.startClientX
        const dy = e.clientY - pending.startClientY
        if (Math.hypot(dx, dy) >= PIN_DRAG_THRESHOLD_PX) {
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
      const cursorNorm = vp
        ? screenToBoardNorm(vp, cameraRef.current, e.clientX, e.clientY)
        : null
      const centerNorm = vp
        ? pinCenterNorm(e.currentTarget, vp, cameraRef.current)
        : null
      let grabOffsetWx = 0
      let grabOffsetWy = 0
      let anchorFromCenterWx = 0
      let anchorFromCenterWy = 0
      if (cursorNorm && centerNorm) {
        grabOffsetWx = cursorNorm.wx - centerNorm.wx
        grabOffsetWy = cursorNorm.wy - centerNorm.wy
        anchorFromCenterWx = wx - centerNorm.wx
        anchorFromCenterWy = wy - centerNorm.wy
      }
      pendingPinRef.current = {
        poiId: poi.id,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startWx: wx,
        startWy: wy,
        grabOffsetWx,
        grabOffsetWy,
        anchorFromCenterWx,
        anchorFromCenterWy,
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

  const onBoardDoubleClick = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement
      if (
        !t.classList.contains('board-view__world') &&
        !t.classList.contains('board-view__cork')
      ) {
        return
      }
      const vp = viewportRef.current
      if (!vp) return
      const norm = screenToBoardNorm(vp, cameraRef.current, e.clientX, e.clientY)
      if (!norm) return
      void addPoiAt(
        clamp(norm.wx, 0.02, 0.98),
        clamp(norm.wy, 0.02, 0.98),
        'poi',
      )
    },
    [addPoiAt],
  )

  return (
    <div className={`board-view${fullscreen ? ' board-view--fullscreen' : ''}`}>
      {!fullscreen && (
        <div className="board-view__toolbar">
          <button
            type="button"
            className="board-view__tool-btn"
            onClick={() => fitCamera()}
            title="Fit board to view"
          >
            Fit
          </button>
          <BoardAddItemButton
            creating={creating}
            buttonClassName="board-view__tool-btn"
            onAdd={(poiType) => void addPoiAt(0.5, 0.5, poiType)}
          />
          <span className="board-view__hint">
            Scroll to zoom · drag background to pan · double-click to add a pin
          </span>
        </div>
      )}

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
          onDoubleClick={onBoardDoubleClick}
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
