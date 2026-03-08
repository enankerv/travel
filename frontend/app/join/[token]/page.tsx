'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import { getInviteDetails, acceptInvite } from '@/lib/api'

export default function JoinPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [invite, setInvite] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/join/${token}`)
      return
    }

    if (user && token) {
      loadInvite()
    }
  }, [user, loading, token, router])

  async function loadInvite() {
    try {
      const inviteData = await getInviteDetails(token)
      setInvite(inviteData)
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invite link')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAcceptInvite() {
    setJoining(true)
    try {
      await acceptInvite(token)
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Failed to join list')
    } finally {
      setJoining(false)
    }
  }

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Invalid Invite</h1>
          <p className="text-gray-400 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  if (!user || !invite) return null

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2">You're invited!</h1>
        <p className="text-gray-400 mb-4">
          Join <span className="text-orange-500 font-semibold">{invite.list_name}</span> as an{' '}
          <span className="text-green-500 font-semibold">{invite.role}</span>
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleAcceptInvite}
          disabled={joining}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
        >
          {joining ? 'Joining...' : 'Join List'}
        </button>
      </div>
    </div>
  )
}
