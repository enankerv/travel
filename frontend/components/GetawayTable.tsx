'use client'

import { useState, useRef } from 'react'
import GetawayRow from './GetawayRow'
import ColumnPopover from './ColumnPopover'
import {
  COLUMN_BY_KEY,
  COLUMN_KEYS,
  DEFAULT_VISIBLE,
  getVisibleColumnKeys,
  type ColumnKey,
  type VisibleColumns,
} from './getawayColumns'

export { COLUMN_KEYS, type ColumnKey, type VisibleColumns }

export default function GetawayTable({ getaways, isLoading, onDelete, onUpdate, onImageClick, onRetry, onPasteClick }: any) {
  const [editingId, setEditingId] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(DEFAULT_VISIBLE)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

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
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (isLoading) {
    return (
      <div className="sheet-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
    <div className="sheet-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="sheet-toolbar">
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
      <ColumnPopover
        open={showColumnMenu}
        onClose={() => setShowColumnMenu(false)}
        triggerRef={triggerRef}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
      />
      <div className="sheet-scroll" style={{ flex: 1 }}>
        <table className="sheet">
          <thead>
            <tr>
              {getVisibleColumnKeys(visibleColumns).map((key) => (
                <th key={key} className={COLUMN_BY_KEY[key].className}>
                  {COLUMN_BY_KEY[key].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {getaways.map((getaway: any) => (
              <GetawayRow
                key={getaway.id}
                getaway={getaway}
                isEditing={editingId === getaway.id}
                visibleColumns={visibleColumns}
                onEditStart={() => handleEditStart(getaway.id)}
                onEditEnd={(updatedData: any) => handleEditEnd(getaway.id, updatedData)}
                onDelete={() => onDelete && onDelete(getaway.id)}
                onImageClick={onImageClick}
                onRetry={getaway.source_url ? () => onRetry && onRetry(getaway) : undefined}
                onPasteClick={onPasteClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
