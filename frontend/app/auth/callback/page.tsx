'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getSafeRedirectPath, POST_AUTH_REDIRECT_KEY } from '@/lib/safeRedirect'

export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const qs = new URLSearchParams(window.location.search)
          const nextFromUrl = qs.get('next')
          let target = '/'
          if (nextFromUrl != null && nextFromUrl !== '') {
            target = getSafeRedirectPath(nextFromUrl)
          } else {
            target = getSafeRedirectPath(sessionStorage.getItem(POST_AUTH_REDIRECT_KEY))
          }
          sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY)
          window.location.replace(`${window.location.origin}${target}`)
        } else {
          window.location.replace(`${window.location.origin}/auth/login`)
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        window.location.replace(`${window.location.origin}/auth/login`)
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Completing sign in...</p>
    </div>
  )
}
