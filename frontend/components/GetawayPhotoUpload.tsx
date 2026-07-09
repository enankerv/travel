'use client'

import { useRef, useState } from 'react'
import { uploadGetawayImages } from '@/lib/api'
import { useListDetailContextOptional } from '@/lib/ListDetailContext'

export default function GetawayPhotoUpload({
  getawayId,
  listId: listIdProp,
  onUploaded,
  disabled,
  className = 'getaway-photo-upload',
  label = 'Add photos',
}: {
  getawayId: string
  listId?: string
  onUploaded?: () => void | Promise<void>
  disabled?: boolean
  className?: string
  label?: string
}) {
  const ctx = useListDetailContextOptional()
  const listId = listIdProp ?? ctx?.list.id
  const refresh = onUploaded ?? ctx?.onRefresh
  const setError = ctx?.setError
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length || !listId) return
    setUploading(true)
    try {
      await uploadGetawayImages(listId, getawayId, Array.from(fileList))
      await refresh?.()
    } catch (err: unknown) {
      setError?.(err instanceof Error ? err.message : 'Failed to upload photos')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        className={className}
        disabled={disabled || uploading || !listId}
        title="Upload photos from your device"
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.click()
        }}
      >
        {uploading ? 'Uploading…' : label}
      </button>
    </>
  )
}
