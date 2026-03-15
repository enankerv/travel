'use client'

import Modal from './Modal'
import PasteFormContent from './PasteFormContent'

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

export default function PasteModal({ isOpen, onClose, onSubmit, isLoading, initialText = '', listingUrl, fromBookmarklet }: PasteModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose}>
      <h2 style={{ color: 'var(--light)' }}>Paste Listing Details</h2>
      <PasteFormContent
        onSubmit={onSubmit}
        onClose={onClose}
        isLoading={isLoading}
        initialText={initialText}
        listingUrl={listingUrl}
        fromBookmarklet={fromBookmarklet}
      />
    </Modal>
  )
}
