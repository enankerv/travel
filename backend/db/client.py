"""Supabase client factory."""
from __future__ import annotations

import os

from supabase import create_client, Client
from supabase.client import ClientOptions

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Missing Supabase credentials in .env")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Missing SUPABASE_SERVICE_ROLE_KEY in .env")


def get_supabase_client(auth_token: str | None = None) -> Client:
    """Build a Supabase client.

    When ``auth_token`` is provided we attach ``Authorization: Bearer <token>``
    via ``ClientOptions.headers`` so PostgREST and Storage authenticate as that
    user (RLS still applies). We deliberately do NOT call
    ``client.auth.set_session(...)`` because that triggers a
    ``GET /auth/v1/user`` round trip on every construction. The JWT signature is
    validated locally upstream (see ``utils.terms_guard`` / ``utils.allowlist``).
    """
    if not auth_token:
        return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return create_client(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {auth_token}"},
        ),
    )


def get_service_client() -> Client:
    """Get a Supabase client with service role key. Bypasses RLS."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
