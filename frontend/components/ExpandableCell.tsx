'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

const DEFAULT_TRUNCATE_LEN = 50
const DEFAULT_WRAP_MAX_LINES = 4

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
  /** Optional second line (e.g. price per person). */
  subline?: ReactNode
  /** If true, wrap full text to fit the column width (no character truncation; clamps to `maxLines`). */
  wrap?: boolean
  /** Max lines to show in wrap mode before clamping. Defaults to 4. */
  maxLines?: number
}

/** Reusable cell with expand/collapse for long text. Shrinks to fit, expands on click. */
export default function ExpandableCell({
  value,
  truncateLen = DEFAULT_TRUNCATE_LEN,
  cellClassName,
  suffix,
  subline,
  wrap = false,
  maxLines = DEFAULT_WRAP_MAX_LINES,
}: ExpandableCellProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const fullText = toDisplayString(value)
  const isLong = !wrap && fullText.length > truncateLen

  useEffect(() => {
    if (!wrap) return
    const el = textRef.current
    if (!el) return
    const check = () => {
      setOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [wrap, fullText, maxLines])

  if (wrap) {
    const isClamped = !expanded
    const wrapTextClass = `expandable-wrap-text${isClamped ? ' expandable-wrap-text--clamped' : ''}`
    const tdClass = `${cellClassName} expandable-wrap${expanded ? ' expandable-wrap--expanded' : ''}${overflowing ? ' expandable-wrap--clickable' : ''}`
    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpanded((v) => !v)
    }
    return (
      <td
        className={tdClass}
        title={fullText}
        onClick={overflowing ? handleToggle : undefined}
        style={
          {
            ['--wrap-max-lines' as any]: String(maxLines),
          } as React.CSSProperties
        }
      >
        <span className="expandable-cell-inner expandable-cell-inner--wrap">
          <span ref={textRef} className={wrapTextClass}>
            {fullText}
          </span>
          {suffix}
        </span>
        {overflowing && (
          <button
            type="button"
            className="expandable-wrap-toggle"
            onClick={handleToggle}
          >
            {expanded ? 'Show less ▲' : 'Show more ▼'}
          </button>
        )}
        {subline != null && subline !== '' && (
          <div className="expandable-cell-subline">{subline}</div>
        )}
      </td>
    )
  }

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
      {subline != null && subline !== "" && (
        <div className="expandable-cell-subline">{subline}</div>
      )}
    </td>
  )
}

export { toDisplayString }
