'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { updateSubgroup } from '@/lib/api'
import type { BoardCamera } from '@/lib/boardCoords'
import {
  clampSubgroupRect,
  screenToParentLocal,
} from '@/lib/boardSpace'
import type { BoardSubgroup } from '@/lib/subgroup'

export type SubgroupRect = Pick<
  BoardSubgroup,
  'board_x' | 'board_y' | 'board_w' | 'board_h'
>

type SubgroupDrag =
  | {
      kind: 'move'
      subgroupId: string
      pointerId: number
      grabDx: number
      grabDy: number
      start: SubgroupRect
    }
  | {
      kind: 'resize-se'
      subgroupId: string
      pointerId: number
      start: SubgroupRect
    }

export function useBoardSubgroupEdit(opts: {
  listId: string
  subgroups: BoardSubgroup[]
  setSubgroups: React.Dispatch<React.SetStateAction<BoardSubgroup[]>>
  setError: (msg: string) => void
  viewportRef: RefObject<HTMLDivElement | null>
  cameraRef: RefObject<BoardCamera | null>
  onActivity?: () => void
  selectedSubgroupId: string | null
  setSelectedSubgroupId: (id: string | null) => void
}) {
  const {
    listId,
    subgroups,
    setSubgroups,
    setError,
    viewportRef,
    cameraRef,
    onActivity,
    selectedSubgroupId,
    setSelectedSubgroupId,
  } = opts

  const [overrideById, setOverrideById] = useState<Record<string, SubgroupRect>>({})
  const overrideRef = useRef(overrideById)
  overrideRef.current = overrideById
  const dragRef = useRef<SubgroupDrag | null>(null)
  const [isSubgroupDragging, setIsSubgroupDragging] = useState(false)
  const subgroupsRef = useRef(subgroups)
  subgroupsRef.current = subgroups

  const getRect = useCallback(
    (sg: BoardSubgroup): SubgroupRect => {
      const o = overrideById[sg.id]
      return {
        board_x: o?.board_x ?? sg.board_x,
        board_y: o?.board_y ?? sg.board_y,
        board_w: o?.board_w ?? sg.board_w,
        board_h: o?.board_h ?? sg.board_h,
      }
    },
    [overrideById],
  )

  const parentLocalFromEvent = useCallback(
    (sg: BoardSubgroup, clientX: number, clientY: number): { wx: number; wy: number } | null => {
      const vp = viewportRef.current
      if (!vp) return null
      return screenToParentLocal(
        vp,
        cameraRef.current ?? { x: 0, y: 0, scale: 1 },
        sg.parent_subgroup_id ?? null,
        subgroupsRef.current,
        clientX,
        clientY,
      )
    },
    [viewportRef, cameraRef],
  )

  const applyOverride = useCallback((subgroupId: string, rect: SubgroupRect) => {
    setOverrideById((prev) => ({ ...prev, [subgroupId]: rect }))
  }, [])

  const commitRect = useCallback(
    async (subgroupId: string, rect: SubgroupRect) => {
      const prev = subgroupsRef.current.find((s) => s.id === subgroupId)
      if (!prev) return

      setSubgroups((list) =>
        list.map((s) => (s.id === subgroupId ? { ...s, ...rect } : s)),
      )
      setOverrideById((o) => {
        if (!(subgroupId in o)) return o
        const next = { ...o }
        delete next[subgroupId]
        return next
      })

      try {
        await updateSubgroup(listId, subgroupId, rect)
      } catch {
        setError('Failed to save group')
        setSubgroups((list) =>
          list.map((s) =>
            s.id === subgroupId
              ? {
                  ...s,
                  board_x: prev.board_x,
                  board_y: prev.board_y,
                  board_w: prev.board_w,
                  board_h: prev.board_h,
                }
              : s,
          ),
        )
      }
    },
    [listId, setSubgroups, setError],
  )

  const onSubgroupMovePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, sg: BoardSubgroup) => {
      if (e.button !== 0) return
      e.stopPropagation()
      onActivity?.()
      setSelectedSubgroupId(sg.id)
      e.currentTarget.setPointerCapture(e.pointerId)

      const rect = getRect(sg)
      const local = parentLocalFromEvent(sg, e.clientX, e.clientY)
      if (!local) return

      dragRef.current = {
        kind: 'move',
        subgroupId: sg.id,
        pointerId: e.pointerId,
        grabDx: local.wx - rect.board_x,
        grabDy: local.wy - rect.board_y,
        start: rect,
      }
      setIsSubgroupDragging(true)
    },
    [getRect, parentLocalFromEvent, onActivity, setSelectedSubgroupId],
  )

  const onSubgroupResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, sg: BoardSubgroup) => {
      if (e.button !== 0) return
      e.stopPropagation()
      onActivity?.()
      setSelectedSubgroupId(sg.id)
      e.currentTarget.setPointerCapture(e.pointerId)

      dragRef.current = {
        kind: 'resize-se',
        subgroupId: sg.id,
        pointerId: e.pointerId,
        start: getRect(sg),
      }
      setIsSubgroupDragging(true)
    },
    [getRect, onActivity, setSelectedSubgroupId],
  )

  const onSubgroupPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return false

      const sg = subgroupsRef.current.find((s) => s.id === drag.subgroupId)
      if (!sg) return true

      onActivity?.()
      const local = parentLocalFromEvent(sg, e.clientX, e.clientY)
      if (!local) return true

      if (drag.kind === 'move') {
        const next = clampSubgroupRect({
          ...drag.start,
          board_x: local.wx - drag.grabDx,
          board_y: local.wy - drag.grabDy,
        })
        applyOverride(drag.subgroupId, next)
      } else {
        const next = clampSubgroupRect({
          ...drag.start,
          board_w: local.wx - drag.start.board_x,
          board_h: local.wy - drag.start.board_y,
        })
        applyOverride(drag.subgroupId, next)
      }
      return true
    },
    [parentLocalFromEvent, applyOverride, onActivity],
  )

  const onSubgroupPointerUp = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== pointerId) return false

      const rect = overrideRef.current[drag.subgroupId] ?? drag.start
      dragRef.current = null
      setIsSubgroupDragging(false)
      void commitRect(drag.subgroupId, rect)
      return true
    },
    [commitRect],
  )

  useEffect(() => {
    return () => {
      dragRef.current = null
      setIsSubgroupDragging(false)
    }
  }, [])

  return {
    getRect,
    selectedSubgroupId,
    setSelectedSubgroupId,
    onSubgroupMovePointerDown,
    onSubgroupResizePointerDown,
    onSubgroupPointerMove,
    onSubgroupPointerUp,
    isSubgroupDragging,
  }
}
