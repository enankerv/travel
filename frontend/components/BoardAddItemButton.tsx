'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BOARD_POI_TYPE_OPTIONS,
  type BoardCreatablePoiType,
} from '@/lib/poi'

export default function BoardAddItemButton({
  creating,
  onAdd,
  buttonClassName = 'board-screen__tool-btn',
}: {
  creating: boolean
  onAdd: (poiType: BoardCreatablePoiType) => void
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="board-add-item" ref={rootRef}>
      <button
        type="button"
        className={buttonClassName}
        disabled={creating}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {creating ? 'Adding…' : 'Add item'}
      </button>
      {open && (
        <div className="board-add-item__menu" role="menu">
          {BOARD_POI_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              role="menuitem"
              className="board-add-item__option"
              onClick={() => {
                setOpen(false)
                onAdd(opt.type)
              }}
            >
              <span className="board-add-item__icon" aria-hidden>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
