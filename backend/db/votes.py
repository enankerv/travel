"""Votes table operations. One vote per user per POI; list members read all."""
from __future__ import annotations

from db.client import get_supabase_client


def _get_profiles(client, user_ids: list[str]) -> dict[str, dict]:
    """Fetch profiles (first_name, avatar_url). Returns { user_id: { first_name, avatar_url } }."""
    if not user_ids:
        return {}
    try:
        response = client.table("profiles").select("id, first_name, avatar_url").in_("id", user_ids).execute()
        return {str(p["id"]): {"first_name": p.get("first_name"), "avatar_url": p.get("avatar_url")} for p in (response.data or [])}
    except Exception:
        return {}


def get_votes_for_list(list_id: str, auth_token: str) -> list[dict]:
    """Get all votes for POIs in a list, with voter profiles.

    Votes carry only ``poi_id``; the list is resolved through the parent poi
    via an inner join. Returns list of { poi_id, user_id, first_name?, avatar_url? }.
    """
    client = get_supabase_client(auth_token)
    response = (
        client.table("votes")
        .select("poi_id, user_id, pois!inner(list_id)")
        .eq("pois.list_id", list_id)
        .execute()
    )
    rows = response.data or []
    for r in rows:
        r.pop("pois", None)
    user_ids = list({r["user_id"] for r in rows})
    profiles = _get_profiles(client, user_ids)
    for r in rows:
        p = profiles.get(str(r["user_id"])) or {}
        r["first_name"] = p.get("first_name")
        r["avatar_url"] = p.get("avatar_url")
    return rows


def get_votes_for_poi(poi_id: str, auth_token: str) -> list[dict]:
    """Get all votes on a single POI, with voter profiles.

    Returns list of { poi_id, user_id, first_name?, avatar_url? }.
    """
    client = get_supabase_client(auth_token)
    response = (
        client.table("votes")
        .select("poi_id, user_id")
        .eq("poi_id", poi_id)
        .execute()
    )
    rows = response.data or []
    user_ids = list({r["user_id"] for r in rows})
    profiles = _get_profiles(client, user_ids)
    for r in rows:
        p = profiles.get(str(r["user_id"])) or {}
        r["first_name"] = p.get("first_name")
        r["avatar_url"] = p.get("avatar_url")
    return rows


def add_vote(poi_id: str, user_id: str, auth_token: str) -> dict | None:
    """Add a vote for a POI. RLS enforces list membership. None on duplicate/denied."""
    client = get_supabase_client(auth_token)
    try:
        response = client.table("votes").insert({"poi_id": poi_id, "user_id": user_id}).execute()
        return response.data[0] if response.data else None
    except Exception:
        return None  # Likely unique constraint violation or RLS denial


def remove_vote(poi_id: str, user_id: str, auth_token: str) -> bool:
    """Remove a vote. User can only remove their own."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("votes")
        .delete()
        .eq("poi_id", poi_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(response.data or []) > 0
