import { TERMS_UPDATED_AT } from './constants'

const CONSENT_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

export type TermsCheckResult =
  | { needsModal: false; acceptWithAge?: number; acceptTermsOnly?: boolean }
  | { needsModal: true; isReAccept: boolean; requiresAge: boolean }

/**
 * Check if user needs to accept terms, and whether we can use recent localStorage consent.
 */
export function checkTermsFromProfile(profile: {
  terms_accepted_at?: string | null
  age_verified_at?: string | null
}): TermsCheckResult {
  const acceptedAt = profile?.terms_accepted_at
    ? new Date(profile.terms_accepted_at).getTime()
    : 0
  const termsUpdatedAt = new Date(TERMS_UPDATED_AT).getTime()
  const needsAcceptance = !profile?.terms_accepted_at || acceptedAt < termsUpdatedAt
  const needsAge = !profile?.age_verified_at

  if (!needsAcceptance) {
    return { needsModal: false }
  }

  if (typeof window === 'undefined') {
    return { needsModal: true, isReAccept: !!profile?.terms_accepted_at, requiresAge: needsAge }
  }

  const consentAt = localStorage.getItem('terms_consent_at')
  const consentAge = localStorage.getItem('terms_consent_age')
  if (!consentAt) {
    return { needsModal: true, isReAccept: !!profile?.terms_accepted_at, requiresAge: needsAge }
  }

  const consentTime = new Date(consentAt).getTime()
  const age = Date.now() - consentTime
  if (age >= CONSENT_MAX_AGE_MS || consentTime < termsUpdatedAt) {
    return { needsModal: true, isReAccept: !!profile?.terms_accepted_at, requiresAge: needsAge }
  }

  const ageNum = consentAge ? parseInt(consentAge, 10) : undefined
  if (needsAge && ageNum !== undefined && !isNaN(ageNum) && ageNum >= 16) {
    return { needsModal: false, acceptWithAge: ageNum }
  }
  if (!needsAge) {
    return { needsModal: false, acceptTermsOnly: true }
  }

  return { needsModal: true, isReAccept: !!profile?.terms_accepted_at, requiresAge: needsAge }
}
