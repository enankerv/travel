'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BoardProvider, useBoardContext } from '@/lib/BoardContext'
import type { BoardLayoutMode } from '@/lib/boardLayout'
import type { BoardCreatablePoiType } from '@/lib/poi'
import BoardView, { type BoardViewHandle } from './BoardView'
import { ListScreenChatButton } from './ListScreenChrome'
import { useListScreenShell } from '@/lib/ListScreenShellContext'
import BoardScreenToolbar from './BoardScreenToolbar'
import BoardScreenSortActions from './BoardScreenSortActions'
import PoiDetailSidebar from './PoiDetailSidebar'
import GetawayDetailSheet from './GetawayDetailSheet'
import CommentsSidebar from './CommentsSidebar'
import ImageGallery from './ImageGallery'
import BoardChat from './BoardChat'
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
  const { setChromeBoardRow, setChromeOverlayHidden, updateMemberCount } =
    useListScreenShell()
  const boardRef = useRef<BoardViewHandle>(null)
  const idleTimerRef = useRef<number>()
  const sidePanelOpenRef = useRef(false)
  const {
    pois,
    members,
    isLoading: boardLoading,
    error,
    setError,
    handleUpdateGetaway,
    handleUpdatePoi,
    handleDeletePoi,
    handleDeleteSubgroup,
    handleUpdateSubgroup,
    subgroups,
  } = useBoardContext()

  const [chromeVisible, setChromeVisible] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [selectedSubgroupId, setSelectedSubgroupId] = useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [focusedGetawayId, setFocusedGetawayId] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const selectedPoi = useMemo(
    () => (selectedPoiId ? pois.find((p) => p.id === selectedPoiId) : undefined),
    [selectedPoiId, pois],
  )

  const sidePanelOpen =
    chatOpen ||
    chatSending ||
    commentsOpen ||
    selectedPoiId != null ||
    galleryImages != null

  sidePanelOpenRef.current = sidePanelOpen

  const scheduleChromeReveal = useCallback(() => {
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      if (!sidePanelOpenRef.current) setChromeVisible(true)
    }, IDLE_MS)
  }, [])

  const hideChromeOnActivity = useCallback(() => {
    setChromeVisible(false)
    scheduleChromeReveal()
  }, [scheduleChromeReveal])

  const revealChrome = useCallback(() => {
    setChromeVisible(true)
    window.clearTimeout(idleTimerRef.current)
  }, [])

  useEffect(() => {
    if (boardLoading) return
    updateMemberCount(members)
  }, [members, boardLoading, updateMemberCount])

  useEffect(() => {
    setChromeBoardRow(
      <ListScreenChatButton
        chatOpen={chatOpen}
        onToggle={() => setChatOpen((open) => !open)}
      />,
    )
    return () => setChromeBoardRow(null)
  }, [chatOpen, setChromeBoardRow])

  useEffect(() => {
    if (sidePanelOpen) {
      setChromeVisible(false)
      window.clearTimeout(idleTimerRef.current)
      return
    }
    setChromeVisible(true)
  }, [sidePanelOpen])

  useEffect(() => {
    setChromeOverlayHidden(!chromeVisible || sidePanelOpen)
  }, [chromeVisible, sidePanelOpen, setChromeOverlayHidden])

  useEffect(() => {
    return () => {
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

  const selectedSubgroup = useMemo(
    () =>
      selectedSubgroupId
        ? subgroups.find((s) => s.id === selectedSubgroupId)
        : undefined,
    [selectedSubgroupId, subgroups],
  )

  const handleAddGroup = useCallback(() => {
    revealChrome()
    void boardRef.current?.addGroup(selectedSubgroupId)
  }, [revealChrome, selectedSubgroupId])

  const handleDeleteGroup = useCallback(async () => {
    if (!selectedSubgroupId) return
    revealChrome()
    const deleted = await handleDeleteSubgroup(selectedSubgroupId)
    if (deleted) setSelectedSubgroupId(null)
  }, [revealChrome, selectedSubgroupId, handleDeleteSubgroup])

  const handleRenameGroup = useCallback(() => {
    if (!selectedSubgroup) return
    revealChrome()
    const name = window.prompt('Rename group', selectedSubgroup.name)?.trim()
    if (!name || name === selectedSubgroup.name) return
    void handleUpdateSubgroup(selectedSubgroup.id, { name })
  }, [revealChrome, selectedSubgroup, handleUpdateSubgroup])

  const onDeletePoi = useCallback(
    async (poiId: string) => {
      const deleted = await handleDeletePoi(poiId)
      if (deleted) setSelectedPoiId((prev) => (prev === poiId ? null : prev))
    },
    [handleDeletePoi],
  )

  return (
    <div className={`board-screen${sidePanelOpen ? ' board-screen--side-panel-open' : ''}`}>
      <div
        className={`board-screen__overlay${chromeVisible ? '' : ' board-screen__overlay--hidden'}`}
      >
        <BoardScreenSortActions
          creating={creating}
          sorting={sorting}
          onSort={(mode) => void handleSort(mode)}
        />
        <BoardScreenToolbar
          creating={creating}
          sorting={sorting}
          hasSelectedGroup={!!selectedSubgroupId}
          onFitCamera={handleFitCamera}
          onAddItem={handleAddItem}
          onAddGroup={handleAddGroup}
          onDeleteGroup={() => void handleDeleteGroup()}
          onRenameGroup={handleRenameGroup}
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
        onSelectPoi={(id: string | null) => {
          setSelectedPoiId(id)
          if (id) setSelectedSubgroupId(null)
        }}
        selectedSubgroupId={selectedSubgroupId}
        onSelectSubgroup={setSelectedSubgroupId}
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

      <BoardChat
        listId={listId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onSendingChange={setChatSending}
      />
    </div>
  )
}
