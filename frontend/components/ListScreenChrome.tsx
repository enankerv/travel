'use client'

import type { ReactNode } from 'react'
import ScoutCredits from './ScoutCredits'
import ScoutCreditCost from './ScoutCreditCost'
import ListViewToggle from './ListViewToggle'
import ListHeaderScout from './ListHeaderScout'
import { type ListView } from '@/lib/listRoutes'

export default function ListScreenChrome({
  listId,
  listName,
  activeView,
  onBack,
  variant = 'page',
  onViewNavigate,
  memberCount,
  onMembersClick,
  children,
}: {
  listId: string
  listName: string
  activeView: ListView
  onBack: () => void
  variant?: 'page' | 'overlay'
  onViewNavigate?: (view: ListView) => void
  memberCount?: number
  onMembersClick?: () => void
  children?: ReactNode
}) {
  return (
    <div className={`list-screen-chrome list-screen-chrome--${variant}`}>
      <header className="list-screen-chrome__header">
        <button
          type="button"
          className="list-screen-chrome__back"
          onClick={onBack}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="list-screen-chrome__title">{listName}</h1>
        <ListViewToggle
          listId={listId}
          activeView={activeView}
          variant={variant === 'overlay' ? 'overlay' : 'default'}
          className="list-screen-chrome__view-toggle"
          onNavigate={onViewNavigate}
        />
        <div className="list-screen-chrome__header-spacer" aria-hidden />
        <ListHeaderScout />
        {onMembersClick != null && memberCount != null && (
          <button
            type="button"
            className="list-screen-chrome__members-btn"
            onClick={onMembersClick}
            aria-label={`Members (${memberCount})`}
            title={`Members (${memberCount})`}
          >
            <svg
              className="list-screen-chrome__members-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="list-screen-chrome__members-count">{memberCount}</span>
          </button>
        )}
        <ScoutCredits className="list-screen-chrome__credits" />
      </header>

      {children}
    </div>
  )
}

export function ListScreenChatButton({
  chatOpen,
  onToggle,
}: {
  chatOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`list-screen-chrome__chat-btn${chatOpen ? ' list-screen-chrome__chat-btn--active' : ''}`}
      onClick={onToggle}
      aria-label="Toggle chat (1 scout credit per message)"
      aria-pressed={chatOpen}
    >
      <span>Chat</span>
      <ScoutCreditCost />
    </button>
  )
}
