import { Suspense } from 'react'
import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div className="auth-page">Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  )
}
