'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BoardProvider, useBoardContext } from '@/lib/BoardContext'
import { presenceColorForUserId } from '@/lib/presenceColors'
import type { BoardCreatablePoiType } from '@/lib/poi'
import BoardView, { type BoardViewHandle } from './BoardView'
import BoardAddItemButton from './BoardAddItemButton'
import PoiDetailSidebar from './PoiDetailSidebar'
import GetawayDetailSheet from './GetawayDetailSheet'
import CommentsSidebar from './CommentsSidebar'
import ImageGallery from './ImageGallery'
import ScoutCredits from './ScoutCredits'
import { useIsMobile } from '@/hooks/useIsMobile'

const IDLE_MS = 1000

export default function ListBoardScreen({ listId }: { listId: string }) {
  return (
    <BoardProvider listId={listId}>
      <ListBoardScreenInner listId={listId} />
    </BoardProvider>
  )
}

function ListBoardScreenInner({ listId }: { listId: string }) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const boardRef = useRef<BoardViewHandle>(null)
  const idleTimerRef = useRef<number>()
  const {
    list,
    pois,
    error,
    setError,
    otherViewers,
    handleUpdateGetaway,
    handleUpdatePoi,
    handleDeletePoi,
  } = useBoardContext()

  const [chromeVisible, setChromeVisible] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [focusedGetawayId, setFocusedGetawayId] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const selectedPoi = useMemo(
    () => (selectedPoiId ? pois.find((p) => p.id === selectedPoiId) : undefined),
    [selectedPoiId, pois],
  )

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

  const handleAddItem = useCallback(
    (poiType: BoardCreatablePoiType) => {
      revealChrome()
      setCreating(true)
      boardRef.current?.addPoiAtCenter(poiType)
      window.setTimeout(() => setCreating(false), 400)
    },
    [revealChrome],
  )

  const onDeletePoi = useCallback(
    async (poiId: string) => {
      const deleted = await handleDeletePoi(poiId)
      if (deleted) setSelectedPoiId((prev) => (prev === poiId ? null : prev))
    },
    [handleDeletePoi],
  )

  if (!list) {
    return null
  }

  return (
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
          onDelete={(id) => void onDeletePoi(id)}
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
          onDelete={(id) => void onDeletePoi(id)}
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
  )
}
