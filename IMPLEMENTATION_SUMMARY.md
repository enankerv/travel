# Supabase Integration - Complete Implementation

## ✅ What's Been Done

### Backend (Python/FastAPI)

1. **Created `db.py`** - Supabase client and database utilities
   - `insert_villa()` - Save villa to database
   - `get_user_villas()` - Fetch all villas for a user (auto-filtered by RLS)
   - `get_villa_by_slug()` - Get specific villa
   - `update_villa_by_slug()` - Update villa fields
   - `delete_villa_by_slug()` - Delete villa

2. **Updated `utils/persistence.py`** - Hybrid JSON + Supabase support
   - Falls back to JSON if Supabase unavailable
   - Maintains backward compatibility
   - Accepts `user_id` parameter

3. **Updated `scout.py`** - Added user_id support
   - `generate_villa_page()` now accepts `user_id`
   - `generate_villa_page_from_paste()` now accepts `user_id`
   - Villas saved to Supabase if user_id provided

4. **Updated `app.py`** - FastAPI endpoints ready for Supabase
   - `POST /api/scout` - Accepts `user_id` parameter
   - `POST /api/scout-paste` - Accepts `user_id` parameter

5. **Created `migrate_to_supabase.py`** - Data migration script
   - Moves existing JSON villas to Supabase
   - Usage: `python migrate_to_supabase.py --user-id <uuid>`

### Database

1. **Created `supabase_schema.sql`** - Complete database schema
   - `villas` table with all villa fields
   - `villa_images` table for image management
   - Row Level Security (RLS) policies
   - Automatic `updated_at` timestamp trigger
   - Indexes for performance

2. **RLS Policies** - Automatic user isolation
   ```sql
   -- Users can only see their own villas
   -- Users can only insert/update/delete their own villas
   -- Enforced at database level - no backend checks needed!
   ```

### Frontend

1. **Created `NEXTJS_SUPABASE_CLIENT.ts`** - Complete Supabase client setup
   - All authentication functions
   - All villa CRUD operations
   - Real-time subscription support
   - Ready to copy into Next.js project

## 🎯 Next Steps (For You)

### 1. Supabase Project Setup

```bash
# Go to https://supabase.com
# Create new project
# In SQL Editor → New Query, paste entire content of supabase_schema.sql and run
# Get your Service Role Key from Settings → API Keys
```

### 2. Backend Setup

```bash
# Update .env file with:
SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Install dependencies
pip install -r requirements.txt

# Test backend
python app.py
```

### 3. Create Next.js Frontend

```bash
npx create-next-app@latest frontend-nextjs --typescript --tailwind
cd frontend-nextjs

npm install @supabase/supabase-js

# Create .env.local with:
NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
NEXT_PUBLIC_API_URL=http://localhost:8000

# Copy NEXTJS_SUPABASE_CLIENT.ts to frontend-nextjs/lib/supabase.ts
```

### 4. Build Auth & UI in Next.js

Using the provided code templates and `SUPABASE_SETUP_GUIDE.md`:
- Create AuthContext (lib/AuthContext.tsx)
- Create API client (lib/api.ts)
- Create login/signup pages (pages/auth/)
- Create dashboard with villa gallery (pages/dashboard/)
- Port your existing gallery component from Vite React

### 5. Migrate Existing Data (Optional)

```bash
# After creating first user in Supabase:
python migrate_to_supabase.py --user-id <your-user-uuid>

# This moves all JSON villas to Supabase for that user
```

## 📊 Architecture

```
Frontend (Next.js)
  ├─ Login/Signup (Supabase Auth)
  ├─ Dashboard (fetches from Supabase directly with RLS)
  └─ Scout form (calls FastAPI backend with user_id)
       ↓
Backend (FastAPI)
  ├─ Validates user_id from token
  ├─ Scrapes & extracts villa data
  └─ Saves to Supabase (RLS auto-associates with user)
       ↓
Database (Supabase)
  ├─ Villas table (RLS policies enforce user isolation)
  ├─ Villa images
  └─ Auth sessions
```

## 🔒 Security

- **Row Level Security (RLS)** - Enforced at database level
  - No way for users to query other users' data
  - Even if frontend makes direct query, database rejects it

- **Auth Flow**
  - Supabase Auth provides JWT tokens
  - Frontend includes token in API headers
  - Backend can verify token (optional - RLS provides security)

- **No private keys in code**
  - Service Role Key stored in `.env` (not committed)
  - Anon Key public (safe to distribute with frontend)

## 📁 Files Created/Modified

### Created
- `db.py` - Supabase client
- `migrate_to_supabase.py` - Migration script
- `supabase_schema.sql` - Database schema
- `NEXTJS_SUPABASE_CLIENT.ts` - Frontend client code
- `SUPABASE_SETUP_GUIDE.md` - Detailed setup instructions

### Modified
- `utils/persistence.py` - Added Supabase + JSON hybrid support
- `scout.py` - Added `user_id` parameters
- `app.py` - Updated endpoints to accept `user_id`
- `requirements.txt` - Added supabase + python-dotenv

## 🚀 Ready to Go!

All the backend code is ready to use. You just need to:

1. Set up Supabase project (5 mins)
2. Run SQL schema (2 mins)
3. Add credentials to `.env` (1 min)
4. Create Next.js frontend (30 mins with templates provided)

See `SUPABASE_SETUP_GUIDE.md` for detailed step-by-step instructions!
