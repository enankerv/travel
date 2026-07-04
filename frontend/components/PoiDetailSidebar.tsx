'use client'

import { useEffect, useRef, useState } from 'react'
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls'
import { useListDetailContext } from '@/lib/ListDetailContext'
import { formatPerPersonLine } from '@/lib/pricePerPerson'
import type { Getaway, POIBase } from '@/lib/getaway'
import type { GetawayUpdate } from '@/lib/getaway'
import type { POIUpdate } from '@/lib/poi'
import {
  BOARD_POI_TYPE_OPTIONS,
  iconForPoiType,
  poiEditPayload,
  poiImageSources,
  poiDisplayAddress,
} from '@/lib/poi'
import { parseAmenitiesInput } from '@/components/AmenitiesCell'
import { ExternalLinkIcon, TrashIcon } from './icons'
import GetawayEditForm from './GetawayEditForm'
import PoiEditForm, { poiEditStateFromPoi } from './PoiEditForm'
import PoiVoteBar from './PoiVoteBar'
import InlineComments from './InlineComments'

function formatPrice(price: number | null | undefined, currency?: string | null) {
  if (price == null) return '—'
  const sym = currency === 'EUR' ? '€' : '$'
  return `${sym}${Number(price).toLocaleString()}`
}

function listJoin(arr: string[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return '—'
  return arr.filter(Boolean).join(', ') || '—'
}

function poiTypeLabel(poi: POIBase): string {
  if (poi.poi_type === 'getaway') return 'Getaway'
  const opt = BOARD_POI_TYPE_OPTIONS.find((o) => o.type === poi.poi_type)
  return opt?.label ?? 'Pin'
}

export default function PoiDetailSidebar({
  poi,
  onClose,
  onImageClick,
  onUpdateGetaway,
  onUpdatePoi,
  onDelete,
}: {
  poi: POIBase
  onClose: () => void
  onImageClick?: (images: string[], index: number) => void
  onUpdateGetaway?: (poiId: string, updates: GetawayUpdate) => void
  onUpdatePoi?: (poiId: string, updates: POIUpdate) => void
  onDelete?: (poiId: string) => void
}) {
  const { partySize } = useListDetailContext()
  const signedUrls = useSignedImageUrls(poiImageSources(poi))
  const thumbUrl = signedUrls[0]
  const isGetaway = poi.poi_type === 'getaway'
  const getaway = poi as Getaway
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<POIBase>(() => ({ ...poi }))
  const commentsRef = useRef<HTMLDivElement>(null)

  const pricePerPersonLine = isGetaway
    ? formatPerPersonLine(getaway.price, getaway.price_currency, partySize)
    : null

  const title =
    poi.title?.trim() ||
    (isGetaway ? 'Getaway' : poiTypeLabel(poi))

  const canEdit = isGetaway ? !!onUpdateGetaway : !!onUpdatePoi

  useEffect(() => {
    setEditData({ ...poi })
    setIsEditing(false)
  }, [poi.id])

  const handleSave = () => {
    if (isGetaway && onUpdateGetaway) {
      const toSend = { ...editData } as Getaway
      if (toSend.amenities != null && typeof toSend.amenities === 'string') {
        toSend.amenities = parseAmenitiesInput(toSend.amenities)
      }
      if (toSend.included != null && typeof toSend.included === 'string') {
        toSend.included = parseAmenitiesInput(toSend.included)
      }
      const {
        id,
        list_id,
        poi_type,
        images,
        created_at,
        updated_at,
        import_status,
        import_error,
        source_url,
        user_id,
        thumbnail_url,
        board_x,
        board_y,
        board_z,
        ...rest
      } = toSend
      onUpdateGetaway(poi.id, rest)
    } else if (onUpdatePoi) {
      onUpdatePoi(poi.id, poiEditPayload(editData))
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditData(isGetaway ? { ...poi } : poiEditStateFromPoi(poi))
    setIsEditing(false)
  }

  const handleDelete = () => {
    onDelete?.(poi.id)
    onClose()
  }

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="map-getaway-sidebar board-poi-sidebar">
      <div className="map-getaway-sidebar__header">
        <h3>{isEditing ? 'Edit item' : title}</h3>
        <div className="getaway-detail-sheet__header-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="sheet-edit-btn sheet-edit-btn-cancel"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sheet-edit-btn sheet-edit-btn-save"
                onClick={handleSave}
              >
                Save
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <button
                  type="button"
                  className="getaway-detail-sheet__action-btn"
                  onClick={() => {
                    setEditData(
                      isGetaway ? { ...poi } : poiEditStateFromPoi(poi),
                    )
                    setIsEditing(true)
                  }}
                  aria-label="Edit"
                  title="Edit"
                >
                  ✎
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="getaway-detail-sheet__action-btn getaway-detail-sheet__action-btn--delete"
                  onClick={handleDelete}
                  aria-label="Delete"
                  title="Delete"
                >
                  <TrashIcon size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="map-getaway-sidebar__close"
                aria-label="Close"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      <div className="map-getaway-sidebar__content">
        {isEditing ? (
          isGetaway ? (
            <GetawayEditForm
              editData={editData}
              setEditData={setEditData}
            />
          ) : (
            <PoiEditForm editData={editData} setEditData={setEditData} />
          )
        ) : (
          <>
            {!isEditing && thumbUrl && (
              <div
                className="map-getaway-sidebar__thumb"
                onClick={() => onImageClick?.(signedUrls, 0)}
              >
                <img src={thumbUrl} alt={title} />
              </div>
            )}

            <PoiVoteBar poiId={poi.id} onCommentClick={scrollToComments} />

            <dl className="map-getaway-sidebar__meta">
              {!isGetaway && (
                <>
                  <dt>Type</dt>
                  <dd>
                    <span className="board-poi-sidebar__type">
                      <span aria-hidden>{iconForPoiType(poi.poi_type)}</span>
                      {poiTypeLabel(poi)}
                    </span>
                  </dd>
                </>
              )}
              {(isGetaway
                ? poi.location || poi.address || getaway.region
                : poiDisplayAddress(poi)) && (
                <>
                  <dt>{isGetaway ? 'Location' : 'Address'}</dt>
                  <dd>
                    {isGetaway
                      ? [poi.location, poi.address, getaway.region]
                          .filter(Boolean)
                          .join(', ')
                      : poiDisplayAddress(poi)}
                  </dd>
                </>
              )}
              {isGetaway &&
                (getaway.bedrooms != null ||
                  getaway.bathrooms != null ||
                  getaway.max_guests != null) && (
                  <>
                    <dt>Details</dt>
                    <dd>
                      {[
                        getaway.bedrooms != null &&
                          `${getaway.bedrooms} bed${getaway.bedrooms !== 1 ? 's' : ''}`,
                        getaway.bathrooms != null &&
                          `${getaway.bathrooms} bath${getaway.bathrooms !== 1 ? 's' : ''}`,
                        getaway.max_guests != null &&
                          `${getaway.max_guests} guest${getaway.max_guests !== 1 ? 's' : ''}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </dd>
                  </>
                )}
              {isGetaway && (getaway.price != null || getaway.price_currency) && (
                <>
                  <dt>Price</dt>
                  <dd>
                    {formatPrice(getaway.price, getaway.price_currency)}
                    {getaway.price_period && ` / ${getaway.price_period}`}
                    {pricePerPersonLine && (
                      <div className="map-getaway-sidebar__price-per">
                        {pricePerPersonLine}
                      </div>
                    )}
                  </dd>
                </>
              )}
              {poi.lat != null && poi.lng != null && (
                <>
                  <dt>Coordinates</dt>
                  <dd>
                    {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
                  </dd>
                </>
              )}
            </dl>

            {isGetaway &&
              getaway.amenities &&
              Array.isArray(getaway.amenities) &&
              getaway.amenities.length > 0 && (
                <div className="map-getaway-sidebar__section">
                  <h4>Amenities</h4>
                  <p>{listJoin(getaway.amenities)}</p>
                </div>
              )}

            {poi.description && (
              <div className="map-getaway-sidebar__section">
                <h4>Description</h4>
                <p className="map-getaway-sidebar__desc">{poi.description}</p>
              </div>
            )}

            {isGetaway && getaway.caveats && (
              <div className="map-getaway-sidebar__section">
                <h4>Caveats</h4>
                <p>{getaway.caveats}</p>
              </div>
            )}

            {isGetaway &&
              getaway.included &&
              Array.isArray(getaway.included) &&
              getaway.included.length > 0 && (
                <div className="map-getaway-sidebar__section">
                  <h4>Included</h4>
                  <p>{listJoin(getaway.included)}</p>
                </div>
              )}

            {poi.source_url && (
              <div className="map-getaway-sidebar__actions">
                <a
                  href={poi.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="map-getaway-sidebar__link"
                >
                  <ExternalLinkIcon size={16} />
                  {isGetaway ? 'View listing' : 'View source'}
                </a>
              </div>
            )}

            <div ref={commentsRef} className="board-poi-sidebar__comments">
              <InlineComments getawayId={poi.id} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
