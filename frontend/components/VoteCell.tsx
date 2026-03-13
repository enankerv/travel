'use client'

import { ThumbsUpIcon } from '@/components/icons'

type Voter = { user_id: string; first_name?: string; avatar_url?: string }

type VoteCellProps = {
  voters: Voter[]
  currentUserId: string | undefined
  canVote: boolean
  onVote: () => void
  onUnvote: () => void
  className: string
}

function displayName(v: Voter): string {
  return v.first_name?.trim() || v.user_id?.slice(0, 8) + '…' || 'Unknown'
}

export default function VoteCell({
  voters,
  currentUserId,
  canVote,
  onVote,
  onUnvote,
  className,
}: VoteCellProps) {
  const myVote = currentUserId && voters.some((v) => v.user_id === currentUserId)

  return (
    <td className={className}>
      <div className="vote-cell">
        <div className="vote-cell__avatars" title={voters.map((v) => displayName(v)).join(', ')}>
          {voters.slice(0, 5).map((v) => (
            <span
              key={v.user_id}
              className="vote-cell__avatar"
              title={displayName(v)}
            >
              {v.avatar_url ? (
                <img src={v.avatar_url} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="vote-cell__avatar-fallback">
                  {displayName(v).charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          ))}
          {voters.length > 5 && (
            <span className="vote-cell__more">+{voters.length - 5}</span>
          )}
        </div>
        {canVote && (
          <button
            type="button"
            className={`vote-cell__btn ${myVote ? 'voted' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              myVote ? onUnvote() : onVote()
            }}
            title={myVote ? 'Remove your vote' : 'Vote for this getaway'}
            aria-label={myVote ? 'Remove vote' : 'Vote'}
          >
            <ThumbsUpIcon size={16} filled={!!myVote} />
          </button>
        )}
      </div>
    </td>
  )
}
