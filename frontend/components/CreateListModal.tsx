'use client'

import { useState } from 'react'
import Modal from './Modal'

type CreateListModalProps = {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description: string) => Promise<void>
}

export default function CreateListModal({
  open,
  onClose,
  onCreate,
}: CreateListModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onCreate(name.trim(), description.trim())
      setName('')
      setDescription('')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create list')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) {
      setName('')
      setDescription('')
      setError('')
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={handleClose} width="400px">
      <h2>Create New List</h2>
      <p>Create a collaborative list for tracking getaways</p>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'var(--red-soft)',
            borderRadius: '8px',
            color: 'var(--red)',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: 'var(--light)',
            fontSize: '0.9rem',
          }}
        >
          List Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: 'var(--light)',
            fontSize: '0.9rem',
          }}
        >
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          onClick={handleClose}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
        >
          {loading ? 'Creating...' : 'Create'}
        </button>
      </div>
    </Modal>
  )
}
