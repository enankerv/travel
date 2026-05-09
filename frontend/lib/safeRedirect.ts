/** Internal path + optional query only. Strips #fragments so Next/router never interprets '#' as routing. */
export function getSafeRedirectPath(candidate: string | null | undefined, fallback = '/'): string {
  if (candidate === null || candidate === undefined) return fallback
  let s = candidate.trim()
  const hashIdx = s.indexOf('#')
  if (hashIdx !== -1) s = s.slice(0, hashIdx).trim()
  if (!s.startsWith('/') || s.startsWith('//')) return fallback
  if (/[\n\r]/u.test(s)) return fallback
  try {
    const u = new URL(s, 'http://localhost')
    if (u.hostname !== 'localhost') return fallback
    const out = (u.pathname + u.search) || fallback
    if (!out.startsWith('/') || out.startsWith('//')) return fallback
    return out
  } catch {
    return fallback
  }
}

export const POST_AUTH_REDIRECT_KEY = 'post_auth_redirect'

/**
 * Supabase PKCE cleanup + Next client navigation can leave `http://localhost:3000/#` (path + bare `#`).
 * Only repairs the empty-fragment case so real hashes like `#section` stay intact.
 */
export function repairHistoryBareHashSuffix() {
  if (typeof window === 'undefined') return
  const { origin, pathname, search, href } = window.location
  const canonical = `${origin}${pathname}${search}`
  if (href === `${canonical}#`) {
    window.history.replaceState(window.history.state, '', canonical)
  }
}

/** Set the visible URL to path+query on this origin (drops any fragment). */
export function replaceBrowserPathStripHash(path: string) {
  if (typeof window === 'undefined') return
  const p = (path.startsWith('/') ? path : `/${path}`) || '/'
  window.history.replaceState(window.history.state, '', `${window.location.origin}${p}`)
}
