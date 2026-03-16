'use client'

import { useState, useRef } from 'react'
import { LinkIcon, ScoutIcon } from '@/components/icons'

function looksLikeUrl(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.includes('\n') || t.length > 250) return false
  return /^https?:\/\/|^www\./i.test(t)
}

/** Extract first http(s) URL from text. */
function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i)
  if (!m) return null
  return m[0].replace(/[.,;:!?)]+$/, '')
}

interface DropZoneProps {
  onUrlSubmit: (url: string) => void
  onError?: (message: string) => void
  isLoading: boolean
}

export default function DropZone({ onUrlSubmit, onError, isLoading }: DropZoneProps) {
  const [url, setUrl] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    if (looksLikeUrl(trimmed)) {
      onUrlSubmit(trimmed)
      setUrl('')
    } else {
      const extracted = extractFirstUrl(trimmed)
      if (extracted) {
        onUrlSubmit(extracted)
        setUrl('')
      } else {
        onError?.('Paste a listing link directly.')
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const text = e.dataTransfer.getData('text/plain')
    if (text) {
      setUrl(text)
      inputRef.current?.focus()
    }
  }

  return (
    <form
      className={`dropzone ${isDragOver ? 'drag-over' : ''} ${isFocused ? 'focused' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onSubmit={handleSubmit}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="dropzone__input-wrap">
        <span className="dropzone__icon" aria-hidden>
          <LinkIcon size={20} />
        </span>
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Paste a listing URL..."
          disabled={isLoading}
          className="dropzone__input"
          aria-label="Listing URL"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !url.trim()}
        className="dropzone__submit"
        aria-label={isLoading ? 'Scouting in progress' : 'Scout this listing'}
      >
        {isLoading ? (
          <span className="dropzone__submit-text">
            <span className="dropzone__spinner" aria-hidden />
            Scouting...
          </span>
        ) : (
          <>
            <ScoutIcon size={18} />
            <span>Scout</span>
          </>
        )}
      </button>
    </form>
  )
}
