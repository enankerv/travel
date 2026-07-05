'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import LoadingView from '@/components/LoadingView'
import {
  addVote,
  removeVote,
  deleteGetaway,
  deletePoi,
  getBoard,
  getListMembers,
  updateGetaway,
  updatePoi,
  type CommentRecord,
} from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useListRealtime, useListPresence, type PresenceUser } from '@/lib/realtime'
import type { GetawayUpdate } from '@/lib/getaway'
import type { POIUpdate } from '@/lib/poi'
import {
  addCommentToBoardPoi,
  addVoteToBoardPoi,
  mergeBoardPoiFromRealtime,
  removeCommentFromBoardPoi,
  removeVoteFromBoardPoi,
  updateCommentOnBoardPoi,
  type BoardPoi,
} from '@/lib/board'
import type { BoardSubgroup } from '@/lib/subgroup'

export type BoardContextValue = {
  listId: string
  list: { id: string; name: string }
  members: Array<{
    user_id: string
    role?: string
    profile?: { first_name?: string; avatar_url?: string }
  }>
  pois: BoardPoi[]
  setPois: React.Dispatch<React.SetStateAction<BoardPoi[]>>
  subgroups: BoardSubgroup[]
  setSubgroups: React.Dispatch<React.SetStateAction<BoardSubgroup[]>>
  otherViewers: PresenceUser[]
  isLoading: boolean
  error: string
  setError: (msg: string) => void
  reload: () => Promise<void>
  updateMembers: (members: BoardContextValue['members']) => void
  refreshMembers: () => Promise<void>
  isListMember: boolean
  currentUserId: string | undefined
  currentUserProfile: { first_name?: string; avatar_url?: string } | undefined
  onVote: (poiId: string) => Promise<void>
  onUnvote: (poiId: string) => Promise<void>
  upsertComment: (comment: CommentRecord) => void
  removeComment: (poiId: string, commentId: string) => void
  handleUpdateGetaway: (poiId: string, updates: GetawayUpdate) => Promise<void>
  handleUpdatePoi: (poiId: string, updates: POIUpdate) => Promise<void>
  handleDeletePoi: (poiId: string) => Promise<boolean>
  partySize: number
}

const BoardContext = createContext<BoardContextValue | null>(null)

export function BoardProvider({
  listId,
  children,
}: {
  listId: string
  children: ReactNode
}) {
  const { user } = useAuth()
  const [list, setList] = useState<{ id: string; name: string } | null>(null)
  const [members, setMembers] = useState<BoardContextValue['members']>([])
  const [pois, setPois] = useState<BoardPoi[]>([])
  const [subgroups, setSubgroups] = useState<BoardSubgroup[]>([])
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const currentUserProfile = useMemo(() => {
    const member = members.find((m) => m.user_id === user?.id)
    if (member?.profile) return member.profile
    if (!user) return undefined
    return {
      first_name:
        user.user_metadata?.full_name?.split(' ')[0] ||
        user.email?.split('@')[0],
      avatar_url:
        user.user_metadata?.avatar_url || user.user_metadata?.picture,
    }
  }, [members, user])

  const isListMember = !!user && members.some((m) => m.user_id === user.id)
  const otherViewers = viewingUsers.filter((u) => u.user_id !== user?.id)

  const loadBoard = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getBoard(listId)
      setList(data.list)
      setMembers(data.members || [])
      setSubgroups(data.subgroups || [])
      setPois(data.pois || [])
      setError('')
    } catch {
      setError('Failed to load board')
    } finally {
      setIsLoading(false)
    }
  }, [listId])

  const refreshPois = useCallback(async () => {
    try {
      const data = await getBoard(listId)
      setPois(data.pois || [])
    } catch {
      /* refetch covers image signing edge cases */
    }
  }, [listId])

  const refreshMembers = useCallback(async () => {
    try {
      const data = await getListMembers(listId)
      setMembers(data?.members || [])
    } catch {
      /* modal surfaces fetch errors */
    }
  }, [listId])

  const updateMembers = useCallback((next: BoardContextValue['members']) => {
    setMembers(next)
  }, [])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  useListRealtime({
    listId,
    enabled: !isLoading && !!user,
    onInsert: (row) => {
      const incoming = row as BoardPoi
      setPois((prev) => {
        if (prev.some((p) => p.id === incoming.id)) return prev
        return [
          {
            ...incoming,
            comments: incoming.comments ?? [],
            votes: incoming.votes ?? [],
          },
          ...prev,
        ]
      })
    },
    onUpdate: (row) => {
      setPois((prev) =>
        prev.map((p) =>
          p.id === row.id
            ? mergeBoardPoiFromRealtime(p, row as BoardPoi)
            : p,
        ),
      )
    },
    onDelete: (id) => {
      setPois((prev) => prev.filter((p) => p.id !== id))
    },
    onImagesChange: () => {
      void refreshPois()
    },
    onCommentInsert: (c) =>
      setPois((prev) => addCommentToBoardPoi(prev, c as CommentRecord)),
    onCommentUpdate: (c) =>
      setPois((prev) => updateCommentOnBoardPoi(prev, c as CommentRecord)),
    onCommentDelete: (id, poiId) =>
      setPois((prev) => removeCommentFromBoardPoi(prev, poiId, id)),
    onVoteInsert: (voter) => setPois((prev) => addVoteToBoardPoi(prev, voter)),
    onVoteDelete: (poiId, userId) =>
      setPois((prev) => removeVoteFromBoardPoi(prev, poiId, userId)),
  })

  useListPresence({
    listId,
    enabled: !isLoading && !!user,
    user,
    onUsersChange: setViewingUsers,
  })

  const onVote = useCallback(
    async (poiId: string) => {
      if (!user?.id) return
      try {
        await addVote(listId, poiId)
        setPois((prev) =>
          addVoteToBoardPoi(prev, {
            poi_id: poiId,
            user_id: user.id,
            first_name: currentUserProfile?.first_name,
            avatar_url: currentUserProfile?.avatar_url,
          }),
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to add vote'
        setError(message)
      }
    },
    [listId, user?.id, currentUserProfile],
  )

  const onUnvote = useCallback(
    async (poiId: string) => {
      if (!user?.id) return
      try {
        await removeVote(listId, poiId)
        setPois((prev) => removeVoteFromBoardPoi(prev, poiId, user.id))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove vote'
        setError(message)
      }
    },
    [listId, user?.id],
  )

  const upsertComment = useCallback((comment: CommentRecord) => {
    setPois((prev) => {
      const exists = prev.some((p) =>
        p.comments.some((c) => c.id === comment.id),
      )
      return exists
        ? updateCommentOnBoardPoi(prev, comment)
        : addCommentToBoardPoi(prev, comment)
    })
  }, [])

  const removeComment = useCallback((poiId: string, commentId: string) => {
    setPois((prev) => removeCommentFromBoardPoi(prev, poiId, commentId))
  }, [])

  const handleUpdateGetaway = useCallback(
    async (poiId: string, updates: GetawayUpdate) => {
      try {
        await updateGetaway(listId, poiId, updates)
        setPois((prev) =>
          prev.map((p) => (p.id === poiId ? { ...p, ...updates } : p)),
        )
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to update getaway'
        setError(message)
      }
    },
    [listId],
  )

  const handleUpdatePoi = useCallback(
    async (poiId: string, updates: POIUpdate) => {
      try {
        const updated = await updatePoi(listId, poiId, updates)
        setPois((prev) =>
          prev.map((p) =>
            p.id === poiId
              ? mergeBoardPoiFromRealtime(p, updated as BoardPoi)
              : p,
          ),
        )
      } catch {
        setError('Failed to update item')
      }
    },
    [listId],
  )

  const handleDeletePoi = useCallback(
    async (poiId: string) => {
      const poi = pois.find((p) => p.id === poiId)
      if (!poi || !confirm('Delete this item?')) return false
      try {
        if (poi.poi_type === 'getaway') {
          await deleteGetaway(listId, poiId)
        } else {
          await deletePoi(listId, poiId)
        }
        setPois((prev) => prev.filter((p) => p.id !== poiId))
        return true
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete item'
        setError(message)
        return false
      }
    },
    [listId, pois],
  )

  if (isLoading || !list) {
    return <LoadingView message="Loading board…" />
  }

  const value: BoardContextValue = {
    listId,
    list,
    members,
    pois,
    setPois,
    subgroups,
    setSubgroups,
    otherViewers,
    isLoading,
    error,
    setError,
    reload: loadBoard,
    updateMembers,
    refreshMembers,
    isListMember,
    currentUserId: user?.id,
    currentUserProfile,
    onVote,
    onUnvote,
    upsertComment,
    removeComment,
    handleUpdateGetaway,
    handleUpdatePoi,
    handleDeletePoi,
    partySize: 1,
  }

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

export function useBoardContext(): BoardContextValue {
  const ctx = useContext(BoardContext)
  if (!ctx) {
    throw new Error('useBoardContext must be used within BoardProvider')
  }
  return ctx
}

export function useBoardContextOptional(): BoardContextValue | null {
  return useContext(BoardContext)
}
