# GetawayGather

Collaborative lists for tracking vacation rentals. Scout listings from URLs or pasted text, store getaways in shared lists, and invite others to collaborate.

---

## Project Structure

### Backend (FastAPI)
- **`backend/app.py`** - Main app, middleware, static serving
- **`backend/routes/`** - API endpoints by resource (auth, lists, members, invites, getaways, scout)
- **`backend/db/`** - Database layer by table (client, lists, list_members, invite_tokens, getaways)
- **`backend/utils/`** - Crawling, extraction, images, storage URLs
- **`backend/scout.py`** - Scraping & LLM extraction pipeline

### Frontend (Next.js)
- **`frontend/app/`** - Pages (home, auth, terms, privacy)
- **`frontend/components/`** - GetawayTable, ListDetailView, ImageGallery, etc.
- **`frontend/lib/`** - Supabase client, API helpers
- **`frontend/hooks/`** - useAuthBootstrap, useSignedImageUrls

### Data
- **Images** - Supabase Storage (`getaway-images`, legacy `villa-images`)
- **Database** - Supabase Postgres (lists, getaways, list_members, invite_tokens)
- **`db/supabase_setup.sql`** - Schema & RLS policies

---

## Reference Guides

### For Backend Development
- API docs: http://localhost:8000/docs (Swagger)
- Routes: `backend/routes/` (prefix `/api`)

### For Frontend Development
- OAuth: `frontend/GOOGLE_OAUTH_SETUP.md`

### For Database
- Schema: `db/supabase_setup.sql`
- Migration: `db/supabase_migrate_villas_to_getaways.sql`

---

## Quick Command Reference

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py
# or: uvicorn app:app --reload

# Frontend Dev
cd frontend
npm install
npm run dev

# Frontend Deploy
npm run build
vercel deploy
```

---

## FAQ

### Q: Where do I start?
A: Read FINAL_SUMMARY.md, then COMPLETE_SETUP.md

### Q: How do I run the backend?
A: `cd backend && python app.py` (or `uvicorn app:app --reload`)

### Q: How do I run the frontend?
A: `cd frontend && npm run dev`

### Q: How do I test the endpoints?
A: http://localhost:8000/docs (Swagger UI)

### Q: How do I deploy?
A: Backend → Railway/Render; Frontend → Vercel. Set env vars for Supabase.

### Q: How does authentication work?
A: Supabase Auth (OAuth). Terms & age verification required before API access.

### Q: Where are images stored?
A: Supabase Storage (private buckets). Signed URLs generated per request.

---

## File Locations

### Main Files
- `backend/app.py` - FastAPI application
- `backend/routes/` - API endpoints (auth, lists, members, invites, getaways, scout)
- `backend/db/` - Database layer (client, lists, list_members, invite_tokens, getaways)
- `backend/models.py` - Pydantic models
- `backend/scout.py` - Scraping & extraction logic
- `backend/requirements.txt` - Python dependencies

### Configuration
- `backend/.env` - Backend secrets (Supabase URL, keys, etc.)
- `db/supabase_setup.sql` - Database schema

### Documentation
- README.md (this file)
- frontend/GOOGLE_OAUTH_SETUP.md

---

## Dependencies

### Backend
```
FastAPI - Web framework
Supabase - Database + Auth
crawl4ai - Web scraping
instructor - LLM extraction
Ollama - Local LLM
Pydantic - Data validation
```

### Frontend
```
Next.js - React framework
Supabase JS - Database client
Tailwind CSS - Styling
TypeScript - Type safety
```

### Hosting
```
Supabase Cloud - Database
Railway/Heroku - Backend
Vercel - Frontend
```

---

## Support Resources

**External:**
- FastAPI docs: https://fastapi.tiangolo.com/
- Next.js docs: https://nextjs.org/docs
- Supabase docs: https://supabase.com/docs
- Tailwind docs: https://tailwindcss.com/docs

---

## Timeline Estimate

- Backend: Done ✅
- Frontend: Done ✅
- Deployment: ~1 hour (Railway + Vercel + env vars)

---

## Next Steps

1. Configure `backend/.env` (Supabase URL, anon key)
2. Run backend: `cd backend && python app.py`
3. Run frontend: `cd frontend && npm run dev`
4. Open http://localhost:3000

---

## Project Stats

**Backend:**
- 22 API endpoints
- 5 database tables
- 9 Python utility modules
- 4 Pydantic models

**Frontend:**
- 25+ React components
- Auth system (Supabase OAuth)
- List management
- Getaway table with inline editing
- Image gallery (Supabase Storage)
- Invite system

**Database:**
- Row Level Security policies
- Automatic permissions
- User isolation
- Scalable schema

**Documentation:**
- 15+ guides
- 25+ code examples
- 100+ configuration options
- Complete API reference

---

## Ready to Launch?

✅ Backend (FastAPI + Supabase)
✅ Frontend (Next.js + Supabase Auth)
✅ Getaway scouting (URL + paste)
✅ Collaborative lists with invites
✅ Images in Supabase Storage

**Run:** `cd backend && python app.py` | `cd frontend && npm run dev`
