'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { POIBase } from '@/lib/getaway'
import type { BoardCamera } from '@/lib/boardCoords'
import {
  applyCameraToWorld,
  attachBoardPinchZoom,
  attachBoardWheelZoom,
  attachSpacePanKeys,
  attachViewportFitObserver,
  computeViewportFitCamera,
  DEFAULT_BOARD_CAMERA,
  panCamera,
} from '@/lib/boardViewport'
import { exceedsDragThreshold } from '@/lib/boardMath'
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
  const panningRef = useRef<PanSession | null>(null)
  const touchPanPendingRef = useRef<PanSession | null>(null)
  const pinchActiveRef = useRef(false)
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

  const resolveCamera = useCallback((): BoardCamera => {
    return pendingCameraRef.current ?? cameraRef.current
  }, [])

  const applyCameraNow = useCallback(
    (cam: BoardCamera) => {
      pendingCameraRef.current = null
      if (cameraRafRef.current) {
        cancelAnimationFrame(cameraRafRef.current)
        cameraRafRef.current = 0
      }
      applyCamera(cam)
      pingActivity()
    },
    [applyCamera, pingActivity],
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
    return attachBoardPinchZoom(vp, resolveCamera, applyCameraNow, {
      onPinchStart: () => {
        const pan = panningRef.current ?? touchPanPendingRef.current
        if (pan) {
          try {
            vp.releasePointerCapture(pan.pointerId)
          } catch {
            // Pointer may already be released.
          }
        }
        panningRef.current = null
        touchPanPendingRef.current = null
        pinchActiveRef.current = true
        setInteracting(true)
      },
      onPinchEnd: () => {
        pinchActiveRef.current = false
        setInteracting(false)
      },
      onActivity: pingActivity,
    })
  }, [applyCameraNow, resolveCamera, pingActivity])

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pinchActiveRef.current) return false

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

      const cam = resolveCamera()
      const session = startPanSession(e.pointerId, e.clientX, e.clientY, cam)

      // Defer touch pan until move so a second finger can land for pinch.
      if (e.pointerType === 'touch') {
        touchPanPendingRef.current = session
        return true
      }

      setInteracting(true)
      panningRef.current = session
      return true
    },
    [pingActivity, resolveCamera],
  )

  const onPanPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pinchActiveRef.current) return false

      const pending = touchPanPendingRef.current
      if (pending && pending.pointerId === e.pointerId && !panningRef.current) {
        if (
          exceedsDragThreshold(
            pending.startX,
            pending.startY,
            e.clientX,
            e.clientY,
          )
        ) {
          panningRef.current = pending
          touchPanPendingRef.current = null
          setInteracting(true)
        } else {
          return true
        }
      }

      const pan = panningRef.current
      if (!panSessionMatches(pan, e.pointerId)) return false
      scheduleCamera(
        panCamera(resolveCamera(), pan, e.clientX, e.clientY),
      )
      return true
    },
    [resolveCamera, scheduleCamera],
  )

  const onPanPointerUp = useCallback((pointerId: number) => {
    if (panSessionMatches(touchPanPendingRef.current, pointerId)) {
      touchPanPendingRef.current = null
      return true
    }
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
