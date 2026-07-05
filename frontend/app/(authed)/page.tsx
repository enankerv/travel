'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { getLists, createList } from '@/lib/api'
import ListsView, { type ListItem } from '@/components/ListsView'
import { setLastListId } from '@/lib/lastListStorage'
import CreateListModal from '@/components/CreateListModal'
import BookmarkletPasteModal from '@/components/BookmarkletPasteModal'
import LoadingView from '@/components/LoadingView'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const listParam = searchParams.get('list')
  const viewParam = searchParams.get('view')
  const pasteParam = searchParams.get('paste')
  const [lists, setLists] = useState<ListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [showBookmarkletModal, setShowBookmarkletModal] = useState(false)

  useEffect(() => {
    if (pasteParam === '1' && searchParams.get('url')) {
      setShowBookmarkletModal(true)
    }
  }, [pasteParam, searchParams])

  const loadLists = useCallback(async () => {
    try {
      const data = await getLists()
      setLists(data || [])
    } catch (err) {
      console.error('Failed to load lists:', err)
      setError('Failed to load lists')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLists()
  }, [loadLists])

  useEffect(() => {
    if (isLoading || !listParam) return
    if (!lists.some((l) => l.id === listParam)) {
      router.replace('/')
      return
    }

    setLastListId(listParam)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('list')
    params.delete('view')
    const query = params.toString()
    const path =
      viewParam === 'map' ? `/list/${listParam}/map` : `/list/${listParam}`
    router.replace(query ? `${path}?${query}` : path)
  }, [isLoading, listParam, viewParam, lists, router, searchParams])

  function handleSelectList(id: string | null, options?: { clearPaste?: boolean }) {
    if (id) {
      setLastListId(id)
      if (options?.clearPaste) {
        router.push(`/list/${id}`)
      } else {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('list')
        params.delete('view')
        const query = params.toString()
        router.push(query ? `/list/${id}?${query}` : `/list/${id}`)
      }
    } else {
      router.push('/')
    }
  }

  async function handleCreateList(name: string, description: string) {
    const list = await createList(name, description)
    setLists((prev) => [...prev, list])
  }

  if (isLoading) {
    return <LoadingView message="Loading your lists…" />
  }

  if (listParam && lists.some((l) => l.id === listParam)) {
    return <LoadingView message="Opening list…" />
  }

  return (
    <div className="app">
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
            router.replace(q ? '/?' + q : '/')
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
