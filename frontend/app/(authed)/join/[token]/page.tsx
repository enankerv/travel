'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getInviteDetails, acceptInvite } from '@/lib/api'
import LoadingView from '@/components/LoadingView'
import AuthDeniedView from '@/components/AuthDeniedView'

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const token = typeof params.token === 'string' ? params.token : ''

  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link')
      return
    }

    let cancelled = false
    async function run() {
      try {
        const invite = await getInviteDetails(token)
        if (cancelled) return
        await acceptInvite(token)
        if (cancelled) return
        router.replace(`/?list=${invite.list_id}`)
      } catch (err: unknown) {
        if (cancelled) return
        const e = err as Error
        setError(e.message || 'Invalid or expired invite link')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [token, router, retryCount])

  if (error) {
    return (
      <AuthDeniedView
        title="Invalid Invite"
        message={error}
        buttonText="Try again"
        onAction={() => {
          setError('')
          setRetryCount((c) => c + 1)
        }}
      />
    )
  }

  return <LoadingView message="Joining list…" />
}
