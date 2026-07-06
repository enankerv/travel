'use client'

import { memo, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { isLockedByPeer, pinLabel, pinStackZIndex, pinTiltDeg, type PinHoldState } from '@/lib/boardPin'
import type { POIBase } from '@/lib/getaway'
import { iconForPoiType, poiImageSources } from '@/lib/poi'
import type { BoardSubgroup } from '@/lib/subgroup'
import { subgroupsByParentId } from '@/lib/boardSpace'
import type { SubgroupRect } from '@/hooks/useBoardSubgroupEdit'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'

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

export type BoardSurfacePinProps = {
  sortedPins: POIBase[]
  selectedPoiId?: string | null
  lockedPoiIds: ReadonlySet<string>
  localDragPoiId?: string | null
  pendingPoiId?: string | null
  layoutAnimating?: boolean
  getPinPos: (poi: POIBase) => { wx: number; wy: number }
  getPinHoldState: (poiId: string) => PinHoldState
  getPinHighlightColor: (poiId: string) => string | undefined
  onPinPointerDown: (e: ReactPointerEvent<HTMLButtonElement>, poi: POIBase) => void
}

export type BoardSurfaceSubgroupProps = {
  selectedSubgroupId?: string | null
  getSubgroupRect: (sg: BoardSubgroup) => SubgroupRect
  onSubgroupSelect: (subgroupId: string) => void
  onSubgroupMovePointerDown: (
    e: ReactPointerEvent<HTMLElement>,
    sg: BoardSubgroup,
  ) => void
  onSubgroupResizePointerDown: (
    e: ReactPointerEvent<HTMLElement>,
    sg: BoardSubgroup,
  ) => void
  onRenameSubgroup?: (sg: BoardSubgroup) => void
}

type BoardSurfaceProps = BoardSurfacePinProps &
  BoardSurfaceSubgroupProps & {
    parentSubgroupId: string | null
    subgroups: BoardSubgroup[]
  }

export default memo(function BoardSurface({
  parentSubgroupId,
  subgroups,
  sortedPins,
  selectedPoiId,
  selectedSubgroupId,
  lockedPoiIds,
  localDragPoiId,
  pendingPoiId,
  layoutAnimating,
  getPinPos,
  getPinHoldState,
  getPinHighlightColor,
  onPinPointerDown,
  getSubgroupRect,
  onSubgroupSelect,
  onSubgroupMovePointerDown,
  onSubgroupResizePointerDown,
  onRenameSubgroup,
}: BoardSurfaceProps) {
  const childrenByParent = subgroupsByParentId(subgroups)
  const childSubgroups = childrenByParent.get(parentSubgroupId) ?? []
  const framePois = sortedPins.filter(
    (poi) => (poi.subgroup_id ?? null) === parentSubgroupId,
  )

  return (
    <div
      className={
        parentSubgroupId
          ? 'board-subgroup__surface'
          : 'board-subgroup__surface board-subgroup__surface--root'
      }
    >
      {childSubgroups.map((sg) => {
        const rect = getSubgroupRect(sg)
        const selected = selectedSubgroupId === sg.id
        return (
          <div
            key={sg.id}
            className={`board-subgroup${selected ? ' board-subgroup--selected' : ''}`}
            style={{
              left: `${rect.board_x * 100}%`,
              top: `${rect.board_y * 100}%`,
              width: `${rect.board_w * 100}%`,
              height: `${rect.board_h * 100}%`,
              zIndex: sg.board_z + (selected ? 100 : 0),
            }}
          >
            <div
              className="board-subgroup__chrome"
              onPointerDown={(e) => onSubgroupMovePointerDown(e, sg)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onRenameSubgroup?.(sg)
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSubgroupSelect(sg.id)
              }}
            >
              <span className="board-subgroup__label">{sg.name}</span>
            </div>
            <button
              type="button"
              className="board-subgroup__resize-se"
              aria-label={`Resize ${sg.name}`}
              onPointerDown={(e) => onSubgroupResizePointerDown(e, sg)}
            />
            <BoardSurface
              parentSubgroupId={sg.id}
              subgroups={subgroups}
              sortedPins={sortedPins}
              selectedPoiId={selectedPoiId}
              selectedSubgroupId={selectedSubgroupId}
              lockedPoiIds={lockedPoiIds}
              localDragPoiId={localDragPoiId}
              pendingPoiId={pendingPoiId}
              layoutAnimating={layoutAnimating}
              getPinPos={getPinPos}
              getPinHoldState={getPinHoldState}
              getPinHighlightColor={getPinHighlightColor}
              onPinPointerDown={onPinPointerDown}
              getSubgroupRect={getSubgroupRect}
              onSubgroupSelect={onSubgroupSelect}
              onSubgroupMovePointerDown={onSubgroupMovePointerDown}
              onSubgroupResizePointerDown={onSubgroupResizePointerDown}
              onRenameSubgroup={onRenameSubgroup}
            />
          </div>
        )
      })}

      {framePois.map((poi) => {
        const dragPos = getPinPos(poi)
        const lockedByPeer = isLockedByPeer(poi.id, lockedPoiIds, localDragPoiId)
        return (
          <BoardPin
            key={poi.id}
            poi={poi}
            wx={dragPos.wx}
            wy={dragPos.wy}
            holdState={getPinHoldState(poi.id)}
            isSelected={selectedPoiId === poi.id}
            lockedByPeer={lockedByPeer}
            highlightColor={getPinHighlightColor(poi.id)}
            layoutAnimating={layoutAnimating}
            onPointerDown={onPinPointerDown}
          />
        )
      })}
    </div>
  )
})
