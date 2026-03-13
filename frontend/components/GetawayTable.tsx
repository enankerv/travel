'use client'

import { useState } from 'react'
import GetawayRow from './GetawayRow'

export default function GetawayTable({ getaways, isLoading, onDelete, onUpdate, onImageClick, onRetry, onPasteClick }: any) {
  const [editingId, setEditingId] = useState(null)

  const handleEditStart = (getawayId: any) => {
    setEditingId(getawayId)
  }

  const handleEditEnd = (getawayId: any, updatedData: any) => {
    if (updatedData && onUpdate) {
      onUpdate(getawayId, updatedData)
    }
    setEditingId(null)
  }

  if (isLoading) {
    return (
      <div className="sheet-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Loading getaways...</p>
      </div>
    )
  }

  if (!getaways || getaways.length === 0) {
    return (
      <div className="sheet-wrap">
        <div className="empty-state">
          <div className="icon">🏠</div>
          <p>No getaways yet. Scout some listings to get started!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="sheet-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="sheet-scroll" style={{ flex: 1 }}>
        <table className="sheet">
          <thead>
            <tr>
              <th className="col-thumb">Image</th>
              <th className="col-name">Getaway Name</th>
              <th className="col-loc">Location</th>
              <th className="col-beds">Beds</th>
              <th className="col-baths">Baths</th>
              <th className="col-guests">Guests</th>
              <th className="col-price">Price</th>
              <th className="col-amenities">Amenities</th>
              <th className="col-catch">Actions</th>
            </tr>
          </thead>
          <tbody>
            {getaways.map((getaway: any) => (
              <GetawayRow
                key={getaway.id}
                getaway={getaway}
                isEditing={editingId === getaway.id}
                onEditStart={() => handleEditStart(getaway.id)}
                onEditEnd={(updatedData: any) => handleEditEnd(getaway.id, updatedData)}
                onDelete={() => onDelete && onDelete(getaway.id)}
                onImageClick={onImageClick}
                onRetry={getaway.source_url ? () => onRetry && onRetry(getaway) : undefined}
                onPasteClick={onPasteClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
