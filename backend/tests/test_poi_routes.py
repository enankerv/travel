"""Tests for POI API routes (spine-only CRUD)."""
import pytest

try:
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    from app import app
    from models import POI
    client = TestClient(app)
    _HAS_DEPS = True
except (ImportError, RuntimeError) as e:
    _HAS_DEPS = False
    _IMPORT_ERROR = str(e)
    client = None

LIST_ID = "list-1"
POI_ID = "poi-1"
AUTH_HEADERS = {"Authorization": "Bearer fake.jwt.token"}


def _sample_poi(**overrides) -> POI:
    data = {
        "id": POI_ID,
        "list_id": LIST_ID,
        "poi_type": "note",
        "title": "Coffee spot",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "images": [],
    }
    data.update(overrides)
    poi = POI.model_validate(data)
    poi._bind_auth_token("fake")
    return poi


@pytest.fixture
def auth_patches():
    with patch("app.check_terms_and_age", return_value=(True, None)):
        with patch("routes.pois.extract_auth_token", return_value="fake"):
            with patch("routes.pois.extract_user_id_from_token", return_value="user-1"):
                yield


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_list_pois(auth_patches):
    poi = _sample_poi()
    with patch.object(POI, "for_list", return_value=[poi]) as for_list:
        r = client.get(f"/api/lists/{LIST_ID}/pois", headers=AUTH_HEADERS)
        assert r.status_code == 200
        assert r.json()[0]["id"] == POI_ID
        assert r.json()[0]["title"] == "Coffee spot"
        for_list.assert_called_once_with(LIST_ID, "fake", poi_type=None)


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_list_pois_filters_by_poi_type(auth_patches):
    note = _sample_poi(poi_type="note")
    with patch.object(POI, "for_list", return_value=[note]) as for_list:
        r = client.get(f"/api/lists/{LIST_ID}/pois?poi_type=note", headers=AUTH_HEADERS)
        assert r.status_code == 200
        assert r.json()[0]["poi_type"] == "note"
        for_list.assert_called_once_with(LIST_ID, "fake", poi_type="note")


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_list_pois_rejects_getaway_filter(auth_patches):
    r = client.get(f"/api/lists/{LIST_ID}/pois?poi_type=getaway", headers=AUTH_HEADERS)
    assert r.status_code == 400
    assert "subtype table" in r.json()["detail"]


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_get_poi(auth_patches):
    poi = _sample_poi()
    with patch.object(POI, "get", return_value=poi):
        r = client.get(f"/api/lists/{LIST_ID}/pois/{POI_ID}", headers=AUTH_HEADERS)
        assert r.status_code == 200
        assert r.json()["id"] == POI_ID


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_get_poi_wrong_list_returns_404(auth_patches):
    poi = _sample_poi(list_id="other-list")
    with patch.object(POI, "get", return_value=poi):
        r = client.get(f"/api/lists/{LIST_ID}/pois/{POI_ID}", headers=AUTH_HEADERS)
        assert r.status_code == 404


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_create_poi_spine_only(auth_patches):
    created = _sample_poi(title="New pin", poi_type="note")
    with patch.object(POI, "new", return_value=created) as new:
        r = client.post(
            f"/api/lists/{LIST_ID}/pois",
            json={"poi_type": "note", "title": "New pin"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["title"] == "New pin"
        new.assert_called_once()
        assert new.call_args.kwargs["user_id"] == "user-1"


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_create_poi_rejects_getaway_subtype(auth_patches):
    with patch.object(POI, "new") as new:
        r = client.post(
            f"/api/lists/{LIST_ID}/pois",
            json={"poi_type": "getaway", "title": "Nope"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 400
        assert "subtype table" in r.json()["detail"]
        new.assert_not_called()


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_update_poi_spine_fields(auth_patches):
    current = _sample_poi()
    updated = _sample_poi(title="Renamed")
    with patch.object(POI, "get", return_value=current):
        with patch.object(POI, "update_by_id", return_value=updated) as update_by_id:
            r = client.put(
                f"/api/lists/{LIST_ID}/pois/{POI_ID}",
                json={"title": "Renamed"},
                headers=AUTH_HEADERS,
            )
            assert r.status_code == 200
            assert r.json()["ok"] is True
            assert r.json()["poi"]["title"] == "Renamed"
            update_by_id.assert_called_once_with(POI_ID, "fake", title="Renamed")


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_update_poi_empty_body_returns_400(auth_patches):
    r = client.put(
        f"/api/lists/{LIST_ID}/pois/{POI_ID}",
        json={},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 400


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_delete_poi(auth_patches):
    poi = _sample_poi()
    with patch.object(POI, "get", return_value=poi):
        with patch.object(POI, "delete_by_id", return_value=True) as delete_by_id:
            r = client.delete(f"/api/lists/{LIST_ID}/pois/{POI_ID}", headers=AUTH_HEADERS)
            assert r.status_code == 200
            assert r.json()["ok"] is True
            delete_by_id.assert_called_once_with(POI_ID, "fake")


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps for route tests: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_delete_poi_not_found(auth_patches):
    with patch.object(POI, "get", return_value=None):
        r = client.delete(f"/api/lists/{LIST_ID}/pois/{POI_ID}", headers=AUTH_HEADERS)
        assert r.status_code == 404
