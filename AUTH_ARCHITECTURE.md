# Authentication Architecture: User-Centric Token Flow

## Overview

The application now uses a **user-centric authentication flow** where the frontend's Supabase JWT token is sent to the backend, and the backend uses that token to query Supabase directly. This ensures:

1. **Security**: No master Service Role Key is exposed to the frontend
2. **Authorization**: Supabase Row Level Security (RLS) policies enforce access control
3. **Scalability**: Backend respects user permissions without implementing auth logic

## Architecture

### 1. Frontend (Next.js)
```
User Login → Supabase Auth → JWT Token
                                ↓
                        Stored in AuthContext
                                ↓
                        Sent with every API call (Authorization: Bearer {token})
```

### 2. Backend (FastAPI)
```
Incoming Request with Bearer Token
                ↓
        extract_auth_token() - parses Authorization header
                ↓
        extract_user_id_from_token() - decodes JWT to get user_id (from 'sub' claim)
                ↓
        get_supabase_client(auth_token) - creates Supabase client with user's token
                ↓
        RLS policies enforce access control at database level
                ↓
        Response to frontend
```

### 3. Supabase (Database)
```
Row Level Security (RLS) Policies
├─ lists table: Users can see/edit lists they own or are members of
├─ list_members table: Users can see members of lists they have access to
├─ invite_tokens table: Users can only manage invites for lists they own (admin)
└─ villas table: Users can see/edit villas in lists they have access to
```

## Key Changes

### Backend (db_lists.py)
```python
# OLD: Used Service Role Key (master key)
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# NEW: Creates client with user's token
def get_supabase_client(auth_token: str = None) -> Client:
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    if auth_token:
        client.auth.set_session(access_token=auth_token, refresh_token="")
    return client
```

### Backend Routes (routes.py)
```python
# OLD: No auth headers
@router.get("/lists")
async def get_user_lists_endpoint(user_id: str = Query(...)):
    lists = get_user_lists(user_id)  # No enforcement!
    return lists

# NEW: Extracts token and user_id from JWT
@router.get("/lists")
async def get_user_lists_endpoint(authorization: Optional[str] = Header(None)):
    token = extract_auth_token(authorization)  # Validates Bearer token
    lists = get_user_lists(token)  # Passes token to DB layer
    return lists
```

### Frontend (lib/api.ts)
```typescript
// getAuthHeaders() already includes Authorization header
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),  // ← Sends token
  }
}

// OLD: Passed user_id as query param (insecure)
export async function getLists(userId?: string) {
  const res = await fetch(`${API_URL}/api/lists?user_id=${userId}`, { headers })
}

// NEW: No user_id query param (backend derives from token)
export async function getLists() {
  const res = await fetch(`${API_URL}/api/lists`, { headers })
}
```

## JWT Token Decoding

The `extract_user_id_from_token()` function decodes the JWT without verification (Supabase will verify it when we use it):

```python
def extract_user_id_from_token(token: str) -> str:
    import base64, json
    parts = token.split('.')
    payload = parts[1]
    # Add padding if needed
    padding = 4 - len(payload) % 4
    if padding != 4:
        payload += '=' * padding
    decoded = base64.urlsafe_b64decode(payload)
    data = json.loads(decoded)
    return data.get('sub')  # 'sub' claim = user_id in Supabase JWT
```

## Security Benefits

### Without Auth Token (OLD):
```
Frontend sends: user_id = "123"
Backend says: "You asked for lists for user 123"
Database: No idea who is asking, trusts backend with Service Role Key

VULNERABILITY: Frontend can request any user_id!
```

### With Auth Token (NEW):
```
Frontend sends: Bearer eyJhbGciOiJIUzI1NiIsInN1YiI6IjEyMyJ9...
Backend extracts: user_id = "123" from token
Database RLS: "I only trust this token, let me check if user 123 has access"

SECURE: Frontend can't impersonate other users
```

## RLS Policy Example (villas table)

```sql
CREATE POLICY "Users can see villas in lists they have access to"
ON villas FOR SELECT
USING (
  list_id IN (
    SELECT id FROM lists 
    WHERE user_id = auth.uid() 
    UNION ALL 
    SELECT list_id FROM list_members 
    WHERE user_id = auth.uid()
  )
);
```

When we call `get_list_villas(list_id, auth_token)`:
1. Backend creates Supabase client with `auth_token`
2. Supabase client knows who the user is (from token's `sub` claim)
3. RLS policy checks if user has access to that list
4. Only matching villas are returned

## No More Query Parameters

All endpoints now extract identification from the Bearer token:

| Endpoint | OLD | NEW |
|----------|-----|-----|
| `POST /lists` | `/lists?user_id=123` | `/lists` (derives from token) |
| `GET /lists` | `/lists?user_id=123` | `/lists` (derives from token) |
| `POST /invites` | `?created_by=123` | `?` (derives from token) |
| `POST /invites/{token}/accept` | `?user_id=123` | `?` (derives from token) |

## Environment Variables

Only the **ANON KEY** is now needed in backend `.env`:

```env
SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...  # Public key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**SERVICE_ROLE_KEY is no longer used** (can be removed from .env)

## Error Handling

```python
# Missing or invalid token
@router.get("/lists")
async def get_user_lists_endpoint(authorization: Optional[str] = Header(None)):
    token = extract_auth_token(authorization)  # Raises 401 if missing
    lists = get_user_lists(token)
    return lists

# RLS violation
# If user tries to access a list they don't have permission for,
# Supabase returns an error which is translated to HTTP 403
```

## Testing the Flow

1. **User signs in** → Supabase returns JWT
2. **Frontend stores JWT** → In AuthContext/session
3. **Frontend makes API call** → Includes `Authorization: Bearer {jwt}`
4. **Backend validates token** → Extracts user_id
5. **Backend queries Supabase** → With user's token
6. **RLS policies apply** → Database enforces access control
7. **Result returned** → Only data user has access to

## Migration Notes

- No database schema changes required
- RLS policies already in place (from previous implementation)
- All existing data remains accessible
- Backward compatibility: None (this is the new architecture)
