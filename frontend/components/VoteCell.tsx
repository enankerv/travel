'use client'

import { CommentIcon, ThumbsUpIcon } from '@/components/icons'

type Voter = { user_id: string; first_name?: string; avatar_url?: string }

type VoteCellProps = {
  voters: Voter[]
  currentUserId: string | undefined
  canVote: boolean
  onVote: () => void
  onUnvote: () => void
  className: string
  onCommentClick?: () => void
  commentCount?: number
}

export default function VoteCell({
  voters,
  currentUserId,
  canVote,
  onVote,
  onUnvote,
  className,
  onCommentClick,
  commentCount = 0,
}: VoteCellProps) {
  const myVote = currentUserId && voters.some((v) => v.user_id === currentUserId)
  const voteCount = voters.length

  return (
    <td className={className} onClick={(e) => e.stopPropagation()}>
      <div className="vote-cell">
        {onCommentClick && (
          <button
            type="button"
            className="vote-cell__btn vote-cell__btn--comment"
            onClick={(e) => {
              e.stopPropagation()
              onCommentClick()
            }}
            title="Comments"
            aria-label="Comments"
          >
            <CommentIcon size={18} />
            {commentCount > 0 && (
              <span className="vote-cell__comment-count">{commentCount}</span>
            )}
          </button>
        )}
        {(canVote || voteCount > 0) && (
          <div className="vote-cell__vote-group">
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
                <ThumbsUpIcon size={18} filled={!!myVote} />
              </button>
            )}
            {voteCount > 0 && <span className="vote-cell__like-count">{voteCount}</span>}
          </div>
        )}
      </div>
    </td>
  )
}
