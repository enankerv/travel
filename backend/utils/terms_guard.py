"""Terms and age verification: block API access for users who haven't accepted terms or verified age."""
from __future__ import annotations

import base64
import json
import os
from datetime import datetime
from typing import Optional

from db import get_supabase_client

# Bump this when you update Terms/Privacy. Must match frontend lib/constants.ts
TERMS_UPDATED_AT = os.getenv("TERMS_UPDATED_AT", "2026-03-18T00:00:00Z")

# In-process cache of users verified for the current TERMS_UPDATED_AT version.
# Cleared on redeploy (new process) or when TERMS_UPDATED_AT changes.
_verified_user_ids: set[str] = set()
_verified_cache_terms_version: str | None = None


def _sync_verified_cache_version() -> None:
    """Drop cached verifications when terms version changes (redeploy or terms bump)."""
    global _verified_cache_terms_version
    if _verified_cache_terms_version != TERMS_UPDATED_AT:
        _verified_user_ids.clear()
        _verified_cache_terms_version = TERMS_UPDATED_AT


def clear_terms_verified_cache() -> None:
    """Clear cached verifications (tests / admin)."""
    _verified_user_ids.clear()


def _get_user_id_from_token(token: str) -> Optional[str]:
    """Extract user_id (sub) from Supabase JWT payload."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        decoded = base64.urlsafe_b64decode(payload)
        data = json.loads(decoded)
        return data.get("sub")
    except Exception:
        return None


def get_profile_terms_status(user_id: str, auth_token: str) -> tuple[bool, Optional[str]]:
    """
    Check if user has accepted terms (after TERMS_UPDATED_AT) and verified age.
    Returns (is_verified, error_code).
    error_code: 'TERMS_NOT_ACCEPTED' | 'AGE_NOT_VERIFIED' | None
    """
    try:
        client = get_supabase_client(auth_token)
        resp = client.table("profiles").select("terms_accepted_at, age_verified_at").eq("id", user_id).single().execute()
        if not resp.data:
            return False, "TERMS_NOT_ACCEPTED"

        profile = resp.data
        terms_at = profile.get("terms_accepted_at")
        age_at = profile.get("age_verified_at")

        if not age_at:
            return False, "AGE_NOT_VERIFIED"

        if not terms_at:
            return False, "TERMS_NOT_ACCEPTED"

        try:
            terms_updated = datetime.fromisoformat(TERMS_UPDATED_AT.replace("Z", "+00:00"))
            accepted = datetime.fromisoformat(terms_at.replace("Z", "+00:00")) if isinstance(terms_at, str) else terms_at
            if accepted.tzinfo is None:
                accepted = accepted.replace(tzinfo=terms_updated.tzinfo)
            if accepted < terms_updated:
                return False, "TERMS_NOT_ACCEPTED"
        except (ValueError, TypeError):
            return False, "TERMS_NOT_ACCEPTED"

        return True, None
    except Exception:
        return False, "TERMS_NOT_ACCEPTED"


def check_terms_and_age(token: str) -> tuple[bool, Optional[str]]:
    """Check token bearer has accepted terms and verified age. Returns (ok, error_code)."""
    user_id = _get_user_id_from_token(token)
    if not user_id:
        return False, "TERMS_NOT_ACCEPTED"

    _sync_verified_cache_version()
    if user_id in _verified_user_ids:
        return True, None

    ok, error_code = get_profile_terms_status(user_id, token)
    if ok:
        _verified_user_ids.add(user_id)
    return ok, error_code
