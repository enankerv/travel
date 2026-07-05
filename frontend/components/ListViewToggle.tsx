'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { listViewHref, type ListView } from '@/lib/listRoutes'

export type { ListView }

export { listViewHref }

const VIEWS: {
  id: ListView
  label: string
  icon: ReactNode
}[] = [
  {
    id: 'list',
    label: 'List',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" strokeLinejoin="round" />
        <path d="M8 2v16M16 6v16" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'board',
    label: 'Board',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="11" rx="1" />
      </svg>
    ),
  },
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
      {VIEWS.map(({ id, label, icon }) => {
        const isActive = id === activeView
        return (
          <button
            key={id}
            type="button"
            role="tab"
            className={`list-view-toggle__btn${isActive ? ' list-view-toggle__btn--active' : ''}`}
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            title={label}
            onClick={() => {
              if (isActive) return
              onNavigate?.(id)
              router.push(listViewHref(listId, id))
            }}
          >
            {icon}
            <span className="list-view-toggle__label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
