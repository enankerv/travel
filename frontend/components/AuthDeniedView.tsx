'use client'

type AuthDeniedViewProps = {
  title: string
  message: string
  buttonText?: string
  onAction: () => void
}

export default function AuthDeniedView({
  title,
  message,
  buttonText = 'Back to Login',
  onAction,
}: AuthDeniedViewProps) {
  return (
    <div
      className="app"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <h2 style={{ margin: 0, color: 'var(--light)' }}>{title}</h2>
      <p style={{ margin: 0, color: 'var(--muted)', textAlign: 'center' }}>
        {message}
      </p>
      <button
        onClick={onAction}
        style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          padding: '0.6rem 1.25rem',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {buttonText}
      </button>
    </div>
  )
}
