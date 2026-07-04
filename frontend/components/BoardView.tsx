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
import { createPoi, resolveImageUrl, updatePoi } from '@/lib/api'
import { useListDetailContext } from '@/lib/ListDetailContext'
import { useBoardPinDragSync } from '@/hooks/useBoardPinDragSync'
import { presenceColorForUserId } from '@/lib/presenceColors'
import {
  BOARD_WORLD_H,
  BOARD_WORLD_W,
  screenToBoardNorm,
  type BoardCamera,
} from '@/lib/boardCoords'
import type { POIBase } from '@/lib/getaway'
import BoardCursorLayer from './BoardCursorLayer'

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
  lockedByPeer,
  highlightColor,
  onPointerDown,
}: {
  poi: POIBase
  wx: number
  wy: number
  isDragging: boolean
  lockedByPeer: boolean
  highlightColor?: string
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>, poi: POIBase) => void
}) {
  const img = pinImage(poi)
  const selected = !!highlightColor
  return (
    <button
      type="button"
      className={`board-pin board-pin--${poi.poi_type}${isDragging ? ' board-pin--dragging' : ''}${lockedByPeer ? ' board-pin--locked' : ''}${selected ? ' board-pin--selected' : ''}`}
      style={{
        left: `${wx * 100}%`,
        top: `${wy * 100}%`,
        zIndex: Math.round((poi.board_z ?? 0) + (isDragging || lockedByPeer ? 1000 : 0)),
        ...(highlightColor ? ({ '--pin-highlight': highlightColor } as CSSProperties) : {}),
      }}
      disabled={lockedByPeer}
      onPointerDown={(e) => onPointerDown(e, poi)}
    >
      <span className="board-pin__tack" aria-hidden />
      <span className="board-pin__card">
        {img ? (
          <img className="board-pin__thumb" src={img} alt="" draggable={false} />
        ) : (
          <span className="board-pin__placeholder" aria-hidden>
            {poi.poi_type === 'note' ? '📝' : '📍'}
          </span>
        )}
      </span>
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
  const { pois, setPois, otherViewers, setError, currentUserId } = useListDetailContext()
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragPos, setDragPos] = useState<{ wx: number; wy: number } | null>(null)
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
    broadcastDragStart,
    broadcastDragMove,
    broadcastDragEnd,
  } = useBoardPinDragSync({
    listId,
    enabled,
    userId: currentUserId,
    otherViewers,
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

  const hiddenCursorUserIds = useMemo(() => {
    const ids = new Set<string>()
    if (drag && currentUserId) ids.add(currentUserId)
    for (const peerDrag of peerDragByPoiId.values()) {
      ids.add(peerDrag.userId)
    }
    return ids
  }, [drag, currentUserId, peerDragByPoiId])

  const pinHighlightColor = useCallback(
    (poiId: string) => {
      if (drag?.poiId === poiId && currentUserId) {
        return presenceColorForUserId(currentUserId)
      }
      const peerDrag = peerDragByPoiId.get(poiId)
      if (!peerDrag) return undefined
      return (
        viewerColorById.get(peerDrag.userId) ??
        presenceColorForUserId(peerDrag.userId)
      )
    },
    [drag, currentUserId, peerDragByPoiId, viewerColorById],
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

  const fitCameraRef = useRef(fitCamera)
  fitCameraRef.current = fitCamera
  const initialFitDone = useRef(false)

  useImperativeHandle(
    ref,
    () => ({
      fitCamera,
      addNoteAtCenter: () => void addNoteAt(0.5, 0.5),
    }),
    [fitCamera, addNoteAt],
  )

  // Fit once on mount (page load); never passive re-fit when pois/data change.
  useEffect(() => {
    if (initialFitDone.current) return
    initialFitDone.current = true
    const id = requestAnimationFrame(() => fitCameraRef.current())
    return () => {
      cancelAnimationFrame(id)
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
        const wx = clamp(norm.wx, 0, 1)
        const wy = clamp(norm.wy, 0, 1)
        setDragPos({ wx, wy })
        broadcastDragMove(drag.poiId, wx, wy)
      }
    },
    [drag, scheduleCamera, pingActivity, broadcastDragMove],
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
      if (drag && drag.pointerId === e.pointerId) {
        const wx = dragPos?.wx ?? drag.startWx
        const wy = dragPos?.wy ?? drag.startWy
        commitGospel(drag.poiId, wx, wy)
        setDrag(null)
        setDragPos(null)
        void finishDrag(drag, { wx, wy })
      }
    },
    [drag, dragPos, finishDrag, finishPan, commitGospel],
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
      setDrag({
        poiId: poi.id,
        startWx: wx,
        startWy: wy,
        pointerId: e.pointerId,
      })
      setDragPos({ wx, wy })
      broadcastDragStart(poi.id, wx, wy)
    },
    [pingActivity, lockedPoiIds, broadcastDragStart],
  )

  useEffect(() => {
    return () => {
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
      if (peer) return { wx: peer.wx, wy: peer.wy }
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
            const pos = resolvePinPos(poi)
            const lockedByPeer = lockedPoiIds.has(poi.id) && drag?.poiId !== poi.id
            return (
              <BoardPin
                key={poi.id}
                poi={poi}
                wx={pos.wx}
                wy={pos.wy}
                isDragging={drag?.poiId === poi.id}
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
            hiddenCursorUserIds={hiddenCursorUserIds}
          />
        </div>
      </div>
    </div>
  )
})

export default BoardView
