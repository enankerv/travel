"""Tests for invite allowlist (allowed_emails table)."""
import os
from unittest.mock import MagicMock, patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

import pytest

from utils import allowlist


@pytest.fixture(autouse=True)
def reset_allowlist():
    allowlist.clear_allowlist_cache()
    yield
    allowlist.clear_allowlist_cache()


def test_empty_allowlist_allows_everyone():
    with patch.object(allowlist, "_get_db_allowed_emails", return_value=set()):
        assert allowlist.is_email_allowed("anyone@example.com") is True


def test_db_allowlist_blocks_unknown_email():
    with patch.object(
        allowlist,
        "_get_db_allowed_emails",
        return_value={"invited@example.com"},
    ):
        assert allowlist.is_email_allowed("invited@example.com") is True
        assert allowlist.is_email_allowed("stranger@example.com") is False


def test_missing_email_blocked_when_allowlist_active():
    with patch.object(
        allowlist,
        "_get_db_allowed_emails",
        return_value={"invited@example.com"},
    ):
        assert allowlist.is_email_allowed(None) is False


def test_loads_db_allowlist_via_service_client():
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.execute.return_value = MagicMock(
        data=[{"email": "A@Example.com"}, {"email": "b@example.com"}]
    )
    with patch("db.client.get_service_client", return_value=mock_client):
        allowlist.clear_allowlist_cache()
        emails = allowlist._get_db_allowed_emails()
    assert emails == {"a@example.com", "b@example.com"}
