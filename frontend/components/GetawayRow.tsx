'use client'

import { useState } from 'react'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'
import { parseAmenitiesInput } from '@/components/AmenitiesCell'
import { TrashIcon } from '@/components/icons'
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
  onCommentClick,
  votesByGetaway,
  commentsByGetaway,
  currentUserId,
  canVote,
  onVote,
  onUnvote,
}: any) {
  const [editData, setEditData] = useState(getaway)
  const signedUrls = useSignedImageUrls(getaway.images || [])
  const thumbUrl = signedUrls[0]
  const visibleKeys = getVisibleColumnKeys(visibleColumns)
  const contentKeys = visibleKeys.filter(
    (k) => k !== 'votes' && k !== 'image' && k !== 'actions'
  )
  const colspanMessage = Math.max(1, contentKeys.length)

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
    votesByGetaway,
    commentsByGetaway,
    onCommentClick,
    currentUserId,
    canVote,
    onVote,
    onUnvote,
  }

  function renderSpecialRow(
    message: React.ReactNode,
    rowStyle: React.CSSProperties,
    actionsContent: React.ReactNode,
    rowProps?: { onClick?: (e: React.MouseEvent) => void; title?: string }
  ) {
    let contentRendered = false
    return (
      <tr style={rowStyle} onClick={rowProps?.onClick} title={rowProps?.title}>
        {visibleKeys.map((key) => {
          if (key === 'votes') {
            return <td key={key} className="col-votes" />
          }
          if (key === 'image') {
            return (
              <td key={key} className="col-thumb">
                {getaway.import_status === 'loading' ? (
                  <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
                ) : (
                  <div className="thumb-placeholder">
                    {getaway.import_status === 'thin' ? '⚠️' : '❌'}
                  </div>
                )}
              </td>
            )
          }
          if (key === 'actions') {
            return (
              <td
                key={key}
                className="col-catch"
                onClick={(e) => e.stopPropagation()}
              >
                {actionsContent}
              </td>
            )
          }
          if (!contentRendered) {
            contentRendered = true
            return (
              <td key={key} className="col-name" colSpan={colspanMessage}>
                {message}
              </td>
            )
          }
          return null
        })}
      </tr>
    )
  }

  if (getaway.import_status === 'loading') {
    return renderSpecialRow(
      <span style={{ color: 'var(--muted)' }}>
        Processing {(() => {
          const u = getaway.source_url
          if (!u || !u.startsWith('http')) return 'listing'
          try { return new URL(u).hostname } catch { return 'listing' }
        })()}...
      </span>,
      { opacity: 0.6 },
      null
    )
  }

  const pasteRowProps =
    onPasteClick
      ? {
          onClick: (e: React.MouseEvent) => {
            if (!(e.target as HTMLElement).closest('button')) onPasteClick(getaway)
          },
          title: 'Click to paste listing details',
        }
      : undefined

  if (getaway.import_status === 'thin') {
    return renderSpecialRow(
      <span style={{ color: 'var(--orange)' }}>
        Unable to extract full data. Click here to paste listing details manually.
      </span>,
      {
        opacity: 0.7,
        backgroundColor: 'var(--orange-soft)',
        cursor: onPasteClick ? 'pointer' : undefined,
      },
      <div className="row-actions">
        <button className="row-action-btn trash" onClick={() => onDelete?.()} title="Delete">
          <TrashIcon />
        </button>
      </div>,
      pasteRowProps
    )
  }

  if (getaway.import_status === 'error') {
    return renderSpecialRow(
      <span style={{ color: 'var(--red)' }}>
        {getaway.import_error || 'Error while processing listing'}
      </span>,
      {
        opacity: 0.7,
        backgroundColor: 'var(--red-soft)',
        cursor: onPasteClick ? 'pointer' : undefined,
      },
      <div className="row-actions">
        {getaway.source_url && onRetry && (
          <button className="row-action-btn" onClick={() => onRetry()} title="Retry">
            ↻
          </button>
        )}
        <button className="row-action-btn trash" onClick={() => onDelete?.()} title="Delete">
          <TrashIcon />
        </button>
      </div>,
      pasteRowProps
    )
  }

  if (isEditing) {
    return <tr>{visibleKeys.map((key) => renderColumnCell(key, cellCtx))}</tr>
  }

  return (
    <tr>
      {visibleKeys.map((key) => renderColumnCell(key, cellCtx))}
    </tr>
  )
}
