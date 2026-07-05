'use client'

import type { BoardCreatablePoiType } from '@/lib/poi'
import BoardAddItemButton from './BoardAddItemButton'

export default function BoardScreenToolbar({
  creating,
  sorting,
  onFitCamera,
  onAddItem,
}: {
  creating: boolean
  sorting: boolean
  onFitCamera: () => void
  onAddItem: (poiType: BoardCreatablePoiType) => void
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
      <BoardAddItemButton creating={creating} onAdd={onAddItem} />
    </div>
  )
}
