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

## Step 4: Update Frontend Redirect

In your frontend, the redirect URL is already set to:
```
${window.location.origin}/auth/callback
```

For production (e.g., https://yourapp.com):
- Add to Google OAuth: `https://yourapp.com/auth/callback`
- Add to Supabase Site URL: `https://yourapp.com`

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

Done! 🎉
