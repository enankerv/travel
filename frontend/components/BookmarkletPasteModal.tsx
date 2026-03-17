'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'
import PasteFormContent from './PasteFormContent'
import { getLists, scoutPaste } from '@/lib/api'
import { dispatchScoutComplete } from '@/components/ScoutCredits'
import { getLastListId, setLastListId } from '@/lib/lastListStorage'

interface BookmarkletPasteModalProps {
  isOpen: boolean
  onClose: () => void
  listingUrl: string | null
  onSuccess: (listId: string) => void
}

export default function BookmarkletPasteModal({
  isOpen,
  onClose,
  listingUrl,
  onSuccess,
}: BookmarkletPasteModalProps) {
  const [lists, setLists] = useState<{ id: string; name?: string }[]>([])
  const [listsLoading, setListsLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [error, setError] = useState('')
  const [truncatedMessage, setTruncatedMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setListsLoading(true)
    setError('')
    setTruncatedMessage('')
    getLists()
      .then((data) => {
        const arr = data || []
        setLists(arr)
        const lastId = getLastListId()
        if (lastId && arr.some((l: { id: string }) => l.id === lastId)) {
          setSelectedListId(lastId)
        } else if (arr.length > 0) {
          setSelectedListId(arr[0].id)
        } else {
          setSelectedListId('')
        }
      })
      .catch(() => {
        setError('Failed to load lists')
        setLists([])
      })
      .finally(() => setListsLoading(false))
  }, [isOpen])

  async function handleSubmit(text: string) {
    if (!selectedListId) {
      setError('Please select a list')
      return
    }
    setError('')
    setSubmitLoading(true)
    try {
      const result = await scoutPaste(text, selectedListId, listingUrl ?? undefined, undefined)
      if (result.ok) {
        dispatchScoutComplete()
        setLastListId(selectedListId)
        if (result.truncated) {
          setTruncatedMessage('Text was truncated for length limits. Processing...')
          setTimeout(() => {
            setTruncatedMessage('')
            onClose()
            onSuccess(selectedListId)
          }, 2000)
        } else {
          onClose()
          onSuccess(selectedListId)
        }
      } else {
        setError(result.error || 'Failed to process paste')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process paste')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal open={isOpen} onClose={onClose}>
      <h2 style={{ color: 'var(--light)' }}>Paste Listing Details</h2>

      {listsLoading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2rem',
            color: 'var(--muted)',
            fontSize: '0.95rem',
          }}
        >
          <span
            className="dropzone__spinner"
            style={{ width: 20, height: 20, borderWidth: 2 }}
            aria-hidden
          />
          Loading your lists…
        </div>
      ) : lists.length === 0 ? (
        <div style={{ padding: '1rem 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Create a list first, then paste.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="bookmarklet-paste-list-select"
              style={{ fontSize: '0.85rem', color: 'var(--muted)', marginRight: '0.5rem' }}
            >
              Add to:
            </label>
            <select
              id="bookmarklet-paste-list-select"
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: '6px',
                color: 'var(--light)',
                padding: '0.4rem 0.6rem',
                fontSize: '0.9rem',
              }}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name ?? 'Untitled'}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'var(--red-soft)',
                border: '1px solid var(--red)',
                borderRadius: '8px',
                color: 'var(--red)',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
          )}
          {truncatedMessage && (
            <div
              role="status"
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
                borderRadius: '8px',
                color: 'var(--light)',
                fontSize: '0.9rem',
              }}
            >
              {truncatedMessage}
            </div>
          )}

          <PasteFormContent
            onSubmit={handleSubmit}
            onClose={onClose}
            isLoading={submitLoading}
            initialText=""
            listingUrl={listingUrl}
            fromBookmarklet
          />
        </>
      )}
    </Modal>
  )
}
