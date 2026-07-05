'use client'

import { useRouter } from 'next/navigation'

export type ListView = 'list' | 'map' | 'board'

export function listViewHref(listId: string, view: ListView): string {
  if (view === 'board') return `/board/${listId}`
  if (view === 'map') return `/?list=${listId}&view=map`
  return `/?list=${listId}`
}

const VIEWS: { id: ListView; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'map', label: 'Map' },
  { id: 'board', label: 'Board' },
]

export default function ListViewToggle({
  listId,
  activeView,
  variant = 'default',
  className,
  onNavigate,
}: {
  listId: string
  activeView: ListView
  variant?: 'default' | 'overlay'
  className?: string
  onNavigate?: (view: ListView) => void
}) {
  const router = useRouter()

  return (
    <div
      className={`list-view-toggle list-view-toggle--${variant}${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label="List views"
    >
      {VIEWS.map(({ id, label }) => {
        const isActive = id === activeView
        return (
          <button
            key={id}
            type="button"
            role="tab"
            className={`list-view-toggle__btn${isActive ? ' list-view-toggle__btn--active' : ''}`}
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            disabled={isActive}
            onClick={() => {
              if (isActive) return
              onNavigate?.(id)
              router.push(listViewHref(listId, id))
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
