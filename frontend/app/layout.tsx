import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/AuthContext'
import Footer from '@/components/Footer'
import './globals.css'

export const metadata: Metadata = {
  title: 'GetawayGather',
  description: 'Collaborative getaway research platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AuthProvider>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
