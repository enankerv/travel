/** Compute target board positions for sort / cluster layouts. */
import { BOARD_WORLD_H, BOARD_WORLD_W } from '@/lib/boardCoords'
import {
  BOARD_PIN_PAD_BOTTOM,
  BOARD_PIN_PAD_TOP,
  type BoardNorm,
} from '@/lib/boardMath'
import type { POIBase } from '@/lib/getaway'

export type BoardLayoutMode = 'poi_type' | 'proximity'

export type BoardLayoutResult = Map<string, BoardNorm>

const TYPE_ORDER = [
  'getaway',
  'activity',
  'restaurant',
  'flight',
  'note',
  'poi',
] as const

/** Polaroid footprint in world pixels (anchor = bottom-center of pin). */
const PIN_W_PX = 104
const PIN_H_PX = BOARD_PIN_PAD_TOP + BOARD_PIN_PAD_BOTTOM

/** Tight spacing within a group (~10px between cards). */
const INTRA_GROUP_GAP_PX = 10
/** Even gap between distinct group boxes — close but not overlapping. */
const INTER_GROUP_GAP_PX = 112

const BOARD_MARGIN_PX = 0.06 * BOARD_WORLD_W
const USABLE_W_PX = BOARD_WORLD_W - BOARD_MARGIN_PX * 2
const USABLE_H_PX = BOARD_WORLD_H - BOARD_MARGIN_PX * 2

const STEP_X_PX = PIN_W_PX + INTRA_GROUP_GAP_PX
const STEP_Y_PX = PIN_H_PX + INTRA_GROUP_GAP_PX

type GroupBox = {
  items: POIBase[]
  cols: number
  rows: number
  widthPx: number
  heightPx: number
}

function typeRank(poiType: string): number {
  const idx = TYPE_ORDER.indexOf(poiType as (typeof TYPE_ORDER)[number])
  return idx >= 0 ? idx : TYPE_ORDER.length
}

/** Nearly-square grid: 4 items → 2×2, 5 → 3×2, etc. */
function gridShape(count: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / cols))
  return { cols, rows }
}

function computeGroupBox(items: POIBase[]): GroupBox {
  const { cols, rows } = gridShape(items.length)
  const widthPx = cols * PIN_W_PX + Math.max(0, cols - 1) * INTRA_GROUP_GAP_PX
  const heightPx = rows * PIN_H_PX + Math.max(0, rows - 1) * INTRA_GROUP_GAP_PX
  return { items, cols, rows, widthPx, heightPx }
}

/** Place one group's pins in a tight grid; origin is top-left of the group box (px). */
function layoutGroupAt(
  group: GroupBox,
  originPxX: number,
  originPxY: number,
  out: BoardLayoutResult,
) {
  group.items.forEach((poi, i) => {
    const col = i % group.cols
    const row = Math.floor(i / group.cols)
    const anchorPxX = originPxX + col * STEP_X_PX + PIN_W_PX / 2
    const anchorPxY = originPxY + row * STEP_Y_PX + PIN_H_PX
    out.set(poi.id, {
      wx: anchorPxX / BOARD_WORLD_W,
      wy: anchorPxY / BOARD_WORLD_H,
    })
  })
}

/**
 * Pack group boxes in a local grid (origin top-left), then center the whole
 * layout on the board midpoint — never anchor sorts to the top/bottom edge.
 */
function layoutGroupBoxes(groups: GroupBox[]): BoardLayoutResult {
  const out: BoardLayoutResult = new Map()
  if (groups.length === 0) return out

  if (groups.length === 1) {
    layoutGroupAt(groups[0], 0, 0, out)
    return centerLayoutOnBoard(out)
  }

  const groupCols = Math.ceil(Math.sqrt(groups.length))
  const rows: GroupBox[][] = []
  for (let i = 0; i < groups.length; i += groupCols) {
    rows.push(groups.slice(i, i + groupCols))
  }

  const rowMetrics = rows.map((rowGroups) => {
    const rowWidth =
      rowGroups.reduce((sum, g) => sum + g.widthPx, 0) +
      Math.max(0, rowGroups.length - 1) * INTER_GROUP_GAP_PX
    const rowHeight = Math.max(...rowGroups.map((g) => g.heightPx))
    return { rowGroups, rowWidth, rowHeight }
  })
  const maxRowWidth = Math.max(...rowMetrics.map((r) => r.rowWidth))

  let yPx = 0
  for (const { rowGroups, rowWidth, rowHeight } of rowMetrics) {
    let xPx = (maxRowWidth - rowWidth) / 2
    for (const group of rowGroups) {
      layoutGroupAt(group, xPx, yPx, out)
      xPx += group.widthPx + INTER_GROUP_GAP_PX
    }
    yPx += rowHeight + INTER_GROUP_GAP_PX
  }

  return centerLayoutOnBoard(out)
}

/** Scale (if needed) and translate so the layout centroid sits on the board center. */
function centerLayoutOnBoard(layout: BoardLayoutResult): BoardLayoutResult {
  if (layout.size === 0) return layout

  let minPxX = Infinity
  let minPxY = Infinity
  let maxPxX = -Infinity
  let maxPxY = -Infinity

  for (const pos of layout.values()) {
    const pxX = pos.wx * BOARD_WORLD_W
    const pxY = pos.wy * BOARD_WORLD_H
    minPxX = Math.min(minPxX, pxX - PIN_W_PX / 2)
    minPxY = Math.min(minPxY, pxY - PIN_H_PX)
    maxPxX = Math.max(maxPxX, pxX + PIN_W_PX / 2)
    maxPxY = Math.max(maxPxY, pxY)
  }

  const layoutCx = (minPxX + maxPxX) / 2
  const layoutCy = (minPxY + maxPxY) / 2
  const layoutW = maxPxX - minPxX
  const layoutH = maxPxY - minPxY

  let scale = 1
  if (layoutW > USABLE_W_PX) scale = Math.min(scale, USABLE_W_PX / layoutW)
  if (layoutH > USABLE_H_PX) scale = Math.min(scale, USABLE_H_PX / layoutH)

  const boardCx = BOARD_WORLD_W / 2
  const boardCy = BOARD_WORLD_H / 2

  const centered = new Map<string, BoardNorm>()
  for (const [id, pos] of layout) {
    const pxX = pos.wx * BOARD_WORLD_W
    const pxY = pos.wy * BOARD_WORLD_H
    centered.set(id, {
      wx: (boardCx + (pxX - layoutCx) * scale) / BOARD_WORLD_W,
      wy: (boardCy + (pxY - layoutCy) * scale) / BOARD_WORLD_H,
    })
  }
  return centered
}

/** One tight box per poi_type. */
export function layoutByPoiType(pois: POIBase[]): BoardLayoutResult {
  if (pois.length === 0) return new Map()

  const byType = new Map<string, POIBase[]>()
  for (const poi of pois) {
    const list = byType.get(poi.poi_type) ?? []
    list.push(poi)
    byType.set(poi.poi_type, list)
  }

  const types = [...byType.keys()].sort(
    (a, b) => typeRank(a) - typeRank(b) || a.localeCompare(b),
  )

  const groups = types.map((type) => {
    const items = [...(byType.get(type) ?? [])].sort((a, b) =>
      (a.title ?? a.id).localeCompare(b.title ?? b.id),
    )
    return computeGroupBox(items)
  })

  return layoutGroupBoxes(groups)
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function hasGeo(poi: POIBase): poi is POIBase & { lat: number; lng: number } {
  return poi.lat != null && poi.lng != null
}

/** Disjoint-set with path compression and union by size (negative roots). */
class UnionFind {
  /** Negative at roots = component size; non-roots point to parent index. */
  parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, () => -1)
  }

  find(i: number): number {
    if (this.parent[i] < 0) return i
    this.parent[i] = this.find(this.parent[i])
    return this.parent[i]
  }

  union(a: number, b: number) {
    let ra = this.find(a)
    let rb = this.find(b)
    if (ra === rb) return

    // More negative root holds the larger component (|parent[root]| = size).
    if (this.parent[ra] > this.parent[rb]) {
      const tmp = ra
      ra = rb
      rb = tmp
    }
    this.parent[ra] += this.parent[rb]
    this.parent[rb] = ra
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function clusterByDistanceMatrix<T extends POIBase>(
  pois: T[],
  distKm: number[][],
  threshold: number,
): Map<number, T[]> {
  const uf = new UnionFind(pois.length)
  for (let i = 0; i < pois.length; i++) {
    for (let j = i + 1; j < pois.length; j++) {
      if (distKm[i][j] <= threshold) uf.union(i, j)
    }
  }

  const groups = new Map<number, T[]>()
  for (let i = 0; i < pois.length; i++) {
    const root = uf.find(i)
    const list = groups.get(root) ?? []
    list.push(pois[i])
    groups.set(root, list)
  }

  return groups
}

type GeoPoi = POIBase & { lat: number; lng: number }

/** All pairwise haversine distances — computed once for threshold + clustering. */
function buildGeoDistanceMatrix(pois: GeoPoi[]): {
  matrix: number[][]
  pairs: number[]
} {
  const n = pois.length
  const matrix = Array.from({ length: n }, () => Array<number>(n).fill(0))
  const pairs: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(pois[i].lat, pois[i].lng, pois[j].lat, pois[j].lng)
      matrix[i][j] = d
      matrix[j][i] = d
      pairs.push(d)
    }
  }
  return { matrix, pairs }
}

function geoThresholdKmFromPairs(pairs: number[]): number {
  if (pairs.length === 0) return 80
  const med = median(pairs)
  return Math.min(200, Math.max(25, med * 0.45))
}

/**
 * Cluster geocoded POIs by real-world proximity; pins without lat/lng
 * always share one group (never clustered by current board position).
 */
export function layoutByProximity(pois: POIBase[]): BoardLayoutResult {
  if (pois.length === 0) return new Map()

  const geoPois = pois.filter(hasGeo)
  const nonGeoPois = pois.filter((p) => !hasGeo(p))

  let clusters: Map<number | string, POIBase[]>
  if (geoPois.length >= 2) {
    const geo = geoPois as GeoPoi[]
    const { matrix, pairs } = buildGeoDistanceMatrix(geo)
    clusters = clusterByDistanceMatrix(geo, matrix, geoThresholdKmFromPairs(pairs))
  } else {
    clusters = new Map()
    if (geoPois.length === 1) clusters.set('solo-geo', [geoPois[0]])
  }

  if (nonGeoPois.length > 0) {
    clusters.set('non-geo', nonGeoPois)
  }

  const groups = [...clusters.values()]
    .sort((a, b) => b.length - a.length)
    .map((items) =>
      computeGroupBox(
        [...items].sort((a, b) =>
          (a.title ?? a.id).localeCompare(b.title ?? b.id),
        ),
      ),
    )

  return layoutGroupBoxes(groups)
}

export function computeBoardLayout(
  pois: POIBase[],
  mode: BoardLayoutMode,
): BoardLayoutResult {
  return mode === 'poi_type' ? layoutByPoiType(pois) : layoutByProximity(pois)
}

export const BOARD_LAYOUT_ANIM_MS = 420
