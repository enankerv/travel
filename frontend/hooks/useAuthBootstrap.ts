'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { checkAccess, getMyProfile, acceptTerms } from '@/lib/api'
import { checkTermsFromProfile } from '@/lib/termsFromStorage'

export type GateStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'allowlist-denied' }
  | { kind: 'underage-denied' }
  | { kind: 'terms-needed'; isReAccept: boolean; requiresAge: boolean }
  | { kind: 'error'; message: string }

type UseAuthBootstrapParams = {
  user: { id: string } | null
  authLoading: boolean
  signOut: () => void | Promise<void>
}

/**
 * Single source of truth for "is the current user allowed to use the app?".
 * Runs allowlist check, fetches profile, and resolves terms/age status.
 * Pages should not call this directly — use the AuthGate / (authed) layout.
 */
export function useAuthBootstrap({
  user,
  authLoading,
  signOut,
}: UseAuthBootstrapParams) {
  const [status, setStatus] = useState<GateStatus>({ kind: 'loading' })
  const [retryEpoch, setRetryEpoch] = useState(0)
  const loadedRef = useRef<string | null>(null)

  // Stable refs so callers passing inline functions don't re-trigger the effect.
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut

  const retry = useCallback(() => {
    loadedRef.current = null
    setStatus({ kind: 'loading' })
    setRetryEpoch((n) => n + 1)
  }, [])

  const markUnderage = useCallback(() => {
    setStatus({ kind: 'underage-denied' })
  }, [])

  const markTermsAccepted = useCallback(() => {
    loadedRef.current = null
    setStatus({ kind: 'loading' })
    setRetryEpoch((n) => n + 1)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      loadedRef.current = null
      return
    }

    const key = `${user.id}:${retryEpoch}`
    if (loadedRef.current === key) return
    loadedRef.current = key

    let cancelled = false
    setStatus({ kind: 'loading' })

    async function run() {
      try {
        await checkAccess()
        if (cancelled) return

        const profile = await getMyProfile()
        if (cancelled) return

        const result = checkTermsFromProfile(profile || {})

        if (result.needsModal) {
          setStatus({
            kind: 'terms-needed',
            isReAccept: result.isReAccept,
            requiresAge: result.requiresAge,
          })
          return
        }

        if (result.acceptWithAge !== undefined) {
          await acceptTerms(result.acceptWithAge)
          if (cancelled) return
          if (typeof window !== 'undefined') {
            localStorage.removeItem('terms_consent_at')
            localStorage.removeItem('terms_consent_age')
          }
        } else if (result.acceptTermsOnly) {
          await acceptTerms()
          if (cancelled) return
          if (typeof window !== 'undefined') {
            localStorage.removeItem('terms_consent_at')
            localStorage.removeItem('terms_consent_age')
          }
        }

        if (cancelled) return
        setStatus({ kind: 'ready' })
      } catch (err: unknown) {
        if (cancelled) return
        const e = err as Error & { code?: string }
        if (e.code === 'NOT_ON_ALLOWLIST') {
          void signOutRef.current()
          setStatus({ kind: 'allowlist-denied' })
        } else {
          setStatus({ kind: 'error', message: 'Failed to load' })
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      // Allow Strict-Mode double-invoke (or unmount/remount) to retry from scratch.
      loadedRef.current = null
    }
  }, [user?.id, authLoading, retryEpoch])

  return { status, retry, markUnderage, markTermsAccepted }
}
