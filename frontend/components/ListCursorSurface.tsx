'use client'

import { PerfectCursor } from 'perfect-cursors'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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

const CURSOR_SURFACE = 'table' as const

type PeerPos = { nx: number; ny: number; ts: number }

function logCursor(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'development') return
  console.log('[list-cursor]', ...args)
}

function normToPx(
  surface: HTMLDivElement | null,
  nx: number,
  ny: number,
): [number, number] {
  if (!surface) return [0, 0]
  const { width, height } = surface.getBoundingClientRect()
  if (width <= 0 || height <= 0) return [0, 0]
  return [nx * width, ny * height]
}

/** Spline-smoothed peer pointer (perfect-cursors / tldraw-style). */
function PeerRemoteCursor({
  color,
  nx,
  ny,
  surfaceRef,
}: {
  color: string
  nx: number
  ny: number
  surfaceRef: RefObject<HTMLDivElement | null>
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pcRef = useRef<PerfectCursor | null>(null)
  const latestRef = useRef({ nx, ny })
  latestRef.current = { nx, ny }

  useEffect(() => {
    const svg = svgRef.current
    const surf = surfaceRef.current
    if (!svg || !surf) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const pc = new PerfectCursor((point: number[]) => {
      svg.style.transform = `translate(${point[0]}px, ${point[1]}px)`
    })
    pcRef.current = pc
    return () => {
      pc.dispose()
      pcRef.current = null
    }
  }, [surfaceRef])

  useEffect(() => {
    const svg = svgRef.current
    const surf = surfaceRef.current
    if (!svg || !surf) return
    const pt = normToPx(surf, nx, ny)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.style.transform = `translate(${pt[0]}px, ${pt[1]}px)`
      return
    }
    pcRef.current?.addPoint(pt)
  }, [nx, ny])

  useEffect(() => {
    const el = surfaceRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const { nx: nx1, ny: ny1 } = latestRef.current
      const pt = normToPx(el, nx1, ny1)
      const svg = svgRef.current
      if (!svg) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        svg.style.transform = `translate(${pt[0]}px, ${pt[1]}px)`
      } else {
        pcRef.current?.addPoint(pt)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [surfaceRef])

  return (
    <div className="list-cursor-peer">
      <svg
        ref={svgRef}
        className="list-cursor-peer__svg"
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
 * Wraps the list table; shared cursors use normalized coords vs this box (not used on map — pan/zoom/resizing).
 */
export default function ListCursorSurface({
  listId,
  enabled,
  otherViewers,
  children,
}: {
  listId: string
  enabled: boolean
  /** Presence peers (excluding self). Empty array gates outbound broadcasts and
   *  provides each peer's cursor_color so we don't re-hash the user id. */
  otherViewers: PresenceUser[]
  children: ReactNode
}) {
  const { user } = useAuth()
  const userId = user?.id
  const wrapRef = useRef<HTMLDivElement>(null)
  const [peers, setPeers] = useState<Record<string, PeerPos>>({})
  const lastSendRef = useRef(0)
  const lastClientRef = useRef<{ clientX: number; clientY: number } | null>(null)
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
      logCursor('recv raw', { listId, surface: CURSOR_SURFACE, payload })
      const pu = payload?.user_id
      const s = payload?.surface

      if (payload?.leave && pu) {
        if (pu === userId) return
        if (s !== CURSOR_SURFACE) return
        logCursor('recv leave', { peer: pu })
        setPeers((prev) => {
          if (!(pu in prev)) return prev
          const next = { ...prev }
          delete next[pu]
          return next
        })
        return
      }

      const nx = payload?.nx
      const ny = payload?.ny
      let skip: string | null = null
      if (!pu) skip = 'no user_id'
      else if (pu === userId) skip = 'self'
      else if (s !== CURSOR_SURFACE) skip = `surface mismatch (got ${String(s)}, want ${CURSOR_SURFACE})`
      else if (typeof nx !== 'number' || typeof ny !== 'number') skip = 'bad nx/ny'
      if (skip) {
        logCursor('recv skip', skip, payload)
        return
      }
      const peerId = pu as string
      const fnx = nx as number
      const fny = ny as number
      logCursor('recv apply', { peer: peerId, nx: fnx, ny: fny })
      setPeers((prev) => ({
        ...prev,
        [peerId]: { nx: fnx, ny: fny, ts: Date.now() },
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
    if (!ch || !userId) return
    if (!hasOtherViewers) return
    const payload: ListCursorBroadcastPayload = {
      user_id: userId,
      surface: CURSOR_SURFACE,
      leave: true,
    }
    logCursor('send leave', payload)
    void ch
      .send({
        type: 'broadcast',
        event: 'cursor',
        payload,
      })
      .catch((e: unknown) => {
        logCursor('send leave error', e)
      })
  }, [userId, hasOtherViewers])

  const send = useCallback(
    (nx: number, ny: number) => {
      const ch = channelRef.current
      if (!ch || !userId) return
      if (!hasOtherViewers) return
      const now = Date.now()
      if (now - lastSendRef.current < 120) return
      lastSendRef.current = now
      const payload = { user_id: userId, surface: CURSOR_SURFACE, nx, ny }
      logCursor('send', payload)
      void ch
        .send({
          type: 'broadcast',
          event: 'cursor',
          payload,
        })
        .then((res) => {
          logCursor('send response', res)
        })
        .catch((e: unknown) => {
          logCursor('send error', e)
        })
    },
    [userId, hasOtherViewers],
  )

  /* When the last other viewer leaves presence, drop any peer dots we still hold so
     we don't show stale pointers waiting for the 4.5s TTL sweep. */
  useEffect(() => {
    if (hasOtherViewers) return
    setPeers((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [hasOtherViewers])

  useEffect(() => {
    if (!enabled || !userId) return
    const root = wrapRef.current
    if (!root) return

    const pointerInsideSurface = (clientX: number, clientY: number) => {
      const r = root.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return false
      return (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      )
    }

    const clearIfLeftSurface = () => {
      const p = lastClientRef.current
      if (!p) return
      if (pointerInsideSurface(p.clientX, p.clientY)) return
      lastClientRef.current = null
      lastSendRef.current = 0
      sendLeave()
    }

    const onMove = (e: MouseEvent) => {
      if (!pointerInsideSurface(e.clientX, e.clientY)) {
        if (lastClientRef.current !== null) {
          lastClientRef.current = null
          lastSendRef.current = 0
          sendLeave()
        }
        return
      }
      lastClientRef.current = { clientX: e.clientX, clientY: e.clientY }
      const r = root.getBoundingClientRect()
      const nx = (e.clientX - r.left) / r.width
      const ny = (e.clientY - r.top) / r.height
      send(Math.min(1, Math.max(0, nx)), Math.min(1, Math.max(0, ny)))
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('scroll', clearIfLeftSurface, true)
    window.addEventListener('resize', clearIfLeftSurface)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', clearIfLeftSurface, true)
      window.removeEventListener('resize', clearIfLeftSurface)
    }
  }, [enabled, userId, send, sendLeave])

  return (
    <div className="list-cursor-surface" ref={wrapRef}>
      {children}
      <div className="list-cursor-surface__peers" aria-hidden>
        {Object.entries(peers).map(([id, pos]) => (
          <PeerRemoteCursor
            key={id}
            color={viewerColorById.get(id) ?? presenceColorForUserId(id)}
            nx={pos.nx}
            ny={pos.ny}
            surfaceRef={wrapRef}
          />
        ))}
      </div>
    </div>
  )
}
