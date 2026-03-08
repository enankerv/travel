'use client'

import { useState, useEffect } from 'react'

export default function PasteModal({ isOpen, onClose, onSubmit, isLoading, initialText = '' }) {
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
        <p>Paste the villa listing text or HTML below. We'll extract the key information.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste villa listing text here..."
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
