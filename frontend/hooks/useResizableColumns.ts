'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_COL_PX = 44

type Widths<K extends string> = Partial<Record<K, number>>

type ResizeState<K extends string> = {
  key: K
  startX: number
  startWidth: number
}

/**
 * Per-session column resize state for a `<table table-layout: fixed>` rendered with `<colgroup>`.
 *
 * Usage:
 *   const { widths, getColStyle, startResize } = useResizableColumns<ColumnKey>()
 *   <col style={getColStyle(key)} />
 *   <th><span className="col-resize-handle" onMouseDown={(e) => startResize(key, e)} /></th>
 */
export function useResizableColumns<K extends string>() {
  const [widths, setWidths] = useState<Widths<K>>({})
  const stateRef = useRef<ResizeState<K> | null>(null)

  const onMove = useCallback((e: MouseEvent) => {
    const s = stateRef.current
    if (!s) return
    const next = Math.max(MIN_COL_PX, Math.round(s.startWidth + (e.clientX - s.startX)))
    setWidths((prev) => ({ ...prev, [s.key]: next }))
  }, [])

  const onUp = useCallback(() => {
    stateRef.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }, [onMove])

  const startResize = useCallback(
    (key: K, e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const th = (e.currentTarget.closest('th') as HTMLElement | null) ?? null
      const startWidth = th?.getBoundingClientRect().width ?? MIN_COL_PX
      stateRef.current = { key, startX: e.clientX, startWidth }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onMove, onUp]
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onMove, onUp])

  const getColStyle = useCallback(
    (key: K): React.CSSProperties | undefined => {
      const w = widths[key]
      return w != null ? { width: `${w}px` } : undefined
    },
    [widths]
  )

  return { widths, getColStyle, startResize }
}
