'use client'

import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPoi } from '@/lib/api'
import { useBoardContext } from '@/lib/BoardContext'
import { useBoardLayout } from '@/hooks/useBoardLayout'
import { useBoardPinFocusSync } from '@/hooks/useBoardPinFocusSync'
import type { BoardLayoutMode } from '@/lib/boardLayout'
import { useBoardPinDrag } from '@/hooks/useBoardPinDrag'
import { useBoardPinPresence } from '@/hooks/useBoardPinPresence'
import { useBoardViewport } from '@/hooks/useBoardViewport'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'
import { BOARD_WORLD_H, BOARD_WORLD_W, screenToBoardNorm } from '@/lib/boardCoords'
import {
  BOARD_CHAT_POI_DRAG_MIME,
  parseSuggestionDragPayload,
  suggestionToPoiCreate,
} from '@/lib/boardChat'
import { isLockedByPeer, pinLabel, pinStackZIndex, pinTiltDeg, type PinHoldState } from '@/lib/boardPin'
import type { POIBase } from '@/lib/getaway'
import {
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
  applyBoardSort: (mode: BoardLayoutMode) => Promise<void>
}

const BoardPin = memo(function BoardPin({
  poi,
  wx,
  wy,
  holdState,
  isSelected,
  lockedByPeer,
  highlightColor,
  layoutAnimating,
  onPointerDown,
}: {
  poi: POIBase
  wx: number
  wy: number
  holdState: PinHoldState
  isSelected: boolean
  lockedByPeer: boolean
  highlightColor?: string
  layoutAnimating?: boolean
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
      className={`board-pin board-pin--${poi.poi_type}${isHeld ? ' board-pin--dragging' : ''}${holdState === 'local' ? ' board-pin--local-drag' : ''}${holdState === 'remote' ? ' board-pin--remote-drag' : ''}${lockedByPeer ? ' board-pin--locked' : ''}${showHighlight ? ' board-pin--selected' : ''}${layoutAnimating ? ' board-pin--layout-animating' : ''}`}
      style={{
        left: `${wx * 100}%`,
        top: `${wy * 100}%`,
        zIndex: pinStackZIndex(
          poi.board_z ?? 0,
          isHeld || lockedByPeer || isSelected,
        ),
        ...(showHighlight
          ? ({
              '--pin-highlight':
                highlightColor ?? 'var(--board-pin-select, #5b8cff)',
            } as CSSProperties)
          : {}),
        ['--pin-tilt' as string]: `${pinTiltDeg(poi.id)}deg`,
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
  const {
    pois,
    setPois,
    otherViewers,
    setError,
    currentUserId,
  } = useBoardContext()
  const dragPosOverrideRef = useRef<{ poiId: string; wx: number; wy: number } | null>(
    null,
  )
  const handlePeerDragEndRef = useRef<(poiId: string, wx: number, wy: number) => void>(
    () => {},
  )

  const {
    viewportRef,
    worldRef,
    cameraRef,
    interacting,
    fitCamera,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
  } = useBoardViewport({
    pois,
    dragPosOverrideRef,
    onActivity,
    onClearSelection: () => onSelectPoi?.(null),
  })

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
    onPeerDragEnd: (poiId, wx, wy) => handlePeerDragEndRef.current(poiId, wx, wy),
  })

  const pinDrag = useBoardPinDrag({
    listId,
    pois,
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
  })
  handlePeerDragEndRef.current = pinDrag.handlePeerDragEnd
  dragPosOverrideRef.current = pinDrag.dragPosOverride

  const boardLayout = useBoardLayout({
    listId,
    userId: currentUserId,
    otherViewers,
    enabled,
    pois,
    setPois,
    setError,
    isDragActive: !!pinDrag.drag || !!pinDrag.pendingPoiId,
    onAfterLayout: fitCamera,
  })

  const presence = useBoardPinPresence({
    pois,
    otherViewers,
    currentUserId,
    dragPoiId: pinDrag.drag?.poiId,
    pendingPoiId: pinDrag.pendingPoiId,
    peerDragByPoiId,
    peerSelectByPoiId,
    hiddenCursorUserIds,
  })

  const addPoiAt = useCallback(
    async (wx: number, wy: number, poiType: BoardCreatablePoiType) => {
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
      }
    },
    [listId, setPois, setError],
  )

  const addSuggestionAt = useCallback(
    async (wx: number, wy: number, raw: string) => {
      const suggestion = parseSuggestionDragPayload(raw)
      if (!suggestion) return
      try {
        const poi = await createPoi(
          listId,
          suggestionToPoiCreate(suggestion, wx, wy),
        )
        setPois((prev) => {
          if (prev.some((p) => p.id === poi.id)) return prev
          return [...prev, { ...poi, comments: [], votes: [] } as BoardPoi]
        })
        onSelectPoi?.(poi.id)
      } catch {
        setError('Failed to add suggestion to board')
      }
    },
    [listId, setPois, setError, onSelectPoi],
  )

  const onViewportDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(BOARD_CHAT_POI_DRAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const onViewportDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const raw = e.dataTransfer.getData(BOARD_CHAT_POI_DRAG_MIME)
      if (!raw) return
      e.preventDefault()
      const vp = viewportRef.current
      if (!vp) return
      const norm = screenToBoardNorm(vp, cameraRef.current, e.clientX, e.clientY)
      if (!norm) return
      void addSuggestionAt(norm.wx, norm.wy, raw)
    },
    [addSuggestionAt, cameraRef, viewportRef],
  )

  useImperativeHandle(
    ref,
    () => ({
      fitCamera,
      addPoiAtCenter: (poiType: BoardCreatablePoiType) => void addPoiAt(0.5, 0.5, poiType),
      applyBoardSort: boardLayout.applyBoardSort,
    }),
    [addPoiAt, fitCamera, boardLayout.applyBoardSort],
  )

  const onViewportPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPanPointerDown(e)
    },
    [onPanPointerDown],
  )

  const onViewportPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (onPanPointerMove(e)) return
      pinDrag.onPinPointerMove(e)
    },
    [onPanPointerMove, pinDrag],
  )

  const onViewportPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPanPointerUp(e.pointerId)
      pinDrag.onPinPointerUp(e.pointerId)
    },
    [onPanPointerUp, pinDrag],
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
        onDragOver={onViewportDragOver}
        onDrop={onViewportDrop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={worldRef}
          className="board-view__world"
          style={{ width: BOARD_WORLD_W, height: BOARD_WORLD_H }}
        >
          <div className="board-view__cork" aria-hidden />

          {presence.sortedPins.map((poi) => {
            const dragPos = pinDrag.getPinPos(poi)
            const layoutGospel = boardLayout.getLayoutGospel(poi.id)
            const pos =
              layoutGospel &&
              pinDrag.drag?.poiId !== poi.id &&
              pinDrag.pendingPoiId !== poi.id
                ? layoutGospel
                : dragPos
            const lockedByPeer = isLockedByPeer(
              poi.id,
              lockedPoiIds,
              pinDrag.drag?.poiId,
            )
            return (
              <BoardPin
                key={poi.id}
                poi={poi}
                wx={pos.wx}
                wy={pos.wy}
                holdState={presence.getPinHoldState(poi.id)}
                isSelected={selectedPoiId === poi.id}
                lockedByPeer={lockedByPeer}
                highlightColor={presence.getPinHighlightColor(poi.id)}
                layoutAnimating={boardLayout.layoutAnimating}
                onPointerDown={pinDrag.onPinPointerDown}
              />
            )
          })}

          <BoardCursorLayer
            listId={listId}
            enabled={enabled}
            otherViewers={otherViewers}
            viewportRef={viewportRef}
            cameraRef={cameraRef}
            hiddenCursorUserIds={presence.hiddenCursorUserIdsWithDrag}
          />
        </div>
      </div>
    </div>
  )
})

export default BoardView
