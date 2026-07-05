'use client'

import type { ReactNode } from 'react'
import { presenceColorForUserId } from '@/lib/presenceColors'
import type { PresenceUser } from '@/lib/realtime'
import ScoutCredits from './ScoutCredits'
import ScoutCreditCost from './ScoutCreditCost'
import ListViewToggle, { type ListView } from './ListViewToggle'

export default function ListScreenChrome({
  listId,
  listName,
  otherViewers,
  activeView,
  onBack,
  variant = 'page',
  onViewNavigate,
  tabs,
  subheaderRight,
  children,
}: {
  listId: string
  listName: string
  otherViewers: PresenceUser[]
  activeView: ListView
  onBack: () => void
  variant?: 'page' | 'overlay'
  onViewNavigate?: (view: ListView) => void
  tabs?: ReactNode
  subheaderRight?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className={`list-screen-chrome list-screen-chrome--${variant}`}>
      <header className="list-screen-chrome__header">
        <div className="list-screen-chrome__header-left">
          <button
            type="button"
            className="list-screen-chrome__back"
            onClick={onBack}
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="list-screen-chrome__title">{listName}</h1>
          {otherViewers.length > 0 && (
            <div
              className="list-screen-chrome__presence"
              title={otherViewers
                .map((u) => u.first_name || u.user_id.slice(0, 8))
                .join(', ')}
            >
              {variant === 'page' && <span>Viewing with</span>}
              <div className="list-screen-chrome__presence-avatars">
                {otherViewers.slice(0, 5).map((u) => (
                  <div
                    key={u.user_id}
                    className="list-screen-chrome__presence-avatar"
                    title={u.first_name || u.user_id.slice(0, 8)}
                    style={{
                      borderColor:
                        u.cursor_color || presenceColorForUserId(u.user_id),
                    }}
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span>
                        {(u.first_name || u.user_id).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="list-screen-chrome__header-right">
          <ScoutCredits />
        </div>
      </header>

      <div className="list-screen-chrome__subheader">
        <ListViewToggle
          listId={listId}
          activeView={activeView}
          variant={variant === 'overlay' ? 'overlay' : 'default'}
          onNavigate={onViewNavigate}
        />
        {subheaderRight && (
          <div className="list-screen-chrome__subheader-right">{subheaderRight}</div>
        )}
      </div>

      {tabs}
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
