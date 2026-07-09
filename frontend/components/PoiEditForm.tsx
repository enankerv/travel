'use client'

import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'
import type { POIBase } from '@/lib/getaway'
import { isLoadableImageUrl, poiDisplayAddress } from '@/lib/poi'

function ThumbnailPreview({ url }: { url: string }) {
  const signed = useSignedImageUrls([url])
  const src = isLoadableImageUrl(url) ? url : signed[0]
  if (!src) return null
  return (
    <div className="poi-edit-form__thumb-preview">
      <img src={src} alt="" />
    </div>
  )
}

export function poiEditStateFromPoi(poi: POIBase): POIBase {
  return {
    ...poi,
    address: poiDisplayAddress(poi) ?? '',
    location: null,
  }
}

export default function PoiEditForm({
  editData,
  setEditData,
}: {
  editData: POIBase
  setEditData: (data: POIBase) => void
}) {
  const thumb = editData.thumbnail_url?.trim() ?? ''

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
        <label>Address</label>
        <input
          type="text"
          className="sheet-edit-input"
          placeholder="Street address, venue, neighborhood…"
          value={editData.address ?? ''}
          onChange={(e) => setEditData({ ...editData, address: e.target.value })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-row">
        <div className="getaway-detail-sheet__edit-field">
          <label>Latitude</label>
          <input
            type="text"
            inputMode="decimal"
            className="sheet-edit-input"
            placeholder="e.g. 48.8566"
            value={editData.lat != null ? String(editData.lat) : ''}
            onChange={(e) => {
              const v = e.target.value.trim()
              const n = parseFloat(v)
              setEditData({
                ...editData,
                lat: v === '' ? null : Number.isNaN(n) ? editData.lat ?? null : n,
              })
            }}
          />
        </div>
        <div className="getaway-detail-sheet__edit-field">
          <label>Longitude</label>
          <input
            type="text"
            inputMode="decimal"
            className="sheet-edit-input"
            placeholder="e.g. 2.3522"
            value={editData.lng != null ? String(editData.lng) : ''}
            onChange={(e) => {
              const v = e.target.value.trim()
              const n = parseFloat(v)
              setEditData({
                ...editData,
                lng: v === '' ? null : Number.isNaN(n) ? editData.lng ?? null : n,
              })
            }}
          />
        </div>
      </div>
      <p
        style={{ margin: '0 0 1rem', fontSize: '0.85em', color: 'var(--muted)' }}
      >
        Map pin position. Leave blank to geocode from the address on save.
      </p>
      <div className="getaway-detail-sheet__edit-field">
        <label>Link</label>
        <input
          type="url"
          className="sheet-edit-input"
          placeholder="https://…"
          value={editData.source_url ?? ''}
          onChange={(e) => setEditData({ ...editData, source_url: e.target.value })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Thumbnail</label>
        <input
          type="url"
          className="sheet-edit-input"
          placeholder="Image URL (https://…)"
          value={editData.thumbnail_url ?? ''}
          onChange={(e) =>
            setEditData({ ...editData, thumbnail_url: e.target.value })
          }
        />
        {thumb ? <ThumbnailPreview url={thumb} /> : null}
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
