/** Pin label, layout, position resolution, and presence styling. */
import { presenceColorForUserId } from '@/lib/presenceColors'
import type { POIBase } from '@/lib/getaway'
import { BOARD_POI_TYPE_OPTIONS } from '@/lib/poi'
import { pinCoordsEqual, type BoardNorm } from '@/lib/boardMath'

export type PinHoldState = 'none' | 'grab' | 'local' | 'remote'

const PIN_ELEVATED_Z_BOOST = 1000

export function pinLabel(poi: POIBase): string {
  if (poi.title?.trim()) return poi.title.trim()
  const opt = BOARD_POI_TYPE_OPTIONS.find((o) => o.type === poi.poi_type)
  if (opt) return opt.label
  if (poi.poi_type === 'getaway') return 'Getaway'
  return 'Pin'
}

/** Stable slight tilt per pin — scattered polaroids on a cork board. */
export function pinTiltDeg(poiId: string): number {
  let h = 0
  for (let i = 0; i < poiId.length; i++) {
    h = (h * 31 + poiId.charCodeAt(i)) | 0
  }
  return (h % 70) / 10 - 3.5
}

export function pinAnchorNorm(poi: POIBase): BoardNorm {
  return { wx: poi.board_x ?? 0.5, wy: poi.board_y ?? 0.5 }
}

export function pinStackZIndex(
  boardZ: number,
  elevated: boolean,
): number {
  return Math.round(boardZ + (elevated ? PIN_ELEVATED_Z_BOOST : 0))
}

export function sortPinsByStackZ(pois: POIBase[]): POIBase[] {
  return [...pois].sort((a, b) => (a.board_z ?? 0) - (b.board_z ?? 0))
}

export function resolvePinPosition(
  poi: POIBase,
  opts: {
    localDragPoiId?: string | null
    localDragPos?: BoardNorm | null
    peerDrag?: { wx?: number; wy?: number } | null
    gospel?: BoardNorm | null
  },
): BoardNorm {
  if (opts.localDragPoiId === poi.id && opts.localDragPos) {
    return opts.localDragPos
  }
  if (
    opts.peerDrag &&
    opts.peerDrag.wx != null &&
    opts.peerDrag.wy != null
  ) {
    return { wx: opts.peerDrag.wx, wy: opts.peerDrag.wy }
  }
  if (opts.gospel) return opts.gospel
  return pinAnchorNorm(poi)
}

export function pinHoldState(
  poiId: string,
  opts: {
    localDragPoiId?: string | null
    pendingPoiId?: string | null
    peerDragPoiIds: ReadonlySet<string>
  },
): PinHoldState {
  if (opts.localDragPoiId === poiId) return 'local'
  if (opts.pendingPoiId === poiId) return 'grab'
  if (opts.peerDragPoiIds.has(poiId)) return 'remote'
  return 'none'
}

export function pinHighlightColor(
  hold: PinHoldState,
  opts: {
    currentUserId?: string
    peerDragUserId?: string
    peerSelectUserId?: string
    viewerColorById: ReadonlyMap<string, string>
  },
): string | undefined {
  if (hold === 'local' || hold === 'grab') {
    return opts.currentUserId
      ? presenceColorForUserId(opts.currentUserId)
      : undefined
  }
  if (opts.peerDragUserId) {
    return (
      opts.viewerColorById.get(opts.peerDragUserId) ??
      presenceColorForUserId(opts.peerDragUserId)
    )
  }
  if (opts.peerSelectUserId) {
    return (
      opts.viewerColorById.get(opts.peerSelectUserId) ??
      presenceColorForUserId(opts.peerSelectUserId)
    )
  }
  return undefined
}

/** Drop optimistic positions once the server row matches. */
export function pruneStaleGospel(
  prev: Record<string, BoardNorm>,
  pois: POIBase[],
): Record<string, BoardNorm> {
  let next: Record<string, BoardNorm> | null = null
  for (const poiId of Object.keys(prev)) {
    const poi = pois.find((p) => p.id === poiId)
    if (!poi) continue
    if (pinCoordsEqual(prev[poiId], pinAnchorNorm(poi))) {
      if (!next) next = { ...prev }
      delete next[poiId]
    }
  }
  return next ?? prev
}

export function isLockedByPeer(
  poiId: string,
  lockedPoiIds: ReadonlySet<string>,
  localDragPoiId?: string | null,
): boolean {
  return lockedPoiIds.has(poiId) && localDragPoiId !== poiId
}
