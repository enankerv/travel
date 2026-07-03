'use client'

import { useState } from 'react'
import Modal from './Modal'

export type PoiType = 'restaurant' | 'activity' | 'business' | 'place' | 'other'

export type PoiFormData = {
  name: string
  poi_type: PoiType
  description: string
  location: string
  region: string
  source_url: string
  notes: string
}

const POI_TYPE_OPTIONS: { value: PoiType; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'activity', label: 'Activity' },
  { value: 'business', label: 'Business' },
  { value: 'place', label: 'Place' },
  { value: 'other', label: 'Other' },
]

type CreatePoiModalProps = {
  open: boolean
  onClose: () => void
  onCreate: (data: PoiFormData) => Promise<void>
}

const inputStyle = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  padding: '0.6rem',
  color: 'var(--light)',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
} as const

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  color: 'var(--light)',
  fontSize: '0.9rem',
} as const

export default function CreatePoiModal({
  open,
  onClose,
  onCreate,
}: CreatePoiModalProps) {
  const [name, setName] = useState('')
  const [poiType, setPoiType] = useState<PoiType>('other')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [region, setRegion] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function resetForm() {
    setName('')
    setPoiType('other')
    setDescription('')
    setLocation('')
    setRegion('')
    setSourceUrl('')
    setNotes('')
    setError('')
  }

  async function handleSubmit() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onCreate({
        name: name.trim(),
        poi_type: poiType,
        description: description.trim(),
        location: location.trim(),
        region: region.trim(),
        source_url: sourceUrl.trim(),
        notes: notes.trim(),
      })
      resetForm()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create idea')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) {
      resetForm()
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={handleClose} width="480px">
      <h2>Add an Idea</h2>
      <p>Save a restaurant, activity, place, or anything else for your trip.</p>

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
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Trattoria da Enzo, Uffizi Gallery, Florence"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Type</label>
        <select
          value={poiType}
          onChange={(e) => setPoiType(e.target.value as PoiType)}
          style={inputStyle}
        >
          {POI_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Location (optional)</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., Trastevere, Rome"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Region / Country (optional)</label>
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="e.g., Lazio, Italy"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why you want to go, hours, tips..."
          style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Link (optional)</label>
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Private notes for your group..."
          style={{ ...inputStyle, minHeight: '56px', resize: 'vertical' }}
        />
      </div>

      <div className="modal-actions">
        <button className="btn-cancel" onClick={handleClose} disabled={loading}>
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
        >
          {loading ? 'Adding...' : 'Add Idea'}
        </button>
      </div>
    </Modal>
  )
}
