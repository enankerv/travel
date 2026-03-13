"""List table operations."""
from db.client import get_supabase_client


def create_list(user_id: str, name: str, description: str = None, auth_token: str = None) -> dict:
    """Create a new list via RPC (uses auth.uid() from JWT, bypasses RLS)."""
    client = get_supabase_client(auth_token)
    params = {"list_name": name}
    if description is not None:
        params["list_description"] = description
    response = client.rpc("create_list_rpc", params).execute()
    row = response.data
    if isinstance(row, dict):
        return row
    if isinstance(row, list) and row:
        return row[0]
    return None


def get_user_lists(auth_token: str) -> list[dict]:
    """Get all lists for a user (owned + member of). Includes villa_count and member_count."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("lists")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    data = response.data or []
    if not data:
        return data

    list_ids = [lst["id"] for lst in data]
    members_resp = (
        client.table("list_members")
        .select("list_id, user_id, role")
        .in_("list_id", list_ids)
        .execute()
    )
    members_by_list: dict[str, list] = {lid: [] for lid in list_ids}
    for m in members_resp.data or []:
        lid = m.get("list_id")
        if lid:
            members_by_list.setdefault(lid, []).append(m)

    for lst in data:
        members = members_by_list.get(lst["id"], [])
        lst["member_count"] = len(members)
        try:
            count_resp = (
                client.table("getaways")
                .select("id", count="exact")
                .eq("list_id", lst["id"])
                .limit(0)
                .execute()
            )
            lst["getaway_count"] = getattr(count_resp, "count", None) or 0
        except Exception:
            lst["getaway_count"] = 0
    return data


def get_list_by_id(list_id: str, auth_token: str) -> dict:
    """Get a specific list with members. RLS ensures user has access."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("lists")
        .select("*, list_members(user_id, role)")
        .eq("id", list_id)
        .single()
        .execute()
    )
    return response.data if response.data else None


def update_list(list_id: str, updates: dict, auth_token: str) -> dict:
    """Update a list (only creator can do this)."""
    client = get_supabase_client(auth_token)
    response = client.table("lists").update(updates).eq("id", list_id).execute()
    return response.data[0] if response.data else None


def delete_list(list_id: str, auth_token: str) -> bool:
    """Delete a list (only creator can do this)."""
    client = get_supabase_client(auth_token)
    response = client.table("lists").delete().eq("id", list_id).execute()
    return len(response.data) > 0 if response.data else False
