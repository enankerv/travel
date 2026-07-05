/** POI spine types for the cork board and generic pins. */
export type { POIBase, Getaway } from './getaway'

import type { POIBase } from './getaway'

export function isLoadableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith('http://') || url.startsWith('https://')
}

/** Normalize a signed URL or storage path to the storage object path. */
export function storagePathFromImageRef(ref: string): string {
  if (!ref) return ''
  if (!ref.startsWith('http')) return ref
  const match = ref.match(/getaway-images\/([^?]+)/)
  return match ? decodeURIComponent(match[1]) : ref
}

function imageRefsMatch(prev: string[], incoming: string[]): boolean {
  if (prev.length !== incoming.length) return false
  const prevPaths = prev.map(storagePathFromImageRef)
  const incomingPaths = incoming.map(storagePathFromImageRef)
  return prevPaths.every((p, i) => p === incomingPaths[i])
}

/**
 * Merge a realtime/broadcast POI row without clobbering signed image URLs when
 * the underlying storage paths are unchanged. Always applies thumbnail_url and
 * image list changes when paths differ (storage paths are signed client-side).
 */
export function mergePoiFromRealtime(
  prev: POIBase,
  incoming: Partial<POIBase>,
): POIBase {
  const next = { ...prev, ...incoming } as POIBase

  if (incoming.images !== undefined) {
    const incomingImages = incoming.images ?? []
    const prevHasLoadable = (prev.images ?? []).some(isLoadableImageUrl)
    const incomingHasLoadable = incomingImages.some(isLoadableImageUrl)

    if (
      prevHasLoadable &&
      !incomingHasLoadable &&
      incomingImages.length > 0 &&
      imageRefsMatch(prev.images ?? [], incomingImages)
    ) {
      next.images = prev.images
    } else {
      next.images = incomingImages
    }
  }

  if (incoming.thumbnail_url !== undefined) {
    next.thumbnail_url = incoming.thumbnail_url
  }

  return next
}

export type POICreate = {
  poi_type?: 'poi' | 'activity' | 'restaurant' | 'flight' | 'note'
  title?: string | null
  description?: string | null
  location?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  source_url?: string | null
  thumbnail_url?: string | null
  board_x?: number
  board_y?: number
  board_z?: number
}

export type POIUpdate = {
  title?: string | null
  description?: string | null
  location?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  source_url?: string | null
  thumbnail_url?: string | null
  board_x?: number
  board_y?: number
  board_z?: number
}

/** Image sources for a POI: explicit thumbnail first, then gallery images. */
export function poiImageSources(
  poi: Pick<POIBase, 'thumbnail_url' | 'images'>,
): string[] {
  const imgs = poi.images ?? []
  if (!poi.thumbnail_url) return imgs
  if (imgs.includes(poi.thumbnail_url)) return imgs
  return [poi.thumbnail_url, ...imgs]
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

/** Spine fields editable in PoiEditForm → POIUpdate payload. */
export function poiEditPayload(data: POIBase): POIUpdate {
  return {
    title: emptyToNull(data.title),
    description: emptyToNull(data.description),
    address: emptyToNull(data.address),
    location: null,
    source_url: emptyToNull(data.source_url),
    thumbnail_url: emptyToNull(data.thumbnail_url),
  }
}

/** Board POI address for display (prefers address; falls back to legacy location). */
export function poiDisplayAddress(poi: Pick<POIBase, 'address' | 'location'>): string | null {
  return emptyToNull(poi.address) ?? emptyToNull(poi.location)
}

export const BOARD_POI_TYPE_OPTIONS = [
  { type: 'activity', label: 'Activity', icon: '🎯', defaultTitle: 'New activity' },
  { type: 'restaurant', label: 'Restaurant', icon: '🍽', defaultTitle: 'New restaurant' },
  { type: 'flight', label: 'Flight', icon: '✈️', defaultTitle: 'New flight' },
  { type: 'poi', label: 'Pin', icon: '📍', defaultTitle: 'New pin' },
] as const

export type BoardCreatablePoiType = (typeof BOARD_POI_TYPE_OPTIONS)[number]['type']

export function defaultTitleForPoiType(poiType: BoardCreatablePoiType): string {
  return BOARD_POI_TYPE_OPTIONS.find((o) => o.type === poiType)?.defaultTitle ?? 'New pin'
}

export function iconForPoiType(poiType: string): string {
  return BOARD_POI_TYPE_OPTIONS.find((o) => o.type === poiType)?.icon ?? '📍'
}
