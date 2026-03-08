"""Allowlist middleware: block API access for users not in ALLOWED_EMAILS env."""
import base64
import json
import logging
import os
from typing import Optional

log = logging.getLogger("allowlist")

_ALLOWED_EMAILS: Optional[set[str]] = None


def _get_allowed_emails() -> Optional[set[str]]:
    """Get allowlist from ALLOWED_EMAILS env (comma-separated). None = allow all."""
    global _ALLOWED_EMAILS
    if _ALLOWED_EMAILS is not None:
        return _ALLOWED_EMAILS
    raw = os.getenv("ALLOWED_EMAILS", "").strip()
    if not raw:
        _ALLOWED_EMAILS = None
        return None
    emails = {e.strip().lower() for e in raw.split(",") if e.strip()}
    _ALLOWED_EMAILS = emails
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
