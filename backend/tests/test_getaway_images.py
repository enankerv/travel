"""Tests for getaway presigned image upload endpoints."""
import pytest

try:
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    from app import app
    from models import Getaway
    client = TestClient(app)
    _HAS_DEPS = True
except (ImportError, RuntimeError) as e:
    _HAS_DEPS = False
    _IMPORT_ERROR = str(e)
    client = None


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_create_getaway_image_upload_urls():
    auth_headers = {"Authorization": "Bearer fake.jwt.token"}
    getaway = Getaway(
        id="poi-1",
        list_id="list-1",
        poi_type="getaway",
        images=[],
        created_at="t",
        updated_at="t",
    )

    with patch("app.check_terms_and_age", return_value=(True, None)):
        with patch("routes.getaways.extract_auth_token", return_value="fake"):
            with patch.object(Getaway, "get", return_value=getaway):
                with patch("routes.getaways.fetch_poi_image_paths", return_value=[]):
                    with patch(
                        "routes.getaways.create_signed_getaway_upload_urls",
                        return_value=[{
                            "path": "poi-1/00.jpg",
                            "token": "tok",
                            "signed_url": "https://example.com/upload",
                        }],
                    ):
                        r = client.post(
                            "/api/lists/list-1/getaways/poi-1/images/upload-urls",
                            headers=auth_headers,
                            json={"files": [{"content_type": "image/jpeg"}]},
                        )

    assert r.status_code == 200, r.json()
    body = r.json()
    assert body["uploads"][0]["path"] == "poi-1/00.jpg"
    assert body["uploads"][0]["token"] == "tok"


@pytest.mark.skipif(not _HAS_DEPS, reason=f"Missing deps: {_IMPORT_ERROR if not _HAS_DEPS else ''}")
def test_create_getaway_image_upload_urls_rejects_when_at_limit():
    auth_headers = {"Authorization": "Bearer fake.jwt.token"}
    getaway = Getaway(
        id="poi-1",
        list_id="list-1",
        poi_type="getaway",
        images=[],
        created_at="t",
        updated_at="t",
    )

    with patch("app.check_terms_and_age", return_value=(True, None)):
        with patch("routes.getaways.extract_auth_token", return_value="fake"):
            with patch.object(Getaway, "get", return_value=getaway):
                with patch(
                    "routes.getaways.fetch_poi_image_paths",
                    return_value=[f"poi-1/{i:02d}.jpg" for i in range(10)],
                ):
                    r = client.post(
                        "/api/lists/list-1/getaways/poi-1/images/upload-urls",
                        headers=auth_headers,
                        json={"files": [{"content_type": "image/jpeg"}]},
                    )

    assert r.status_code == 400
    assert "Maximum" in r.json().get("detail", "")
