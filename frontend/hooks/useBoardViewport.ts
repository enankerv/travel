'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { POIBase } from '@/lib/getaway'
import type { BoardCamera } from '@/lib/boardCoords'
import {
  applyCameraToWorld,
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

export function useBoardViewport(opts: {
  pois: POIBase[]
  dragPosOverrideRef?: RefObject<{ poiId: string; wx: number; wy: number } | null>
  onActivity?: () => void
  onClearSelection?: () => void
}) {
  const { pois, dragPosOverrideRef, onActivity, onClearSelection } = opts

  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<BoardCamera>(DEFAULT_BOARD_CAMERA)
  const cameraRafRef = useRef(0)
  const pendingCameraRef = useRef<BoardCamera | null>(null)
  const panningRef = useRef<PanSession | null>(null)
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

  const scheduleCamera = useCallback(
    (cam: BoardCamera) => {
      pendingCameraRef.current = cam
      pingActivity()
      if (cameraRafRef.current) return
      cameraRafRef.current = requestAnimationFrame(flushCamera)
    },
    [flushCamera, pingActivity],
  )

  const fitCamera = useCallback((): boolean => {
    const vp = viewportRef.current
    if (!vp) return false
    const cam = computeViewportFitCamera(
      vp,
      pois,
      dragPosOverrideRef?.current ?? null,
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
    return attachBoardWheelZoom(
      vp,
      () => cameraRef.current,
      (cam) => {
        pendingCameraRef.current = cam
        pingActivity()
        if (cameraRafRef.current) return
        cameraRafRef.current = requestAnimationFrame(flushCamera)
      },
      pingActivity,
    )
  }, [flushCamera, pingActivity])

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
      setInteracting(true)
      panningRef.current = startPanSession(
        e.pointerId,
        e.clientX,
        e.clientY,
        cameraRef.current,
      )
      return true
    },
    [pingActivity],
  )

  const onPanPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const pan = panningRef.current
      if (!panSessionMatches(pan, e.pointerId)) return false
      scheduleCamera(panCamera(cameraRef.current, pan, e.clientX, e.clientY))
      return true
    },
    [scheduleCamera],
  )

  const onPanPointerUp = useCallback((pointerId: number) => {
    if (panSessionMatches(panningRef.current, pointerId)) {
      panningRef.current = null
      setInteracting(false)
      return true
    }
    return false
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
