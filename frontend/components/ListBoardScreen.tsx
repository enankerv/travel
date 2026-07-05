'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BoardProvider, useBoardContext } from '@/lib/BoardContext'
import type { BoardLayoutMode } from '@/lib/boardLayout'
import type { BoardCreatablePoiType } from '@/lib/poi'
import BoardView, { type BoardViewHandle } from './BoardView'
import BoardScreenChrome from './BoardScreenChrome'
import BoardScreenToolbar from './BoardScreenToolbar'
import BoardScreenSortActions from './BoardScreenSortActions'
import PoiDetailSidebar from './PoiDetailSidebar'
import GetawayDetailSheet from './GetawayDetailSheet'
import CommentsSidebar from './CommentsSidebar'
import ImageGallery from './ImageGallery'
import BoardChatPanel from './BoardChatPanel'
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
  const [sorting, setSorting] = useState(false)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    setChatOpen(mq.matches)
  }, [])
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

  const handleFitCamera = useCallback(() => {
    revealChrome()
    boardRef.current?.fitCamera()
  }, [revealChrome])

  const handleSort = useCallback(
    async (mode: BoardLayoutMode) => {
      revealChrome()
      setSorting(true)
      try {
        await boardRef.current?.applyBoardSort(mode)
      } finally {
        setSorting(false)
      }
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
        <BoardScreenChrome
          listId={listId}
          listName={list.name}
          otherViewers={otherViewers}
          chatOpen={chatOpen}
          onChatToggle={() => setChatOpen((open) => !open)}
        />
        <BoardScreenSortActions
          creating={creating}
          sorting={sorting}
          onSort={(mode) => void handleSort(mode)}
        />
        <BoardScreenToolbar
          creating={creating}
          sorting={sorting}
          onFitCamera={handleFitCamera}
          onAddItem={handleAddItem}
        />
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

      <BoardChatPanel
        listId={listId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  )
}
