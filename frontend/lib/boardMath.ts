/** Board camera, bounds, drag, and zoom math. */
import type { POIBase } from '@/lib/getaway'
import {
  BOARD_WORLD_H,
  BOARD_WORLD_W,
  type BoardCamera,
} from '@/lib/boardCoords'
import { BOARD_ROOT_SPACE, screenToLocalNorm, type BoardSpace } from '@/lib/boardSpace'
import type { BoardSubgroup } from '@/lib/subgroup'

export const BOARD_MIN_SCALE = 0.08
export const BOARD_MAX_SCALE = 2.5
/** Visual padding around pin anchors when fitting (world px). */
export const BOARD_PIN_PAD_X = 88
export const BOARD_PIN_PAD_TOP = 142
export const BOARD_PIN_PAD_BOTTOM = 14
export const BOARD_MIN_FIT_SPAN = 180
export const BOARD_FIT_MARGIN = 0.88
/** Screen px before a pin pointer down becomes a drag (not a click). */
export const BOARD_PIN_DRAG_THRESHOLD_PX = 6

export type BoardBounds = { minX: number; minY: number; maxX: number; maxY: number }

export type BoardNorm = { wx: number; wy: number }

export type PinDragGrab = {
  grabOffsetWx: number
  grabOffsetWy: number
  anchorFromCenterWx: number
  anchorFromCenterWy: number
}

/** Visual padding around subgroup frames when fitting (world px). */
export const BOARD_SUBGROUP_FIT_PAD = 16

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function coordsMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.0001
}

export function pinCoordsEqual(a: BoardNorm, b: BoardNorm) {
  return coordsMatch(a.wx, b.wx) && coordsMatch(a.wy, b.wy)
}

export function cameraTransform(cam: BoardCamera) {
  return `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.scale})`
}

export function poiBoundsWorld(
  pois: POIBase[],
  posOverride?: { poiId: string; wx: number; wy: number } | null,
): BoardBounds | null {
  if (pois.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const poi of pois) {
    const overridden = posOverride?.poiId === poi.id ? posOverride : null
    const wx = overridden?.wx ?? poi.board_x ?? 0.5
    const wy = overridden?.wy ?? poi.board_y ?? 0.5
    const bx = wx * BOARD_WORLD_W
    const by = wy * BOARD_WORLD_H
    minX = Math.min(minX, bx - BOARD_PIN_PAD_X)
    maxX = Math.max(maxX, bx + BOARD_PIN_PAD_X)
    minY = Math.min(minY, by - BOARD_PIN_PAD_TOP)
    maxY = Math.max(maxY, by + BOARD_PIN_PAD_BOTTOM)
  }

  return { minX, minY, maxX, maxY }
}

function mergeBounds(a: BoardBounds | null, b: BoardBounds): BoardBounds {
  if (!a) return b
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

function subgroupFrameBoundsWorld(sg: BoardSubgroup): BoardBounds {
  const pad = BOARD_SUBGROUP_FIT_PAD
  return {
    minX: sg.board_x * BOARD_WORLD_W - pad,
    minY: sg.board_y * BOARD_WORLD_H - pad,
    maxX: (sg.board_x + sg.board_w) * BOARD_WORLD_W + pad,
    maxY: (sg.board_y + sg.board_h) * BOARD_WORLD_H + pad,
  }
}

/**
 * Fit bounds for the board root: top-level subgroup frames plus root-level pins.
 * Pins inside subgroups are omitted — they are laid out within their frame.
 */
export function boardFitBoundsWorld(
  pois: POIBase[],
  subgroups: BoardSubgroup[],
  posOverride?: { poiId: string; wx: number; wy: number } | null,
): BoardBounds | null {
  const rootPois = pois.filter((p) => (p.subgroup_id ?? null) === null)
  const rootOverride =
    posOverride && rootPois.some((p) => p.id === posOverride.poiId)
      ? posOverride
      : null

  let bounds = poiBoundsWorld(rootPois, rootOverride)

  for (const sg of subgroups) {
    if ((sg.parent_subgroup_id ?? null) !== null) continue
    bounds = mergeBounds(bounds, subgroupFrameBoundsWorld(sg))
  }

  return bounds
}

export function cameraForBounds(
  viewportW: number,
  viewportH: number,
  bounds: BoardBounds,
): BoardCamera {
  let { minX, minY, maxX, maxY } = bounds
  let bw = maxX - minX
  let bh = maxY - minY

  if (bw < BOARD_MIN_FIT_SPAN) {
    const cx = (minX + maxX) / 2
    minX = cx - BOARD_MIN_FIT_SPAN / 2
    maxX = cx + BOARD_MIN_FIT_SPAN / 2
    bw = BOARD_MIN_FIT_SPAN
  }
  if (bh < BOARD_MIN_FIT_SPAN) {
    const cy = (minY + maxY) / 2
    minY = cy - BOARD_MIN_FIT_SPAN / 2
    maxY = cy + BOARD_MIN_FIT_SPAN / 2
    bh = BOARD_MIN_FIT_SPAN
  }

  const scale = clamp(
    Math.min(viewportW / bw, viewportH / bh) * BOARD_FIT_MARGIN,
    BOARD_MIN_SCALE,
    BOARD_MAX_SCALE,
  )
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  return {
    x: viewportW / 2 - cx * scale,
    y: viewportH / 2 - cy * scale,
    scale,
  }
}

export function cameraForEmptyBoard(viewportW: number, viewportH: number): BoardCamera {
  const scale = clamp(
    Math.min(
      viewportW / (BOARD_WORLD_W * 0.35),
      viewportH / (BOARD_WORLD_H * 0.35),
    ) * BOARD_FIT_MARGIN,
    BOARD_MIN_SCALE,
    BOARD_MAX_SCALE,
  )
  return {
    x: viewportW / 2 - (BOARD_WORLD_W * 0.5) * scale,
    y: viewportH / 2 - (BOARD_WORLD_H * 0.5) * scale,
    scale,
  }
}

export function computeFitCamera(
  viewportW: number,
  viewportH: number,
  pois: POIBase[],
  posOverride?: { poiId: string; wx: number; wy: number } | null,
  subgroups: BoardSubgroup[] = [],
): BoardCamera {
  const bounds = boardFitBoundsWorld(pois, subgroups, posOverride)
  if (!bounds) return cameraForEmptyBoard(viewportW, viewportH)
  return cameraForBounds(viewportW, viewportH, bounds)
}

/** Zoom toward a viewport-local point (mx, my), keeping that world point fixed. */
export function zoomCameraAtPoint(
  cam: BoardCamera,
  mx: number,
  my: number,
  deltaY: number,
): BoardCamera {
  const wx = (mx - cam.x) / cam.scale
  const wy = (my - cam.y) / cam.scale
  const factor = deltaY < 0 ? 1.08 : 1 / 1.08
  const newScale = clamp(cam.scale * factor, BOARD_MIN_SCALE, BOARD_MAX_SCALE)
  return {
    x: mx - wx * newScale,
    y: my - wy * newScale,
    scale: newScale,
  }
}

export function pinCenterNorm(
  pinEl: HTMLElement,
  viewport: HTMLDivElement,
  camera: BoardCamera,
  space: BoardSpace = BOARD_ROOT_SPACE,
): BoardNorm | null {
  const rect = pinEl.getBoundingClientRect()
  return screenToLocalNorm(
    viewport,
    camera,
    space,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  )
}

/** Map cursor position → anchor, keeping pin center fixed relative to the grab. */
export function anchorFromDragPointer(
  drag: PinDragGrab,
  cursorWx: number,
  cursorWy: number,
): BoardNorm {
  const centerWx = cursorWx - drag.grabOffsetWx
  const centerWy = cursorWy - drag.grabOffsetWy
  return {
    wx: clamp(centerWx + drag.anchorFromCenterWx, 0, 1),
    wy: clamp(centerWy + drag.anchorFromCenterWy, 0, 1),
  }
}

export function computePinGrabOffsets(
  pinEl: HTMLElement,
  viewport: HTMLDivElement,
  camera: BoardCamera,
  clientX: number,
  clientY: number,
  anchorWx: number,
  anchorWy: number,
  space: BoardSpace = BOARD_ROOT_SPACE,
): PinDragGrab {
  const cursorNorm = screenToLocalNorm(viewport, camera, space, clientX, clientY)
  const centerNorm = pinCenterNorm(pinEl, viewport, camera, space)
  if (!cursorNorm || !centerNorm) {
    return {
      grabOffsetWx: 0,
      grabOffsetWy: 0,
      anchorFromCenterWx: 0,
      anchorFromCenterWy: 0,
    }
  }
  return {
    grabOffsetWx: cursorNorm.wx - centerNorm.wx,
    grabOffsetWy: cursorNorm.wy - centerNorm.wy,
    anchorFromCenterWx: anchorWx - centerNorm.wx,
    anchorFromCenterWy: anchorWy - centerNorm.wy,
  }
}

export function exceedsDragThreshold(
  startClientX: number,
  startClientY: number,
  clientX: number,
  clientY: number,
  thresholdPx = BOARD_PIN_DRAG_THRESHOLD_PX,
) {
  return Math.hypot(clientX - startClientX, clientY - startClientY) >= thresholdPx
}
