'use client'

import type { BoardCreatablePoiType } from '@/lib/poi'
import type { BoardLayoutMode } from '@/lib/boardLayout'
import BoardAddItemButton from './BoardAddItemButton'

export default function BoardScreenToolbar({
  creating,
  sorting,
  onFitCamera,
  onAddItem,
  onSort,
}: {
  creating: boolean
  sorting: boolean
  onFitCamera: () => void
  onAddItem: (poiType: BoardCreatablePoiType) => void
  onSort: (mode: BoardLayoutMode) => void
}) {
  const busy = creating || sorting

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
        onClick={() => onSort('poi_type')}
        disabled={busy}
      >
        Sort by type
      </button>
      <button
        type="button"
        className="board-screen__tool-btn"
        onClick={() => onSort('proximity')}
        disabled={busy}
      >
        Cluster nearby
      </button>
      <BoardAddItemButton creating={creating} onAdd={onAddItem} />
    </div>
  )
}
