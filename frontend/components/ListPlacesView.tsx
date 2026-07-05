'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useListDetailContext } from '@/lib/ListDetailContext'
import { useListScreenShell } from '@/lib/ListScreenShellContext'
import ListGetawaysTab from './ListGetawaysTab'

export default function ListPlacesView({
  viewMode,
}: {
  viewMode: 'table' | 'map'
}) {
  const searchParams = useSearchParams()
  const { setError, error } = useListDetailContext()
  const { setChromeFooter } = useListScreenShell()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [focusedGetawayId, setFocusedGetawayId] = useState<string | null>(null)

  return (
    <>
      {error && (
        <div
          className="list-villas-tab__error"
          style={{ margin: '1rem 2rem 0' }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="list-villas-tab__error-dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <ListGetawaysTab
        viewMode={viewMode}
        pasteParam={searchParams.get('paste')}
        urlParam={searchParams.get('url')}
        commentsOpen={commentsOpen}
        onCommentsOpenChange={setCommentsOpen}
        focusedGetawayId={focusedGetawayId}
        onFocusedGetawayChange={setFocusedGetawayId}
        onStickyContent={setChromeFooter}
      />
    </>
  )
}
