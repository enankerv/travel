'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { bulkUpdatePoiPositions } from '@/lib/api'
import {
  BOARD_LAYOUT_ANIM_MS,
  computeBoardLayout,
  type BoardLayoutMode,
} from '@/lib/boardLayout'
import type { BoardNorm } from '@/lib/boardMath'
import { pruneStaleGospel } from '@/lib/boardPin'
import type { BoardPoi } from '@/lib/board'
import {
  commitGospelEntry,
  type GospelByPoiId,
} from '@/lib/boardViewport'
import { supabase } from '@/lib/supabase'
import {
  subscribeBoardSortBroadcast,
  type BoardSortBroadcastPayload,
  type PresenceUser,
} from '@/lib/realtime'

type LayoutPosition = { id: string; board_x: number; board_y: number }

export function useBoardLayout(opts: {
  listId: string
  userId: string | undefined
  otherViewers: PresenceUser[]
  enabled: boolean
  pois: BoardPoi[]
  setPois: React.Dispatch<React.SetStateAction<BoardPoi[]>>
  setError: (msg: string) => void
  isDragActive: boolean
  onAfterLayout?: () => void
}) {
  const {
    listId,
    userId,
    otherViewers,
    enabled,
    pois,
    setPois,
    setError,
    isDragActive,
    onAfterLayout,
  } = opts

  const [layoutGospel, setLayoutGospel] = useState<GospelByPoiId>({})
  const [layoutAnimating, setLayoutAnimating] = useState(false)
  const [sorting, setSorting] = useState(false)
  const poisRef = useRef(pois)
  poisRef.current = pois
  const sortingRef = useRef(false)
  sortingRef.current = sorting
  const isDragActiveRef = useRef(isDragActive)
  isDragActiveRef.current = isDragActive
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const hasOtherViewers = otherViewers.length > 0

  useEffect(() => {
    if (!enabled || !userId) {
      channelRef.current = null
      return
    }
    channelRef.current = supabase.channel(`list:${listId}`, {
      config: { private: true },
    })
    return () => {
      channelRef.current = null
    }
  }, [listId, enabled, userId])

  useEffect(() => {
    setLayoutGospel((prev) => pruneStaleGospel(prev, pois))
  }, [pois])

  const broadcastSort = useCallback(
    (payload: Omit<BoardSortBroadcastPayload, 'user_id'>) => {
      const ch = channelRef.current
      if (!ch || !userId || !hasOtherViewers) return
      void ch
        .send({
          type: 'broadcast',
          event: 'sort',
          payload: { user_id: userId, ...payload },
        })
        .catch(() => {})
    },
    [userId, hasOtherViewers],
  )

  const applyLayoutPositions = useCallback(
    async (
      positions: LayoutPosition[],
      opts: { persist: boolean; mode?: BoardLayoutMode },
    ) => {
      if (positions.length === 0) return

      const layout = new Map<string, BoardNorm>()
      for (const p of positions) {
        layout.set(p.id, { wx: p.board_x, wy: p.board_y })
      }

      let gospel: GospelByPoiId = {}
      for (const [id, pos] of layout) {
        gospel = commitGospelEntry(gospel, id, pos.wx, pos.wy)
      }

      setSorting(true)
      setLayoutAnimating(true)
      setLayoutGospel(gospel)
      setPois((prev) =>
        prev.map((p) => {
          const pos = layout.get(p.id)
          return pos ? { ...p, board_x: pos.wx, board_y: pos.wy } : p
        }),
      )

      if (opts.persist && opts.mode) {
        broadcastSort({ mode: opts.mode, positions })
      }

      await new Promise((r) => window.setTimeout(r, BOARD_LAYOUT_ANIM_MS))

      if (opts.persist) {
        try {
          await bulkUpdatePoiPositions(listId, positions)
        } catch {
          setError('Failed to save board layout')
          setLayoutGospel({})
          setLayoutAnimating(false)
          setSorting(false)
          return
        }
      }

      setLayoutAnimating(false)
      setSorting(false)
      onAfterLayout?.()
    },
    [listId, setPois, setError, onAfterLayout, broadcastSort],
  )

  const applyBoardSort = useCallback(
    async (mode: BoardLayoutMode) => {
      if (sorting || isDragActive || poisRef.current.length === 0) return

      const layout = computeBoardLayout(poisRef.current, mode)
      if (layout.size === 0) return

      const positions = [...layout.entries()].map(([id, pos]) => ({
        id,
        board_x: pos.wx,
        board_y: pos.wy,
      }))

      await applyLayoutPositions(positions, { persist: true, mode })
    },
    [applyLayoutPositions, isDragActive, sorting],
  )

  const applyRemoteSortRef = useRef(applyLayoutPositions)
  applyRemoteSortRef.current = applyLayoutPositions

  useEffect(() => {
    if (!enabled || !userId) return

    const unsub = subscribeBoardSortBroadcast(listId, (payload) => {
      const senderId = payload.user_id
      if (!senderId || senderId === userId) return
      if (sortingRef.current || isDragActiveRef.current) return

      const positions = payload.positions?.filter(
        (p) =>
          p?.id &&
          typeof p.board_x === 'number' &&
          typeof p.board_y === 'number' &&
          p.board_x >= 0 &&
          p.board_x <= 1 &&
          p.board_y >= 0 &&
          p.board_y <= 1,
      )
      if (!positions?.length) return

      const known = new Set(poisRef.current.map((p) => p.id))
      const applicable = positions.filter((p) => known.has(p.id))
      if (applicable.length === 0) return

      void applyRemoteSortRef.current(applicable, { persist: false })
    })

    return unsub
  }, [listId, enabled, userId])

  const getLayoutGospel = useCallback(
    (poiId: string): BoardNorm | null => layoutGospel[poiId] ?? null,
    [layoutGospel],
  )

  return {
    applyBoardSort,
    layoutAnimating,
    sorting,
    getLayoutGospel,
  }
}
