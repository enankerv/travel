import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/AuthContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nankervis Scout',
  description: 'Collaborative villa research platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
