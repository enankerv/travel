"""Supabase client factory."""
import os
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Missing Supabase credentials in .env")


def get_supabase_client(auth_token: str = None) -> Client:
    """Get a Supabase client instance.
    If auth_token is provided, uses it for authenticated requests (respects RLS).
    Otherwise, uses anon key.
    """
    if auth_token:
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        client.auth.set_session(access_token=auth_token, refresh_token="")
        return client
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def get_service_client() -> Client | None:
    """Get a Supabase client with service role key. Bypasses RLS. Returns None if key not set."""
    if not SUPABASE_SERVICE_ROLE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
