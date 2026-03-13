'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { GoogleIcon } from '@/components/icons'

export default function OAuthConsent() {
  const router = useRouter()
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAccept() {
    setError('')
    setLoading(true)
    try {
      const { data, error } = await signInWithGoogle()
      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
        return
      }
      throw new Error('No redirect URL received')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <span className="auth-tag">GetawayGather</span>
      <h1>Sign in with Google</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        GetawayGather will access the following information from your Google account:
      </p>
      <ul className="oauth-consent-list">
        <li>Email address</li>
        <li>Name and profile picture</li>
      </ul>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        We use this to create your account and personalize your experience. See our{' '}
        <Link href="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</Link> for details.
      </p>

      {error && <div className="auth-error">{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading}
          className="auth-google"
        >
          {loading ? (
            'Signing in...'
          ) : (
            <>
              <GoogleIcon size={18} />
              Continue with Google
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push('/auth/login')}
          disabled={loading}
          className="auth-cancel"
        >
          Cancel
        </button>
      </div>

      <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
        <Link href="/auth/login">Back to login</Link>
      </p>
    </div>
  )
}
