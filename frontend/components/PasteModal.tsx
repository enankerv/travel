'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'

const THIN_WORD_THRESHOLD = 40

function isThinPaste(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length < THIN_WORD_THRESHOLD
}

interface PasteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (text: string) => void
  isLoading: boolean
  initialText?: string
  /** When set (e.g. thin scrape), show a link to open the listing in a new tab */
  listingUrl?: string | null
  /** When true, show a "Paste from clipboard" button (e.g. opened from bookmarklet) */
  fromBookmarklet?: boolean
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

export default function PasteModal({ isOpen, onClose, onSubmit, isLoading, initialText = '', listingUrl, fromBookmarklet }: PasteModalProps) {
  const [text, setText] = useState(initialText)
  const [extractedImages, setExtractedImages] = useState<string[]>([])
  const [hasTyped, setHasTyped] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setText(initialText)
      setExtractedImages([])
      setHasTyped(false)
    }
  }, [isOpen, initialText])

  const trimmed = text.trim()
  const isThin = listingUrl && isThinPaste(trimmed)
  const canSubmit = trimmed.length > 0 && !isThin
  const showThinWarning = isThin && hasTyped

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasTyped(true)
    setText(e.target.value)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    setHasTyped(true)
    const html = e.clipboardData.getData('text/html')
    if (html) {
      const urls = extractImageUrlsFromHtml(html)
      if (urls.length > 0) {
        setExtractedImages(urls)
      }
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) {
        setText(clip)
        setHasTyped(true)
      }
    } catch {
      // Clipboard API may be blocked; user can paste manually
    }
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    let payload = trimmed
    if (extractedImages.length > 0) {
      payload += '\n\n' + extractedImages.join('\n')
    }
    onSubmit(payload)
    setText('')
    setExtractedImages([])
  }

  const handleClose = () => {
    setText('')
    setExtractedImages([])
    onClose()
  }

  return (
    <Modal open={isOpen} onClose={handleClose}>
        <h2 style={{ color: 'var(--light)' }}>Paste Listing Details</h2>
        {listingUrl ? (
          <>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--light)' }}>Copy the full listing page:</p>
            <ol style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--light)' }}>
              <li>
                <a
                  href={listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontWeight: 500 }}
                >
                  Open the listing
                </a>
              </li>
              <li>Select all: <kbd>Ctrl+A</kbd> (Windows) or <kbd>⌘A</kbd> (Mac)</li>
              <li>Copy: <kbd>Ctrl+C</kbd> (Windows) or <kbd>⌘C</kbd> (Mac)</li>
              <li>Paste in the box below</li>
            </ol>
          </>
        ) : (
          <p style={{ color: 'var(--light)' }}>
            {fromBookmarklet
              ? 'Paste the page content below (or use the button).'
              : 'Paste the getaway listing text or HTML below. We\'ll extract the key information.'}
          </p>
        )}
        {fromBookmarklet && (
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="btn-primary"
            style={{ marginBottom: '1rem' }}
          >
            Paste from clipboard
          </button>
        )}
        <textarea
          value={text}
          onChange={handleInputChange}
          onPaste={handlePaste}
          placeholder="Paste getaway listing text here..."
          disabled={isLoading}
        />
        {extractedImages.length > 0 && (
          <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: 'var(--green)' }}>
            {extractedImages.length} photo{extractedImages.length !== 1 ? 's' : ''} detected from clipboard
          </p>
        )}
        {showThinWarning && (
          <div
            role="alert"
            style={{
              margin: '1rem 0 0',
              padding: '1rem',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: '8px',
              color: 'var(--light)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
            }}
          >
            <p style={{ margin: 0, color: 'var(--light)' }}>
              Not enough text. Follow the steps above to copy the full page, then paste again.
            </p>
          </div>
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
            disabled={isLoading || !canSubmit}
          >
            {isLoading ? 'Processing...' : 'Process'}
          </button>
        </div>
    </Modal>
  )
}
