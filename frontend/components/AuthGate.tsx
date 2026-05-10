'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import LoadingView from './LoadingView'
import AuthDeniedView from './AuthDeniedView'
import TermsConsentModal from './TermsConsentModal'

/**
 * Site-wide gate for privileged routes. Mounted once by `app/(authed)/layout.tsx`.
 * Handles: redirect to login, allowlist check, terms/age modal, denied views.
 * Children only render when status is 'ready'.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const redirectedRef = useRef(false)

  const { status, retry, markUnderage, markTermsAccepted } = useAuthBootstrap({
    user,
    authLoading: loading,
    signOut,
  })

  useEffect(() => {
    if (loading) return
    if (user) {
      redirectedRef.current = false
      return
    }
    if (redirectedRef.current) return
    redirectedRef.current = true

    const qs = searchParams.toString()
    const redirect = qs ? `${pathname}?${qs}` : pathname
    const isHome = redirect === '/' || redirect === ''
    const target = isHome
      ? '/auth/login'
      : `/auth/login?redirect=${encodeURIComponent(redirect)}`
    router.replace(target)
  }, [loading, user, router, pathname, searchParams])

  if (loading) return <LoadingView message="Checking session…" />
  if (!user) return <LoadingView message="Redirecting…" />

  if (status.kind === 'loading') return <LoadingView />

  if (status.kind === 'allowlist-denied') {
    return (
      <AuthDeniedView
        title="You're not on the invite list yet"
        message="This app is currently invite-only. Ask the owner to add your email."
        onAction={() => router.push('/auth/login')}
      />
    )
  }

  if (status.kind === 'underage-denied') {
    return (
      <AuthDeniedView
        title="You must be 16+ to use GetawayGather"
        message="GetawayGather requires users to be at least 16 years old."
        onAction={() => {
          void signOut()
          router.push('/auth/login')
        }}
      />
    )
  }

  if (status.kind === 'terms-needed') {
    return (
      <TermsConsentModal
        isReAccept={status.isReAccept}
        requiresAge={status.requiresAge}
        onAccepted={markTermsAccepted}
        onUnderAge={() => {
          markUnderage()
          void signOut()
        }}
      />
    )
  }

  if (status.kind === 'error') {
    return (
      <AuthDeniedView
        title="Something went wrong"
        message={status.message}
        buttonText="Try again"
        onAction={retry}
      />
    )
  }

  return <>{children}</>
}
