"""Low-level profiles table operations."""
from __future__ import annotations

from db.client import get_supabase_client


def fetch_profiles(user_ids: list[str], auth_token: str) -> list[dict]:
    """Fetch profile rows for the given user ids."""
    if not user_ids:
        return []
    try:
        client = get_supabase_client(auth_token)
        response = (
            client.table("profiles")
            .select("id, first_name, avatar_url")
            .in_("id", user_ids)
            .execute()
        )
        return response.data or []
    except Exception:
        return []
