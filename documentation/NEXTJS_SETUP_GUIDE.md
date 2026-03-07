# Next.js Frontend - Complete Setup & Build Guide

## Quick Start

```bash
# 1. Create Next.js project
npx create-next-app@latest frontend --typescript --tailwind --no-eslint -no-git

# 2. Navigate to project
cd frontend

# 3. Install Supabase
npm install @supabase/supabase-js

# 4. Create .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 5. Run dev server
npm run dev
```

## Directory Structure (After Setup)

```
frontend/
├── app/
│   ├── layout.tsx                 # Root layout with AuthProvider
│   ├── page.tsx                   # Home/dashboard
│   ├── auth/
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── page.tsx
│   ├── lists/
│   │   ├── page.tsx               # Lists dashboard
│   │   ├── [id]/
│   │   │   └── page.tsx           # Single list view
│   │   └── create/
│   │       └── page.tsx
│   └── join/
│       └── [token]/
│           └── page.tsx           # Accept invite
├── components/
│   ├── auth/
│   │   ├── SignupForm.tsx
│   │   └── LoginForm.tsx
│   ├── lists/
│   │   ├── ListGrid.tsx
│   │   ├── ListHeader.tsx
│   │   ├── ListSettings.tsx
│   │   └── InviteForm.tsx
│   ├── villas/
│   │   ├── VillaTable.tsx
│   │   ├── VillaRow.tsx
│   │   ├── EditableCell.tsx
│   │   ├── ImageGallery.tsx
│   │   ├── DropZone.tsx
│   │   └── PasteModal.tsx
│   ├── members/
│   │   └── MembersList.tsx
│   └── common/
│       ├── Header.tsx
│       ├── Navbar.tsx
│       └── Loading.tsx
├── lib/
│   ├── supabase.ts                # Supabase client
│   ├── AuthContext.tsx            # Auth provider
│   ├── api.ts                     # Backend API calls
│   └── utils.ts                   # Helper functions
├── styles/
│   └── globals.css
├── .env.local
├── next.config.js
├── package.json
└── tsconfig.json
```

## Files to Create (In Order)

### Phase 1: Core Setup & Auth
1. `lib/supabase.ts` - Supabase client
2. `lib/AuthContext.tsx` - Auth provider
3. `app/layout.tsx` - Root layout
4. `app/auth/signup/page.tsx` - Signup page
5. `app/auth/login/page.tsx` - Login page
6. `components/auth/SignupForm.tsx` - Signup component
7. `components/auth/LoginForm.tsx` - Login component

### Phase 2: Lists Management
8. `lib/api.ts` - Backend API wrapper
9. `app/lists/page.tsx` - Lists dashboard
10. `app/lists/create/page.tsx` - Create list
11. `components/lists/ListGrid.tsx` - Lists display
12. `components/lists/ListHeader.tsx` - List header
13. `components/lists/InviteForm.tsx` - Invite form

### Phase 3: Villa Management
14. `app/lists/[id]/page.tsx` - Single list view
15. `components/villas/VillaTable.tsx` - Villa spreadsheet
16. `components/villas/VillaRow.tsx` - Villa row
17. `components/villas/EditableCell.tsx` - Inline editing
18. `components/villas/ImageGallery.tsx` - Gallery modal
19. `components/villas/DropZone.tsx` - URL input
20. `components/villas/PasteModal.tsx` - Paste fallback

### Phase 4: Invites & Members
21. `app/join/[token]/page.tsx` - Accept invite
22. `components/members/MembersList.tsx` - Members display

### Phase 5: Common Components
23. `components/common/Header.tsx` - App header
24. `components/common/Navbar.tsx` - Navigation
25. `components/common/Loading.tsx` - Loading indicator

---

## Key Implementation Notes

### Authentication Flow
1. User signs up → Supabase Auth creates account
2. User logs in → Gets JWT token in session
3. Token stored in browser session
4. Token sent with API requests via Supabase client
5. RLS policies enforce permissions at DB level

### Data Flow
1. User creates list → `POST /api/lists`
2. User scouts URL → `POST /api/scout` (saves to list)
3. Frontend queries villas → Supabase RLS filters by list
4. User invites friend → `POST /api/lists/{id}/invites`
5. Friend accepts → `POST /api/invites/{token}/accept`
6. Friend sees list in dashboard

### State Management
- AuthContext for user session
- React hooks (useState, useEffect) for components
- Supabase real-time subscriptions (optional)

### Styling
- Tailwind CSS for utility-first styling
- Dark theme similar to existing design
- Responsive mobile-first approach

---

## Files to Create (Detailed)

### 1. lib/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
```

### 2. lib/AuthContext.tsx

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    return supabase.auth.signUp({ email, password })
  }

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

### 3. lib/api.ts

```typescript
import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

// Lists
export async function createList(name: string, description?: string, userId?: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists?user_id=${userId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, description }),
  })
  if (!res.ok) throw new Error('Failed to create list')
  return res.json()
}

export async function getLists(userId?: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists?user_id=${userId}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch lists')
  return res.json()
}

export async function getList(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch list')
  return res.json()
}

export async function updateList(listId: string, updates: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update list')
  return res.json()
}

export async function deleteList(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete list')
  return res.json()
}

// Villas
export async function getVillas(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas`, { headers })
  if (!res.ok) throw new Error('Failed to fetch villas')
  return res.json()
}

export async function updateVilla(listId: string, slug: string, updates: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas/${slug}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update villa')
  return res.json()
}

export async function deleteVilla(listId: string, slug: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas/${slug}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete villa')
  return res.json()
}

// Scout
export async function scoutUrl(url: string, listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/scout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, list_id: listId }),
  })
  if (!res.ok) throw new Error('Scout failed')
  return res.json()
}

export async function scoutPaste(pasted_text: string, listId: string, original_url?: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/scout-paste`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pasted_text, list_id: listId, original_url }),
  })
  if (!res.ok) throw new Error('Scout paste failed')
  return res.json()
}

// Invites
export async function createInvite(listId: string, role: string = 'viewer', userId?: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/invites?created_by=${userId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ role, expires_in_days: 30 }),
  })
  if (!res.ok) throw new Error('Failed to create invite')
  return res.json()
}

export async function getInviteDetails(token: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/invites/${token}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch invite')
  return res.json()
}

export async function acceptInvite(token: string, userId?: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/invites/${token}/accept?user_id=${userId}`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) throw new Error('Failed to accept invite')
  return res.json()
}

// Members
export async function getListMembers(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/members`, { headers })
  if (!res.ok) throw new Error('Failed to fetch members')
  return res.json()
}

export async function removeListMember(listId: string, userId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/members/${userId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to remove member')
  return res.json()
}
```

---

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Component Implementation Order

1. **Auth components first** - Signup/Login forms
2. **List management** - Create/view lists
3. **Villa management** - Scout/edit villas
4. **Invite system** - Share lists
5. **UI refinement** - Styling, animations

---

## Next.js Setup Script (Copy & Paste)

```bash
# Create project
npx create-next-app@latest frontend --typescript --tailwind --no-eslint --no-git

# Navigate to project
cd frontend

# Install dependencies
npm install @supabase/supabase-js

# Create env file
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF

# Run dev server
npm run dev
```

---

## Testing Checklist

- [ ] Signup creates user in Supabase
- [ ] Login retrieves session token
- [ ] Create list appears in dashboard
- [ ] Scout URL creates villa in list
- [ ] Create invite generates shareable link
- [ ] Accept invite adds user to list
- [ ] Edit villa updates in real-time
- [ ] Delete villa removes from list
- [ ] Gallery opens and navigates images

---

## What's Next After Setup

1. Copy all component files I'm about to provide
2. Run the setup script above
3. Implement components in order
4. Test each feature
5. Deploy to Vercel

Ready? I'll provide all component files next!
