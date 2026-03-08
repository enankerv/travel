import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Base URL for OAuth redirects. Set NEXT_PUBLIC_SITE_URL in production (e.g. https://yourapp.com) so OAuth redirects back to your deployed app instead of localhost. */
function getRedirectBase(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) return siteUrl.replace(/\/$/, '') // prefer env when set (production)
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getRedirectBase()}/auth/callback`,
    },
  })
  return { data, error }
}

export async function signInWithGithub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${getRedirectBase()}/auth/callback`,
    },
  })
  return { data, error }
}
