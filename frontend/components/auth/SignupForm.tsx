'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GoogleIcon } from '@/components/icons'

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
        <GoogleIcon size={18} />
        Google
      </button>

      <p className="auth-footer">
        Already have an account? <Link href="/auth/login">Log in</Link>
      </p>
    </div>
  )
}
