# Google OAuth Setup Guide

## Step 1: Enable Google OAuth in Supabase

1. Go to your Supabase dashboard: https://app.supabase.com
2. Click on your project
3. Go to **Authentication** → **Providers**
4. Find **Google** and click **Enable**
5. You'll see a form asking for Client ID and Client Secret

## Step 2: Create Google OAuth Application

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a new project (or select existing one)
3. Go to **APIs & Services** → **Credentials**
4. Click **+ Create Credentials** → **OAuth Client ID**
5. If prompted, set up the OAuth consent screen first
6. Choose **Web application**
7. Add Authorized redirect URIs:
   ```
   https://[YOUR-PROJECT-ID].supabase.co/auth/v1/callback
   ```
   (Get your project ID from Supabase dashboard URL)
8. Copy the **Client ID** and **Client Secret**

## Step 3: Add to Supabase

1. Back in Supabase dashboard
2. Paste Client ID and Client Secret into the Google OAuth form
3. Click **Save**

## Step 4: Configure Supabase URL Allowlist (REQUIRED)

Supabase only allows OAuth `redirectTo` values that match its Redirect URLs allowlist.
If the URL does **not** match, Supabase silently falls back to the **Site URL** — which
is what causes the "ends up at `http://localhost:3000/#` instead of `/auth/callback`" symptom.

Go to **Supabase Dashboard → Authentication → URL Configuration**:

### Site URL

- Dev: `http://localhost:3000`
- Prod: `https://yourapp.com`

### Redirect URLs (add **all** of these)

We pass `?next=/join/<token>` for invite acceptance, so the wildcard form is required:

```
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?**
http://localhost:3000/auth/reset-password
https://yourapp.com/auth/callback
https://yourapp.com/auth/callback?**
https://yourapp.com/auth/reset-password
```

The `?**` wildcard is what allows the `next=…` query param to round-trip through Google → Supabase → your app.

## Step 5: Test It

1. Run frontend: `npm run dev`
2. Go to http://localhost:3000/auth/login
3. Click **Google** button
4. Sign in with your Google account
5. You'll be redirected to `/auth/callback` then to `/lists`

## That's It!

Users can now sign up and log in with:
- ✅ Email + Password
- ✅ Google OAuth
- ✅ GitHub OAuth (same process as Google)

## Troubleshooting

**"Redirect URI mismatch"**
- Make sure the redirect URI in Google Cloud matches exactly what's in Supabase
- Check for trailing slashes

**"Client ID/Secret invalid"**
- Copy again from Google Cloud Console
- Make sure you're using the right credentials (OAuth, not API key)

**Local development issues**
- Make sure your Supabase Site URL is set to `http://localhost:3000` for development
- Go to Supabase Settings → Configuration → Site URL
- For password reset: add `http://localhost:3000/auth/reset-password` to Redirect URLs (Authentication → URL Configuration)

**Lands on `http://localhost:3000/#` (or your Site URL) after Google sign-in**
- Cause: the `redirectTo` URL doesn't match Supabase's Redirect URLs allowlist, so
  Supabase falls back to the Site URL.
- Fix: add `http://localhost:3000/auth/callback` **and** `http://localhost:3000/auth/callback?**`
  to **Authentication → URL Configuration → Redirect URLs**, then sign in again.

**Invite link lands on `/` instead of `/join/<token>` after Google sign-in**
- Cause: same as above — the `?next=/join/...` form of the callback URL isn't
  allowlisted, so Supabase strips it and uses the bare Site URL.
- Fix: ensure the wildcard `http://localhost:3000/auth/callback?**` is in the allowlist.

Done! 🎉
