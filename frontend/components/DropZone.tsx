'use client'

import { useState, useRef } from 'react'
import { LinkIcon, ScoutIcon } from '@/components/icons'

interface DropZoneProps {
  onUrlSubmit: (url: string) => void
  isLoading: boolean
}

export default function DropZone({ onUrlSubmit, isLoading }: DropZoneProps) {
  const [url, setUrl] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      onUrlSubmit(url)
      setUrl('')
    }
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <form
      className={`dropzone ${isDragOver ? 'drag-over' : ''} ${isFocused ? 'focused' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onSubmit={handleSubmit}
      onClick={handleContainerClick}
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
          placeholder="Paste a listing URL from Airbnb, VRBO, or any rental site..."
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
      <span className="dropzone__hint">or drag a link here</span>
    </form>
  )
}
