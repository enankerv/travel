# Supabase Auth Hook: Allowlist Setup

This blocks signups at the source. Only emails in the `allowed_emails` table can create accounts. Combined with the backend allowlist, this prevents direct Supabase access by non-invited users.

## 1. Run the SQL migration

In **Supabase Dashboard** → **SQL Editor**, run the contents of `supabase_auth_hook_allowlist.sql`:

- Creates `allowed_emails` table
- Creates `hook_before_user_created` function
- Sets up permissions

## 2. Add your first allowed email

```sql
INSERT INTO public.allowed_emails (email) VALUES ('your-email@gmail.com');
```

Add more friends:

```sql
INSERT INTO public.allowed_emails (email) VALUES ('friend1@gmail.com'), ('friend2@gmail.com');
```

## 3. Enable the hook in Supabase (required)

**If you skip this step, the hook will not run and anyone can sign up.**

1. Go to **Supabase Dashboard** → **Authentication** → **Auth Hooks**  
   (Direct link: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/auth/auth-hooks`)
2. Click **Add hook** (or **Enable** for Before user created)
3. Select **Before user created**
4. Choose **Postgres function** (not HTTP)
5. Select function: `public.hook_before_user_created`
6. Save

**Troubleshooting:** If OAuth signups still succeed, the hook is not enabled. Double-check step 3.

## 4. Backend behavior

The backend reads from the same `allowed_emails` table (cached 60s). If the table doesn't exist yet, it falls back to the `ALLOWED_EMAILS` env var.

**Single source of truth:** Use the `allowed_emails` table. You can remove `ALLOWED_EMAILS` from Railway once the migration is run.

## Flow

| Step | What happens |
|------|--------------|
| User tries to sign up (OAuth or email) | Supabase Auth calls the hook before creating the user |
| Hook checks `allowed_emails` | If email not in table → signup rejected with 403 |
| If email in table | User is created, can sign in |
| User calls your API | Backend middleware checks same table, returns 403 if not allowed |

Non-invited users cannot create accounts, so they cannot access Supabase directly.
