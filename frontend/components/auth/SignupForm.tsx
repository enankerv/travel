'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TERMS_CONSENT_KEY = 'terms_consent_at'
const TERMS_CONSENT_AGE_KEY = 'terms_consent_age'

function getAgeFromDOB(dobStr: string): number | undefined {
  const dob = new Date(dobStr)
  if (isNaN(dob.getTime())) return undefined
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function recordTermsConsent(age: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TERMS_CONSENT_KEY, new Date().toISOString())
    localStorage.setItem(TERMS_CONSENT_AGE_KEY, String(age))
  }
}

export default function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dob, setDob] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signUp, signInWithGoogle } = useAuth()
  const router = useRouter()

  const ageFromDob = dob.trim() ? getAgeFromDOB(dob) : undefined
  const ageValid = ageFromDob !== undefined && ageFromDob >= 16
  const canSubmit = agreedToTerms && ageValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || ageFromDob === undefined || ageFromDob < 16) return
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    recordTermsConsent(ageFromDob)
    try {
      const { error } = await signUp(email, password)
      if (error) throw error
      router.push('/auth/login?message=Check+your+email+to+confirm')
    } catch (err: any) {
      setError(err.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    if (!canSubmit || ageFromDob === undefined || ageFromDob < 16) return
    setError('')
    setLoading(true)
    recordTermsConsent(ageFromDob)
    try {
      const { error } = await signInWithGoogle()
      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google')
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <span className="auth-tag">Travel Scout</span>
      <h1>Create Account</h1>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirm">Confirm Password</label>
          <input
            id="confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="dob">Date of birth</label>
          <input
            id="dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
            max={new Date().toISOString().split('T')[0]}
            style={{ maxWidth: '100%' }}
          />
          {ageFromDob !== undefined && ageFromDob < 16 && (
            <p style={{ marginTop: '0.25rem', color: 'var(--red)', fontSize: '0.85rem' }}>You must be at least 16 to sign up.</p>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--light)' }}>
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--accent)' }}
          />
          <span>I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link></span>
        </label>

        <button type="submit" className="auth-submit" disabled={loading || !canSubmit}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div className="auth-divider">
        <span>Or sign up with</span>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={loading || !canSubmit}
        className="auth-google"
      >
        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Google
      </button>

      <p className="auth-footer">
        Already have an account? <Link href="/auth/login">Log in</Link>
      </p>
    </div>
  )
}
