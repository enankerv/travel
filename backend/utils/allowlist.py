"""Allowlist middleware: block API access for users not in allowed_emails table or ALLOWED_EMAILS env."""
import base64
import json
import logging
import os
import time
from typing import Optional

log = logging.getLogger("allowlist")

_ALLOWED_EMAILS: Optional[set[str]] = None
_CACHE_EXPIRY: float = 0


def _fetch_allowed_emails_from_supabase() -> Optional[set[str]]:
    """Fetch allowed emails from Supabase allowed_emails table (service role)."""
    try:
        from db import get_supabase
        client = get_supabase()
        resp = client.table("allowed_emails").select("email").execute()
        if not resp.data:
            return set()
        emails = {str(r.get("email", "")).strip().lower() for r in resp.data if r.get("email")}
        return emails
    except Exception as e:
        log.warning("Could not fetch allowed_emails from Supabase: %s", e)
        return None


def _get_allowed_emails() -> Optional[set[str]]:
    """Get allowlist: Supabase table first, then ALLOWED_EMAILS env, then allow all."""
    global _ALLOWED_EMAILS, _CACHE_EXPIRY
    now = time.time()
    if _ALLOWED_EMAILS is not None and now < _CACHE_EXPIRY:
        return _ALLOWED_EMAILS

    # Try Supabase table first (single source of truth with auth hook)
    from_db = _fetch_allowed_emails_from_supabase()
    if from_db is not None:
        _ALLOWED_EMAILS = from_db
        _CACHE_EXPIRY = now + 60  # Cache 60 seconds
        if _ALLOWED_EMAILS:
            log.info("Allowlist from Supabase: %d emails", len(_ALLOWED_EMAILS))
        else:
            log.info("Allowlist from Supabase: empty (deny all)")
        return _ALLOWED_EMAILS

    # Fallback: env var (when table doesn't exist yet)
    raw = os.getenv("ALLOWED_EMAILS", "").strip()
    if not raw:
        _ALLOWED_EMAILS = None
        _CACHE_EXPIRY = 0
        return None
    emails = {e.strip().lower() for e in raw.split(",") if e.strip()}
    _ALLOWED_EMAILS = emails
    _CACHE_EXPIRY = now + 60
    log.info("Allowlist from env: %d emails", len(emails))
    return emails


def _decode_jwt_payload(token: str) -> dict:
    """Decode JWT payload (no verification; Supabase validates the token)."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid token format")
    payload = parts[1]
    padding = 4 - len(payload) % 4
    if padding != 4:
        payload += "=" * padding
    decoded = base64.urlsafe_b64decode(payload)
    return json.loads(decoded)


def get_email_from_token(token: str) -> Optional[str]:
    """Extract email from Supabase JWT payload."""
    try:
        data = _decode_jwt_payload(token)
        return (data.get("email") or "").strip().lower() or None
    except Exception:
        return None


def is_email_allowed(email: Optional[str]) -> bool:
    """Check if email is in allowlist. Returns True if allowlist is disabled (None)."""
    allowed = _get_allowed_emails()
    if allowed is None:
        return True  # No allowlist configured
    if not email:
        return False
    return email.lower() in allowed
