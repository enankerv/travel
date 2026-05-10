import { TERMS_UPDATED_AT } from './constants'

const CONSENT_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

export type TermsCheckResult =
  | { needsModal: false; acceptWithAge?: number; acceptTermsOnly?: boolean }
  | { needsModal: true; isReAccept: boolean; requiresAge: boolean }

/**
 * Decide whether the gate must show the Terms / age modal, taking a recent
 * localStorage consent into account so we don't re-prompt within 10 minutes.
 *
 * The user must have BOTH: a fresh terms acceptance (>= TERMS_UPDATED_AT) AND
 * an `age_verified_at`. Either being missing means we need a modal (or a silent
 * accept if localStorage has a usable consent).
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

  if (!needsAcceptance && !needsAge) {
    return { needsModal: false }
  }

  const modalResult: TermsCheckResult = {
    needsModal: true,
    /* "Terms Updated" copy only when the user previously accepted but the
       version is now stale. Missing-age-only goes through the normal copy. */
    isReAccept: !!profile?.terms_accepted_at && needsAcceptance,
    requiresAge: needsAge,
  }

  if (typeof window === 'undefined') {
    return modalResult
  }

  const consentAt = localStorage.getItem('terms_consent_at')
  const consentAge = localStorage.getItem('terms_consent_age')
  if (!consentAt) {
    return modalResult
  }

  const consentTime = new Date(consentAt).getTime()
  const age = Date.now() - consentTime
  const consentFresh = age < CONSENT_MAX_AGE_MS && consentTime >= termsUpdatedAt
  if (!consentFresh) {
    return modalResult
  }

  const ageNum = consentAge ? parseInt(consentAge, 10) : undefined
  const ageOk = ageNum !== undefined && !isNaN(ageNum) && ageNum >= 16

  if (needsAge) {
    if (ageOk) {
      return { needsModal: false, acceptWithAge: ageNum }
    }
    return modalResult
  }

  return { needsModal: false, acceptTermsOnly: true }
}
