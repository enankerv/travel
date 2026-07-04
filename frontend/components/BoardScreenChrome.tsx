'use client'

import { useRouter } from 'next/navigation'
import { presenceColorForUserId } from '@/lib/presenceColors'
import type { PresenceUser } from '@/lib/realtime'
import ScoutCredits from './ScoutCredits'

export default function BoardScreenChrome({
  listId,
  listName,
  otherViewers,
}: {
  listId: string
  listName: string
  otherViewers: PresenceUser[]
}) {
  const router = useRouter()

  return (
    <header className="board-screen__header">
      <div className="board-screen__header-left">
        <button
          type="button"
          className="board-screen__back"
          onClick={() => router.push(`/?list=${listId}`)}
          aria-label="Back to list"
        >
          ←
        </button>
        <h1 className="board-screen__title">{listName}</h1>
        {otherViewers.length > 0 && (
          <div
            className="board-screen__presence"
            title={otherViewers
              .map((u) => u.first_name || u.user_id.slice(0, 8))
              .join(', ')}
          >
            {otherViewers.slice(0, 5).map((u) => (
              <div
                key={u.user_id}
                className="board-screen__presence-avatar"
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
        )}
      </div>
      <div className="board-screen__header-right">
        <ScoutCredits />
      </div>
    </header>
  )
}
