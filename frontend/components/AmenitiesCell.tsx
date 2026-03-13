'use client'

import { useState } from 'react'

const DEFAULT_TRUNCATE_LEN = 50

/** Normalize amenities from API: can be string, array of strings, or mixed. Returns single display string. */
export function normalizeAmenitiesDisplay(
  amenities: string[] | string | null | undefined
): string {
  if (amenities == null) return '—'
  if (typeof amenities === 'string') {
    const t = amenities.trim()
    return t || '—'
  }
  if (Array.isArray(amenities)) {
    const s = amenities
      .map((a) => (typeof a === 'string' ? a : String(a)).trim())
      .filter(Boolean)
      .join(', ')
    return s || '—'
  }
  return '—'
}

/** Parse comma-separated string into array of trimmed non-empty strings (for editing amenities). */
export function parseAmenitiesInput(value: string): string[] {
  if (!value || typeof value !== 'string') return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

type AmenitiesCellProps = {
  amenities: string[] | string | null | undefined
  truncateLen?: number
  readOnly?: boolean
}

export default function AmenitiesCell({
  amenities,
  truncateLen = DEFAULT_TRUNCATE_LEN,
  readOnly = false,
}: AmenitiesCellProps) {
  const [expanded, setExpanded] = useState(false)
  const fullText = normalizeAmenitiesDisplay(amenities)
  const isLong = fullText.length > truncateLen

  // Don't stop propagation - let row click open listing. Expand/collapse buttons handle their own clicks.

  if (readOnly) {
    return (
      <td className="col-amenities" title={fullText}>
        {fullText}
      </td>
    )
  }

  const cellClassName = `col-amenities${expanded ? ' amenities-expanded' : ''}`

  const renderContent = () => {
    if (fullText === '—') return '—'
    if (!isLong) return fullText
    if (expanded) {
      return (
        <span>
          {fullText}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
            className="amenities-collapse-btn"
            title="Show less"
          >
            {' '}▼
          </button>
        </span>
      )
    }
    return (
      <span>
        {fullText.slice(0, truncateLen)}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          className="amenities-expand-btn"
          title="Show all amenities"
        >
          <span className="amenities-ellipsis"> …</span>
          <span className="amenities-arrow"> ▶</span>
        </button>
      </span>
    )
  }

  return (
    <td
      className={cellClassName}
      title={fullText}
    >
      {renderContent()}
    </td>
  )
}
