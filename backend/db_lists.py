"""Database utilities for collaborative lists with Supabase using user auth tokens."""
import os
import secrets
from supabase import create_client, Client
from datetime import datetime, timedelta

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Missing Supabase credentials in .env")


def get_supabase_client(auth_token: str = None) -> Client:
    """Get a Supabase client instance.
    
    If auth_token is provided, uses it for authenticated requests (respects RLS).
    Otherwise, uses anon key (still respects RLS based on current auth context).
    """
    if auth_token:
        # Create client with user's auth token
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        # Set the authorization header with the user's token
        client.auth.set_session(access_token=auth_token, refresh_token="")
        return client
    else:
        # Fall back to anon client
        return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ============================================================================
# LIST OPERATIONS
# ============================================================================

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
    """Get all lists for a user (owned + member of).
    RLS automatically filters to user's accessible lists.
    Includes villa_count and member_count for each list.
    """
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

    # Fetch list_members in one query
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

    # Fetch getaway counts per list
    for lst in data:
        members = members_by_list.get(lst["id"], [])
        lst["member_count"] = len(members)  # creator is now in list_members
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
    """Get a specific list with members.
    RLS ensures user has access.
    """
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


# ============================================================================
# LIST MEMBER OPERATIONS
# ============================================================================

def add_list_member(list_id: str, user_id: str, role: str = "viewer", invited_by: str = None, auth_token: str = None) -> dict:
    """Add a user to a list (only admin can do this)."""
    client = get_supabase_client(auth_token)
    data = {
        "list_id": list_id,
        "user_id": user_id,
        "role": role,
        "invited_by": invited_by,
    }
    response = client.table("list_members").insert(data).execute()
    return response.data[0] if response.data else None


def get_list_members(list_id: str, auth_token: str) -> dict:
    """Get all members of a list with profiles. Creator is in list_members with is_creator=true."""
    client = get_supabase_client(auth_token)
    response = client.table("list_members").select("*").eq("list_id", list_id).execute()
    members = response.data or []
    user_ids = [m["user_id"] for m in members]
    profiles = _get_profiles(client, user_ids)
    for m in members:
        m["profile"] = profiles.get(str(m["user_id"])) or {}
    return {"members": members}


def _get_profiles(client, user_ids: list[str]) -> dict[str, dict]:
    """Fetch profiles (first_name, avatar_url only). Returns { user_id: { first_name, avatar_url } }."""
    if not user_ids:
        return {}
    try:
        response = client.table("profiles").select("id, first_name, avatar_url").in_("id", user_ids).execute()
        return {str(p["id"]): {"first_name": p.get("first_name"), "avatar_url": p.get("avatar_url")} for p in (response.data or [])}
    except Exception:
        return {}


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


# ============================================================================
# INVITE TOKEN OPERATIONS
# ============================================================================

def create_invite_token(
    list_id: str,
    created_by: str,
    role: str = "viewer",
    expires_in_days: int = 30,
    max_uses: int = None,
    auth_token: str = None,
) -> dict:
    """Create a shareable invite link token. Revokes any other active tokens for this list."""
    client = get_supabase_client(auth_token)
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(days=expires_in_days)).isoformat()

    data = {
        "list_id": list_id,
        "token": token,
        "created_by": created_by,
        "role": role,
        "expires_at": expires_at,
        "max_uses": max_uses,
    }
    response = client.table("invite_tokens").insert(data).execute()
    new_row = response.data[0] if response.data else None
    if not new_row:
        return None

    # Revoke all other tokens for this list so only one link is valid at a time
    client.table("invite_tokens").update({"is_active": False}).eq(
        "list_id", list_id
    ).neq("id", new_row["id"]).execute()

    return new_row


def get_invite_token(token: str, auth_token: str = None) -> dict:
    """Get invite token details. For invitees (accept flow), use get_invite_for_accept_rpc instead."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("invite_tokens")
        .select("*, lists(id, name)")
        .eq("token", token)
        .eq("is_active", True)
        .execute()
    )
    if not response.data:
        return None

    token_data = response.data[0]

    # Check if token is expired
    if token_data.get("expires_at"):
        expires_at = datetime.fromisoformat(token_data["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(expires_at.tzinfo):
            return None

    # Check if max uses reached
    if token_data.get("max_uses") and token_data["uses_count"] >= token_data["max_uses"]:
        return None

    return token_data


def get_invite_for_accept_rpc(token: str, auth_token: str) -> dict | None:
    """Get invite details via RPC - returns one row only, no enumeration. For invitee flow."""
    client = get_supabase_client(auth_token)
    response = client.rpc("get_invite_for_accept", {"lookup_token": token}).execute()
    data = response.data
    if data is None or (isinstance(data, list) and not data):
        return None
    if isinstance(data, list):
        return data[0] if data else None
    return data


def accept_invite(token: str, user_id: str, auth_token: str) -> dict:
    """Accept an invite via RPC (bypasses RLS so invitee can add themselves)."""
    client = get_supabase_client(auth_token)
    response = client.rpc("accept_invite_rpc", {"lookup_token": token, "joining_user_id": user_id}).execute()
    data = response.data
    if not data:
        raise ValueError("Invalid or expired invite token")
    result = data[0] if isinstance(data, list) else data
    member = result.get("member") if isinstance(result, dict) else result
    return member or result


def list_invite_tokens(list_id: str, auth_token: str) -> list[dict]:
    """Get all invite tokens for a list."""
    client = get_supabase_client(auth_token)
    response = client.table("invite_tokens").select("*").eq("list_id", list_id).execute()
    return response.data or []


def revoke_invite_token(token: str, auth_token: str) -> dict:
    """Deactivate an invite token."""
    client = get_supabase_client(auth_token)
    response = client.table("invite_tokens").update({"is_active": False}).eq("token", token).execute()
    return response.data[0] if response.data else None


# ============================================================================
# GETAWAY OPERATIONS
# ============================================================================

def create_loading_getaway(list_id: str, url: str, auth_token: str = None) -> dict:
    """Create a placeholder getaway row with 'loading' status. Returns the getaway ID."""
    import secrets

    client = get_supabase_client(auth_token)
    slug = f"loading-{secrets.token_hex(4)}"
    data = {
        "list_id": list_id,
        "slug": slug,
        "source_url": url,
        "import_status": "loading",
    }
    response = client.table("getaways").insert(data).execute()
    return response.data[0] if response.data else None


def insert_getaway(list_id: str, user_id: str, getaway_data: dict, auth_token: str = None) -> dict:
    """Insert a new getaway into a list."""
    client = get_supabase_client(auth_token)
    getaway_data["list_id"] = list_id
    getaway_data["user_id"] = user_id
    response = client.table("getaways").insert(getaway_data).execute()
    return response.data[0] if response.data else None


def _attach_images_to_getaways(rows: list[dict]) -> list[dict]:
    """Flatten getaway_images into an 'images' array (sorted by position) on each row."""
    for row in rows:
        imgs = row.pop("getaway_images", None) or []
        row["images"] = [x["image_url"] for x in sorted(imgs, key=lambda i: (i.get("position") or 0))]
    return rows


def get_list_getaways(list_id: str, auth_token: str) -> list[dict]:
    """Get all getaways in a list, with images from getaway_images."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .select("*, getaway_images(image_url, position)")
        .eq("list_id", list_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = response.data or []
    return _attach_images_to_getaways(rows)


def get_getaway_by_slug(list_id: str, slug: str, auth_token: str) -> dict:
    """Get a specific getaway by slug in a list."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .select("*, getaway_images(image_url, position)")
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    if not response.data:
        return None
    rows = _attach_images_to_getaways([response.data[0]])
    return rows[0]


def update_getaway(getaway_id: str, updates: dict, auth_token: str) -> dict:
    """Update a getaway."""
    client = get_supabase_client(auth_token)
    response = client.table("getaways").update(updates).eq("id", getaway_id).execute()
    return response.data[0] if response.data else None


def update_getaway_by_slug(list_id: str, slug: str, updates: dict, auth_token: str) -> dict:
    """Update a getaway by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .update(updates)
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return response.data[0] if response.data else None


def delete_getaway(getaway_id: str, auth_token: str) -> bool:
    """Delete a getaway (getaway_images cascade)."""
    client = get_supabase_client(auth_token)
    response = client.table("getaways").delete().eq("id", getaway_id).execute()
    return len(response.data) > 0 if response.data else False


def delete_getaway_by_slug(list_id: str, slug: str, auth_token: str) -> bool:
    """Delete a getaway by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .delete()
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return len(response.data) > 0 if response.data else False


def insert_getaway_images(getaway_id: str, image_urls: list[str], auth_token: str) -> None:
    """Insert image rows into getaway_images for a getaway. Replaces any existing images for that getaway."""
    if not image_urls:
        return
    client = get_supabase_client(auth_token)
    # Delete existing images for this getaway so we don't duplicate
    client.table("getaway_images").delete().eq("getaway_id", getaway_id).execute()
    rows = [{"getaway_id": getaway_id, "image_url": url, "position": i} for i, url in enumerate(image_urls)]
    client.table("getaway_images").insert(rows).execute()
