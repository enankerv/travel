'use client'

type ModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** Optional width override (e.g. '400px') */
  width?: string
}

export default function Modal({ open, onClose, children, width }: ModalProps) {
  if (!open) return null

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal" style={width ? { width } : undefined}>
        {children}
      </div>
    </div>
  )
}
