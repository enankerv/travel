'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { POIBase } from '@/lib/getaway'
import type { BoardCamera } from '@/lib/boardCoords'
import {
  applyCameraToWorld,
  attachBoardTouchGestures,
  attachBoardWheelZoom,
  attachSpacePanKeys,
  attachViewportFitObserver,
  computeViewportFitCamera,
  DEFAULT_BOARD_CAMERA,
  panCamera,
} from '@/lib/boardViewport'
import {
  isBoardBackgroundTarget,
  panSessionMatches,
  shouldStartViewportPan,
  startPanSession,
  type PanSession,
} from '@/lib/boardPointer'
import type { BoardSubgroup } from '@/lib/subgroup'

export function useBoardViewport(opts: {
  pois: POIBase[]
  subgroups?: BoardSubgroup[]
  dragPosOverrideRef?: RefObject<{ poiId: string; wx: number; wy: number } | null>
  onActivity?: () => void
  onClearSelection?: () => void
}) {
  const { pois, subgroups = [], dragPosOverrideRef, onActivity, onClearSelection } = opts

  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<BoardCamera>(DEFAULT_BOARD_CAMERA)
  const cameraRafRef = useRef(0)
  const pendingCameraRef = useRef<BoardCamera | null>(null)
  const mousePanRef = useRef<PanSession | null>(null)
  const spaceDownRef = useRef(false)
  const initialFitDone = useRef(false)

  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity
  const onClearSelectionRef = useRef(onClearSelection)
  onClearSelectionRef.current = onClearSelection

  const [interacting, setInteracting] = useState(false)

  const pingActivity = useCallback(() => {
    onActivityRef.current?.()
  }, [])

  const applyCamera = useCallback((cam: BoardCamera) => {
    cameraRef.current = cam
    applyCameraToWorld(worldRef.current, cam)
  }, [])

  const flushCamera = useCallback(() => {
    cameraRafRef.current = 0
    const next = pendingCameraRef.current
    if (!next) return
    pendingCameraRef.current = null
    applyCamera(next)
  }, [applyCamera])

  /** rAF-batched updates — wheel zoom only. */
  const scheduleCamera = useCallback(
    (cam: BoardCamera) => {
      pendingCameraRef.current = cam
      if (cameraRafRef.current) return
      cameraRafRef.current = requestAnimationFrame(flushCamera)
    },
    [flushCamera],
  )

  const resolveCamera = useCallback((): BoardCamera => {
    return pendingCameraRef.current ?? cameraRef.current
  }, [])

  /** Immediate apply — touch pan/pinch on native listeners. */
  const applyCameraImmediate = useCallback(
    (cam: BoardCamera) => {
      pendingCameraRef.current = null
      if (cameraRafRef.current) {
        cancelAnimationFrame(cameraRafRef.current)
        cameraRafRef.current = 0
      }
      applyCamera(cam)
    },
    [applyCamera],
  )

  const subgroupsRef = useRef(subgroups)
  subgroupsRef.current = subgroups

  const fitCamera = useCallback((): boolean => {
    const vp = viewportRef.current
    if (!vp) return false
    const cam = computeViewportFitCamera(
      vp,
      pois,
      dragPosOverrideRef?.current ?? null,
      subgroupsRef.current,
    )
    if (!cam) return false
    applyCamera(cam)
    return true
  }, [applyCamera, pois, dragPosOverrideRef])

  const fitCameraRef = useRef(fitCamera)
  fitCameraRef.current = fitCamera
  const applyCameraRef = useRef(applyCamera)
  applyCameraRef.current = applyCamera

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    return attachViewportFitObserver({
      viewport: vp,
      fitCamera: () => fitCameraRef.current(),
      applyCamera: (cam) => applyCameraRef.current(cam),
      getCamera: () => cameraRef.current,
      initialFitDone,
      onCameraRafCancel: () => {
        if (cameraRafRef.current) cancelAnimationFrame(cameraRafRef.current)
      },
    })
  }, [])

  useEffect(() => attachSpacePanKeys(spaceDownRef), [])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    return attachBoardWheelZoom(vp, () => cameraRef.current, scheduleCamera, pingActivity)
  }, [scheduleCamera, pingActivity])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    return attachBoardTouchGestures(vp, {
      getCamera: resolveCamera,
      applyCamera: applyCameraImmediate,
      onClearSelection: () => onClearSelectionRef.current?.(),
      onActivity: pingActivity,
      onInteractingChange: setInteracting,
    })
  }, [applyCameraImmediate, resolveCamera, pingActivity])

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return false

      const onBackground = isBoardBackgroundTarget(e.target, e.currentTarget)
      if (
        !shouldStartViewportPan({
          button: e.button,
          spaceDown: spaceDownRef.current,
          onBackground,
        })
      ) {
        return false
      }
      onClearSelectionRef.current?.()
      pingActivity()
      e.currentTarget.setPointerCapture(e.pointerId)
      mousePanRef.current = startPanSession(
        e.pointerId,
        e.clientX,
        e.clientY,
        resolveCamera(),
      )
      setInteracting(true)
      return true
    },
    [pingActivity, resolveCamera],
  )

  const onPanPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return false

      const pan = mousePanRef.current
      if (!panSessionMatches(pan, e.pointerId)) return false
      applyCameraImmediate(
        panCamera(cameraRef.current, pan, e.clientX, e.clientY),
      )
      return true
    },
    [applyCameraImmediate],
  )

  const onPanPointerUp = useCallback((pointerId: number) => {
    if (!panSessionMatches(mousePanRef.current, pointerId)) return false
    mousePanRef.current = null
    setInteracting(false)
    return true
  }, [])

  return {
    viewportRef,
    worldRef,
    cameraRef,
    interacting,
    fitCamera,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
  }
}
