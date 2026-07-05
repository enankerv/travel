'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyBoardRedirect({ params }: { params: { listId: string } }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/list/${params.listId}/board`)
  }, [params.listId, router])

  return null
}
