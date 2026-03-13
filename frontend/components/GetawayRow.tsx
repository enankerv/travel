'use client'

import { useState } from 'react'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'
import AmenitiesCell from '@/components/AmenitiesCell'
import { parseAmenitiesInput } from '@/components/AmenitiesCell'
import EditableCell from '@/components/EditableCell'
import TrashIcon from '@/components/TrashIcon'

function formatPrice(price: number | null | undefined, currency?: string | null) {
  if (price == null) return '—'
  const sym = currency === 'EUR' ? '€' : '$'
  return `${sym}${Number(price).toLocaleString()}`
}

export default function GetawayRow({
  getaway,
  isEditing,
  onEditStart,
  onEditEnd,
  onDelete,
  onImageClick,
  onRetry,
  onPasteClick,
}: any) {
  const [editData, setEditData] = useState(getaway)
  const signedUrls = useSignedImageUrls(getaway.images || [])
  const thumbUrl = signedUrls[0]

  const handleSave = () => {
    const toSend = { ...editData }
    if (toSend.amenities != null && typeof toSend.amenities === 'string') {
      toSend.amenities = parseAmenitiesInput(toSend.amenities)
    }
    if (toSend.amenities != null && !Array.isArray(toSend.amenities)) {
      toSend.amenities = [String(toSend.amenities)]
    }
    // Only send editable getaway fields (backend getaways table has no images column)
    const { id, list_id, slug, images, created_at, updated_at, import_status, import_error, source_url, ...rest } = toSend
    if (onEditEnd) onEditEnd(rest)
  }

  const handleCancel = () => {
    setEditData(getaway)
    if (onEditEnd) onEditEnd(null)
  }

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (getaway.images && getaway.images.length > 0) {
      if (onImageClick) {
        onImageClick(getaway.images, 0)
      } else if (getaway.source_url) {
        window.open(getaway.source_url, '_blank')
      }
    }
  }

  const handleRowClick = () => {
    if (!isEditing && getaway.source_url) {
      window.open(getaway.source_url, '_blank')
    }
  }

  if (getaway.import_status === 'loading') {
    return (
      <tr
        style={{ opacity: 0.6, cursor: getaway.source_url ? 'pointer' : undefined }}
        onClick={() => getaway.source_url && window.open(getaway.source_url, '_blank')}
        title={getaway.source_url ? 'Open listing' : undefined}
      >
        <td className="col-thumb">
          <div className="spinner" style={{ width: '2rem', height: '2rem' }}></div>
        </td>
        <td className="col-name" colSpan={7} style={{ color: 'var(--muted)' }}>
          Processing {getaway.source_url ? new URL(getaway.source_url).hostname : 'listing'}...
        </td>
        <td className="col-catch"></td>
      </tr>
    )
  }

  if (getaway.import_status === 'thin') {
    return (
      <tr
        style={{ opacity: 0.7, backgroundColor: 'var(--orange-soft)', cursor: onPasteClick ? 'pointer' : undefined }}
        onClick={(e) => {
          if (onPasteClick && !(e.target as HTMLElement).closest('button')) {
            onPasteClick(getaway)
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
            <TrashIcon />
          </button>
        </td>
      </tr>
    )
  }

  if (getaway.import_status === 'error') {
    return (
      <tr
        style={{ opacity: 0.7, backgroundColor: 'var(--red-soft)', cursor: onPasteClick ? 'pointer' : undefined }}
        onClick={(e) => {
          if (onPasteClick && !(e.target as HTMLElement).closest('button')) {
            onPasteClick(getaway)
          }
        }}
        title={onPasteClick ? 'Click to paste listing details' : undefined}
      >
        <td className="col-thumb">
          <div className="thumb-placeholder">❌</div>
        </td>
        <td className="col-name" colSpan={7} style={{ color: 'var(--red)' }}>
          {getaway.import_error || 'Error while processing listing'}
        </td>
        <td className="col-catch" onClick={(e) => e.stopPropagation()}>
          <div className="row-actions">
            {getaway.source_url && onRetry && (
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
              <TrashIcon />
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
          {getaway.images && getaway.images.length > 0 && thumbUrl ? (
            <img src={thumbUrl} alt={getaway.name} className="thumb" />
          ) : (
            <div className="thumb-placeholder">—</div>
          )}
        </td>
        <EditableCell
          type="text"
          cellClassName="col-name"
          value={editData.name}
          onChange={(v) => setEditData({ ...editData, name: v as string })}
        />
        <EditableCell
          type="text"
          cellClassName="col-loc"
          value={editData.location}
          onChange={(v) => setEditData({ ...editData, location: v as string })}
        />
        <EditableCell
          type="number"
          cellClassName="col-beds"
          value={editData.bedrooms}
          onChange={(v) => setEditData({ ...editData, bedrooms: v })}
        />
        <EditableCell
          type="number"
          cellClassName="col-baths"
          value={editData.bathrooms}
          onChange={(v) => setEditData({ ...editData, bathrooms: v })}
        />
        <EditableCell
          type="number"
          cellClassName="col-guests"
          value={editData.max_guests}
          onChange={(v) => setEditData({ ...editData, max_guests: v })}
        />
        <EditableCell
          type="price"
          cellClassName="col-price"
          value={editData.price}
          onChange={(v) => setEditData({ ...editData, price: v })}
        />
        <EditableCell
          type="amenities"
          cellClassName="col-amenities"
          value={editData.amenities}
          onChange={(v) => setEditData({ ...editData, amenities: v as string[] })}
        />
        <td className="col-catch">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="sheet-edit-btn sheet-edit-btn-save" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="sheet-edit-btn sheet-edit-btn-cancel" onClick={handleCancel}>
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
      style={getaway.source_url ? { cursor: 'pointer' } : undefined}
      title={getaway.source_url ? 'Open listing' : undefined}
    >
      <td className="col-thumb">
        {getaway.images && getaway.images.length > 0 && thumbUrl ? (
          <div className="thumb-link" onClick={handleImageClick} title="Click to view images">
            <img src={thumbUrl} alt={getaway.name} className="thumb" />
          </div>
        ) : (
          <div className="thumb-placeholder">—</div>
        )}
      </td>
      <td className="col-name">{getaway.name || '—'}</td>
      <td className="col-loc">{getaway.location || '—'}</td>
      <td className="col-beds">{getaway.bedrooms ?? '—'}</td>
      <td className="col-baths">{getaway.bathrooms ?? '—'}</td>
      <td className="col-guests">{getaway.max_guests ?? '—'}</td>
      <td className="col-price">{formatPrice(getaway.price, getaway.price_currency)}</td>
      <AmenitiesCell amenities={getaway.amenities} />
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
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  )
}
