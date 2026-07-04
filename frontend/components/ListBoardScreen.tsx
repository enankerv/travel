'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getList, listPois } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useListRealtime, useListPresence, type PresenceUser } from '@/lib/realtime'
import { presenceColorForUserId } from '@/lib/presenceColors'
import { ListDetailProvider } from '@/lib/ListDetailContext'
import type { POIBase } from '@/lib/getaway'
import { mergePoiFromRealtime } from '@/lib/poi'
import BoardView, { type BoardViewHandle } from './BoardView'
import BoardAddItemButton from './BoardAddItemButton'
import type { BoardCreatablePoiType } from '@/lib/poi'
import ScoutCredits from './ScoutCredits'
import LoadingView from './LoadingView'
import { useIsMobile } from '@/hooks/useIsMobile'

const IDLE_MS = 1000

export default function ListBoardScreen({ listId }: { listId: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const boardRef = useRef<BoardViewHandle>(null)
  const idleTimerRef = useRef<number>()
  const [list, setList] = useState<{ id: string; name: string } | null>(null)
  const [pois, setPois] = useState<POIBase[]>([])
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [chromeVisible, setChromeVisible] = useState(true)
  const [creating, setCreating] = useState(false)

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
      const [listData, poisData] = await Promise.all([
        getList(listId),
        listPois(listId),
      ])
      setList(listData)
      setPois(poisData || [])
      setError('')
    } catch {
      setError('Failed to load board')
    } finally {
      setIsLoading(false)
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
    onDelete: (id) => setPois((prev) => prev.filter((p) => p.id !== id)),
    onVoteInsert: () => {},
    onVoteDelete: () => {},
  })

  useListPresence({
    listId,
    enabled: !isLoading && !!user,
    user,
    onUsersChange: setViewingUsers,
  })

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
    members: [],
    getaways: [],
    setGetaways: () => {},
    pois,
    setPois,
    votesByGetaway: {},
    onVote: async () => {},
    onUnvote: async () => {},
    isListMember: true,
    currentUserId: user?.id,
    currentUserProfile: undefined,
    commentsByGetaway: {},
    setCommentsByGetaway: () => {},
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
        />
      </div>
    </ListDetailProvider>
  )
}
