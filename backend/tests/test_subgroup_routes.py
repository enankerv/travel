"""Tests for board subgroup API routes."""
import pytest

try:
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    from app import app
    from models import BoardSubgroup
    client = TestClient(app)
    _HAS_DEPS = True
except (ImportError, RuntimeError) as e:
    _HAS_DEPS = False
    _IMPORT_ERROR = str(e)
    client = None

LIST_ID = "list-1"
SUBGROUP_ID = "sg-1"
AUTH_HEADERS = {"Authorization": "Bearer fake.jwt.token"}


def _sample_subgroup(**overrides) -> BoardSubgroup:
    data = {
        "id": SUBGROUP_ID,
        "list_id": LIST_ID,
        "parent_subgroup_id": None,
        "name": "Day 1",
        "board_x": 0.35,
        "board_y": 0.35,
        "board_w": 0.3,
        "board_h": 0.25,
        "board_z": 0,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    data.update(overrides)
    return BoardSubgroup.model_validate(data)


@pytest.fixture
def auth_patches():
    with patch("app.check_terms_and_age", return_value=(True, None)):
        with patch("routes.subgroups.extract_auth_token", return_value="fake"):
            yield


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_list_subgroups(auth_patches):
    sg = _sample_subgroup()
    with patch("routes.subgroups.get_subgroups_for_list", return_value=[sg.model_dump()]) as for_list:
        r = client.get(f"/api/lists/{LIST_ID}/subgroups", headers=AUTH_HEADERS)
        assert r.status_code == 200
        assert r.json()[0]["id"] == SUBGROUP_ID
        assert r.json()[0]["name"] == "Day 1"
        for_list.assert_called_once_with(LIST_ID, "fake")


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_create_subgroup(auth_patches):
    created = _sample_subgroup(name="Food")
    with patch("routes.subgroups.create_subgroup", return_value=created.model_dump()) as create:
        r = client.post(
            f"/api/lists/{LIST_ID}/subgroups",
            json={"name": "Food"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Food"
        create.assert_called_once()


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_update_subgroup(auth_patches):
    current = _sample_subgroup()
    updated = _sample_subgroup(name="Renamed")
    with patch("routes.subgroups.subgroup_belongs_to_list", return_value=True):
        with patch("routes.subgroups.get_subgroup_by_id", return_value=current.model_dump()):
            with patch("routes.subgroups.update_subgroup", return_value=updated.model_dump()) as update:
                r = client.put(
                    f"/api/lists/{LIST_ID}/subgroups/{SUBGROUP_ID}",
                    json={"name": "Renamed"},
                    headers=AUTH_HEADERS,
                )
                assert r.status_code == 200
                assert r.json()["name"] == "Renamed"
                update.assert_called_once_with(SUBGROUP_ID, "fake", name="Renamed")


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_delete_subgroup(auth_patches):
    current = _sample_subgroup()
    with patch("routes.subgroups.subgroup_belongs_to_list", return_value=True):
        with patch("routes.subgroups.get_subgroup_by_id", return_value=current.model_dump()):
            with patch("routes.subgroups.delete_subgroup", return_value=True) as delete:
                r = client.delete(
                    f"/api/lists/{LIST_ID}/subgroups/{SUBGROUP_ID}",
                    headers=AUTH_HEADERS,
                )
                assert r.status_code == 200
                assert r.json()["ok"] is True
                delete.assert_called_once_with(SUBGROUP_ID, "fake")
