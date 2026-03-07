# Quick Start Checklist

## Phase 1: Supabase Setup (10 minutes)

- [ ] Go to https://supabase.com
- [ ] Create new project
- [ ] Go to SQL Editor → New Query
- [ ] Copy entire `supabase_schema.sql` and run it
- [ ] Go to Settings → API Keys
- [ ] Copy `Service Role Key` (keep it private!)
- [ ] Create `.env` file with credentials:
  ```
  SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<paste-here>
  ```

## Phase 2: Backend Ready (Already Done)

- [x] `db.py` - Supabase client utilities
- [x] Updated `scout.py` - Accepts user_id
- [x] Updated `app.py` - Accepts user_id in requests
- [x] Updated `utils/persistence.py` - Hybrid Supabase + JSON
- [x] Updated `requirements.txt` - Added supabase

**To test backend:**
```bash
pip install -r requirements.txt
python app.py
# Backend should start without errors
```

## Phase 3: Frontend Setup (Start Next.js)

- [ ] Create Next.js project:
  ```bash
  npx create-next-app@latest frontend-nextjs --typescript --tailwind
  cd frontend-nextjs
  npm install @supabase/supabase-js
  ```

- [ ] Create `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://kfrzzbfnbguhrtdmtkka.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```

- [ ] Copy `NEXTJS_SUPABASE_CLIENT.ts` to `frontend-nextjs/lib/supabase.ts`

- [ ] Following `SUPABASE_SETUP_GUIDE.md`, create:
  - [ ] `lib/AuthContext.tsx` - Auth state management
  - [ ] `lib/api.ts` - API client for backend
  - [ ] `app/auth/signup/page.tsx` - Signup form
  - [ ] `app/auth/login/page.tsx` - Login form
  - [ ] `app/dashboard/page.tsx` - Main app

## Phase 4: UI Components (Port from Vite)

- [ ] Copy `VillaRow.jsx` → `components/VillaRow.tsx`
- [ ] Copy `ImageGallery.jsx` → `components/ImageGallery.tsx`
- [ ] Copy `VillaTable.jsx` → `components/VillaTable.tsx`
- [ ] Copy `DropZone.jsx` → `components/DropZone.tsx`
- [ ] Copy `PasteModal.jsx` → `components/PasteModal.tsx`
- [ ] Port styles from `App.css` to Tailwind + `globals.css`

## Testing

### Test Backend
```bash
python app.py
# Should start on http://localhost:8000
# Check Supabase connection with no errors
```

### Test Frontend
```bash
cd frontend-nextjs
npm run dev
# Should start on http://localhost:3000
```

### Test Auth Flow
1. Go to http://localhost:3000/auth/signup
2. Sign up with email/password
3. Check Supabase Auth → Users (should appear there)
4. Go to http://localhost:3000/dashboard
5. Should see villa spreadsheet

### Test Scouting
1. In dashboard, paste URL
2. Backend should scrape and save to Supabase
3. Villa should appear in spreadsheet with RLS auto-filtering

## Helpful Commands

```bash
# Install backend dependencies
pip install -r requirements.txt

# Test backend syntax
python -m py_compile app.py scout.py db.py

# Run backend
python app.py

# Migrate existing JSON villas to Supabase (after creating user)
python migrate_to_supabase.py --user-id <your-uuid>

# Install frontend dependencies
npm install

# Run frontend dev server
npm run dev

# Build frontend for production
npm run build
```

## File Reference

| File | Purpose |
|------|---------|
| `db.py` | Supabase client & database helpers |
| `scout.py` | Villa scraping (updated for user_id) |
| `app.py` | FastAPI endpoints (updated for Supabase) |
| `utils/persistence.py` | Villa storage (Supabase + JSON) |
| `supabase_schema.sql` | Database schema (run in Supabase) |
| `migrate_to_supabase.py` | Move JSON villas → Supabase |
| `NEXTJS_SUPABASE_CLIENT.ts` | Frontend client code (copy to Next.js) |
| `SUPABASE_SETUP_GUIDE.md` | Detailed setup instructions |
| `IMPLEMENTATION_SUMMARY.md` | Complete overview |

## Key Credentials (Keep Safe!)

**Public (Safe to Share):**
- SUPABASE_URL: `https://kfrzzbfnbguhrtdmtkka.supabase.co`
- SUPABASE_ANON_KEY: `sb_publishable_-42g94YB5nayTd_1WQu_Mg_-IaZG-7Q`

**Private (Never Share):**
- SUPABASE_SERVICE_ROLE_KEY: Keep in `.env` only

## Architecture at a Glance

```
User → Next.js App
       ├─ Auth (Supabase Auth)
       └─ Dashboard (Supabase DB with RLS)
           ├─ Fetch villas (auto-filtered by user_id)
           ├─ Scout URL (→ FastAPI backend)
           └─ Edit/Delete villas (RLS enforced)

FastAPI Backend
       └─ Scout endpoints
           └─ Save to Supabase

Supabase
       ├─ Auth (user sessions)
       └─ Database (villas with RLS policies)
```

## Next: What I Can Help With

Ready for Next.js frontend setup?

1. Create the full Next.js app structure
2. Implement Auth flows (signup/login)
3. Build dashboard UI with villa spreadsheet
4. Port gallery component
5. Test end-to-end flow

Just let me know! 🚀
