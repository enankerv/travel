"""Tests for terms verification cache."""
import base64
import json
import os
from unittest.mock import patch

# terms_guard imports db at load time
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

import pytest

from utils import terms_guard


def _fake_token(user_id: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"sub": user_id}).encode()).decode().rstrip("=")
    return f"hdr.{payload}.sig"


@pytest.fixture(autouse=True)
def reset_terms_cache():
    terms_guard.clear_terms_verified_cache()
    terms_guard._verified_cache_terms_version = terms_guard.TERMS_UPDATED_AT
    yield
    terms_guard.clear_terms_verified_cache()
    terms_guard._verified_cache_terms_version = terms_guard.TERMS_UPDATED_AT


def test_verified_user_is_cached():
    token = _fake_token("user-1")
    with patch.object(terms_guard, "get_profile_terms_status", return_value=(True, None)) as lookup:
        assert terms_guard.check_terms_and_age(token) == (True, None)
        assert terms_guard.check_terms_and_age(token) == (True, None)
        lookup.assert_called_once()


def test_failed_verification_is_not_cached():
    token = _fake_token("user-2")
    with patch.object(
        terms_guard,
        "get_profile_terms_status",
        side_effect=[(False, "AGE_NOT_VERIFIED"), (True, None)],
    ) as lookup:
        assert terms_guard.check_terms_and_age(token) == (False, "AGE_NOT_VERIFIED")
        assert terms_guard.check_terms_and_age(token) == (True, None)
        assert lookup.call_count == 2


def test_terms_version_bump_clears_cache():
    token = _fake_token("user-3")
    with patch.object(terms_guard, "get_profile_terms_status", return_value=(True, None)) as lookup:
        assert terms_guard.check_terms_and_age(token) == (True, None)
        lookup.assert_called_once()

        with patch.object(terms_guard, "TERMS_UPDATED_AT", "2027-01-01T00:00:00Z"):
            assert terms_guard.check_terms_and_age(token) == (True, None)
            assert lookup.call_count == 2
