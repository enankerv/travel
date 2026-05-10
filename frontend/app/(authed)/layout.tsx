'use client'

import { Suspense } from 'react'
import AuthGate from '@/components/AuthGate'
import LoadingView from '@/components/LoadingView'

/**
 * Privileged route group. Any page placed under `app/(authed)/` is only rendered
 * after the user is signed in, on the allowlist, age-verified, and has accepted
 * the current Terms. The URL is unchanged by this group (e.g. `(authed)/page.tsx`
 * still serves `/`).
 */
export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<LoadingView message="Checking session…" />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  )
}
