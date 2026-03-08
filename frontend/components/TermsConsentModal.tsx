'use client'

import { useState } from 'react'
import Link from 'next/link'
import { acceptTerms } from '@/lib/api'

function getAgeFromDOB(dobStr: string): number | undefined {
  const dob = new Date(dobStr)
  if (isNaN(dob.getTime())) return undefined
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export default function TermsConsentModal({
  isReAccept,
  requiresAge,
  onAccepted,
  onUnderAge,
}: {
  isReAccept?: boolean
  requiresAge?: boolean
  onAccepted: () => void
  onUnderAge?: () => void
}) {
  const [agreed, setAgreed] = useState(false)
  const [dob, setDob] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ageFromDob = dob.trim() ? getAgeFromDOB(dob) : undefined
  const ageValid = ageFromDob !== undefined && ageFromDob >= 16
  const canSubmit = agreed && (!requiresAge || ageValid)

  async function handleAccept() {
    if (!canSubmit) return
    if (requiresAge && (ageFromDob === undefined || ageFromDob < 16)) {
      setError('You must be at least 16 to use this service.')
      onUnderAge?.()
      return
    }
    setLoading(true)
    setError('')
    try {
      await acceptTerms(requiresAge ? ageFromDob : undefined)
      onAccepted()
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('16')) {
        onUnderAge?.()
      }
      setError(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          maxWidth: 480,
          width: '100%',
          padding: '2rem',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
          {isReAccept ? 'Terms Updated' : 'Agree to Terms'}
        </h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          {isReAccept ? (
            <>
              Our Terms of Service and Privacy Policy have been updated. Please review the{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms</Link> and{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> and accept to continue.
            </>
          ) : (
            <>
              To use GetawayGather, you must be at least 16 years old and agree to our{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
              .
            </>
          )}
        </p>

        {requiresAge && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="dob" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--light)', fontSize: '0.9rem' }}>
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => {
                setDob(e.target.value)
                setError('')
              }}
              max={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: '0.6rem',
                background: 'var(--dark-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                color: 'var(--light)',
                fontSize: '1rem',
              }}
            />
            {ageFromDob !== undefined && ageFromDob < 16 && (
              <p style={{ marginTop: '0.5rem', color: 'var(--red)', fontSize: '0.85rem' }}>
                You must be at least 16 to use GetawayGather.
              </p>
            )}
          </div>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            cursor: 'pointer',
            marginBottom: '1.5rem',
            color: 'var(--light)',
            fontSize: '0.9rem',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--accent)' }}
          />
          <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
        </label>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--red-soft)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {requiresAge && (
          <button
            type="button"
            onClick={() => onUnderAge?.()}
            style={{
              width: '100%',
              background: 'transparent',
              color: 'var(--muted)',
              border: 'none',
              padding: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              marginBottom: '0.5rem',
            }}
          >
            I&apos;m under 16
          </button>
        )}

        <button
          onClick={handleAccept}
          disabled={!canSubmit || loading}
          style={{
            width: '100%',
            background: canSubmit ? 'var(--accent)' : 'var(--border)',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: '1rem',
          }}
        >
          {loading ? 'Saving...' : 'I Agree'}
        </button>
      </div>
    </div>
  )
}
