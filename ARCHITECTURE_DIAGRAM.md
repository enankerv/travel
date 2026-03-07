# Supabase Integration Diagram

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Supabase Auth                          │  │
│  │  ┌────────┐  ┌────────┐  ┌──────┐  ┌────────────────┐   │  │
│  │  │ Signup │──│ Login  │──│ User │──│ Session Token  │   │  │
│  │  └────────┘  └────────┘  └──────┘  └────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Dashboard / Villa Spreadsheet               │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Fetch Villas (Direct to Supabase with RLS Filter) │  │  │
│  │  │    ↓                                               │  │  │
│  │  │ ┌──────────────────────────────────────────────┐  │  │  │
│  │  │ │ Villa 1    │ Villa 2    │ Villa 3           │  │  │  │
│  │  │ │ Gallery... │ Edit...    │ Delete...         │  │  │  │
│  │  │ └──────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │     Scout Form (Scout URL / Paste HTML)           │  │  │
│  │  │     ↓ Send with user_id + session token           │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                BACKEND (Python FastAPI)                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              /api/scout                                 │  │
│  │              /api/scout-paste                           │  │
│  │                                                          │  │
│  │  ├─ Receive URL + user_id                              │  │
│  │  ├─ Scrape listing (crawl4ai)                          │  │
│  │  ├─ Extract data (LLM with instructor)                 │  │
│  │  ├─ Download images                                     │  │
│  │  └─ Save to Supabase (with user_id)                    │  │
│  │           ↓                                              │  │
│  │  Return slug + success status                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE (Supabase PostgreSQL)                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Table: villas                                             ││
│  │ ┌─────────────────────────────────────────────────────┐ ││
│  │ │ id    user_id   slug    title    location  ...      │ ││
│  │ ├─────────────────────────────────────────────────────┤ ││
│  │ │ uuid1 user123   villa1  "Villa A" "Tuscany" ... RLS│ ││
│  │ │ uuid2 user123   villa2  "Villa B" "Rome"    ... RLS│ ││
│  │ │ uuid3 user456   villa3  "Villa C" "Milan"   ... RLS│ ││
│  │ └─────────────────────────────────────────────────────┘ ││
│  │                     ↓                                   ││
│  │ Row Level Security Policies:                           ││
│  │ • SELECT: WHERE auth.uid() = user_id                  ││
│  │ • INSERT: Check auth.uid() = user_id                  ││
│  │ • UPDATE: WHERE auth.uid() = user_id                  ││
│  │ • DELETE: WHERE auth.uid() = user_id                  ││
│  │                                                        ││
│  │ Result: User A can only see/edit their villas          ││
│  │         User B can only see/edit their villas          ││
│  │         No cross-user access possible!                 ││
│  └────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Table: villa_images                                   ││
│  │ ├─ villa_id (FK → villas.id)                          ││
│  │ ├─ image_url                                          ││
│  │ ├─ position                                           ││
│  │ └─ RLS policies (inherited from villas)               ││
│  └────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Auth Module (Built-in)                                ││
│  │ ├─ Users table (managed by Supabase)                  ││
│  │ ├─ Session management                                 ││
│  │ └─ JWT token generation                               ││
│  └────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: User Signs Up
```
User enters email/password
         ↓
Next.js calls supabaseClient.auth.signUp()
         ↓
Supabase Auth creates user + sends confirmation email
         ↓
User confirms email
         ↓
User logs in
         ↓
Supabase returns session token
         ↓
Frontend stores token in browser session
         ↓
Token sent with all future requests
```

### Example 2: User Scouts a Villa
```
User enters URL in dashboard
         ↓
Frontend calls scoutUrl(url, userId, token)
         ↓
FastAPI backend receives request
         ↓
Backend scrapes URL + extracts villa data
         ↓
Backend calls db.insert_villa(user_id, villa_data)
         ↓
Supabase saves villa with user_id association
         ↓
RLS policy: Can only save if auth.uid() = user_id
         ↓
Backend returns success
         ↓
Frontend gets real-time update via RLS query
         ↓
Villa appears in spreadsheet (auto-filtered for user)
```

### Example 3: User Fetches Their Villas
```
User navigates to dashboard
         ↓
Frontend calls getUserVillas()
         ↓
Supabase client sends query: SELECT * FROM villas
         ↓
RLS policy automatically filters: WHERE user_id = auth.uid()
         ↓
Database returns only user's villas
         ↓
Frontend renders in spreadsheet
         ↓
User cannot see other users' villas (even if they query manually!)
```

### Example 4: Unauthorized Access Attempt
```
Attacker tries: SELECT * FROM villas WHERE user_id = 'someone_else_id'
         ↓
Supabase checks RLS policy
         ↓
Policy: WHERE auth.uid() = user_id
         ↓
auth.uid() ≠ someone_else_id
         ↓
Query rejected at database level ✗
         ↓
Error: "row level security: new row violates RLS policy"
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                  React Component Tree                        │
│                                                              │
│  App (Wrapped with AuthProvider)                            │
│  ├─ Header (User profile, logout button)                    │
│  ├─ DropZone (URL input or paste)                           │
│  ├─ VillaTable (Villa spreadsheet)                          │
│  │  ├─ VillaRow (Each villa with gallery)                  │
│  │  │  ├─ ImageGallery (Modal lightbox)                    │
│  │  │  ├─ EditableCell (Inline editing)                    │
│  │  │  └─ RowActions (Edit/Delete buttons)                 │
│  │  └─ LoadingRow (Scouting status)                        │
│  └─ PasteModal (Manual paste for failed scrapes)            │
│                                                              │
│  useAuth() Hook                                              │
│  ├─ getCurrentUser()                                         │
│  ├─ signUp()                                                 │
│  ├─ signIn()                                                 │
│  └─ signOut()                                                │
│                                                              │
│  API Calls (lib/api.ts)                                      │
│  ├─ scoutUrl(url, userId, token)                            │
│  ├─ scoutPaste(text, userId, token)                         │
│  ├─ getUserVillas() [direct to Supabase with RLS]           │
│  ├─ updateVilla(id, updates) [direct to Supabase]           │
│  └─ deleteVilla(id) [direct to Supabase]                    │
└─────────────────────────────────────────────────────────────┘
```

## Security Layers

```
┌────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                         │
└────────────────────────────────────────────────────────────┘

Layer 1: Browser/Session
  • User authenticates with Supabase Auth
  • JWT token stored in secure session
  • Token included in all requests

Layer 2: API Transport
  • HTTPS (enforced by Supabase)
  • API requests include Authorization header
  • Token verified by Supabase before DB access

Layer 3: Database (RLS)
  • ALL queries filtered by user_id
  • Database enforces: WHERE auth.uid() = user_id
  • No backend code can bypass RLS
  • Cannot SELECT, UPDATE, or DELETE other users' data

Layer 4: Row Level Security Policies
  ✓ Prevent direct SQL manipulation
  ✓ Prevent privilege escalation
  ✓ Prevent data exfiltration
  ✓ Single source of truth: database

Result: Multi-layer defense
         Even if one layer fails, others protect data
         Maximum security with minimal backend complexity
```

## Deployment Options

```
┌─────────────────────┐
│   Supabase Cloud    │
│  (Hosted Database)  │
└─────────────────────┘
         ↑
    ┌────┴────┐
    │          │
┌───────┐  ┌──────────┐
│ Vercel│  │ Railway/ │
│(Next) │  │ Heroku   │
│       │  │ (FastAPI)│
└───────┘  └──────────┘
```

Ready to implement? 🚀
