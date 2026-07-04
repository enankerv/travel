'use client'

import { useListDetailContext } from '@/lib/ListDetailContext'
import { CommentIcon, ThumbsUpIcon } from './icons'
import VoteFacePile from './VoteFacePile'

export default function PoiVoteBar({
  poiId,
  onCommentClick,
}: {
  poiId: string
  onCommentClick?: () => void
}) {
  const {
    votesByGetaway,
    commentsByGetaway,
    onVote,
    onUnvote,
    isListMember,
    currentUserId,
  } = useListDetailContext()

  const voters = votesByGetaway[poiId] || []
  const commentCount = commentsByGetaway[poiId]?.length ?? 0
  const myVote =
    !!currentUserId && voters.some((v) => v.user_id === currentUserId)
  const voteCount = voters.length

  if (!isListMember && voteCount === 0 && commentCount === 0) return null

  return (
    <div className="vote-cell board-poi-sidebar__votes">
      {onCommentClick && (
        <button
          type="button"
          className="vote-cell__btn vote-cell__btn--comment"
          onClick={onCommentClick}
          title="Comments"
          aria-label="Comments"
        >
          <CommentIcon size={18} />
          {commentCount > 0 && (
            <span className="vote-cell__comment-count">{commentCount}</span>
          )}
        </button>
      )}
      {(isListMember || voteCount > 0) && (
        <div className="vote-cell__vote-group">
          {isListMember && (
            <button
              type="button"
              className={`vote-cell__btn${myVote ? ' voted' : ''}`}
              onClick={() => (myVote ? onUnvote(poiId) : onVote(poiId))}
              title={myVote ? 'Remove your vote' : 'Vote for this item'}
              aria-label={myVote ? 'Remove vote' : 'Vote'}
            >
              <ThumbsUpIcon size={18} filled={myVote} />
            </button>
          )}
          {voteCount > 0 && <VoteFacePile voters={voters} />}
        </div>
      )}
    </div>
  )
}
