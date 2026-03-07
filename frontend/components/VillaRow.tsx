'use client'

import { useState } from 'react'

export default function VillaRow({
  villa,
  isEditing,
  onEditStart,
  onEditEnd,
  onDelete,
  onImageClick,
}) {
  const [editData, setEditData] = useState(villa)

  const handleSave = () => {
    if (onEditEnd) {
      onEditEnd(editData)
    }
  }

  const handleCancel = () => {
    setEditData(villa)
    if (onEditEnd) {
      onEditEnd(null)
    }
  }

  const handleImageClick = () => {
    if (villa.images && villa.images.length > 0) {
      if (onImageClick) {
        onImageClick(villa.images, 0)
      } else if (villa.original_url) {
        window.open(villa.original_url, '_blank')
      }
    }
  }

  if (isEditing) {
    return (
      <tr>
        <td className="col-thumb">
          {villa.images && villa.images.length > 0 ? (
            <img src={villa.images[0]} alt={villa.villa_name} className="thumb" />
          ) : (
            <div className="thumb-placeholder">—</div>
          )}
        </td>
        <td className="col-name">
          <input
            type="text"
            value={editData.villa_name || ''}
            onChange={(e) => setEditData({ ...editData, villa_name: e.target.value })}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: '4px',
              padding: '0.3rem',
              color: 'var(--light)',
            }}
          />
        </td>
        <td className="col-loc">
          <input
            type="text"
            value={editData.location || ''}
            onChange={(e) => setEditData({ ...editData, location: e.target.value })}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: '4px',
              padding: '0.3rem',
              color: 'var(--light)',
            }}
          />
        </td>
        <td className="col-beds">{editData.bedrooms || '—'}</td>
        <td className="col-baths">{editData.bathrooms || '—'}</td>
        <td className="col-guests">{editData.max_guests || '—'}</td>
        <td className="col-price">
          <input
            type="text"
            value={editData.price_weekly_usd || ''}
            onChange={(e) => setEditData({ ...editData, price_weekly_usd: parseFloat(e.target.value) || null })}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: '4px',
              padding: '0.3rem',
              color: 'var(--light)',
            }}
          />
        </td>
        <td className="col-pool">{editData.pool_features?.[0] || '—'}</td>
        <td className="col-catch">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--green)',
                color: '#fff',
                border: 'none',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              style={{
                background: 'var(--muted)',
                color: '#fff',
                border: 'none',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="col-thumb">
        {villa.images && villa.images.length > 0 ? (
          <div className="thumb-link" onClick={handleImageClick} title="Click to view images">
            <img src={villa.images[0]} alt={villa.villa_name} className="thumb" />
          </div>
        ) : (
          <div className="thumb-placeholder">—</div>
        )}
      </td>
      <td className="col-name">{villa.villa_name || '—'}</td>
      <td className="col-loc">{villa.location || '—'}</td>
      <td className="col-beds">{villa.bedrooms || '—'}</td>
      <td className="col-baths">{villa.bathrooms || '—'}</td>
      <td className="col-guests">{villa.max_guests || '—'}</td>
      <td className="col-price">${villa.price_weekly_usd || '—'}</td>
      <td className="col-pool">{villa.pool_features?.[0] || '—'}</td>
      <td className="col-catch">
        <div className="row-actions">
          <button
            className="row-action-btn"
            onClick={() => onEditStart && onEditStart()}
            title="Edit"
          >
            ✎
          </button>
          <button
            className="row-action-btn trash"
            onClick={() => onDelete && onDelete()}
            title="Delete"
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  )
}
