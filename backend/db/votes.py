"""Votes table operations. One vote per user per getaway per list."""
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
    """Get all votes for getaways in a list, with voter profiles.
    Returns list of { getaway_id, user_id, first_name?, avatar_url? }.
    """
    client = get_supabase_client(auth_token)
    response = (
        client.table("votes")
        .select("getaway_id, user_id")
        .eq("list_id", list_id)
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


def add_vote(list_id: str, getaway_id: str, user_id: str, auth_token: str) -> dict | None:
    """Add a vote. User must be list member. Getaway must belong to list. Returns vote row or None if duplicate."""
    client = get_supabase_client(auth_token)
    # Verify getaway belongs to list
    g = client.table("getaways").select("id").eq("id", getaway_id).eq("list_id", list_id).execute()
    if not g.data:
        return None
    data = {"list_id": list_id, "getaway_id": getaway_id, "user_id": user_id}
    try:
        response = client.table("votes").insert(data).execute()
        return response.data[0] if response.data else None
    except Exception:
        return None  # Likely unique constraint violation


def remove_vote(list_id: str, getaway_id: str, user_id: str, auth_token: str) -> bool:
    """Remove a vote. User can only remove their own."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("votes")
        .delete()
        .eq("list_id", list_id)
        .eq("getaway_id", getaway_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(response.data or []) > 0
