'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  COLUMN_BY_KEY,
  COLUMN_KEYS,
  type ColumnKey,
  type VisibleColumns,
} from './getawayColumns'

type ColumnPopoverProps = {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  visibleColumns: VisibleColumns
  onToggleColumn: (key: ColumnKey) => void
}

export default function ColumnPopover({
  open,
  onClose,
  triggerRef,
  visibleColumns,
  onToggleColumn,
}: ColumnPopoverProps) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect())
    } else {
      setAnchorRect(null)
    }
  }, [open, triggerRef])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        open &&
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose, triggerRef])

  if (!open || !anchorRect) return null

  return createPortal(
    <>
      <div
        className="column-popover-backdrop"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={popoverRef}
        className="column-popover"
        role="dialog"
        aria-label="Column visibility"
        style={{
          top: anchorRect.bottom + 8,
          left: anchorRect.left,
        }}
      >
        <div className="column-popover-title">Show columns</div>
        <div className="column-popover-list">
          {COLUMN_KEYS.map((key) => (
            <label key={key} className="column-popover-item">
              <input
                type="checkbox"
                checked={visibleColumns[key]}
                onChange={() => onToggleColumn(key)}
              />
              {COLUMN_BY_KEY[key].label}
            </label>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}
