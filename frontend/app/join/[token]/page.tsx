'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import { getInviteDetails, acceptInvite, checkAccess } from '@/lib/api'

export default function JoinPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [allowlistDenied, setAllowlistDenied] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/join/${token}`)
      return
    }

    if (user && token && !allowlistDenied) {
      checkAccess()
        .then(() => acceptAndOpen())
        .catch((err: Error & { code?: string }) => {
          if (err.code === 'NOT_ON_ALLOWLIST') {
            setAllowlistDenied(true)
            signOut()
          } else {
            setError(err.message || 'Invalid or expired invite link')
          }
          setIsLoading(false)
        })
    }
  }, [user, loading, token, router, allowlistDenied])

  async function acceptAndOpen() {
    try {
      const invite = await getInviteDetails(token)
      await acceptInvite(token)
      router.push(`/?list=${invite.list_id}`)
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invite link')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (allowlistDenied) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re not on the invite list yet</h1>
          <p className="text-gray-400 mb-4">This app is currently invite-only. Ask the owner to add your email.</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Invalid Invite</h1>
          <p className="text-gray-400 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  return null
}
