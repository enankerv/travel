/** Viewport camera state and DOM bindings. */
import type { POIBase } from '@/lib/getaway'
import type { BoardCamera } from '@/lib/boardCoords'
import {
  cameraTransform,
  computeFitCamera,
  zoomCameraAtPoint,
  type BoardNorm,
} from '@/lib/boardMath'
import type { BoardSubgroup } from '@/lib/subgroup'

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
