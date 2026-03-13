'use client'

import { useState } from 'react'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'
import { parseAmenitiesInput } from '@/components/AmenitiesCell'
import TrashIcon from '@/components/TrashIcon'
import {
  getVisibleColumnKeys,
  renderColumnCell,
  type CellRenderContextInput,
} from '@/components/getawayColumns'

export default function GetawayRow({
  getaway,
  isEditing,
  visibleColumns,
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
  const visibleKeys = getVisibleColumnKeys(visibleColumns)
  const colspanLoading = Math.max(1, visibleKeys.length - (visibleKeys.includes('image') ? 1 : 0))
  const colspanMessage = Math.max(
    1,
    visibleKeys.length - (visibleKeys.includes('image') ? 1 : 0) - (visibleKeys.includes('actions') ? 1 : 0)
  )

  const handleSave = () => {
    const toSend = { ...editData }
    if (toSend.amenities != null && typeof toSend.amenities === 'string') {
      toSend.amenities = parseAmenitiesInput(toSend.amenities)
    }
    if (toSend.amenities != null && !Array.isArray(toSend.amenities)) {
      toSend.amenities = [String(toSend.amenities)]
    }
    if (toSend.included != null && typeof toSend.included === 'string') {
      toSend.included = parseAmenitiesInput(toSend.included)
    }
    if (toSend.included != null && !Array.isArray(toSend.included)) {
      toSend.included = [String(toSend.included)]
    }
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

  const cellCtx: CellRenderContextInput = {
    getaway,
    editData,
    setEditData,
    isEditing,
    thumbUrl,
    onEditStart,
    onDelete,
    onImageClick: handleImageClick,
    handleSave,
    handleCancel,
  }

  if (getaway.import_status === 'loading') {
    return (
      <tr
        style={{ opacity: 0.6, cursor: getaway.source_url ? 'pointer' : undefined }}
        onClick={() => getaway.source_url && window.open(getaway.source_url, '_blank')}
        title={getaway.source_url ? 'Open listing' : undefined}
      >
        {visibleKeys.includes('image') && (
          <td className="col-thumb">
            <div className="spinner" style={{ width: '2rem', height: '2rem' }}></div>
          </td>
        )}
        <td className="col-name" colSpan={colspanLoading} style={{ color: 'var(--muted)' }}>
          Processing {getaway.source_url ? new URL(getaway.source_url).hostname : 'listing'}...
        </td>
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
        {visibleKeys.includes('image') && (
          <td className="col-thumb">
            <div className="thumb-placeholder">⚠️</div>
          </td>
        )}
        <td className="col-name" colSpan={colspanMessage} style={{ color: 'var(--orange)' }}>
          <span style={{ cursor: 'pointer' }}>
            Unable to extract full data. Click here to paste listing details manually.
          </span>
        </td>
        {visibleKeys.includes('actions') && (
          <td className="col-catch" onClick={(e) => e.stopPropagation()}>
            <button className="row-action-btn trash" onClick={() => onDelete && onDelete()} title="Delete">
              <TrashIcon />
            </button>
          </td>
        )}
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
        {visibleKeys.includes('image') && (
          <td className="col-thumb">
            <div className="thumb-placeholder">❌</div>
          </td>
        )}
        <td className="col-name" colSpan={colspanMessage} style={{ color: 'var(--red)' }}>
          {getaway.import_error || 'Error while processing listing'}
        </td>
        {visibleKeys.includes('actions') && (
          <td className="col-catch" onClick={(e) => e.stopPropagation()}>
            <div className="row-actions">
              {getaway.source_url && onRetry && (
                <button className="row-action-btn" onClick={() => onRetry()} title="Retry">
                  ↻
                </button>
              )}
              <button className="row-action-btn trash" onClick={() => onDelete && onDelete()} title="Delete">
                <TrashIcon />
              </button>
            </div>
          </td>
        )}
      </tr>
    )
  }

  if (isEditing) {
    return <tr>{visibleKeys.map((key) => renderColumnCell(key, cellCtx))}</tr>
  }

  return (
    <tr
      onClick={handleRowClick}
      style={getaway.source_url ? { cursor: 'pointer' } : undefined}
      title={getaway.source_url ? 'Open listing' : undefined}
    >
      {visibleKeys.map((key) => renderColumnCell(key, cellCtx))}
    </tr>
  )
}
