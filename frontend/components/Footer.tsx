import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      style={{
        padding: '1rem 2rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'var(--dark-2)',
        fontSize: '0.85rem',
        color: 'var(--muted)',
      }}
    >
      <span>© {new Date().getFullYear()} Nankervis Digital LLC</span>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Link href="/terms" style={{ color: 'var(--muted)' }}>
          Terms of Service
        </Link>
        <Link href="/privacy" style={{ color: 'var(--muted)' }}>
          Privacy Policy
        </Link>
        <a href="mailto:ethan@nankervisdigital.com" style={{ color: 'var(--muted)' }}>
          Contact
        </a>
      </div>
    </footer>
  )
}
