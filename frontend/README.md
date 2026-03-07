# Next.js Frontend - Quick Start

## Installation

From the TravelBlog directory:

```bash
cd frontend
npm install
npm run dev
```

Frontend will be on http://localhost:3000

## Files Created

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home (redirects)
│   ├── auth/
│   │   ├── signup/page.tsx     # Signup page
│   │   └── login/page.tsx      # Login page
│   ├── lists/
│   │   ├── page.tsx            # Lists dashboard
│   │   ├── create/page.tsx     # Create list page
│   │   └── [id]/page.tsx       # Single list view
│   └── join/[token]/page.tsx   # Accept invite
├── components/
│   └── auth/
│       ├── SignupForm.tsx      # Signup form
│       └── LoginForm.tsx       # Login form
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── AuthContext.tsx         # Auth provider
│   └── api.ts                  # API wrapper
├── app/
│   └── globals.css             # Tailwind setup
├── .env.local                  # Environment variables
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── next.config.js              # Next.js config
├── tailwind.config.js          # Tailwind config
├── postcss.config.js           # PostCSS config
└── .gitignore
```

## Usage

### 1. Sign Up
Go to http://localhost:3000/auth/signup

### 2. Log In
Go to http://localhost:3000/auth/login

### 3. Create List
Click "New List" on the dashboard

### 4. Scout Villa
Enter URL in the "Scout New Villa" form on list page

### 5. Share List
Click "Share" button to create invite link

## Environment Variables

Already set in `.env.local`:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_URL

## Deployment

```bash
npm run build
vercel deploy
```

## Features Implemented

✅ User authentication (signup/login)
✅ List dashboard
✅ Create lists
✅ View lists
✅ Scout villas from URLs
✅ Share lists via invite links
✅ Accept invites
✅ Display villas in table

## Next Steps

Still to add:
- [ ] Edit villa details inline
- [ ] Delete villas
- [ ] Image gallery
- [ ] Paste modal for failed scrapes
- [ ] Member management
- [ ] Real-time updates
