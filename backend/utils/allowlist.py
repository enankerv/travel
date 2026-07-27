"""Allowlist middleware: block API access for users not on the invite list."""
from __future__ import annotations

import base64
import json
import logging
import time
from typing import Optional

log = logging.getLogger("allowlist")

_DB_ALLOWED_EMAILS: Optional[set[str]] = None
_DB_CACHE_AT: float = 0.0
_DB_CACHE_TTL_SEC = 60.0


def clear_allowlist_cache() -> None:
    """Clear cached allowlist (tests / after admin updates)."""
    global _DB_ALLOWED_EMAILS, _DB_CACHE_AT
    _DB_ALLOWED_EMAILS = None
    _DB_CACHE_AT = 0.0


def _get_db_allowed_emails() -> Optional[set[str]]:
    """Load allowed_emails table (same source as Supabase signup hook). None if unreadable."""
    global _DB_ALLOWED_EMAILS, _DB_CACHE_AT
    now = time.monotonic()
    if _DB_ALLOWED_EMAILS is not None and (now - _DB_CACHE_AT) < _DB_CACHE_TTL_SEC:
        return _DB_ALLOWED_EMAILS

    try:
        from db.client import get_service_client

        client = get_service_client()
        response = client.table("allowed_emails").select("email").execute()
        emails = {
            row["email"].strip().lower()
            for row in (response.data or [])
            if row.get("email")
        }
        _DB_ALLOWED_EMAILS = emails
        _DB_CACHE_AT = now
        log.info("Allowlist from DB: %d emails", len(emails))
        return emails
    except Exception as exc:
        log.warning("Failed to load allowed_emails from DB: %s", exc)
        return None


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
    """Check invite list membership against allowed_emails table."""
    db = _get_db_allowed_emails()
    if not db:
        return True

    if not email:
        return False

    return email.lower() in db
