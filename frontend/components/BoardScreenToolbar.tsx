'use client'

import type { BoardCreatablePoiType } from '@/lib/poi'
import BoardAddItemButton from './BoardAddItemButton'

export default function BoardScreenToolbar({
  creating,
  onFitCamera,
  onAddItem,
}: {
  creating: boolean
  onFitCamera: () => void
  onAddItem: (poiType: BoardCreatablePoiType) => void
}) {
  return (
    <div className="board-screen__tools">
      <button
        type="button"
        className="board-screen__tool-btn"
        onClick={onFitCamera}
      >
        Fit
      </button>
      <BoardAddItemButton creating={creating} onAdd={onAddItem} />
    </div>
  )
}
