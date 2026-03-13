'use client'

import { useState, type ReactNode } from 'react'

const DEFAULT_TRUNCATE_LEN = 50

/** Normalize value to display string: string, array (joined), number, etc. */
function toDisplayString(
  value: string | string[] | number | null | undefined
): string {
  if (value == null) return '—'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim() || '—'
  if (Array.isArray(value)) {
    const s = value
      .map((x) => (typeof x === 'string' ? x : String(x)).trim())
      .filter(Boolean)
      .join(', ')
    return s || '—'
  }
  return '—'
}

type ExpandableCellProps = {
  value: string | string[] | number | null | undefined
  truncateLen?: number
  cellClassName: string
  suffix?: ReactNode
}

/** Reusable cell with expand/collapse for long text. Shrinks to fit, expands on click. */
export default function ExpandableCell({
  value,
  truncateLen = DEFAULT_TRUNCATE_LEN,
  cellClassName,
  suffix,
}: ExpandableCellProps) {
  const [expanded, setExpanded] = useState(false)
  const fullText = toDisplayString(value)
  const isLong = fullText.length > truncateLen

  const handleCellClick = (e: React.MouseEvent) => {
    if (!isLong) return
    e.stopPropagation()
    if (!expanded) {
      setExpanded(true)
    } else {
      setExpanded(false)
    }
  }

  const renderContent = () => {
    if (fullText === '—') return '—'
    if (!isLong) return fullText
    if (expanded) {
      return (
        <span className="expandable-content">
          {fullText}
          <button
            type="button"
            className="expandable-collapse-btn"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
            title="Show less"
          >
            {' '}▲
          </button>
        </span>
      )
    }
    return (
      <span
        className="expandable-content expandable-truncated"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(true)
          }
        }}
        title="Click to expand"
      >
        <span className="expandable-text">{fullText.slice(0, truncateLen)}</span>
        <span className="expandable-indicator">
          <span className="expandable-arrow">▼</span>
        </span>
      </span>
    )
  }

  const className = `${cellClassName}${expanded ? ' expandable-expanded' : ''}${isLong ? ' expandable-clickable' : ''}`

  return (
    <td className={className} onClick={handleCellClick} title={fullText}>
      <span className="expandable-cell-inner">
        {renderContent()}
        {suffix}
      </span>
    </td>
  )
}

export { toDisplayString }
