"""Tests for Scout API routes (rate limit 429)."""
import pytest

try:
    from unittest.mock import patch, MagicMock
    from fastapi.testclient import TestClient
    from app import app
    client = TestClient(app)
    _HAS_DEPS = True
except (ImportError, RuntimeError) as e:
    _HAS_DEPS = False
    _IMPORT_ERROR = str(e)
    client = None


@pytest.fixture(autouse=True)
def reset_rate_limit():
    """Clear rate limit state before each test."""
    from utils.rate_limit import reset_for_tests
    reset_for_tests()
    yield
    reset_for_tests()


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_scout_returns_429_when_rate_limited():
    """Scout endpoint returns 429 when user exceeds rate limit."""
    auth_headers = {"Authorization": "Bearer fake.jwt.token"}

    with patch("utils.terms_guard.check_terms_and_age", return_value=(True, None)):
        with patch("routes.scout.extract_auth_token", return_value="fake"):
            with patch("routes.scout.extract_user_id_from_token", return_value="rl-test-user"):
                with patch("routes.scout.create_loading_getaway", return_value={"id": "g1"}):
                    with patch("routes.scout.update_getaway"):
                        with patch("routes.scout._process_scout", new=MagicMock()):
                            # Exhaust rate limit (default 10)
                            for _ in range(10):
                                r = client.post(
                                    "/api/scout",
                                    json={"url": "https://example.com/villa/1", "list_id": "list-1"},
                                    headers=auth_headers,
                                )
                                assert r.status_code == 200, r.json()

                            # 11th request should be 429
                            r = client.post(
                                "/api/scout",
                                json={"url": "https://example.com/villa/2", "list_id": "list-1"},
                                headers=auth_headers,
                            )
                            assert r.status_code == 429
                            assert "Too many" in r.json().get("detail", "")
