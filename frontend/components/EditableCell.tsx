'use client'

import { normalizeAmenitiesDisplay, parseAmenitiesInput } from '@/components/AmenitiesCell'

export type EditableCellType = 'text' | 'number' | 'price' | 'amenities'

type EditableCellProps = {
  type: EditableCellType
  value: string | number | null | string[] | undefined
  onChange: (value: string | number | null | string[]) => void
  cellClassName: string
  placeholder?: string
}

export default function EditableCell({
  type,
  value,
  onChange,
  cellClassName,
  placeholder,
}: EditableCellProps) {
  if (type === 'text') {
    return (
      <td className={cellClassName}>
        <input
          type="text"
          className="sheet-edit-input"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </td>
    )
  }

  if (type === 'number') {
    return (
      <td className={cellClassName}>
        <input
          type="text"
          inputMode="numeric"
          className="sheet-edit-input"
          value={value != null ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value.trim()
            const n = parseInt(v, 10)
            onChange(v === '' ? null : (Number.isNaN(n) ? null : n))
          }}
        />
      </td>
    )
  }

  if (type === 'price') {
    return (
      <td className={cellClassName}>
        <input
          type="text"
          className="sheet-edit-input"
          value={value != null && value !== '' ? String(value) : ''}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            onChange(Number.isNaN(n) ? null : n)
          }}
        />
      </td>
    )
  }

  // type === 'amenities'
  const display =
    (() => {
      const s = normalizeAmenitiesDisplay(value as string[] | string | null | undefined)
      return s === '—' ? '' : s
    })()

  return (
    <td className={cellClassName}>
      <input
        type="text"
        className="sheet-edit-input"
        placeholder={placeholder ?? 'e.g. Wifi, Kitchen, Pool'}
        value={display}
        onChange={(e) => onChange(parseAmenitiesInput(e.target.value))}
      />
    </td>
  )
}
