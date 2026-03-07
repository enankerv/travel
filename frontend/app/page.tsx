'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { getLists, createList } from '@/lib/api'
import ListsView from '@/components/ListsView'
import ListDetailView from '@/components/ListDetailView'

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [lists, setLists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      loadLists()
    }
  }, [user, authLoading, router])

  async function loadLists() {
    try {
      const data = await getLists()
      setLists(data || [])
    } catch (err) {
      console.error('Failed to load lists:', err)
      setError('Failed to load lists')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateList() {
    if (!newListName.trim()) return

    setCreateLoading(true)
    try {
      const list = await createList(newListName, newListDescription)
      setLists([...lists, list])
      setNewListName('')
      setNewListDescription('')
      setCreateModalOpen(false)
    } catch (err: any) {
      setError(err.message || 'Failed to create list')
    } finally {
      setCreateLoading(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="app">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const selectedList = lists.find(l => l.id === selectedListId)

  return (
    <div className="app" style={{ overflow: 'hidden', height: '100vh' }}>
      {/* Fade between views */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: selectedListId ? 0 : 1,
          pointerEvents: selectedListId ? 'none' : 'auto',
          transition: 'opacity 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Lists View */}
        <ListsView
          lists={lists}
          onSelectList={setSelectedListId}
          onCreateList={() => setCreateModalOpen(true)}
          onSignOut={signOut}
          user={user}
          error={error}
          isLoading={isLoading}
        />
      </div>

      {/* Detail View */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: selectedListId ? 1 : 0,
          pointerEvents: selectedListId ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {selectedList && (
          <ListDetailView
            list={selectedList}
            onBack={() => setSelectedListId(null)}
            onUpdate={() => loadLists()}
          />
        )}
      </div>

      {/* Create List Modal */}
      <div className={`modal-overlay ${createModalOpen ? 'open' : ''}`}>
        <div className="modal" style={{ width: '400px' }}>
          <h2>Create New List</h2>
          <p>Create a collaborative list for tracking villas</p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--light)' }}>
              List Name
            </label>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g., Italy Trip 2024"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                padding: '0.6rem',
                color: 'var(--light)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--light)' }}>
              Description (optional)
            </label>
            <textarea
              value={newListDescription}
              onChange={(e) => setNewListDescription(e.target.value)}
              placeholder="Add notes about this list..."
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                padding: '0.6rem',
                color: 'var(--light)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
          </div>

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={() => {
                setCreateModalOpen(false)
                setNewListName('')
                setNewListDescription('')
              }}
              disabled={createLoading}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleCreateList}
              disabled={createLoading || !newListName.trim()}
            >
              {createLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
