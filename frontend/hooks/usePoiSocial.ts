'use client'

import type { CommentRecord } from '@/lib/api'
import { useBoardContextOptional } from '@/lib/BoardContext'
import { useListDetailContextOptional } from '@/lib/ListDetailContext'
import type { Voter } from '@/lib/votes'

type BoardPoiSocial = {
  source: 'board'
  listId: string
  comments: CommentRecord[]
  voters: Voter[]
  isListMember: boolean
  currentUserId: string | undefined
  onVote: (poiId: string) => Promise<void>
  onUnvote: (poiId: string) => Promise<void>
  upsertComment: (comment: CommentRecord) => void
  removeComment: (poiId: string, commentId: string) => void
}

type ListPoiSocial = {
  source: 'list'
  listId: string
  comments: CommentRecord[]
  voters: Voter[]
  isListMember: boolean
  currentUserId: string | undefined
  onVote: (poiId: string) => Promise<void>
  onUnvote: (poiId: string) => Promise<void>
  setCommentsByGetaway: React.Dispatch<
    React.SetStateAction<Record<string, CommentRecord[]>>
  >
}

export type PoiSocial = BoardPoiSocial | ListPoiSocial

/** Comments + votes for one POI from board or list context. */
export function usePoiSocial(poiId: string): PoiSocial {
  const board = useBoardContextOptional()
  const list = useListDetailContextOptional()

  if (board) {
    const poi = board.pois.find((p) => p.id === poiId)
    return {
      source: 'board',
      listId: board.listId,
      comments: poi?.comments ?? [],
      voters: poi?.votes ?? [],
      isListMember: board.isListMember,
      currentUserId: board.currentUserId,
      onVote: board.onVote,
      onUnvote: board.onUnvote,
      upsertComment: board.upsertComment,
      removeComment: board.removeComment,
    }
  }

  if (list) {
    return {
      source: 'list',
      listId: list.list.id,
      comments: list.commentsByGetaway[poiId] ?? [],
      voters: list.votesByGetaway[poiId] ?? [],
      isListMember: list.isListMember,
      currentUserId: list.currentUserId,
      onVote: list.onVote,
      onUnvote: list.onUnvote,
      setCommentsByGetaway: list.setCommentsByGetaway,
    }
  }

  throw new Error('usePoiSocial requires BoardProvider or ListDetailProvider')
}
