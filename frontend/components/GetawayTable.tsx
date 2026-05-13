'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
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

  // "Seen" set: every row ID the user has acknowledged via either the initial
  // load or a subsequent sort. Any row currently in `getaways` that is NOT in
  // `seenIds` is treated as new — it pins to the top with a NEW badge.
  //
  // The model:
  //  - seenIds starts as `null` (uninitialized). While null, nothing renders
  //    as new and nothing pins to the top — we don't know what the baseline
  //    is yet, so we can't flag anything against it.
  //  - We snapshot the baseline as soon as load completes. Two trigger paths
  //    so we behave correctly across the real data-load lifecycles:
  //      (a) isLoading transitions true → false (the standard fetch flow,
  //          even when it lands an empty result).
  //      (b) We observe non-empty `getaways` (handles prefetched/cached
  //          cases where isLoading is never set true).
  //  - When the user changes sort, snapshot the current row set into seenIds.
  //    Whatever was new becomes seen and slots into the new sort order on the
  //    next render, automatically.
  //  - Any row that arrives later (own scout, teammate scout) is not in
  //    seenIds → renders as new at the top until the user re-sorts.
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null)
  const prevLoadingRef = useRef<boolean | null>(null)

  useEffect(() => {
    const wasLoading = prevLoadingRef.current
    prevLoadingRef.current = isLoading
    if (seenIds !== null) return
    const loadJustFinished = wasLoading === true && !isLoading
    const hasContent = Array.isArray(getaways) && getaways.length > 0
    if (loadJustFinished || hasContent) {
      setSeenIds(new Set((getaways || []).map((g: any) => g.id)))
    }
  }, [seenIds, isLoading, getaways])

  // Source order has newest at index 0 (realtime inserts via [row, ...prev]),
  // so the natural array order already puts the newest new-row at the top of
  // the pinned block. Before init, treat nothing as new.
  const newIds = useMemo(() => {
    if (seenIds === null) return [] as string[]
    return (getaways || [])
      .filter((g: any) => !seenIds.has(g.id))
      .map((g: any) => g.id as string)
  }, [getaways, seenIds])

  const handleSortChange = useCallback(
    (next: GetawaySortOption) => {
      setSortOption(next)
      setSeenIds(new Set((getaways || []).map((g: any) => g.id)))
    },
    [getaways],
  )

  const orderedGetaways = useMemo(
    () =>
      sortGetaways(getaways || [], votesByGetaway ?? {}, sortOption, {
        pinFirstIds: newIds,
      }),
    [getaways, votesByGetaway, sortOption, newIds],
  )

  const maxVoteCount = useMemo(
    () =>
      orderedGetaways.reduce(
        (m: number, g: any) => Math.max(m, votesByGetaway?.[g.id]?.length ?? 0),
        0,
      ),
    [orderedGetaways, votesByGetaway],
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
                    onChange={handleSortChange}
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
            {(() => {
              // Rank numbers count only non-pinned rows so the sorted region
              // below the NEW block always reads #1, #2, #3...
              let sortedRank = 0
              return orderedGetaways.map((getaway: any) => {
                const isPinnedNew =
                  seenIds !== null && !seenIds.has(getaway.id)
                const sortIndex = isPinnedNew ? 0 : ++sortedRank
                return (
                  <GetawayRow
                    key={getaway.id}
                    sortIndex={sortIndex}
                    isPinnedNew={isPinnedNew}
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
                )
              })
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}
