'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase will handle the callback automatically
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.push('/lists')
        } else {
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/auth/login')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Completing sign in...</p>
    </div>
  )
}
