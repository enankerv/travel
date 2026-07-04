'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteGetaway,
  deletePoi,
  getList,
  getListComments,
  getListMembers,
  getListVotes,
  listPois,
  updateGetaway,
  updatePoi,
} from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useListVotes } from '@/hooks/useListVotes'
import { useListRealtime, useListPresence, type PresenceUser } from '@/lib/realtime'
import { presenceColorForUserId } from '@/lib/presenceColors'
import { ListDetailProvider } from '@/lib/ListDetailContext'
import type { Getaway, GetawayUpdate, POIBase } from '@/lib/getaway'
import { mergePoiFromRealtime, type POIUpdate } from '@/lib/poi'
import BoardView, { type BoardViewHandle } from './BoardView'
import BoardAddItemButton from './BoardAddItemButton'
import PoiDetailSidebar from './PoiDetailSidebar'
import GetawayDetailSheet from './GetawayDetailSheet'
import CommentsSidebar from './CommentsSidebar'
import ImageGallery from './ImageGallery'
import type { BoardCreatablePoiType } from '@/lib/poi'
import ScoutCredits from './ScoutCredits'
import LoadingView from './LoadingView'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { CommentsByGetaway } from '@/lib/ListDetailContext'

const IDLE_MS = 1000

export default function ListBoardScreen({ listId }: { listId: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const boardRef = useRef<BoardViewHandle>(null)
  const idleTimerRef = useRef<number>()
  const [list, setList] = useState<{ id: string; name: string } | null>(null)
  const [pois, setPois] = useState<POIBase[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [chromeVisible, setChromeVisible] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [commentsByGetaway, setCommentsByGetaway] = useState<CommentsByGetaway>({})
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [focusedGetawayId, setFocusedGetawayId] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const votes = useListVotes({
    listId,
    user,
    members,
    setError,
  })

  const selectedPoi = useMemo(
    () => (selectedPoiId ? pois.find((p) => p.id === selectedPoiId) : undefined),
    [selectedPoiId, pois],
  )

  const otherViewers = viewingUsers.filter((u) => u.user_id !== user?.id)

  const hideChromeOnActivity = useCallback(() => {
    setChromeVisible(false)
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => setChromeVisible(true), IDLE_MS)
  }, [])

  const revealChrome = useCallback(() => {
    setChromeVisible(true)
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => setChromeVisible(true), IDLE_MS)
  }, [])

  useEffect(() => {
    document.body.classList.add('board-screen-active')
    return () => {
      document.body.classList.remove('board-screen-active')
      window.clearTimeout(idleTimerRef.current)
    }
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [listData, poisData, commentsData, membersData, votesData] =
        await Promise.all([
          getList(listId),
          listPois(listId),
          getListComments(listId),
          getListMembers(listId),
          getListVotes(listId),
        ])
      setList(listData)
      setPois(poisData || [])
      setMembers(membersData?.members || [])
      const commentsList = commentsData?.comments || []
      const commentsByGid: CommentsByGetaway = {}
      for (const c of commentsList) {
        const gid = c.poi_id
        if (!commentsByGid[gid]) commentsByGid[gid] = []
        commentsByGid[gid].push(c)
      }
      setCommentsByGetaway(commentsByGid)
      const votesList = votesData?.votes || []
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
      setError('')
    } catch {
      setError('Failed to load board')
    } finally {
      setIsLoading(false)
    }
  }, [listId, votes.setVotesByGetaway])

  const refreshPois = useCallback(async () => {
    try {
      const poisData = await listPois(listId)
      setPois(poisData || [])
    } catch {
      /* merge handles most updates; refetch covers image signing edge cases */
    }
  }, [listId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useListRealtime({
    listId,
    enabled: !isLoading && !!user,
    onInsert: (row) => {
      setPois((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev
        return [row as POIBase, ...prev]
      })
    },
    onUpdate: (row) => {
      setPois((prev) =>
        prev.map((p) =>
          p.id === row.id ? mergePoiFromRealtime(p, row as POIBase) : p,
        ),
      )
    },
    onDelete: (id) => {
      setPois((prev) => prev.filter((p) => p.id !== id))
      setSelectedPoiId((prev) => (prev === id ? null : prev))
    },
    onImagesChange: () => {
      void refreshPois()
    },
    onCommentInsert: (c) =>
      setCommentsByGetaway((prev) => {
        const existing = prev[c.poi_id] || []
        if (existing.some((x) => x.id === c.id)) return prev
        return { ...prev, [c.poi_id]: [...existing, c] }
      }),
    onCommentUpdate: (c) =>
      setCommentsByGetaway((prev) => {
        const next = { ...prev }
        for (const gid of Object.keys(next)) {
          next[gid] = next[gid].map((x) => (x.id === c.id ? { ...x, ...c } : x))
        }
        return next
      }),
    onCommentDelete: (id, poiId) =>
      setCommentsByGetaway((prev) => ({
        ...prev,
        [poiId]: (prev[poiId] || []).filter((x) => x.id !== id),
      })),
    onVoteInsert: votes.onVoteInsert,
    onVoteDelete: votes.onVoteDelete,
  })

  useListPresence({
    listId,
    enabled: !isLoading && !!user,
    user,
    onUsersChange: setViewingUsers,
  })

  const handleUpdateGetaway = useCallback(
    async (poiId: string, updates: GetawayUpdate) => {
      try {
        await updateGetaway(listId, poiId, updates)
        setPois((prev) =>
          prev.map((p) => (p.id === poiId ? { ...p, ...updates } : p)),
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update getaway'
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
          prev.map((p) => (p.id === poiId ? { ...p, ...updated } : p)),
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
      if (!poi || !confirm('Delete this item?')) return
      try {
        if (poi.poi_type === 'getaway') {
          await deleteGetaway(listId, poiId)
        } else {
          await deletePoi(listId, poiId)
        }
        setPois((prev) => prev.filter((p) => p.id !== poiId))
        setSelectedPoiId((prev) => (prev === poiId ? null : prev))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete item'
        setError(message)
      }
    },
    [listId, pois],
  )

  const handleAddItem = useCallback(
    (poiType: BoardCreatablePoiType) => {
      revealChrome()
      setCreating(true)
      boardRef.current?.addPoiAtCenter(poiType)
      window.setTimeout(() => setCreating(false), 400)
    },
    [revealChrome],
  )

  if (isLoading || !list) {
    return <LoadingView message="Loading board…" />
  }

  const contextValue = {
    list,
    members,
    getaways: pois as Getaway[],
    setGetaways: () => {},
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
    error,
    setError,
    onRefresh: loadData,
    partySize: 1,
    setPartySize: () => {},
    otherViewers,
  }

  return (
    <ListDetailProvider value={contextValue}>
      <div className="board-screen">
        <div
          className={`board-screen__overlay${chromeVisible ? '' : ' board-screen__overlay--hidden'}`}
        >
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
              <h1 className="board-screen__title">{list.name}</h1>
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

          <div className="board-screen__tools">
            <button
              type="button"
              className="board-screen__tool-btn"
              onClick={() => {
                revealChrome()
                boardRef.current?.fitCamera()
              }}
            >
              Fit
            </button>
            <BoardAddItemButton creating={creating} onAdd={handleAddItem} />
          </div>
        </div>

        {error && (
          <div className="board-screen__error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <BoardView
          ref={boardRef}
          listId={listId}
          enabled={!isMobile}
          fullscreen
          onActivity={hideChromeOnActivity}
          selectedPoiId={selectedPoiId}
          onSelectPoi={setSelectedPoiId}
        />

        {selectedPoi && !isMobile && (
          <PoiDetailSidebar
            poi={selectedPoi}
            onClose={() => setSelectedPoiId(null)}
            onImageClick={(images, index) => {
              setGalleryImages(images)
              setGalleryIndex(index)
            }}
            onUpdateGetaway={handleUpdateGetaway}
            onUpdatePoi={handleUpdatePoi}
            onDelete={handleDeletePoi}
          />
        )}

        {selectedPoi && isMobile && (
          <GetawayDetailSheet
            getaway={selectedPoi}
            onClose={() => setSelectedPoiId(null)}
            onUpdate={
              selectedPoi.poi_type === 'getaway'
                ? (id, updates) => void handleUpdateGetaway(id, updates)
                : (id, updates) => void handleUpdatePoi(id, updates)
            }
            onDelete={(id) => void handleDeletePoi(id)}
          />
        )}

        <CommentsSidebar
          isOpen={commentsOpen}
          onClose={() => {
            setCommentsOpen(false)
            setFocusedGetawayId(null)
          }}
          focusedGetawayId={focusedGetawayId}
          onGetawayClick={(id) => {
            setFocusedGetawayId(id)
            setSelectedPoiId(id)
          }}
        />

        {galleryImages && (
          <ImageGallery
            images={galleryImages}
            initialIndex={galleryIndex}
            onClose={() => setGalleryImages(null)}
          />
        )}
      </div>
    </ListDetailProvider>
  )
}
