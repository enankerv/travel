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
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPoi, resolveImageUrl, updatePoi } from '@/lib/api'
import { useListDetailContext } from '@/lib/ListDetailContext'
import type { POIBase } from '@/lib/getaway'
import BoardCursorLayer, {
  BOARD_WORLD_H,
  BOARD_WORLD_W,
  screenToBoardNorm,
  type BoardCamera,
} from './BoardCursorLayer'

const MIN_SCALE = 0.08
const MAX_SCALE = 2.5
/** Visual padding around pin anchors when fitting (world px). */
const PIN_PAD_X = 84
const PIN_PAD_TOP = 128
const PIN_PAD_BOTTOM = 12
const MIN_FIT_SPAN = 180
const FIT_MARGIN = 0.88

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
  addNoteAtCenter: () => void
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function cameraTransform(cam: BoardCamera) {
  return `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.scale})`
}

function pinImage(poi: POIBase): string {
  const thumb = poi.thumbnail_url ? resolveImageUrl(poi.thumbnail_url) : ''
  if (thumb) return thumb
  const first = poi.images?.[0]
  return first ? resolveImageUrl(first) : ''
}

function pinLabel(poi: POIBase): string {
  if (poi.title?.trim()) return poi.title.trim()
  if (poi.poi_type === 'getaway') return 'Getaway'
  if (poi.poi_type === 'note') return 'Note'
  return 'Pin'
}

const BoardPin = memo(function BoardPin({
  poi,
  wx,
  wy,
  isDragging,
  onPointerDown,
}: {
  poi: POIBase
  wx: number
  wy: number
  isDragging: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>, poi: POIBase) => void
}) {
  const img = pinImage(poi)
  return (
    <button
      type="button"
      className={`board-pin board-pin--${poi.poi_type}${isDragging ? ' board-pin--dragging' : ''}`}
      style={{
        left: `${wx * 100}%`,
        top: `${wy * 100}%`,
        zIndex: Math.round((poi.board_z ?? 0) + (isDragging ? 1000 : 0)),
      }}
      onPointerDown={(e) => onPointerDown(e, poi)}
    >
      <span className="board-pin__tack" aria-hidden />
      {img ? (
        <img className="board-pin__thumb" src={img} alt="" draggable={false} />
      ) : (
        <span className="board-pin__placeholder" aria-hidden>
          {poi.poi_type === 'note' ? '📝' : '📍'}
        </span>
      )}
      <span className="board-pin__label">{pinLabel(poi)}</span>
    </button>
  )
})

type DragState = {
  poiId: string
  startWx: number
  startWy: number
  pointerId: number
}

const BoardView = forwardRef<
  BoardViewHandle,
  {
    listId: string
    enabled: boolean
    fullscreen?: boolean
    onActivity?: () => void
  }
>(function BoardView({ listId, enabled, fullscreen = false, onActivity }, ref) {
  const { pois, setPois, otherViewers, setError } = useListDetailContext()
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<BoardCamera>({ x: 0, y: 0, scale: 0.35 })
  const cameraRafRef = useRef(0)
  const pendingCameraRef = useRef<BoardCamera | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragPos, setDragPos] = useState<{ wx: number; wy: number } | null>(null)
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

  const fitCamera = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const { width, height } = vp.getBoundingClientRect()
    if (width <= 0 || height <= 0) return

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
      return
    }

    applyCamera(cameraForBounds(width, height, bounds))
  }, [applyCamera, pois, drag, dragPos])

  const addNoteAt = useCallback(
    async (wx: number, wy: number) => {
      if (creating) return
      pingActivity()
      setCreating(true)
      try {
        const poi = await createPoi(listId, {
          poi_type: 'note',
          title: 'New note',
          board_x: wx,
          board_y: wy,
        })
        setPois((prev) => {
          if (prev.some((p) => p.id === poi.id)) return prev
          return [...prev, poi]
        })
      } catch {
        setError('Failed to create note')
      } finally {
        setCreating(false)
      }
    },
    [creating, listId, setPois, setError, pingActivity],
  )

  useImperativeHandle(
    ref,
    () => ({
      fitCamera,
      addNoteAtCenter: () => void addNoteAt(0.5, 0.5),
    }),
    [fitCamera, addNoteAt],
  )

  useEffect(() => {
    fitCamera()
    return () => {
      if (cameraRafRef.current) cancelAnimationFrame(cameraRafRef.current)
    }
  }, [fitCamera])

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
      if (drag && drag.pointerId === e.pointerId) {
        pingActivity()
        const vp = viewportRef.current
        if (!vp) return
        const norm = screenToBoardNorm(vp, cameraRef.current, e.clientX, e.clientY)
        if (!norm) return
        setDragPos({
          wx: clamp(norm.wx, 0, 1),
          wy: clamp(norm.wy, 0, 1),
        })
      }
    },
    [drag, scheduleCamera, pingActivity],
  )

  const finishPan = useCallback((pointerId: number) => {
    if (panningRef.current?.pointerId === pointerId) {
      panningRef.current = null
      setInteracting(false)
    }
  }, [])

  const finishDrag = useCallback(
    async (state: DragState, pos: { wx: number; wy: number } | null) => {
      const wx = pos?.wx ?? state.startWx
      const wy = pos?.wy ?? state.startWy
      setPois((prev) =>
        prev.map((p) =>
          p.id === state.poiId ? { ...p, board_x: wx, board_y: wy } : p,
        ),
      )
      try {
        await updatePoi(listId, state.poiId, { board_x: wx, board_y: wy })
      } catch {
        setError('Failed to save pin position')
      }
    },
    [listId, setPois, setError],
  )

  const onViewportPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      finishPan(e.pointerId)
      if (drag && drag.pointerId === e.pointerId) {
        void finishDrag(drag, dragPos)
        setDrag(null)
        setDragPos(null)
      }
    },
    [drag, dragPos, finishDrag, finishPan],
  )

  const onPinPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, poi: POIBase) => {
      e.stopPropagation()
      if (e.button !== 0) return
      pingActivity()
      e.currentTarget.setPointerCapture(e.pointerId)
      const wx = poi.board_x ?? 0.5
      const wy = poi.board_y ?? 0.5
      setDrag({
        poiId: poi.id,
        startWx: wx,
        startWy: wy,
        pointerId: e.pointerId,
      })
      setDragPos({ wx, wy })
    },
    [pingActivity],
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
      void addNoteAt(
        clamp(norm.wx, 0.02, 0.98),
        clamp(norm.wy, 0.02, 0.98),
      )
    },
    [addNoteAt],
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
          <button
            type="button"
            className="board-view__tool-btn"
            disabled={creating}
            onClick={() => void addNoteAt(0.5, 0.5)}
          >
            {creating ? 'Adding…' : 'Add note'}
          </button>
          <span className="board-view__hint">
            Scroll to zoom · drag background to pan · double-click to add a note
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
            const pos =
              drag?.poiId === poi.id && dragPos
                ? dragPos
                : { wx: poi.board_x ?? 0.5, wy: poi.board_y ?? 0.5 }
            return (
              <BoardPin
                key={poi.id}
                poi={poi}
                wx={pos.wx}
                wy={pos.wy}
                isDragging={drag?.poiId === poi.id}
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
          />
        </div>
      </div>
    </div>
  )
})

export default BoardView
