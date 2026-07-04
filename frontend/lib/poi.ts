/** POI spine types for the cork board and generic pins. */
export type { POIBase, Getaway } from './getaway'

import type { POIBase } from './getaway'

export function isLoadableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * Merge a realtime/broadcast POI row without clobbering signed image URLs.
 * Broadcast payloads include storage paths; the list API returns signed URLs.
 */
export function mergePoiFromRealtime(
  prev: POIBase,
  incoming: Partial<POIBase>,
): POIBase {
  const next = { ...prev, ...incoming } as POIBase

  if (incoming.images !== undefined) {
    const prevHasLoadable = prev.images.some(isLoadableImageUrl)
    const incomingHasLoadable = incoming.images.some(isLoadableImageUrl)
    if (prevHasLoadable && !incomingHasLoadable) {
      next.images = prev.images
    }
  }

  if (
    incoming.thumbnail_url !== undefined &&
    incoming.thumbnail_url &&
    !isLoadableImageUrl(incoming.thumbnail_url) &&
    isLoadableImageUrl(prev.thumbnail_url)
  ) {
    next.thumbnail_url = prev.thumbnail_url
  }

  return next
}

export type POICreate = {
  poi_type?: 'poi' | 'activity' | 'restaurant' | 'flight'
  title?: string | null
  description?: string | null
  location?: string | null
  board_x?: number
  board_y?: number
  board_z?: number
}

export type POIUpdate = {
  title?: string | null
  description?: string | null
  location?: string | null
  board_x?: number
  board_y?: number
  board_z?: number
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
