# Next.js Frontend - Complete Component Templates

This file contains all the component code ready to copy into your Next.js project.

## Setup Instructions

1. Create `frontend` directory structure as shown in NEXTJS_SETUP_GUIDE.md
2. Copy each component code below into the appropriate file
3. Create `.env.local` with credentials
4. Run `npm run dev`

---

## Phase 1: Core Setup (Must Do First)

### 1. lib/supabase.ts
[See NEXTJS_SETUP_GUIDE.md]

### 2. lib/AuthContext.tsx
[See NEXTJS_SETUP_GUIDE.md]

### 3. lib/api.ts
[See NEXTJS_SETUP_GUIDE.md]

### 4. app/layout.tsx

```typescript
import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/AuthContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'GetawayGather',
  description: 'Collaborative villa research platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

### 5. styles/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --dark: #111317;
  --dark-2: #1a1d23;
  --surface: #22262e;
  --surface-hover: #2a2f38;
  --border: rgba(255, 255, 255, 0.06);
  --accent: #c45c26;
  --muted: #a0a9b8;
  --light: #e6edf3;
}

body {
  @apply bg-slate-950 text-slate-100;
}

input:focus {
  @apply outline-none ring-2 ring-orange-500;
}

button:disabled {
  @apply opacity-50 cursor-not-allowed;
}
```

---

## Phase 2: Authentication Pages

### 6. app/auth/signup/page.tsx

```typescript
import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <SignupForm />
    </div>
  )
}
```

### 7. app/auth/login/page.tsx

```typescript
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <LoginForm />
    </div>
  )
}
```

### 8. components/auth/SignupForm.tsx

[See COMPONENT_SignupForm.tsx in this repo]

### 9. components/auth/LoginForm.tsx

```typescript
'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      if (error) throw error
      router.push('/lists')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-white">Welcome Back</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-4 text-center text-gray-400">
        Don't have an account?{' '}
        <a href="/auth/signup" className="text-orange-500 hover:underline">
          Sign up
        </a>
      </p>
    </div>
  )
}
```

---

## Phase 3: Lists Management

### 10. app/lists/page.tsx

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { getLists } from '@/lib/api'
import ListGrid from '@/components/lists/ListGrid'

export default function ListsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [lists, setLists] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      loadLists()
    }
  }, [user, loading, router])

  async function loadLists() {
    try {
      const data = await getLists(user?.id)
      setLists(data || [])
    } catch (error) {
      console.error('Failed to load lists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Your Lists</h1>
          <a
            href="/lists/create"
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded"
          >
            + New List
          </a>
        </div>

        {lists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No lists yet</p>
            <a
              href="/lists/create"
              className="text-orange-500 hover:underline"
            >
              Create your first list
            </a>
          </div>
        ) : (
          <ListGrid lists={lists} />
        )}
      </div>
    </div>
  )
}
```

### 11. components/lists/ListGrid.tsx

```typescript
'use client'

import Link from 'next/link'

interface List {
  id: string
  name: string
  description?: string
  list_members?: any[]
}

export default function ListGrid({ lists }: { lists: List[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {lists.map((list) => (
        <Link key={list.id} href={`/lists/${list.id}`}>
          <div className="bg-slate-800 p-6 rounded-lg hover:bg-slate-700 transition cursor-pointer border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-2">{list.name}</h2>
            <p className="text-gray-400 text-sm mb-4">
              {list.description || 'No description'}
            </p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{list.list_members?.length || 0} members</span>
              <span>→</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

---

## Next Components to Implement

Due to length, here are the key remaining components:

### Villa Components
- `VillaTable.tsx` - Spreadsheet view (port from Vite React)
- `VillaRow.tsx` - Individual villa row
- `EditableCell.tsx` - Inline editing
- `ImageGallery.tsx` - Gallery modal
- `DropZone.tsx` - URL/file input

### List Components
- `ListHeader.tsx` - List info + actions
- `InviteForm.tsx` - Create invites
- `MembersList.tsx` - Show members

### Pages
- `app/lists/create/page.tsx` - Create list form
- `app/lists/[id]/page.tsx` - Single list view
- `app/join/[token]/page.tsx` - Accept invite flow

---

## How to Use This Guide

1. **Read NEXTJS_SETUP_GUIDE.md first** - Shows directory structure
2. **Copy lib/ files** - supabase.ts, AuthContext.tsx, api.ts
3. **Copy app/layout.tsx and styles/globals.css**
4. **Copy auth pages** - Login/Signup
5. **Implement lists pages** - Dashboard, create
6. **Implement villa components** - Port from existing Vite React app
7. **Test each feature** - Auth → Lists → Villas

## Quick Wins

Start with:
1. Auth flow (signup → login)
2. List dashboard
3. Create list form
4. View list with villas
5. Scout URL
6. Share invite link

---

## Production Notes

- [ ] Add error boundaries
- [ ] Add loading skeletons
- [ ] Add form validation
- [ ] Add success toasts
- [ ] Add error alerts
- [ ] Add confirmation dialogs for delete
- [ ] Add real-time subscriptions
- [ ] Add image optimization
- [ ] Add debouncing for search
- [ ] Add analytics

---

## Deployment

When ready:
```bash
npm run build
vercel deploy
```

Frontend will be live on Vercel, backend on Railway/Heroku.

---

## Files Ready to Copy

From this repo (TravelBlog folder):
- COMPONENT_SignupForm.tsx → Copy to frontend/components/auth/SignupForm.tsx
- NEXTJS_SETUP_GUIDE.md → Reference for directory structure
- NEXTJS_SUPABASE_CLIENT.ts → Already provided earlier

All code above is ready to paste directly into your Next.js project!
