'use client'

import { useState } from 'react'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'

function formatAmenities(arr: string[] | null | undefined): string {
  if (!arr?.length) return '—'
  const max = 4
  const shown = arr.slice(0, max).join(', ')
  return arr.length > max ? `${shown} +${arr.length - max}` : shown
}

export default function VillaRow({
  villa,
  isEditing,
  onEditStart,
  onEditEnd,
  onDelete,
  onImageClick,
  onRetry,
  onPasteClick,
}: any) {
  const [editData, setEditData] = useState(villa)
  const signedUrls = useSignedImageUrls(villa.images || [])
  const thumbUrl = signedUrls[0]

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

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (villa.images && villa.images.length > 0) {
      if (onImageClick) {
        onImageClick(villa.images, 0)
      } else if (villa.original_url) {
        window.open(villa.original_url, '_blank')
      }
    }
  }

  const handleRowClick = () => {
    if (!isEditing && villa.original_url) {
      window.open(villa.original_url, '_blank')
    }
  }

  if (villa.scrap_status === 'loading') {
    return (
      <tr
        style={{ opacity: 0.6, cursor: villa.original_url ? 'pointer' : undefined }}
        onClick={() => villa.original_url && window.open(villa.original_url, '_blank')}
        title={villa.original_url ? 'Open listing' : undefined}
      >
        <td className="col-thumb">
          <div className="spinner" style={{ width: '2rem', height: '2rem' }}></div>
        </td>
        <td className="col-name" colSpan={7} style={{ color: 'var(--muted)' }}>
          Processing {villa.original_url ? new URL(villa.original_url).hostname : 'listing'}...
        </td>
        <td className="col-catch"></td>
      </tr>
    )
  }

  if (villa.scrap_status === 'thin') {
    return (
      <tr
        style={{ opacity: 0.7, backgroundColor: 'var(--orange-soft)', cursor: onPasteClick ? 'pointer' : undefined }}
        onClick={(e) => {
          if (onPasteClick && !(e.target as HTMLElement).closest('button')) {
            onPasteClick(villa)
          }
        }}
        title={onPasteClick ? 'Click to paste listing details' : undefined}
      >
        <td className="col-thumb">
          <div className="thumb-placeholder">⚠️</div>
        </td>
        <td className="col-name" colSpan={7} style={{ color: 'var(--orange)' }}>
          <span style={{ cursor: 'pointer' }}>
            Unable to extract full data. Click here to paste listing details manually.
          </span>
        </td>
        <td className="col-catch" onClick={(e) => e.stopPropagation()}>
          <button
            className="row-action-btn trash"
            onClick={() => onDelete && onDelete()}
            title="Delete"
          >
            🗑
          </button>
        </td>
      </tr>
    )
  }

  if (villa.scrap_status === 'error') {
    return (
      <tr
        style={{ opacity: 0.7, backgroundColor: 'var(--red-soft)', cursor: onPasteClick ? 'pointer' : undefined }}
        onClick={(e) => {
          if (onPasteClick && !(e.target as HTMLElement).closest('button')) {
            onPasteClick(villa)
          }
        }}
        title={onPasteClick ? 'Click to paste listing details' : undefined}
      >
        <td className="col-thumb">
          <div className="thumb-placeholder">❌</div>
        </td>
        <td className="col-name" colSpan={7} style={{ color: 'var(--red)' }}>
          {villa.scrap_error || 'Error while processing listing'}
        </td>
        <td className="col-catch" onClick={(e) => e.stopPropagation()}>
          <div className="row-actions">
            {villa.original_url && onRetry && (
              <button
                className="row-action-btn"
                onClick={() => onRetry()}
                title="Retry"
              >
                ↻
              </button>
            )}
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

  if (isEditing) {
    return (
      <tr>
        <td className="col-thumb">
          {villa.images && villa.images.length > 0 && thumbUrl ? (
            <img src={thumbUrl} alt={villa.villa_name} className="thumb" />
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
        <td className="col-amenities" title={editData.amenities?.join(', ')}>
          {formatAmenities(editData.amenities)}
        </td>
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
    <tr
      onClick={handleRowClick}
      style={villa.original_url ? { cursor: 'pointer' } : undefined}
      title={villa.original_url ? 'Open listing' : undefined}
    >
      <td className="col-thumb">
        {villa.images && villa.images.length > 0 && thumbUrl ? (
          <div className="thumb-link" onClick={handleImageClick} title="Click to view images">
            <img src={thumbUrl} alt={villa.villa_name} className="thumb" />
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
      <td className="col-amenities" title={villa.amenities?.join(', ')}>
        {formatAmenities(villa.amenities)}
      </td>
      <td className="col-catch" onClick={(e) => e.stopPropagation()}>
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
