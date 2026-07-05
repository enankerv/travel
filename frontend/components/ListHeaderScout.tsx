'use client'

import { useState } from 'react'
import { useListScreenShell } from '@/lib/ListScreenShellContext'
import { useScoutUrl } from '@/hooks/useScoutUrl'
import DropZone from './DropZone'

export default function ListHeaderScout() {
  const { listId } = useListScreenShell()
  const [error, setError] = useState('')
  const { scoutLoading, handleScoutUrl } = useScoutUrl(listId, { setError })

  return (
    <div className="list-header-scout">
      <DropZone
        onUrlSubmit={handleScoutUrl}
        onError={setError}
        isLoading={scoutLoading}
      />
      {error && (
        <p className="list-header-scout__error" role="alert">
          {error}
          <button
            type="button"
            className="list-header-scout__error-dismiss"
            onClick={() => setError('')}
            aria-label="Dismiss"
          >
            ×
          </button>
        </p>
      )}
    </div>
  )
}
