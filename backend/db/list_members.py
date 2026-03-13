"""List members table operations."""
from db.client import get_supabase_client


def _get_profiles(client, user_ids: list[str]) -> dict[str, dict]:
    """Fetch profiles (first_name, avatar_url only). Returns { user_id: { first_name, avatar_url } }."""
    if not user_ids:
        return {}
    try:
        response = client.table("profiles").select("id, first_name, avatar_url").in_("id", user_ids).execute()
        return {str(p["id"]): {"first_name": p.get("first_name"), "avatar_url": p.get("avatar_url")} for p in (response.data or [])}
    except Exception:
        return {}


def add_list_member(list_id: str, user_id: str, role: str = "viewer", invited_by: str = None, auth_token: str = None) -> dict:
    """Add a user to a list (only admin can do this)."""
    client = get_supabase_client(auth_token)
    data = {"list_id": list_id, "user_id": user_id, "role": role, "invited_by": invited_by}
    response = client.table("list_members").insert(data).execute()
    return response.data[0] if response.data else None


def get_list_members(list_id: str, auth_token: str) -> dict:
    """Get all members of a list with profiles."""
    client = get_supabase_client(auth_token)
    response = client.table("list_members").select("*").eq("list_id", list_id).execute()
    members = response.data or []
    user_ids = [m["user_id"] for m in members]
    profiles = _get_profiles(client, user_ids)
    for m in members:
        m["profile"] = profiles.get(str(m["user_id"])) or {}
    return {"members": members}


def update_member_role(list_id: str, user_id: str, new_role: str, auth_token: str) -> dict:
    """Update a member's role in a list."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("list_members")
        .update({"role": new_role})
        .eq("list_id", list_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None


def remove_list_member(list_id: str, user_id: str, auth_token: str) -> bool:
    """Remove a user from a list."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("list_members")
        .delete()
        .eq("list_id", list_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(response.data) > 0 if response.data else False
