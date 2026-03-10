'use client'

import { useState, useEffect } from 'react'

interface PasteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (text: string) => void
  isLoading: boolean
  initialText?: string
}

const JUNK = ['favicon', 'icon', 'logo', 'avatar', 'badge', 'pixel', '1x1', 'tracking', 'placeholder', '/user/', 'profile_pic', 'airbnb-logo']

function extractImageUrlsFromHtml(html: string): string[] {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const imgs = [...doc.querySelectorAll('img[src]')]
    const seen = new Set<string>()
    const urls: string[] = []
    for (const img of imgs) {
      const src = img.getAttribute('src') || ''
      if (!src.startsWith('http')) continue
      const low = src.toLowerCase()
      if (JUNK.some((w) => low.includes(w))) continue
      if (/\.svg|\.gif/i.test(src)) continue
      const isAirbnb = low.includes('muscache.com') && low.includes('/im/pictures/')
      if (low.includes('muscache.com') && !isAirbnb) continue
      const key = src.replace(/[-_]\d+x\d+/g, '')
      if (seen.has(key)) continue
      seen.add(key)
      if (isAirbnb || /\.(jpe?g|png|webp)/i.test(src)) {
        urls.push(src)
      }
      if (urls.length >= 10) break
    }
    return urls
  } catch {
    return []
  }
}

export default function PasteModal({ isOpen, onClose, onSubmit, isLoading, initialText = '' }: PasteModalProps) {
  const [text, setText] = useState(initialText)
  const [extractedImages, setExtractedImages] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setText(initialText)
      setExtractedImages([])
    }
  }, [isOpen, initialText])

  const handlePaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html')
    if (html) {
      const urls = extractImageUrlsFromHtml(html)
      if (urls.length > 0) {
        setExtractedImages(urls)
      }
    }
  }

  const handleSubmit = () => {
    if (text.trim()) {
      let payload = text.trim()
      if (extractedImages.length > 0) {
        payload += '\n\n' + extractedImages.join('\n')
      }
      onSubmit(payload)
      setText('')
      setExtractedImages([])
    }
  }

  const handleClose = () => {
    setText('')
    setExtractedImages([])
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
          onPaste={handlePaste}
          placeholder="Paste getaway listing text here..."
          disabled={isLoading}
        />
        {extractedImages.length > 0 && (
          <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: 'var(--green)' }}>
            {extractedImages.length} photo{extractedImages.length !== 1 ? 's' : ''} detected from clipboard
          </p>
        )}
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
