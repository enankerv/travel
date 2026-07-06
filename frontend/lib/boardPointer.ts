/** Pointer session types and pure pointer-event logic for the board. */
import type { BoardCamera } from '@/lib/boardCoords'
import {
  anchorFromDragPointer,
  exceedsDragThreshold,
  type BoardNorm,
  type PinDragGrab,
} from '@/lib/boardMath'
import { poiOffsetBounds, screenToPoiOffset } from '@/lib/boardSpace'
import type { POIBase } from '@/lib/getaway'
import type { BoardSubgroup } from '@/lib/subgroup'

export type PanSession = {
  pointerId: number
  startX: number
  startY: number
  camX: number
  camY: number
}

export type PendingPinPointer = {
  poiId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startWx: number
  startWy: number
} & PinDragGrab

export type DragState = {
  poiId: string
  startWx: number
  startWy: number
  pointerId: number
} & PinDragGrab

export function isBoardBackgroundTarget(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean {
  const t = target as HTMLElement | null
  const cur = currentTarget as HTMLElement | null
  if (!t || !cur) return false
  return (
    t.classList.contains('board-view__world') ||
    t.classList.contains('board-view__cork') ||
    t.classList.contains('board-subgroup__surface') ||
    t === cur
  )
}

export function shouldStartViewportPan(opts: {
  button: number
  spaceDown: boolean
  onBackground: boolean
}): boolean {
  return (
    opts.button === 1 ||
    opts.button === 2 ||
    opts.spaceDown ||
    (opts.button === 0 && opts.onBackground)
  )
}

export function startPanSession(
  pointerId: number,
  clientX: number,
  clientY: number,
  cam: BoardCamera,
): PanSession {
  return {
    pointerId,
    startX: clientX,
    startY: clientY,
    camX: cam.x,
    camY: cam.y,
  }
}

export function panSessionMatches(
  pan: PanSession | null,
  pointerId: number,
): pan is PanSession {
  return pan !== null && pan.pointerId === pointerId
}

function pinCenterOffset(
  pinEl: HTMLElement,
  viewport: HTMLDivElement,
  camera: BoardCamera,
  poi: POIBase,
  subgroups: BoardSubgroup[],
): BoardNorm | null {
  const rect = pinEl.getBoundingClientRect()
  return screenToPoiOffset(
    viewport,
    camera,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    subgroups,
    poi.subgroup_id ?? null,
  )
}

export function computePinGrabOffsets(
  pinEl: HTMLElement,
  viewport: HTMLDivElement,
  camera: BoardCamera,
  clientX: number,
  clientY: number,
  anchorWx: number,
  anchorWy: number,
  poi: POIBase,
  subgroups: BoardSubgroup[],
): PinDragGrab {
  const cursorNorm = screenToPoiOffset(
    viewport,
    camera,
    clientX,
    clientY,
    subgroups,
    poi.subgroup_id ?? null,
  )
  const centerNorm = pinCenterOffset(pinEl, viewport, camera, poi, subgroups)
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

export function pinPosFromPointer(
  vp: HTMLElement,
  camera: BoardCamera,
  grab: PinDragGrab,
  clientX: number,
  clientY: number,
  poi: POIBase,
  subgroups: BoardSubgroup[],
): BoardNorm | null {
  const bounds = poiOffsetBounds(poi.subgroup_id ?? null, subgroups)
  const cursor = screenToPoiOffset(
    vp,
    camera,
    clientX,
    clientY,
    subgroups,
    poi.subgroup_id ?? null,
  )
  if (!cursor) return null
  return anchorFromDragPointer(grab, cursor.wx, cursor.wy, bounds)
}

export function buildPendingPinPointer(opts: {
  poiId: string
  pointerId: number
  clientX: number
  clientY: number
  anchorWx: number
  anchorWy: number
  pinEl: HTMLElement
  viewport: HTMLDivElement
  camera: BoardCamera
  poi: POIBase
  subgroups: BoardSubgroup[]
}): PendingPinPointer {
  const grab = computePinGrabOffsets(
    opts.pinEl,
    opts.viewport,
    opts.camera,
    opts.clientX,
    opts.clientY,
    opts.anchorWx,
    opts.anchorWy,
    opts.poi,
    opts.subgroups,
  )
  return {
    poiId: opts.poiId,
    pointerId: opts.pointerId,
    startClientX: opts.clientX,
    startClientY: opts.clientY,
    startWx: opts.anchorWx,
    startWy: opts.anchorWy,
    ...grab,
  }
}

export function pendingPinToDragState(pending: PendingPinPointer): DragState {
  return {
    poiId: pending.poiId,
    startWx: pending.startWx,
    startWy: pending.startWy,
    pointerId: pending.pointerId,
    grabOffsetWx: pending.grabOffsetWx,
    grabOffsetWy: pending.grabOffsetWy,
    anchorFromCenterWx: pending.anchorFromCenterWx,
    anchorFromCenterWy: pending.anchorFromCenterWy,
  }
}

export function shouldPromotePendingDrag(
  pending: PendingPinPointer,
  clientX: number,
  clientY: number,
): boolean {
  return exceedsDragThreshold(
    pending.startClientX,
    pending.startClientY,
    clientX,
    clientY,
  )
}

export function pendingPointerMatches(
  pending: PendingPinPointer | null,
  pointerId: number,
): pending is PendingPinPointer {
  return pending !== null && pending.pointerId === pointerId
}

export function dragPointerMatches(
  drag: DragState | null,
  pointerId: number,
): drag is DragState {
  return drag !== null && drag.pointerId === pointerId
}
