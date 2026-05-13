/** Must match `.vote-cell__face-wrap` in globals.css (face size & overlap ratio). */
const VOTE_FACE_SIZE_REM = 1.375
const VOTE_FACE_OVERLAP_RATIO = 0.38

/**
 * Minimum width (rem) for the votes column: comment + vote + face pile + slack.
 * Used by `<col>` (table-wide max) and optionally per-cell for consistency.
 */
export function votesColumnMinWidthRem(opts: {
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
