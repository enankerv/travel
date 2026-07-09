'use client'

import { useCallback, useState } from 'react'
import { scoutUrl } from '@/lib/api'
import {
  dispatchScoutOptimisticDecrement,
  dispatchScoutOptimisticRefund,
} from '@/components/ScoutCredits'
import { tryShowScoutNotification } from '@/lib/scoutNotifications'

export function useScoutUrl(
  listId: string,
  {
    setError,
  }: {
    setError?: (message: string) => void
  } = {},
) {
  const [scoutLoading, setScoutLoading] = useState(false)
  const [lastFailedUrl, setLastFailedUrl] = useState('')

  const handleScoutUrl = useCallback(
    async (url: string, getawayId?: string) => {
      setError?.('')
      setLastFailedUrl('')
      setScoutLoading(true)
      dispatchScoutOptimisticDecrement()
      try {
        const result = await scoutUrl(url, listId, getawayId)
        if (result.ok) {
          if (result.thin_scrape) {
            dispatchScoutOptimisticRefund()
            tryShowScoutNotification('Credit refunded', {
              body: 'Credit refunded for thin scrape.',
              icon: '↩️',
            })
          }
          tryShowScoutNotification('Scouting...', {
            body: 'Processing listing...',
            icon: '⏳',
          })
        } else {
          setLastFailedUrl(url)
          const message = result.error || 'Failed to scout getaway'
          setError?.(message)
          tryShowScoutNotification('Scouting Failed', {
            body: message,
            icon: '✕',
          })
        }
      } catch (err: unknown) {
        dispatchScoutOptimisticRefund()
        setLastFailedUrl(url)
        const message =
          err instanceof Error ? err.message : 'Failed to scout getaway'
        setError?.(message)
        tryShowScoutNotification('Error', {
          body: message,
          icon: '✕',
        })
      } finally {
        setScoutLoading(false)
      }
    },
    [listId, setError],
  )

  return { scoutLoading, lastFailedUrl, setLastFailedUrl, handleScoutUrl }
}
