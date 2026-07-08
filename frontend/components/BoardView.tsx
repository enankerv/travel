'use client'

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPoi } from '@/lib/api'
import { useBoardContext } from '@/lib/BoardContext'
import { useBoardLayout } from '@/hooks/useBoardLayout'
import { useBoardPinFocusSync } from '@/hooks/useBoardPinFocusSync'
import type { BoardLayoutMode } from '@/lib/boardLayout'
import { useBoardPinDrag } from '@/hooks/useBoardPinDrag'
import { useBoardPinPresence } from '@/hooks/useBoardPinPresence'
import { useBoardSubgroupEdit } from '@/hooks/useBoardSubgroupEdit'
import { useBoardViewport } from '@/hooks/useBoardViewport'
import { BOARD_WORLD_H, BOARD_WORLD_W, screenToBoardNorm } from '@/lib/boardCoords'
import { buildBoardSubgroupTree, poiDisplayNorm, poiFromRoot, subgroupContainingRootPoint } from '@/lib/boardSpace'
import {
  BOARD_CHAT_POI_DRAG_MIME,
  parseSuggestionDragPayload,
  suggestionToPoiCreate,
} from '@/lib/boardChat'
import type { BoardPoi } from '@/lib/board'
import {
  defaultTitleForPoiType,
  type BoardCreatablePoiType,
} from '@/lib/poi'
import BoardCursorLayer from './BoardCursorLayer'
import BoardSurface from './BoardSurface'

export type BoardViewHandle = {
  fitCamera: () => void
  addPoiAtCenter: (poiType: BoardCreatablePoiType) => void
  applyBoardSort: (mode: BoardLayoutMode) => Promise<void>
  addGroup: (parentSubgroupId?: string | null) => Promise<void>
}

const BoardView = forwardRef<
  BoardViewHandle,
  {
    listId: string
    enabled: boolean
    onActivity?: () => void
    selectedPoiId?: string | null
    onSelectPoi?: (poiId: string | null) => void
    selectedSubgroupId?: string | null
    onSelectSubgroup?: (subgroupId: string | null) => void
  }
>(function BoardView(
  {
    listId,
    enabled,
    onActivity,
    selectedPoiId = null,
    onSelectPoi,
    selectedSubgroupId = null,
    onSelectSubgroup,
  },
  ref,
) {
  const {
    pois,
    setPois,
    subgroups,
    setSubgroups,
    otherViewers,
    setError,
    currentUserId,
    handleCreateSubgroup,
    handleUpdateSubgroup,
  } = useBoardContext()
  const subgroupTree = useMemo(
    () => buildBoardSubgroupTree(subgroups),
    [subgroups],
  )

  const poiFieldsAtRoot = useCallback(
    (wx: number, wy: number) => {
      const root = { wx, wy }
      const subgroupId = subgroupContainingRootPoint(root, subgroupTree)
      const offset = poiFromRoot(root, subgroupId, subgroups, { clamp: true })
      return {
        board_x: offset.wx,
        board_y: offset.wy,
        subgroup_id: subgroupId,
      }
    },
    [subgroupTree, subgroups],
  )
  const dragPosOverrideRef = useRef<{ poiId: string; wx: number; wy: number } | null>(
    null,
  )
  const handlePeerDragEndRef = useRef<(poiId: string, wx: number, wy: number) => void>(
    () => {},
  )
  const onPinchInterruptRef = useRef<() => void>(() => {})

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
    subgroups,
    dragPosOverrideRef,
    onActivity,
    onClearSelection: () => {
      onSelectPoi?.(null)
      onSelectSubgroup?.(null)
    },
    onPinchStart: () => onPinchInterruptRef.current(),
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

  const subgroupEdit = useBoardSubgroupEdit({
    listId,
    subgroups,
    setSubgroups,
    setError,
    viewportRef,
    cameraRef,
    onActivity,
    selectedSubgroupId: selectedSubgroupId ?? null,
    setSelectedSubgroupId: (id) => onSelectSubgroup?.(id),
  })

  const pinDrag = useBoardPinDrag({
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
    onSelectPoi: (id) => {
      onSelectSubgroup?.(null)
      onSelectPoi?.(id)
    },
    onActivity,
  })
  handlePeerDragEndRef.current = pinDrag.handlePeerDragEnd
  dragPosOverrideRef.current = pinDrag.dragPosOverride
  onPinchInterruptRef.current = () => {
    pinDrag.cancelInteraction()
    subgroupEdit.cancelInteraction()
  }

  const boardLayout = useBoardLayout({
    listId,
    userId: currentUserId,
    otherViewers,
    enabled,
    pois,
    subgroups,
    selectedSubgroupId: selectedSubgroupId ?? null,
    setPois,
    setError,
    isDragActive:
      !!pinDrag.drag ||
      !!pinDrag.pendingPoiId ||
      subgroupEdit.isSubgroupDragging,
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
        const placement = poiFieldsAtRoot(wx, wy)
        const poi = await createPoi(listId, {
          poi_type: poiType,
          title: defaultTitleForPoiType(poiType),
          ...placement,
        })
        setPois((prev) => {
          if (prev.some((p) => p.id === poi.id)) return prev
          return [...prev, { ...poi, comments: [], votes: [] } as BoardPoi]
        })
      } catch {
        setError('Failed to add item')
      }
    },
    [listId, setPois, setError, poiFieldsAtRoot],
  )

  const addSuggestionAt = useCallback(
    async (wx: number, wy: number, raw: string) => {
      const suggestion = parseSuggestionDragPayload(raw)
      if (!suggestion) return
      try {
        const placement = poiFieldsAtRoot(wx, wy)
        const poi = await createPoi(
          listId,
          { ...suggestionToPoiCreate(suggestion, placement.board_x, placement.board_y), ...placement },
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
    [listId, setPois, setError, onSelectPoi, poiFieldsAtRoot],
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

  const addGroup = useCallback(
    async (parentSubgroupId?: string | null) => {
      const parent = parentSubgroupId ?? selectedSubgroupId ?? null
      const name =
        window.prompt('Group name', `Group ${subgroups.length + 1}`)?.trim() ||
        ''
      if (!name) return
      const created = await handleCreateSubgroup({
        name,
        parent_subgroup_id: parent,
      })
      if (created) onSelectSubgroup?.(created.id)
    },
    [subgroups.length, selectedSubgroupId, handleCreateSubgroup, onSelectSubgroup],
  )

  useImperativeHandle(
    ref,
    () => ({
      fitCamera,
      addPoiAtCenter: (poiType: BoardCreatablePoiType) => void addPoiAt(0.5, 0.5, poiType),
      applyBoardSort: boardLayout.applyBoardSort,
      addGroup,
    }),
    [addPoiAt, addGroup, boardLayout.applyBoardSort, fitCamera],
  )

  const onViewportPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPanPointerDown(e)
    },
    [onPanPointerDown],
  )

  const onViewportPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (subgroupEdit.onSubgroupPointerMove(e)) return
      if (onPanPointerMove(e)) return
      pinDrag.onPinPointerMove(e)
    },
    [onPanPointerMove, pinDrag, subgroupEdit],
  )

  const onViewportPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      subgroupEdit.onSubgroupPointerUp(e.pointerId)
      onPanPointerUp(e.pointerId)
      pinDrag.onPinPointerUp(e.pointerId)
    },
    [onPanPointerUp, pinDrag, subgroupEdit],
  )

  const onRenameSubgroup = useCallback(
    (sg: { id: string; name: string }) => {
      const name = window.prompt('Rename group', sg.name)?.trim()
      if (!name || name === sg.name) return
      void handleUpdateSubgroup(sg.id, { name })
    },
    [handleUpdateSubgroup],
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

          <BoardSurface
            parentSubgroupId={null}
            subgroups={subgroups}
            sortedPins={presence.sortedPins}
            selectedPoiId={selectedPoiId}
            selectedSubgroupId={selectedSubgroupId}
            lockedPoiIds={lockedPoiIds}
            localDragPoiId={pinDrag.drag?.poiId}
            pendingPoiId={pinDrag.pendingPoiId}
            layoutAnimating={boardLayout.layoutAnimating}
            getPinPos={(poi) => {
              const stored = pinDrag.getPinPos(poi)
              const layoutGospel = boardLayout.getLayoutGospel(poi.id)
              let offset = stored
              if (
                layoutGospel &&
                pinDrag.drag?.poiId !== poi.id &&
                pinDrag.pendingPoiId !== poi.id
              ) {
                offset = layoutGospel
              }
              return poiDisplayNorm(poi, subgroups, offset, subgroupEdit.getRect)
            }}
            getPinHoldState={presence.getPinHoldState}
            getPinHighlightColor={presence.getPinHighlightColor}
            onPinPointerDown={pinDrag.onPinPointerDown}
            getSubgroupRect={subgroupEdit.getRect}
            onSubgroupSelect={(id) => {
              onSelectPoi?.(null)
              onSelectSubgroup?.(id)
            }}
            onSubgroupMovePointerDown={subgroupEdit.onSubgroupMovePointerDown}
            onSubgroupResizePointerDown={subgroupEdit.onSubgroupResizePointerDown}
            onRenameSubgroup={onRenameSubgroup}
          />

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
