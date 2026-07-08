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
  cameraFromPinchSession,
  isBoardBackgroundTarget,
  panSessionMatches,
  pinchSessionMatches,
  shouldStartViewportPan,
  startPanSession,
  startPinchSession,
  type PanSession,
  type PinchPointer,
  type PinchSession,
} from '@/lib/boardPointer'
import type { BoardSubgroup } from '@/lib/subgroup'

export function useBoardViewport(opts: {
  pois: POIBase[]
  subgroups?: BoardSubgroup[]
  dragPosOverrideRef?: RefObject<{ poiId: string; wx: number; wy: number } | null>
  onActivity?: () => void
  onClearSelection?: () => void
  onPinchStart?: () => void
}) {
  const { pois, subgroups = [], dragPosOverrideRef, onActivity, onClearSelection, onPinchStart } =
    opts

  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<BoardCamera>(DEFAULT_BOARD_CAMERA)
  const cameraRafRef = useRef(0)
  const pendingCameraRef = useRef<BoardCamera | null>(null)
  const panningRef = useRef<PanSession | null>(null)
  const pinchRef = useRef<PinchSession | null>(null)
  const pinchPointersRef = useRef(new Map<number, PinchPointer>())
  const pinchingRef = useRef(false)
  const spaceDownRef = useRef(false)
  const initialFitDone = useRef(false)

  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity
  const onClearSelectionRef = useRef(onClearSelection)
  onClearSelectionRef.current = onClearSelection
  const onPinchStartRef = useRef(onPinchStart)
  onPinchStartRef.current = onPinchStart

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

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    const toViewportLocal = (clientX: number, clientY: number): PinchPointer => {
      const rect = vp.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    const beginPinch = () => {
      const pointers = pinchPointersRef.current
      if (pointers.size < 2) return

      const ids = [...pointers.keys()].slice(0, 2) as [number, number]
      const session = startPinchSession(pointers, ids, cameraRef.current)
      if (!session) return

      panningRef.current = null
      pinchRef.current = session
      pinchingRef.current = true
      onPinchStartRef.current?.()
      onClearSelectionRef.current?.()
      pingActivity()
      setInteracting(true)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      pinchPointersRef.current.set(e.pointerId, toViewportLocal(e.clientX, e.clientY))
      if (pinchPointersRef.current.size >= 2) beginPinch()
    }

    const onPointerMove = (e: PointerEvent) => {
      const pointers = pinchPointersRef.current
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, toViewportLocal(e.clientX, e.clientY))

      const pinch = pinchRef.current
      if (!pinch) {
        if (pointers.size >= 2) beginPinch()
        return
      }

      const next = cameraFromPinchSession(pinch, pointers)
      if (!next) return
      e.preventDefault()
      scheduleCamera(next)
    }

    const endPointer = (pointerId: number) => {
      pinchPointersRef.current.delete(pointerId)
      if (!pinchSessionMatches(pinchRef.current, pointerId)) return
      pinchRef.current = null
      pinchingRef.current = false
      if (pinchPointersRef.current.size === 0) setInteracting(false)
    }

    const onPointerUp = (e: PointerEvent) => {
      endPointer(e.pointerId)
    }

    vp.addEventListener('pointerdown', onPointerDown, { capture: true })
    vp.addEventListener('pointermove', onPointerMove, { passive: false })
    vp.addEventListener('pointerup', onPointerUp)
    vp.addEventListener('pointercancel', onPointerUp)

    return () => {
      vp.removeEventListener('pointerdown', onPointerDown, { capture: true })
      vp.removeEventListener('pointermove', onPointerMove)
      vp.removeEventListener('pointerup', onPointerUp)
      vp.removeEventListener('pointercancel', onPointerUp)
      pinchPointersRef.current.clear()
      pinchRef.current = null
      pinchingRef.current = false
    }
  }, [scheduleCamera, pingActivity])

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pinchingRef.current) return false
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
      if (pinchingRef.current) return false
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
    pinchingRef,
    fitCamera,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
  }
}
