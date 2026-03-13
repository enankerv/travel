"""Invite tokens table operations."""
import secrets
from datetime import datetime, timedelta
from db.client import get_supabase_client


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
    client.table("invite_tokens").update({"is_active": False}).eq(
        "list_id", list_id
    ).neq("id", new_row["id"]).execute()
    return new_row


def get_invite_token(token: str, auth_token: str = None) -> dict:
    """Get invite token details."""
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
    if token_data.get("expires_at"):
        expires_at = datetime.fromisoformat(token_data["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(expires_at.tzinfo):
            return None
    if token_data.get("max_uses") and token_data["uses_count"] >= token_data["max_uses"]:
        return None
    return token_data


def get_invite_for_accept_rpc(token: str, auth_token: str) -> dict | None:
    """Get invite details via RPC - returns one row only. For invitee flow."""
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
