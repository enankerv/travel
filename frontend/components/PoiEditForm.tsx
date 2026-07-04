'use client'

import type { POIBase } from '@/lib/getaway'

export default function PoiEditForm({
  editData,
  setEditData,
}: {
  editData: POIBase
  setEditData: (data: POIBase) => void
}) {
  return (
    <div className="getaway-detail-sheet__edit-form">
      <div className="getaway-detail-sheet__edit-field">
        <label>Title</label>
        <input
          type="text"
          className="sheet-edit-input"
          value={editData.title ?? ''}
          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Location</label>
        <input
          type="text"
          className="sheet-edit-input"
          value={editData.location ?? ''}
          onChange={(e) => setEditData({ ...editData, location: e.target.value })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Description</label>
        <textarea
          className="sheet-edit-input getaway-detail-sheet__edit-textarea"
          rows={4}
          value={editData.description ?? ''}
          onChange={(e) =>
            setEditData({ ...editData, description: e.target.value })
          }
        />
      </div>
    </div>
  )
}
