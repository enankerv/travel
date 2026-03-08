'use client'

import { useState, useEffect } from 'react'

interface PasteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (text: string) => void
  isLoading: boolean
  initialText?: string
}

export default function PasteModal({ isOpen, onClose, onSubmit, isLoading, initialText = '' }: PasteModalProps) {
  const [text, setText] = useState(initialText)

  useEffect(() => {
    if (isOpen) setText(initialText)
  }, [isOpen, initialText])

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text)
      setText('')
    }
  }

  const handleClose = () => {
    setText('')
    onClose()
  }

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`}>
      <div className="modal">
        <h2>Paste Listing Details</h2>
        <p>Paste the getaway listing text or HTML below. We'll extract the key information.</p>
        <textarea
          value={text}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
          placeholder="Paste getaway listing text here..."
          disabled={isLoading}
        />
        <div className="modal-actions">
          <button
            className="btn-cancel"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? 'Processing...' : 'Process'}
          </button>
        </div>
      </div>
    </div>
  )
}
