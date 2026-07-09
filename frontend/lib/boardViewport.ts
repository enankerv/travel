/** Viewport camera state and DOM bindings. */
import type { POIBase } from '@/lib/getaway'
import type { BoardCamera } from '@/lib/boardCoords'
import {
  cameraTransform,
  computeFitCamera,
  exceedsDragThreshold,
  pinchZoomCamera,
  zoomCameraAtPoint,
  type BoardNorm,
} from '@/lib/boardMath'
import type { BoardSubgroup } from '@/lib/subgroup'
import {
  isBoardBackgroundTarget,
  panSessionMatches,
  startPanSession,
  type PanSession,
} from '@/lib/boardPointer'

export const DEFAULT_BOARD_CAMERA: BoardCamera = { x: 0, y: 0, scale: 0.35 }

export type ViewportSize = { width: number; height: number }

export const PAPER_TEXTURE_BASE_PX = 200
/** Below this camera scale, skip SVG paper texture for performance. */
export const PAPER_TEXTURE_MIN_SCALE = 0.5

export function applyCameraToWorld(
  world: HTMLElement | null,
  cam: BoardCamera,
) {
  if (!world) return
  world.style.transform = cameraTransform(cam)

  const macroView = cam.scale < PAPER_TEXTURE_MIN_SCALE
  world.classList.toggle('optimized-macro-view', macroView)

  if (!macroView) {
    // Counter-scale tile size so paper grain stays ~200px on screen as you zoom.
    world.style.setProperty(
      '--paper-texture-size',
      `${PAPER_TEXTURE_BASE_PX / cam.scale}px`,
    )
  }
}

export function readViewportSize(vp: HTMLElement | null): ViewportSize | null {
  if (!vp) return null
  const { width, height } = vp.getBoundingClientRect()
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

export function panCamera(
  cam: BoardCamera,
  pan: {
    startX: number
    startY: number
    camX: number
    camY: number
  },
  clientX: number,
  clientY: number,
): BoardCamera {
  return {
    ...cam,
    x: pan.camX + (clientX - pan.startX),
    y: pan.camY + (clientY - pan.startY),
  }
}

export function wheelZoomCamera(
  cam: BoardCamera,
  vp: HTMLElement,
  clientX: number,
  clientY: number,
  deltaY: number,
): BoardCamera {
  const rect = vp.getBoundingClientRect()
  return zoomCameraAtPoint(cam, clientX - rect.left, clientY - rect.top, deltaY)
}

export function computeViewportFitCamera(
  vp: HTMLElement,
  pois: POIBase[],
  posOverride?: { poiId: string; wx: number; wy: number } | null,
  subgroups: BoardSubgroup[] = [],
): BoardCamera | null {
  const size = readViewportSize(vp)
  if (!size) return null
  return computeFitCamera(
    size.width,
    size.height,
    pois,
    posOverride,
    subgroups,
  )
}

const MIN_PINCH_DIST_PX = 10

type PinchPointer = { clientX: number; clientY: number }

type PinchSession = {
  startDist: number
  startMidX: number
  startMidY: number
  startCam: BoardCamera
}

function pinchMetrics(
  pointers: Map<number, PinchPointer>,
  rect: DOMRect,
): { midX: number; midY: number; dist: number } | null {
  const pts = [...pointers.values()]
  if (pts.length < 2) return null
  const [a, b] = pts
  return {
    midX: (a.clientX + b.clientX) / 2 - rect.left,
    midY: (a.clientY + b.clientY) / 2 - rect.top,
    dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
  }
}

function isTouchPointer(e: PointerEvent) {
  return e.pointerType === 'touch'
}

function releaseCapture(vp: HTMLElement, pointerId: number) {
  try {
    vp.releasePointerCapture(pointerId)
  } catch {
    // Pointer may already be released.
  }
}

/**
 * Touch pan + pinch on the board viewport (capture phase so pins don't block
 * tracking). Owns gesture state internally. Returns detach.
 */
export function attachBoardTouchGestures(
  vp: HTMLElement,
  opts: {
    getCamera: () => BoardCamera
    applyCamera: (cam: BoardCamera) => void
    onClearSelection?: () => void
    onActivity?: () => void
    onInteractingChange?: (active: boolean) => void
  },
): () => void {
  const pointers = new Map<number, PinchPointer>()
  let pinchSession: PinchSession | null = null
  let touchPending: PanSession | null = null
  let touchPanning: PanSession | null = null

  const clearTouchPan = () => {
    const captureId = touchPanning?.pointerId ?? touchPending?.pointerId
    touchPending = null
    touchPanning = null
    if (captureId != null) releaseCapture(vp, captureId)
  }

  const startPinchIfReady = () => {
    if (pointers.size !== 2) return
    const rect = vp.getBoundingClientRect()
    const metrics = pinchMetrics(pointers, rect)
    if (!metrics || metrics.dist < MIN_PINCH_DIST_PX) return

    clearTouchPan()
    pinchSession = {
      startDist: metrics.dist,
      startMidX: metrics.midX,
      startMidY: metrics.midY,
      startCam: opts.getCamera(),
    }
    opts.onActivity?.()
    opts.onInteractingChange?.(true)
  }

  const endPinchIfNeeded = () => {
    if (pointers.size >= 2 || !pinchSession) return
    pinchSession = null
    opts.onInteractingChange?.(false)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!isTouchPointer(e)) return
    pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY })

    if (pointers.size === 1 && isBoardBackgroundTarget(e.target, vp) && e.button === 0) {
      opts.onClearSelection?.()
      opts.onActivity?.()
      vp.setPointerCapture(e.pointerId)
      touchPending = startPanSession(
        e.pointerId,
        e.clientX,
        e.clientY,
        opts.getCamera(),
      )
    }

    if (pointers.size === 2) startPinchIfReady()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY })

    if (pinchSession && pointers.size >= 2) {
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const metrics = pinchMetrics(pointers, rect)
      if (!metrics || pinchSession.startDist < MIN_PINCH_DIST_PX) return
      opts.applyCamera(
        pinchZoomCamera(
          pinchSession.startCam,
          pinchSession.startMidX,
          pinchSession.startMidY,
          pinchSession.startDist,
          metrics.midX,
          metrics.midY,
          metrics.dist,
        ),
      )
      return
    }

    if (touchPending && touchPending.pointerId === e.pointerId && !touchPanning) {
      if (
        exceedsDragThreshold(
          touchPending.startX,
          touchPending.startY,
          e.clientX,
          e.clientY,
        )
      ) {
        touchPanning = touchPending
        touchPending = null
        opts.onInteractingChange?.(true)
      } else {
        return
      }
    }

    const pan = touchPanning
    if (!pan || pan.pointerId !== e.pointerId) return

    e.preventDefault()
    opts.applyCamera(panCamera(opts.getCamera(), pan, e.clientX, e.clientY))
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)

    if (panSessionMatches(touchPending, e.pointerId)) {
      touchPending = null
      releaseCapture(vp, e.pointerId)
    } else if (panSessionMatches(touchPanning, e.pointerId)) {
      touchPanning = null
      opts.onInteractingChange?.(false)
      releaseCapture(vp, e.pointerId)
    }

    endPinchIfNeeded()
  }

  const capture = true
  vp.addEventListener('pointerdown', onPointerDown, capture)
  vp.addEventListener('pointermove', onPointerMove, { passive: false, capture })
  vp.addEventListener('pointerup', onPointerUp, capture)
  vp.addEventListener('pointercancel', onPointerUp, capture)
  vp.addEventListener('lostpointercapture', onPointerUp, capture)

  return () => {
    vp.removeEventListener('pointerdown', onPointerDown, capture)
    vp.removeEventListener('pointermove', onPointerMove, capture)
    vp.removeEventListener('pointerup', onPointerUp, capture)
    vp.removeEventListener('pointercancel', onPointerUp, capture)
    vp.removeEventListener('lostpointercapture', onPointerUp, capture)
  }
}

/** Wheel zoom on the board viewport. Returns detach. */
export function attachBoardWheelZoom(
  vp: HTMLElement,
  getCamera: () => BoardCamera,
  scheduleCamera: (cam: BoardCamera) => void,
  onActivity?: () => void,
): () => void {
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    onActivity?.()
    scheduleCamera(wheelZoomCamera(getCamera(), vp, e.clientX, e.clientY, e.deltaY))
  }
  vp.addEventListener('wheel', onWheel, { passive: false })
  return () => vp.removeEventListener('wheel', onWheel)
}

/** Space bar held → pan mode. Returns detach. */
export function attachSpacePanKeys(spaceDownRef: { current: boolean }): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) spaceDownRef.current = true
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') spaceDownRef.current = false
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }
}

/** Initial fit + resize/visibility camera sync. Returns detach. */
export function attachViewportFitObserver(opts: {
  viewport: HTMLElement
  fitCamera: () => boolean
  applyCamera: (cam: BoardCamera) => void
  getCamera: () => BoardCamera
  initialFitDone: { current: boolean }
  onCameraRafCancel?: () => void
}): () => void {
  let raf = 0

  const syncCameraDom = () => {
    if (!readViewportSize(opts.viewport)) return
    opts.applyCamera(opts.getCamera())
  }

  const tryInitialFit = () => {
    if (opts.initialFitDone.current) return true
    if (opts.fitCamera()) {
      opts.initialFitDone.current = true
      return true
    }
    return false
  }

  const scheduleFitRetry = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(function tick() {
      if (tryInitialFit()) return
      if (document.visibilityState !== 'visible') return
      raf = requestAnimationFrame(tick)
    })
  }

  const onViewportReady = () => {
    if (tryInitialFit()) return
    syncCameraDom()
  }

  scheduleFitRetry()

  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return
    raf = requestAnimationFrame(onViewportReady)
    if (!opts.initialFitDone.current) scheduleFitRetry()
  }
  document.addEventListener('visibilitychange', onVisibility)

  const ro = new ResizeObserver(() => {
    raf = requestAnimationFrame(onViewportReady)
  })
  ro.observe(opts.viewport)

  return () => {
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', onVisibility)
    ro.disconnect()
    opts.onCameraRafCancel?.()
  }
}

export type GospelByPoiId = Record<string, BoardNorm>

export function commitGospelEntry(
  prev: GospelByPoiId,
  poiId: string,
  wx: number,
  wy: number,
): GospelByPoiId {
  return { ...prev, [poiId]: { wx, wy } }
}

export function clearGospelEntry(prev: GospelByPoiId, poiId: string): GospelByPoiId {
  if (!(poiId in prev)) return prev
  const next = { ...prev }
  delete next[poiId]
  return next
}
