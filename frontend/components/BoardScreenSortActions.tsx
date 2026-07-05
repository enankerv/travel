'use client'

import type { BoardLayoutMode } from '@/lib/boardLayout'

export default function BoardScreenSortActions({
  creating,
  sorting,
  onSort,
}: {
  creating: boolean
  sorting: boolean
  onSort: (mode: BoardLayoutMode) => void
}) {
  const busy = creating || sorting

  return (
    <div className="board-screen__sort-actions">
      <button
        type="button"
        className="board-screen__header-btn"
        onClick={() => onSort('poi_type')}
        disabled={busy}
      >
        Sort by type
      </button>
      <button
        type="button"
        className="board-screen__header-btn"
        onClick={() => onSort('proximity')}
        disabled={busy}
      >
        Cluster nearby
      </button>
    </div>
  )
}
