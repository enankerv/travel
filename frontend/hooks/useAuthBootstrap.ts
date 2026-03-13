'use client'

import { useEffect, useRef } from 'react'
import { checkAccess, getMyProfile, acceptTerms } from '@/lib/api'
import { checkTermsFromProfile } from '@/lib/termsFromStorage'

type UseAuthBootstrapParams = {
  user: { id: string } | null
  authLoading: boolean
  signOut: () => void
  allowlistDenied: boolean
  underAgeDenied: boolean
  onReady: () => void | Promise<void>
  onTermsNeeded: (opts: { isReAccept: boolean; requiresAge: boolean }) => void
  onAllowlistDenied: () => void
  onUnderAgeDenied: () => void
  onError: (msg: string) => void
  onLoadingChange: (loading: boolean) => void
}

export function useAuthBootstrap({
  user,
  authLoading,
  signOut,
  allowlistDenied,
  underAgeDenied,
  onReady,
  onTermsNeeded,
  onAllowlistDenied,
  onUnderAgeDenied,
  onError,
  onLoadingChange,
}: UseAuthBootstrapParams) {
  const loadedForUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      loadedForUserIdRef.current = null
      return
    }
    if (allowlistDenied || underAgeDenied) return

    if (loadedForUserIdRef.current === user.id) return
    loadedForUserIdRef.current = user.id

    onLoadingChange(true)
    checkAccess()
      .then(() => getMyProfile())
      .then(async (profile) => {
        const result = checkTermsFromProfile(profile || {})

        if (result.needsModal) {
          onTermsNeeded({
            isReAccept: result.isReAccept,
            requiresAge: result.requiresAge,
          })
          onLoadingChange(false)
          return
        }

        if (result.acceptWithAge !== undefined) {
          await acceptTerms(result.acceptWithAge)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('terms_consent_at')
            localStorage.removeItem('terms_consent_age')
          }
        } else if (result.acceptTermsOnly) {
          await acceptTerms()
          if (typeof window !== 'undefined') {
            localStorage.removeItem('terms_consent_at')
            localStorage.removeItem('terms_consent_age')
          }
        }

        await onReady()
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === 'NOT_ON_ALLOWLIST') {
          signOut()
          onAllowlistDenied()
        } else {
          onError('Failed to load')
        }
        onLoadingChange(false)
      })
  }, [
    user?.id,
    allowlistDenied,
    underAgeDenied,
    onReady,
    onTermsNeeded,
    onAllowlistDenied,
    onUnderAgeDenied,
    onError,
    onLoadingChange,
    signOut,
  ])
}
