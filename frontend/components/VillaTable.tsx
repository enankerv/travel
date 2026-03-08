'use client'

import { useState } from 'react'
import VillaRow from './VillaRow'

export default function VillaTable({ villas, isLoading, onDelete, onUpdate, onImageClick, onRetry }: any) {
  const [editingId, setEditingId] = useState(null)

  const handleEditStart = (villaId: any) => {
    setEditingId(villaId)
  }

  const handleEditEnd = (villaId: any, updatedData: any) => {
    if (updatedData && onUpdate) {
      onUpdate(villaId, updatedData)
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

  if (!villas || villas.length === 0) {
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
              <th className="col-price">Price/Week</th>
              <th className="col-pool">Pool</th>
              <th className="col-catch">Actions</th>
            </tr>
          </thead>
          <tbody>
            {villas.map((villa: any) => (
              <VillaRow
                key={villa.id}
                villa={villa}
                isEditing={editingId === villa.id}
                onEditStart={() => handleEditStart(villa.id)}
                onEditEnd={(updatedData: any) => handleEditEnd(villa.id, updatedData)}
                onDelete={() => onDelete && onDelete(villa.id)}
                onImageClick={onImageClick}
                onRetry={villa.original_url ? () => onRetry && onRetry(villa) : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
