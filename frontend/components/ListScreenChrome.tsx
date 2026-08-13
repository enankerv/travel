'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { presenceColorForUserId } from '@/lib/presenceColors'
import type { PresenceUser } from '@/lib/realtime'
import ScoutCredits from './ScoutCredits'
import ScoutCreditCost from './ScoutCreditCost'
import ListViewToggle from './ListViewToggle'
import ListHeaderScout from './ListHeaderScout'
import { type ListView } from '@/lib/listRoutes'

function presenceLabel(user: PresenceUser) {
  const name = user.first_name?.trim()
  return name || user.user_id.slice(0, 8)
}

function uniqueViewers(users: PresenceUser[]) {
  const seen = new Set<string>()
  const out: PresenceUser[] = []
  for (const user of users) {
    if (seen.has(user.user_id)) continue
    seen.add(user.user_id)
    out.push(user)
  }
  return out
}

function PresenceAvatar({ user }: { user: PresenceUser }) {
  const [imgFailed, setImgFailed] = useState(false)
  const name = presenceLabel(user)
  const showImg = Boolean(user.avatar_url) && !imgFailed

  return (
    <div className="list-screen-chrome__presence-avatar-wrap" data-name={name}>
      <div
        className="list-screen-chrome__presence-avatar"
        style={{
          borderColor: user.cursor_color || presenceColorForUserId(user.user_id),
        }}
      >
        {showImg ? (
          <img
            src={user.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span aria-hidden>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
    </div>
  )
}

export default function ListScreenChrome({
  listId,
  listName,
  otherViewers = [],
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
  otherViewers?: PresenceUser[]
  activeView: ListView
  onBack: () => void
  variant?: 'page' | 'overlay'
  onViewNavigate?: (view: ListView) => void
  memberCount?: number
  onMembersClick?: () => void
  children?: ReactNode
}) {
  const viewers = useMemo(() => uniqueViewers(otherViewers), [otherViewers])

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
        {viewers.length > 0 && (
          <div className="list-screen-chrome__presence">
            <span className="list-screen-chrome__presence-label">Viewing with</span>
            <div className="list-screen-chrome__presence-avatars">
              {viewers.map((user) => (
                <PresenceAvatar key={user.user_id} user={user} />
              ))}
            </div>
          </div>
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
