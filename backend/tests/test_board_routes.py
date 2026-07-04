"""Tests for board snapshot API."""
import pytest

try:
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    from app import app
    client = TestClient(app)
    _HAS_DEPS = True
except (ImportError, RuntimeError) as e:
    _HAS_DEPS = False
    _IMPORT_ERROR = str(e)
    client = None

LIST_ID = "list-1"
AUTH_HEADERS = {"Authorization": "Bearer fake.jwt.token"}


@pytest.fixture
def auth_patches():
    with patch("app.check_terms_and_age", return_value=(True, None)):
        with patch("routes.board.extract_auth_token", return_value="fake"):
            yield


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_get_board(auth_patches):
    snapshot = {
        "list": {
            "id": LIST_ID,
            "user_id": "user-1",
            "name": "Trip",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        },
        "members": [{"user_id": "user-1", "role": "admin"}],
        "pois": [
            {
                "id": "poi-1",
                "list_id": LIST_ID,
                "poi_type": "poi",
                "title": "Coffee",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
                "comments": [
                    {
                        "id": "c-1",
                        "poi_id": "poi-1",
                        "user_id": "user-1",
                        "body": "Nice spot",
                        "created_at": "2026-01-01T00:00:00Z",
                        "updated_at": "2026-01-01T00:00:00Z",
                    }
                ],
                "votes": [
                    {"poi_id": "poi-1", "user_id": "user-1"},
                ],
            }
        ],
    }
    with patch("routes.board.BoardResponse.snapshot", return_value=snapshot):
        r = client.get(f"/api/lists/{LIST_ID}/board", headers=AUTH_HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert data["list"]["name"] == "Trip"
        assert data["pois"][0]["comments"][0]["body"] == "Nice spot"
        assert data["pois"][0]["votes"][0]["user_id"] == "user-1"


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_get_board_not_found(auth_patches):
    with patch("routes.board.BoardResponse.snapshot", return_value=None):
        r = client.get(f"/api/lists/{LIST_ID}/board", headers=AUTH_HEADERS)
        assert r.status_code == 404
