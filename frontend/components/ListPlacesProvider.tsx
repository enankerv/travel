'use client'

import { useState, useEffect, type ReactNode } from 'react'
import {
  getGetaways,
  getListMembers,
  getListVotes,
  getListComments,
  listPois,
} from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useListRealtime } from '@/lib/realtime'
import { useListVotes } from '@/hooks/useListVotes'
import { ListDetailProvider } from '@/lib/ListDetailContext'
import { useListScreenShell } from '@/lib/ListScreenShellContext'
import type { Getaway, POIBase } from '@/lib/getaway'
import { mergePoiFromRealtime } from '@/lib/poi'

export default function ListPlacesProvider({
  listId,
  listName,
  children,
}: {
  listId: string
  listName: string
  children: ReactNode
}) {
  const { user } = useAuth()
  const { otherViewers, updateMemberCount } = useListScreenShell()
  const [getaways, setGetaways] = useState<Getaway[]>([])
  const [pois, setPois] = useState<POIBase[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [commentsByGetaway, setCommentsByGetaway] = useState<
    Record<string, any[]>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [partySize, setPartySizeInternal] = useState(1)

  const list = { id: listId, name: listName }

  const votes = useListVotes({
    listId,
    user,
    members,
    setError,
  })

  useEffect(() => {
    if (!dataLoaded) void loadData()
  }, [])

  useEffect(() => {
    if (!dataLoaded) return
    updateMemberCount(members)
  }, [members, dataLoaded, updateMemberCount])

  useListRealtime({
    listId,
    enabled: dataLoaded && !!user,
    onInsert: (row) => {
      setPois((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev
        return [row as POIBase, ...prev]
      })
      if (row.poi_type && row.poi_type !== 'getaway') return
      setGetaways((prev) => {
        if (prev.some((g) => g.id === row.id)) return prev
        return [row as Getaway, ...prev]
      })
    },
    onUpdate: (row) => {
      setPois((prev) =>
        prev.map((p) =>
          p.id === row.id ? mergePoiFromRealtime(p, row as POIBase) : p,
        ),
      )
      if (row.poi_type && row.poi_type !== 'getaway') return
      setGetaways((prev) => {
        const index = prev.findIndex((g) => g.id === row.id)
        if (index < 0) return prev
        const next = [...prev]
        next[index] = mergePoiFromRealtime(
          prev[index],
          row as POIBase,
        ) as Getaway
        return next
      })
    },
    onDelete: (id) => {
      setPois((prev) => prev.filter((p) => p.id !== id))
      setGetaways((prev) => prev.filter((g) => g.id !== id))
    },
    onImagesChange: () => void loadData(true),
    onVoteInsert: votes.onVoteInsert,
    onVoteDelete: votes.onVoteDelete,
    onCommentInsert: (c) =>
      setCommentsByGetaway((prev) => {
        const existing = prev[c.poi_id] || []
        if (existing.some((x) => x.id === c.id)) return prev
        const next = { ...prev }
        next[c.poi_id] = [...existing, c]
        return next
      }),
    onCommentUpdate: (c) =>
      setCommentsByGetaway((prev) => {
        const next = { ...prev }
        for (const gid of Object.keys(next)) {
          next[gid] = next[gid].map((x) =>
            x.id === c.id ? { ...x, ...c } : x,
          )
        }
        return next
      }),
    onCommentDelete: (id, getawayId) =>
      setCommentsByGetaway((prev) => {
        const next = { ...prev }
        next[getawayId] = (next[getawayId] || []).filter((x) => x.id !== id)
        return next
      }),
  })

  async function loadData(silent = false) {
    if (!silent) setIsLoading(true)
    try {
      const [getawaysData, poisData, membersData, votesData, commentsData] =
        await Promise.all([
          getGetaways(listId),
          listPois(listId),
          getListMembers(listId),
          getListVotes(listId),
          getListComments(listId),
        ])
      setGetaways((getawaysData || []) as Getaway[])
      setPois((poisData || []) as POIBase[])
      const memberRows = membersData?.members || []
      setMembers(memberRows)
      if (!dataLoaded) {
        setPartySizeInternal(Math.max(1, memberRows.length))
      }
      const votesList = votesData?.votes || []
      const commentsList = commentsData?.comments || []
      const commentsByGid: Record<string, any[]> = {}
      for (const c of commentsList) {
        const gid = c.poi_id
        if (!commentsByGid[gid]) commentsByGid[gid] = []
        commentsByGid[gid].push(c)
      }
      setCommentsByGetaway(commentsByGid)
      const votesByGid: Record<
        string,
        { user_id: string; first_name?: string; avatar_url?: string }[]
      > = {}
      for (const v of votesList) {
        const gid = v.poi_id
        if (!votesByGid[gid]) votesByGid[gid] = []
        votesByGid[gid].push({
          user_id: v.user_id,
          first_name: v.first_name,
          avatar_url: v.avatar_url,
        })
      }
      votes.setVotesByGetaway(votesByGid)
      setDataLoaded(true)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load data')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  const contextValue = {
    list,
    members,
    getaways,
    setGetaways,
    pois,
    setPois,
    votesByGetaway: votes.votesByGetaway,
    onVote: votes.onVote,
    onUnvote: votes.onUnvote,
    isListMember: votes.isListMember,
    currentUserId: votes.currentUserId,
    currentUserProfile: votes.currentUserProfile,
    commentsByGetaway,
    setCommentsByGetaway,
    isLoading,
    dataLoaded,
    error,
    setError,
    onRefresh: () => loadData(true),
    partySize,
    setPartySize: (n: number) => {
      const v = Math.floor(Number(n))
      if (!Number.isFinite(v) || v < 1) setPartySizeInternal(1)
      else if (v > 999) setPartySizeInternal(999)
      else setPartySizeInternal(v)
    },
    otherViewers,
  }

  return (
    <ListDetailProvider value={contextValue}>{children}</ListDetailProvider>
  )
}
