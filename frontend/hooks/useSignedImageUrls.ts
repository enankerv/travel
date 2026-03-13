'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const BUCKET = 'getaway-images'
const EXPIRE_SEC = 3600

function isStoragePath(url: string): boolean {
  if (!url || url.startsWith('http') || url.startsWith('/images/')) return false
  return url.includes('/')  // e.g. getaway_id/00.jpg
}

/** Sign storage paths to signed URLs; pass through http URLs as-is. Preserves order. */
export function useSignedImageUrls(images: string[] | null | undefined): string[] {
  const [signed, setSigned] = useState<string[]>([])

  useEffect(() => {
    if (!images || images.length === 0) {
      setSigned([])
      return
    }

    const pathsToSign = images.filter(isStoragePath)
    if (pathsToSign.length === 0) {
      setSigned(images.filter((u) => u.startsWith('http')))
      return
    }

    supabase.storage
      .from(BUCKET)
      .createSignedUrls(pathsToSign, EXPIRE_SEC)
      .then(({ data, error }) => {
        if (error) {
          setSigned(images.filter((u) => u.startsWith('http')))
          return
        }
        const signedMap = new Map<string, string>()
        ;(data || []).forEach((d: { path?: string | null; signedUrl?: string }, i: number) => {
          const path = pathsToSign[i]
          const url = d?.signedUrl
          if (path && url) signedMap.set(path, url)
        })
        const result = images.map((img) =>
          img.startsWith('http') ? img : signedMap.get(img) ?? ''
        ).filter(Boolean)
        setSigned(result)
      })
      .catch(() => setSigned(images.filter((u) => u.startsWith('http'))))
  }, [images?.join(',')])

  return signed
}
