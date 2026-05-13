'use client'

import { useMemo } from 'react'
import { CommentIcon, ThumbsUpIcon } from '@/components/icons'
import VoteFacePile, { type Voter } from '@/components/VoteFacePile'

/** Must match `.vote-cell__face-wrap` in globals.css (face size & overlap ratio). */
const VOTE_FACE_SIZE_REM = 1.375
const VOTE_FACE_OVERLAP_RATIO = 0.38

function votesColumnMinWidthRem(opts: {
  voteCount: number
  canVote: boolean
  hasCommentButton: boolean
}): string | undefined {
  const { voteCount, canVote, hasCommentButton } = opts
  if (voteCount === 0 && !canVote) return undefined

  const pileRem =
    voteCount > 0
      ? VOTE_FACE_SIZE_REM +
        Math.max(0, voteCount - 1) * VOTE_FACE_SIZE_REM * (1 - VOTE_FACE_OVERLAP_RATIO)
      : 0

  const commentRem = hasCommentButton ? 2.65 : 0
  const voteBtnRem = canVote ? 2.45 : 0
  const voteCellGapRem = hasCommentButton && (canVote || voteCount > 0) ? 0.35 : 0
  const voteGroupGapRem = (canVote || hasCommentButton) && voteCount > 0 ? 0.2 : 0
  const padSlackRem = 1.65

  const total = pileRem + commentRem + voteBtnRem + voteCellGapRem + voteGroupGapRem + padSlackRem
  const floorRem = 8.25
  return `${Math.max(floorRem, total).toFixed(2)}rem`
}

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

  const tdMinWidth = useMemo(
    () =>
      votesColumnMinWidthRem({
        voteCount,
        canVote,
        hasCommentButton: !!onCommentClick,
      }),
    [voteCount, canVote, onCommentClick],
  )

  return (
    <td
      className={className}
      style={tdMinWidth ? { minWidth: tdMinWidth } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
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
            {voteCount > 0 && <VoteFacePile voters={voters} />}
          </div>
        )}
      </div>
    </td>
  )
}
