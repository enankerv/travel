'use client'

import type { BoardCreatablePoiType } from '@/lib/poi'
import BoardAddItemButton from './BoardAddItemButton'

export default function BoardScreenToolbar({
  creating,
  sorting,
  groupBusy,
  hasSelectedGroup,
  onFitCamera,
  onAddItem,
  onAddGroup,
  onDeleteGroup,
  onRenameGroup,
}: {
  creating: boolean
  sorting: boolean
  groupBusy?: boolean
  hasSelectedGroup?: boolean
  onFitCamera: () => void
  onAddItem: (poiType: BoardCreatablePoiType) => void
  onAddGroup: () => void
  onDeleteGroup?: () => void
  onRenameGroup?: () => void
}) {
  const busy = creating || sorting || groupBusy

  return (
    <div className="board-screen__tools">
      <button
        type="button"
        className="board-screen__tool-btn"
        onClick={onFitCamera}
        disabled={busy}
      >
        Fit
      </button>
      <button
        type="button"
        className="board-screen__tool-btn"
        onClick={onAddGroup}
        disabled={busy}
      >
        Add group
      </button>
      {hasSelectedGroup && (
        <>
          <button
            type="button"
            className="board-screen__tool-btn"
            onClick={onRenameGroup}
            disabled={busy}
          >
            Rename
          </button>
          <button
            type="button"
            className="board-screen__tool-btn board-screen__tool-btn--danger"
            onClick={onDeleteGroup}
            disabled={busy}
          >
            Delete group
          </button>
        </>
      )}
      <BoardAddItemButton creating={creating} onAdd={onAddItem} />
    </div>
  )
}
