'use client'

type LoadingViewProps = {
  message?: string
}

export default function LoadingView({
  message = 'Loading…',
}: LoadingViewProps) {
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
      }}
    >
      <div className="spinner" style={{ width: '2.5rem', height: '2.5rem' }} />
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem' }}>
        {message}
      </p>
    </div>
  )
}
