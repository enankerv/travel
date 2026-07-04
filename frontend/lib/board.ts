/** Cork board types and POI-local comment/vote helpers. */
import type { CommentRecord, VoteRecord } from './api'
import type { Getaway, POIBase } from './getaway'
import { mergePoiFromRealtime } from './poi'

export type BoardPoi = POIBase &
  Partial<Getaway> & {
    comments: CommentRecord[]
    votes: VoteRecord[]
  }

export type BoardSnapshot = {
  list: { id: string; name: string; user_id?: string; member_count?: number }
  members: Array<{
    user_id: string
    role?: string
    profile?: { first_name?: string; avatar_url?: string }
  }>
  pois: BoardPoi[]
}

/** Realtime POI row → keep nested comments/votes from the previous snapshot. */
export function mergeBoardPoiFromRealtime(
  prev: BoardPoi,
  incoming: Partial<BoardPoi>,
): BoardPoi {
  const merged = mergePoiFromRealtime(prev, incoming) as BoardPoi
  return {
    ...merged,
    comments: incoming.comments ?? prev.comments,
    votes: incoming.votes ?? prev.votes,
  }
}

export function patchBoardPoi(
  pois: BoardPoi[],
  poiId: string,
  patch: Partial<BoardPoi>,
): BoardPoi[] {
  return pois.map((p) => (p.id === poiId ? { ...p, ...patch } : p))
}

export function addCommentToBoardPoi(
  pois: BoardPoi[],
  comment: CommentRecord,
): BoardPoi[] {
  return pois.map((p) => {
    if (p.id !== comment.poi_id) return p
    if (p.comments.some((c) => c.id === comment.id)) return p
    return { ...p, comments: [...p.comments, comment] }
  })
}

export function updateCommentOnBoardPoi(
  pois: BoardPoi[],
  comment: CommentRecord,
): BoardPoi[] {
  return pois.map((p) =>
    p.id === comment.poi_id
      ? {
          ...p,
          comments: p.comments.map((c) =>
            c.id === comment.id ? { ...c, ...comment } : c,
          ),
        }
      : p,
  )
}

export function removeCommentFromBoardPoi(
  pois: BoardPoi[],
  poiId: string,
  commentId: string,
): BoardPoi[] {
  return pois.map((p) =>
    p.id === poiId
      ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
      : p,
  )
}

export function addVoteToBoardPoi(
  pois: BoardPoi[],
  vote: VoteRecord,
): BoardPoi[] {
  return pois.map((p) => {
    if (p.id !== vote.poi_id) return p
    if (p.votes.some((v) => v.user_id === vote.user_id)) return p
    return { ...p, votes: [...p.votes, vote] }
  })
}

export function removeVoteFromBoardPoi(
  pois: BoardPoi[],
  poiId: string,
  userId: string,
): BoardPoi[] {
  return pois.map((p) =>
    p.id === poiId
      ? { ...p, votes: p.votes.filter((v) => v.user_id !== userId) }
      : p,
  )
}
