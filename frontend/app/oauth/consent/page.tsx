import { Suspense } from 'react'
import OAuthConsent from '@/components/auth/OAuthConsent'

export default function OAuthConsentPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div className="auth-page">Loading...</div>}>
        <OAuthConsent />
      </Suspense>
    </div>
  )
}
