# Supabase Integration Setup Guide

## Step 1: Create Supabase Project & Database Schema

1. Go to https://supabase.com and sign in
2. Create a new project
3. Go to **SQL Editor** → **New Query**
4. Copy the entire contents of `supabase_schema.sql` and run it
5. This will create:
   - `villas` table with Row Level Security (RLS)
   - `villa_images` table for image management
   - RLS policies that ensure users can only see/edit their own villas

## Step 2: Backend Setup (Python/FastAPI)

### Install Supabase Python Client

```bash
pip install supabase
```

### Create `.env` File

Create a `.env` file in your project root:

```
SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important:** Keep `SUPABASE_SERVICE_ROLE_KEY` PRIVATE - never commit it or share it publicly!

### Update requirements.txt

Add to `requirements.txt`:
```
supabase
python-dotenv
```

### The Backend is Now Ready!

The `app.py` and `scout.py` have been updated to:
- Accept `user_id` parameter in scouting endpoints
- Save villas to Supabase DB instead of JSON files (with fallback to JSON if Supabase is unavailable)
- Maintain backward compatibility with existing code

**New endpoints:**
- `POST /api/scout` - Now accepts `user_id` to save villa to user's DB
- `POST /api/scout-paste` - Now accepts `user_id` for manual paste

## Step 3: Frontend Setup (Next.js)

### Create Next.js Project

```bash
npx create-next-app@latest frontend-nextjs --typescript --tailwind
cd frontend-nextjs
```

### Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### Create `.env.local` File

Create `.env.local` in your Next.js project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
```

**Note:** These are PUBLIC keys - it's safe to include them in `.env.local` or `.env` files that are committed

### Copy Supabase Client Code

Copy the contents of `NEXTJS_SUPABASE_CLIENT.ts` to:
```
frontend-nextjs/lib/supabase.ts
```

### Create Auth Context (lib/AuthContext.tsx)

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabaseClient, getSession } from './supabase'

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
    // Get initial session
    const initializeAuth = async () => {
      try {
        const session = await getSession()
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    return supabaseClient.auth.signUp({ email, password })
  }

  const signIn = async (email: string, password: string) => {
    return supabaseClient.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabaseClient.auth.signOut()
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

### Create API Client (lib/api.ts)

```typescript
import { supabaseClient } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function scoutUrl(
  url: string,
  userId: string,
  options?: { check_in?: string; check_out?: string; guests?: number }
) {
  const session = await supabaseClient.auth.getSession()
  const token = session.data.session?.access_token

  const res = await fetch(`${API_URL}/api/scout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url,
      user_id: userId,
      ...options,
    }),
  })

  if (!res.ok) throw new Error('Scout failed')
  return res.json()
}

export async function scoutPaste(
  pastedText: string,
  userId: string,
  originalUrl?: string
) {
  const session = await supabaseClient.auth.getSession()
  const token = session.data.session?.access_token

  const res = await fetch(`${API_URL}/api/scout-paste`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      pasted_text: pastedText,
      user_id: userId,
      original_url: originalUrl,
    }),
  })

  if (!res.ok) throw new Error('Scout paste failed')
  return res.json()
}
```

## Step 4: Environment Setup

### Backend (.env)
```
SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Frontend Next.js (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Step 5: Testing

### Backend Test
```bash
cd backend
python -m pip install -r requirements.txt
python app.py
```

### Frontend Test
```bash
cd frontend-nextjs
npm install
npm run dev
```

## How It Works

1. **User signs up** → Supabase Auth creates user
2. **User gets JWT token** → Stored in browser session
3. **Frontend fetches villas** → Direct to Supabase with RLS (automatic user filtering)
4. **User scouts URL** → Frontend calls backend with `user_id` + token
5. **Backend scrapes** → Saves villa to Supabase DB associated with user
6. **RLS policies ensure** → User can only see/edit their own villas

## Row Level Security (RLS)

The SQL schema includes RLS policies that ensure:

```sql
-- User can only SELECT villas where user_id = auth.uid()
CREATE POLICY "Users can view their own villas"
  ON villas FOR SELECT
  USING (auth.uid() = user_id);

-- User can only INSERT villas for themselves
CREATE POLICY "Users can insert their own villas"
  ON villas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Similar policies for UPDATE and DELETE
```

This means:
- Frontend queries are automatically filtered by user
- No extra server-side auth checks needed for villa queries
- Users cannot access other users' data even if they try to query manually

## Troubleshooting

### "SUPABASE_URL not configured"
- Add `.env` file to backend with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Install `python-dotenv` via pip

### "RLS policies not found"
- Run the SQL schema in Supabase SQL Editor (Settings → SQL Editor → New Query)
- Copy entire contents of `supabase_schema.sql` and execute

### "Cannot insert villas"
- Make sure `user_id` is being passed in API request
- Check that user is authenticated in frontend
- Verify RLS policies are enabled in Supabase dashboard

### Villas not appearing in frontend
- Check browser console for errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Make sure user is signed in
- Check Supabase database directly to see if villas were saved

## Next Steps

1. Set up Supabase project
2. Run SQL schema
3. Update backend `.env`
4. Create Next.js frontend
5. Add Auth Provider to Next.js
6. Build villa dashboard UI (reuse components from Vite React)
7. Test signup/login flow
8. Deploy!
