'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { getLists, createList } from '@/lib/api'
import ListsView, { type ListItem } from '@/components/ListsView'
import ListDetailView from '@/components/ListDetailView'
import { setLastListId } from '@/lib/lastListStorage'
import CreateListModal from '@/components/CreateListModal'
import BookmarkletPasteModal from '@/components/BookmarkletPasteModal'
import LoadingView from '@/components/LoadingView'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const listParam = searchParams.get('list')
  const pasteParam = searchParams.get('paste')
  const [lists, setLists] = useState<ListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [showBookmarkletModal, setShowBookmarkletModal] = useState(false)

  useEffect(() => {
    if (pasteParam === '1' && searchParams.get('url')) {
      setShowBookmarkletModal(true)
    }
  }, [pasteParam, searchParams])

  const loadLists = useCallback(
    async (applyListFromUrl = true) => {
      try {
        const data = await getLists()
        setLists(data || [])
        if (applyListFromUrl && data?.length) {
          if (listParam && data.some((l: ListItem) => l.id === listParam)) {
            setSelectedListId(listParam)
          } else if (listParam) {
            router.replace('/', { scroll: false })
          }
          /* When paste=1: stay on home, BookmarkletPasteModal handles the flow */
        }
      } catch (err) {
        console.error('Failed to load lists:', err)
        setError('Failed to load lists')
      } finally {
        setIsLoading(false)
      }
    },
    [listParam, router]
  )

  useEffect(() => {
    void loadLists()
  }, [loadLists])

  useEffect(() => {
    if (listParam && lists.some((l) => l.id === listParam)) {
      setSelectedListId(listParam)
    }
  }, [listParam, lists])

  function handleSelectList(id: string | null, options?: { clearPaste?: boolean }) {
    setSelectedListId(id)
    if (id) {
      setLastListId(id)
      const params = new URLSearchParams(searchParams.toString())
      params.set('list', id)
      if (options?.clearPaste) {
        params.delete('paste')
        params.delete('url')
      }
      router.replace('/?' + params.toString(), { scroll: false })
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('list')
      params.delete('paste')
      params.delete('url')
      const q = params.toString()
      router.replace(q ? '/?' + q : '/', { scroll: false })
    }
  }

  async function handleCreateList(name: string, description: string) {
    const list = await createList(name, description)
    setLists((prev) => [...prev, list])
  }

  if (isLoading) {
    return <LoadingView message="Loading your lists…" />
  }

  const selectedList = lists.find((l) => l.id === selectedListId)

  return (
    <div className="app">
      {selectedListId && selectedList ? (
        <div className="app-detail-view">
          <ListDetailView
            list={selectedList}
            searchParams={Object.fromEntries(searchParams.entries())}
            onBack={() => {
              handleSelectList(null)
              loadLists(false)
            }}
            onUpdate={() => loadLists()}
          />
        </div>
      ) : (
        <ListsView
          lists={lists}
          onSelectList={handleSelectList}
          onCreateList={() => setCreateModalOpen(true)}
          onSignOut={signOut}
          user={user}
          error={error}
          onDismissError={() => setError('')}
          isLoading={isLoading}
          pasteMode={pasteParam === '1' && !!searchParams.get('url')}
        />
      )}

      <CreateListModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateList}
      />

      {showBookmarkletModal && (
        <BookmarkletPasteModal
          isOpen
          onClose={() => {
            setShowBookmarkletModal(false)
            const params = new URLSearchParams(searchParams.toString())
            params.delete('paste')
            params.delete('url')
            const q = params.toString()
            router.replace(q ? '/?' + q : '/', { scroll: false })
          }}
          listingUrl={searchParams.get('url')}
          onSuccess={(listId) => {
            setShowBookmarkletModal(false)
            handleSelectList(listId, { clearPaste: true })
          }}
        />
      )}
    </div>
  )
}
