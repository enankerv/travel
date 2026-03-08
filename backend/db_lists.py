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

    # Fetch villa counts per list
    for lst in data:
        members = members_by_list.get(lst["id"], [])
        lst["member_count"] = len(members)  # creator is now in list_members
        try:
            count_resp = (
                client.table("villas")
                .select("id", count="exact")
                .eq("list_id", lst["id"])
                .limit(0)
                .execute()
            )
            lst["villa_count"] = getattr(count_resp, "count", None) or 0
        except Exception:
            lst["villa_count"] = 0
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
    """Create a shareable invite link token."""
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
    return response.data[0] if response.data else None


def get_invite_token(token: str, auth_token: str = None) -> dict:
    """Get invite token details (for accepting invites)."""
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


def accept_invite(token: str, user_id: str, auth_token: str) -> dict:
    """Accept an invite and add user to list."""
    token_data = get_invite_token(token, auth_token)
    if not token_data:
        raise ValueError("Invalid or expired invite token")

    list_id = token_data["lists"]["id"]
    role = token_data["role"]

    # Add user to list
    member = add_list_member(list_id, user_id, role, invited_by=token_data["created_by"], auth_token=auth_token)

    # Increment token uses
    client = get_supabase_client(auth_token)
    client.table("invite_tokens").update({"uses_count": token_data["uses_count"] + 1}).eq(
        "token", token
    ).execute()

    return member


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
# VILLA OPERATIONS (updated for lists)
# ============================================================================

def create_loading_villa(list_id: str, url: str, auth_token: str = None) -> dict:
    """Create a placeholder villa row with 'loading' status. Returns the villa ID."""
    import secrets
    from urllib.parse import urlparse
    
    client = get_supabase_client(auth_token)
    domain = urlparse(url).netloc
    slug = f"loading-{secrets.token_hex(4)}"
    
    data = {
        "list_id": list_id,
        "slug": slug,
        "original_url": url,
        "scrap_status": "loading",
    }
    response = client.table("villas").insert(data).execute()
    return response.data[0] if response.data else None


def insert_villa(list_id: str, user_id: str, villa_data: dict, auth_token: str = None) -> dict:
    """Insert a new villa into a list."""
    client = get_supabase_client(auth_token)
    villa_data["list_id"] = list_id
    villa_data["user_id"] = user_id
    response = client.table("villas").insert(villa_data).execute()
    return response.data[0] if response.data else None


def get_list_villas(list_id: str, auth_token: str) -> list[dict]:
    """Get all villas in a list."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("villas")
        .select("*")
        .eq("list_id", list_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def get_villa_by_slug(list_id: str, slug: str, auth_token: str) -> dict:
    """Get a specific villa by slug in a list."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("villas")
        .select("*")
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return response.data[0] if response.data else None


def update_villa(villa_id: str, updates: dict, auth_token: str) -> dict:
    """Update a villa."""
    client = get_supabase_client(auth_token)
    response = client.table("villas").update(updates).eq("id", villa_id).execute()
    return response.data[0] if response.data else None


def update_villa_by_slug(list_id: str, slug: str, updates: dict, auth_token: str) -> dict:
    """Update a villa by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("villas")
        .update(updates)
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return response.data[0] if response.data else None


def delete_villa(villa_id: str, auth_token: str) -> bool:
    """Delete a villa."""
    client = get_supabase_client(auth_token)
    response = client.table("villas").delete().eq("id", villa_id).execute()
    return len(response.data) > 0 if response.data else False


def delete_villa_by_slug(list_id: str, slug: str, auth_token: str) -> bool:
    """Delete a villa by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("villas")
        .delete()
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return len(response.data) > 0 if response.data else False
