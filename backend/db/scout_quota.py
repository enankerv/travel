"""Scout quota: credits only (5 free on first use, no monthly reset). Uses service role."""
from __future__ import annotations

from datetime import datetime
from db.client import get_service_client


def check_and_use_quota(user_id: str) -> tuple[bool, str | None]:
    """
    Check if user has credits, consume one, and return (allowed, error_message).
    Uses service role. New users get 5 credits on first scout.
    """
    client = get_service_client()
    r = client.rpc("use_scout_credit", {"p_user_id": user_id}).execute()
    had_credits = r.data is True

    if not had_credits:
        return False, "You're out of scout credits. Buy a pack to continue."

    return True, None


def get_quota_status(user_id: str) -> dict:
    """Get user's credit balance."""
    service = get_service_client()
    r = service.table("scout_credits").select("balance").eq("user_id", user_id).execute()
    credits = r.data[0]["balance"] if r.data else 5  # New users get 5 when they first scout
    can_scout = credits > 0

    return {"credits": credits, "can_scout": can_scout}


def add_credits(user_id: str, amount: int) -> None:
    """Add purchased credits. Uses service role."""
    if amount <= 0:
        return
    client = get_service_client()
    r = client.table("scout_credits").select("balance").eq("user_id", user_id).execute()
    if r.data:
        current = r.data[0]["balance"]
        client.table("scout_credits").update({"balance": current + amount, "updated_at": datetime.now(datetime.timezone.utc).isoformat()}).eq("user_id", user_id).execute()
    else:
        client.table("scout_credits").insert({"user_id": user_id, "balance": amount}).execute()
