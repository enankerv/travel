"""Comments table operations. Per POI; list members read, owner can edit."""
from __future__ import annotations

from db.client import get_supabase_client
from models import Profile


def get_comments_for_list(list_id: str, auth_token: str) -> list[dict]:
    """Get all comments for POIs in a list, with author profiles.

    Comments carry only ``poi_id``; the list is resolved through the parent poi
    via an inner join. Returns { id, poi_id, user_id, body, created_at,
    updated_at, first_name?, avatar_url? }.
    """
    client = get_supabase_client(auth_token)
    response = (
        client.table("comments")
        .select("id, poi_id, user_id, body, created_at, updated_at, pois!inner(list_id)")
        .eq("pois.list_id", list_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = response.data or []
    for r in rows:
        r.pop("pois", None)
    user_ids = list({r["user_id"] for r in rows})
    profiles = Profile.for_user_ids(user_ids, auth_token)
    Profile.enrich_rows(rows, profiles)
    return rows


def get_comments_for_poi(poi_id: str, auth_token: str) -> list[dict]:
    """Get all comments on a single POI, with author profiles (oldest first).

    Returns { id, poi_id, user_id, body, created_at, updated_at, first_name?, avatar_url? }.
    """
    client = get_supabase_client(auth_token)
    response = (
        client.table("comments")
        .select("id, poi_id, user_id, body, created_at, updated_at")
        .eq("poi_id", poi_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = response.data or []
    user_ids = list({r["user_id"] for r in rows})
    profiles = Profile.for_user_ids(user_ids, auth_token)
    Profile.enrich_rows(rows, profiles)
    return rows


def create_comment(poi_id: str, user_id: str, body: str, auth_token: str) -> dict | None:
    """Create a comment on a POI. RLS enforces list membership."""
    client = get_supabase_client(auth_token)
    data = {"poi_id": poi_id, "user_id": user_id, "body": body}
    try:
        response = client.table("comments").insert(data).execute()
        row = response.data[0] if response.data else None
        if row:
            Profile.enrich_rows([row], Profile.for_user_ids([user_id], auth_token))
        return row
    except Exception:
        return None


def update_comment(comment_id: str, user_id: str, body: str, auth_token: str) -> dict | None:
    """Update a comment. Only owner can update."""
    client = get_supabase_client(auth_token)
    try:
        response = (
            client.table("comments")
            .update({"body": body})
            .eq("id", comment_id)
            .eq("user_id", user_id)
            .execute()
        )
        row = response.data[0] if response.data else None
        if row:
            Profile.enrich_rows([row], Profile.for_user_ids([user_id], auth_token))
        return row
    except Exception:
        return None


def delete_comment(comment_id: str, user_id: str, auth_token: str) -> bool:
    """Delete a comment. Only owner can delete."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("comments")
        .delete()
        .eq("id", comment_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(response.data or []) > 0
