'use client'

import { PerfectCursor } from 'perfect-cursors'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { presenceColorForUserId } from '@/lib/presenceColors'
import {
  subscribeListCursorBroadcast,
  type ListCursorBroadcastPayload,
  type PresenceUser,
} from '@/lib/realtime'

const CURSOR_SURFACE = 'board' as const

export const BOARD_WORLD_W = 4000
export const BOARD_WORLD_H = 3000

type PeerPos = { wx: number; wy: number; ts: number }

export type BoardCamera = { x: number; y: number; scale: number }

function logCursor(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'development') return
  console.log('[board-cursor]', ...args)
}

export function screenToBoardNorm(
  viewport: HTMLDivElement,
  camera: BoardCamera,
  clientX: number,
  clientY: number,
): { wx: number; wy: number } | null {
  const r = viewport.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0 || camera.scale <= 0) return null
  const sx = clientX - r.left
  const sy = clientY - r.top
  const worldX = (sx - camera.x) / camera.scale
  const worldY = (sy - camera.y) / camera.scale
  return {
    wx: worldX / BOARD_WORLD_W,
    wy: worldY / BOARD_WORLD_H,
  }
}

/** Peer pointer rendered in board world space — scales with pan/zoom via parent transform. */
function BoardPeerCursor({
  color,
  wx,
  wy,
}: {
  color: string
  wx: number
  wy: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pcRef = useRef<PerfectCursor | null>(null)
  const latestRef = useRef({ wx, wy })
  latestRef.current = { wx, wy }

  const toPx = useCallback((nx: number, ny: number): [number, number] => {
    return [nx * BOARD_WORLD_W, ny * BOARD_WORLD_H]
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const pc = new PerfectCursor((point: number[]) => {
      svg.style.transform = `translate(${point[0]}px, ${point[1]}px)`
    })
    pcRef.current = pc
    return () => {
      pc.dispose()
      pcRef.current = null
    }
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const pt = toPx(wx, wy)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.style.transform = `translate(${pt[0]}px, ${pt[1]}px)`
      return
    }
    pcRef.current?.addPoint(pt)
  }, [wx, wy, toPx])

  return (
    <div className="board-cursor-peer">
      <svg
        ref={svgRef}
        className="board-cursor-peer__svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 35 35"
        fill="none"
        fillRule="evenodd"
        aria-hidden
      >
        <g fill="rgba(0,0,0,.2)" transform="translate(1,1)">
          <path d="m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z" />
          <path d="m21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z" />
        </g>
        <g fill="white">
          <path d="m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z" />
          <path d="m21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z" />
        </g>
        <g fill={color}>
          <path d="m19.751 24.4155-1.844.774-3.1-7.374 1.841-.775z" />
          <path d="m13 10.814v11.188l2.969-2.866.428-.139h4.768z" />
        </g>
      </svg>
    </div>
  )
}

/**
 * Broadcasts/receives cursors in normalized board world coords (wx/wy).
 * Peer cursors render inside the transformed world layer so they zoom with the board.
 */
export default function BoardCursorLayer({
  listId,
  enabled,
  otherViewers,
  viewportRef,
  cameraRef,
}: {
  listId: string
  enabled: boolean
  otherViewers: PresenceUser[]
  viewportRef: RefObject<HTMLDivElement | null>
  cameraRef: RefObject<BoardCamera>
}) {
  const { user } = useAuth()
  const userId = user?.id
  const [peers, setPeers] = useState<Record<string, PeerPos>>({})
  const lastSendRef = useRef(0)
  const lastInsideRef = useRef(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const hasOtherViewers = otherViewers.length > 0
  const viewerColorById = useMemo(() => {
    const m = new Map<string, string | undefined>()
    for (const v of otherViewers) m.set(v.user_id, v.cursor_color)
    return m
  }, [otherViewers])

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
    if (!enabled || !userId) return

    const unsub = subscribeListCursorBroadcast(listId, (payload: ListCursorBroadcastPayload) => {
      const pu = payload?.user_id
      const s = payload?.surface

      if (payload?.leave && pu) {
        if (pu === userId) return
        if (s !== CURSOR_SURFACE) return
        setPeers((prev) => {
          if (!(pu in prev)) return prev
          const next = { ...prev }
          delete next[pu]
          return next
        })
        return
      }

      const wx = payload?.wx
      const wy = payload?.wy
      if (
        !pu ||
        pu === userId ||
        s !== CURSOR_SURFACE ||
        typeof wx !== 'number' ||
        typeof wy !== 'number'
      ) {
        return
      }
      setPeers((prev) => ({
        ...prev,
        [pu]: { wx, wy, ts: Date.now() },
      }))
    })

    return unsub
  }, [listId, enabled, userId])

  useEffect(() => {
    if (!enabled || !userId) return
    const id = window.setInterval(() => {
      const now = Date.now()
      setPeers((prev) => {
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          if (now - next[k].ts > 4500) delete next[k]
        }
        return next
      })
    }, 1600)
    return () => window.clearInterval(id)
  }, [enabled, userId])

  const sendLeave = useCallback(() => {
    const ch = channelRef.current
    if (!ch || !userId || !hasOtherViewers) return
    const payload: ListCursorBroadcastPayload = {
      user_id: userId,
      surface: CURSOR_SURFACE,
      leave: true,
    }
    void ch.send({ type: 'broadcast', event: 'cursor', payload }).catch((e: unknown) => {
      logCursor('send leave error', e)
    })
  }, [userId, hasOtherViewers])

  const send = useCallback(
    (wx: number, wy: number) => {
      const ch = channelRef.current
      if (!ch || !userId || !hasOtherViewers) return
      const now = Date.now()
      if (now - lastSendRef.current < 120) return
      lastSendRef.current = now
      const payload: ListCursorBroadcastPayload = {
        user_id: userId,
        surface: CURSOR_SURFACE,
        wx,
        wy,
      }
      void ch.send({ type: 'broadcast', event: 'cursor', payload }).catch((e: unknown) => {
        logCursor('send error', e)
      })
    },
    [userId, hasOtherViewers],
  )

  useEffect(() => {
    if (hasOtherViewers) return
    setPeers((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [hasOtherViewers])

  useEffect(() => {
    if (!enabled || !userId) return

    const onMove = (e: MouseEvent) => {
      const vp = viewportRef.current
      if (!vp) return
      const norm = screenToBoardNorm(
        vp,
        cameraRef.current ?? { x: 0, y: 0, scale: 1 },
        e.clientX,
        e.clientY,
      )
      const inside =
        norm !== null &&
        norm.wx >= 0 &&
        norm.wx <= 1 &&
        norm.wy >= 0 &&
        norm.wy <= 1

      if (!inside) {
        if (lastInsideRef.current) {
          lastInsideRef.current = false
          lastSendRef.current = 0
          sendLeave()
        }
        return
      }

      lastInsideRef.current = true
      send(
        Math.min(1, Math.max(0, norm.wx)),
        Math.min(1, Math.max(0, norm.wy)),
      )
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (lastInsideRef.current) sendLeave()
      lastInsideRef.current = false
    }
  }, [enabled, userId, send, sendLeave, viewportRef, cameraRef])

  return (
    <>
      {Object.entries(peers).map(([id, pos]) => (
        <BoardPeerCursor
          key={id}
          color={viewerColorById.get(id) ?? presenceColorForUserId(id)}
          wx={pos.wx}
          wy={pos.wy}
        />
      ))}
    </>
  )
}
