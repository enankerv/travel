'use client'

import { useState, useRef, useMemo } from 'react'
import { useListDetailContext } from '@/lib/ListDetailContext'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import GetawayRow from './GetawayRow'
import ColumnPopover from './ColumnPopover'
import PartySizeControls from './PartySizeControls'
import GetawaySortSelect from './GetawaySortSelect'
import { sortGetaways, type GetawaySortOption } from '@/lib/sortGetaways'
import { votesColumnMinWidthRem } from '@/lib/votesColumnLayout'
import {
  COLUMN_BY_KEY,
  COLUMN_KEYS,
  DEFAULT_VISIBLE,
  getVisibleColumnKeys,
  isAlwaysVisibleColumn,
  type ColumnKey,
  type VisibleColumns,
} from './getawayColumns'

export { COLUMN_KEYS, type ColumnKey, type VisibleColumns }

export default function GetawayTable({
  getaways,
  isLoading,
  onDelete,
  onUpdate,
  onImageClick,
  onRetry,
  onPasteClick,
  onCommentClick,
}: any) {
  const { votesByGetaway, commentsByGetaway, currentUserId, isListMember, onVote, onUnvote } =
    useListDetailContext();
  const [editingId, setEditingId] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(DEFAULT_VISIBLE)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [sortOption, setSortOption] = useState<GetawaySortOption>('votes-desc')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { getColStyle, startResize } = useResizableColumns<ColumnKey>()

  const sortedGetaways = useMemo(
    () => sortGetaways(getaways || [], votesByGetaway ?? {}, sortOption),
    [getaways, votesByGetaway, sortOption],
  )

  const maxVoteCount = useMemo(
    () =>
      sortedGetaways.reduce(
        (m, g) => Math.max(m, votesByGetaway?.[g.id]?.length ?? 0),
        0,
      ),
    [sortedGetaways, votesByGetaway],
  )

  const votesColMinWidth = useMemo(
    () =>
      votesColumnMinWidthRem({
        voteCount: maxVoteCount,
        canVote: !!isListMember,
        hasCommentButton: !!onCommentClick,
      }),
    [maxVoteCount, isListMember, onCommentClick],
  )

  const handleEditStart = (getawayId: any) => {
    setEditingId(getawayId)
  }

  const handleEditEnd = (getawayId: any, updatedData: any) => {
    if (updatedData && onUpdate) {
      onUpdate(getawayId, updatedData)
    }
    setEditingId(null)
  }

  const toggleColumn = (key: ColumnKey) => {
    if (isAlwaysVisibleColumn(key)) return
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const visibleKeys = getVisibleColumnKeys(visibleColumns)

  if (isLoading) {
    return (
      <div
        className="sheet-wrap"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0,
          width: '100%',
          minHeight: 'min(50vh, 24rem)',
        }}
      >
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Loading getaways...</p>
      </div>
    )
  }

  if (!getaways || getaways.length === 0) {
    return (
      <div className="sheet-wrap">
        <div className="empty-state">
          <div className="icon">🏠</div>
          <p>No getaways yet. Scout some listings to get started!</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="sheet-wrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        width: '100%',
      }}
    >
      <ColumnPopover
        open={showColumnMenu}
        onClose={() => setShowColumnMenu(false)}
        triggerRef={triggerRef}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
      />
      <div className="sheet-scroll sheet-scroll--fill">
        <table className="sheet">
          <colgroup>
            {visibleKeys.map((key) => {
              const base = getColStyle(key)
              const voteMin =
                key === 'votes' && votesColMinWidth
                  ? { minWidth: votesColMinWidth }
                  : undefined
              return (
                <col
                  key={key}
                  className={COLUMN_BY_KEY[key].className}
                  style={{ ...base, ...voteMin }}
                />
              )
            })}
          </colgroup>
          {/* Sticky <thead> is the single sticky element on the desktop list table:
              row 1 hosts the toolbar (in a colspan cell), row 2 hosts the column names.
              Both stack inside the same sticky box — no JS height measurement needed. */}
          <thead>
            <tr className="sheet-toolbar-row">
              <th colSpan={visibleKeys.length} className="sheet-toolbar-cell">
                <div className="sheet-toolbar">
                  <PartySizeControls />
                  <GetawaySortSelect
                    id="getaway-sort-table"
                    value={sortOption}
                    onChange={setSortOption}
                  />
                  <button
                    ref={triggerRef}
                    type="button"
                    className="column-toggle-btn"
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    title="Toggle columns"
                  >
                    ⋮ Columns
                  </button>
                </div>
              </th>
            </tr>
            <tr>
              {visibleKeys.map((key) => (
                <th key={key} className={COLUMN_BY_KEY[key].className}>
                  <span className="th-label">{COLUMN_BY_KEY[key].label}</span>
                  {key !== 'rank' && (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    className="col-resize-handle"
                    onMouseDown={(e) => startResize(key, e)}
                    onClick={(e) => e.stopPropagation()}
                    title="Drag to resize column"
                  />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedGetaways.map((getaway: any, rowIdx: number) => (
              <GetawayRow
                key={getaway.id}
                sortIndex={rowIdx + 1}
                getaway={getaway}
                isEditing={editingId === getaway.id}
                visibleColumns={visibleColumns}
                onEditStart={() => handleEditStart(getaway.id)}
                onEditEnd={(updatedData: any) => handleEditEnd(getaway.id, updatedData)}
                onDelete={() => onDelete && onDelete(getaway.id)}
                onImageClick={onImageClick}
                onRetry={getaway.source_url ? () => onRetry && onRetry(getaway) : undefined}
                onPasteClick={onPasteClick}
                onCommentClick={onCommentClick ? () => onCommentClick(getaway.id) : undefined}
                votesByGetaway={votesByGetaway}
                commentsByGetaway={commentsByGetaway}
                currentUserId={currentUserId}
                canVote={isListMember}
                onVote={onVote}
                onUnvote={onUnvote}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
