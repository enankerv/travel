# Project Structure - After FastAPI Update

## Backend Files

### Core Application
```
app.py                    # Main FastAPI app (clean, ~50 lines)
routes.py                 # All 22 API endpoints organized
models.py                 # Pydantic models for validation
```

### Database & Logic
```
db_lists.py               # Supabase functions for lists/members/villas
db.py                     # Legacy Supabase client (kept for compatibility)
scout.py                  # Villa scraping & LLM extraction
utils/
  ├─ urls.py              # URL manipulation utilities
  ├─ text_cleaning.py     # Markdown filtering
  ├─ images.py            # Image handling & downloading
  ├─ crawler.py           # Web crawling logic
  ├─ extraction.py        # LLM-based extraction
  └─ persistence.py       # Data storage (Supabase + JSON fallback)
```

### Configuration & Schema
```
.env                      # Environment variables (private)
requirements.txt          # Python dependencies
supabase_schema_v2_lists.sql    # Database schema with RLS
migrate_to_supabase.py    # Migration script for JSON → Supabase
```

### Documentation
```
API_DOCUMENTATION.md      # Complete endpoint reference
FASTAPI_IMPLEMENTATION.md # How to use the endpoints
LISTS_ARCHITECTURE.md     # Collaborative lists design
SUPABASE_SETUP_GUIDE.md   # Setup instructions
IMPLEMENTATION_SUMMARY.md # High-level overview
QUICKSTART.md             # Quick reference
ARCHITECTURE_DIAGRAM.md   # Visual diagrams
```

## Frontend (To Be Created)

```
frontend-nextjs/
├─ app/
│  ├─ layout.tsx          # Root layout with AuthProvider
│  ├─ page.tsx            # Home page
│  ├─ auth/
│  │  ├─ signup/page.tsx
│  │  ├─ login/page.tsx
│  │  └─ callback/page.tsx
│  ├─ lists/
│  │  ├─ page.tsx         # List dashboard
│  │  ├─ [id]/page.tsx    # Single list view
│  │  └─ create/page.tsx
│  └─ join/
│     └─ [token]/page.tsx # Accept invite
├─ components/
│  ├─ VillaTable.tsx      # Spreadsheet view
│  ├─ VillaRow.tsx        # Villa row with gallery
│  ├─ ImageGallery.tsx    # Gallery modal
│  ├─ ListGrid.tsx        # Dashboard grid
│  ├─ InviteForm.tsx      # Create invite
│  └─ ...
├─ lib/
│  ├─ supabase.ts         # Supabase client
│  ├─ api.ts              # API calls to backend
│  └─ AuthContext.tsx     # Auth state management
├─ .env.local             # Frontend env vars (public)
├─ next.config.js
└─ package.json
```

## File Dependencies

```
app.py
  └─ routes.py (all endpoints)
      ├─ models.py (request/response validation)
      ├─ db_lists.py (database operations)
      │   └─ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
      ├─ scout.py (web scraping)
      │   ├─ utils/crawler.py
      │   ├─ utils/extraction.py
      │   ├─ utils/images.py
      │   ├─ utils/text_cleaning.py
      │   ├─ utils/urls.py
      │   └─ utils/persistence.py
      └─ Static files (images, villas)
```

## Environment Variables

### Backend (.env)
```
SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-key-here>
```

### Frontend (.env.local) - PUBLIC
```
NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Database Schema

### Tables (with RLS)
```
auth.users              (Supabase managed)
├─ lists                (user creates lists)
│  ├─ list_members      (track who has access)
│  ├─ villas            (villas in list)
│  │  └─ villa_images   (images per villa)
│  └─ invite_tokens     (shareable links)
```

### RLS Policies
- Users see only lists they own or are members of
- Editors can modify villas, viewers cannot
- Admins manage members
- Invite tokens have expiry + usage limits

## API Endpoints (22 total)

### Lists (6)
- POST /api/lists
- GET /api/lists
- GET /api/lists/{id}
- PUT /api/lists/{id}
- DELETE /api/lists/{id}

### Members (4)
- GET /api/lists/{id}/members
- POST /api/lists/{id}/members
- PUT /api/lists/{id}/members/{uid}
- DELETE /api/lists/{id}/members/{uid}

### Invites (6)
- POST /api/lists/{id}/invites
- GET /api/invites/{token}
- POST /api/invites/{token}/accept
- GET /api/lists/{id}/invites
- DELETE /api/invites/{token}

### Villas (3)
- GET /api/lists/{id}/villas
- PUT /api/lists/{id}/villas/{slug}
- DELETE /api/lists/{id}/villas/{slug}

### Scout (2)
- POST /api/scout
- POST /api/scout-paste

### Health (1)
- GET /health

## Development Workflow

### 1. Backend Development
```bash
# Install dependencies
pip install -r requirements.txt

# Set up Supabase
# - Create project at supabase.com
# - Run supabase_schema_v2_lists.sql
# - Add credentials to .env

# Run backend
python app.py
# Backend on http://localhost:8000/docs (Swagger UI)
```

### 2. Frontend Development
```bash
# Create Next.js project
npx create-next-app@latest frontend-nextjs

# Install Supabase
npm install @supabase/supabase-js

# Set up .env.local with credentials

# Run frontend
npm run dev
# Frontend on http://localhost:3000
```

### 3. Integration
```bash
# Backend running on 8000
# Frontend running on 3000
# Test scouting: Create list → Scout URL → See villa appear
# Test invites: Create token → Accept in new user account
```

## Key Technologies

**Backend:**
- FastAPI (web framework)
- Supabase (database + auth)
- crawl4ai (web scraping)
- instructor (LLM extraction)
- Ollama (local LLM)

**Frontend:**
- Next.js (React framework)
- TypeScript
- Supabase Client
- Tailwind CSS (for styling)

**Infrastructure:**
- Supabase Cloud (database)
- Uvicorn (ASGI server)
- Node.js/npm (frontend)

## Production Checklist

- [ ] Add authentication to FastAPI endpoints
- [ ] Implement rate limiting
- [ ] Set up logging/monitoring
- [ ] Configure CORS properly
- [ ] Add input validation/sanitization
- [ ] Set up CI/CD pipeline
- [ ] Deploy backend (Railway, Heroku)
- [ ] Deploy frontend (Vercel)
- [ ] Set up custom domain
- [ ] Configure Supabase backups
- [ ] Add error tracking (Sentry)
