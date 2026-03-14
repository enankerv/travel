"""Comments table operations. Per getaway per list; list members read, owner can edit."""
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


def get_comments_for_list(list_id: str, auth_token: str) -> list[dict]:
    """Get all comments for getaways in a list, with author profiles.
    Returns list of { id, list_id, getaway_id, user_id, body, created_at, updated_at, first_name?, avatar_url? }.
    """
    client = get_supabase_client(auth_token)
    response = (
        client.table("comments")
        .select("id, list_id, getaway_id, user_id, body, created_at, updated_at")
        .eq("list_id", list_id)
        .order("created_at", desc=False)
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


def create_comment(list_id: str, getaway_id: str, user_id: str, body: str, auth_token: str) -> dict | None:
    """Create a comment. User must be list member. Getaway must belong to list."""
    client = get_supabase_client(auth_token)
    g = client.table("getaways").select("id").eq("id", getaway_id).eq("list_id", list_id).execute()
    if not g.data:
        return None
    data = {"list_id": list_id, "getaway_id": getaway_id, "user_id": user_id, "body": body}
    try:
        response = client.table("comments").insert(data).execute()
        row = response.data[0] if response.data else None
        if row:
            p = _get_profiles(client, [user_id]).get(str(user_id)) or {}
            row["first_name"] = p.get("first_name")
            row["avatar_url"] = p.get("avatar_url")
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
            p = _get_profiles(client, [user_id]).get(str(user_id)) or {}
            row["first_name"] = p.get("first_name")
            row["avatar_url"] = p.get("avatar_url")
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
