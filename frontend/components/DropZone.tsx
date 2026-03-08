'use client'

import { useState } from 'react'

export default function DropZone({ onUrlSubmit, isLoading }) {
  const [url, setUrl] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const text = e.dataTransfer.getData('text/plain')
    if (text) {
      setUrl(text)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (url.trim()) {
      onUrlSubmit(url)
      setUrl('')
    }
  }

  return (
    <form
      className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste getaway listing URL here..."
        disabled={isLoading}
      />
      <span className="hint">or drag and drop</span>
      <button type="submit" disabled={isLoading || !url.trim()}>
        {isLoading ? 'Scouting...' : 'Scout'}
      </button>
    </form>
  )
}
