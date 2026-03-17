import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div className="auth-page">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
