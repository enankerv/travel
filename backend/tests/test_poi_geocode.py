"""Tests for geocoding hooks on POI create/update."""
import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from unittest.mock import patch

from models import POI


def _sample_poi(**overrides) -> POI:
    data = {
        "id": "poi-1",
        "list_id": "list-1",
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


def test_new_geocodes_before_insert():
    fields = {"poi_type": "note", "title": "Pin", "location": "Paris"}
    with patch("utils.geocode.geocode", return_value=(48.8, 2.3)) as geocode_fn:
        with patch("db.pois.insert_poi_row", return_value={"id": "poi-1"}) as insert:
            with patch.object(POI, "get", return_value=_sample_poi()):
                POI.new("list-1", "fake", user_id="user-1", **fields)
                geocode_fn.assert_called_once_with("Paris", user_id="user-1")
                spine = insert.call_args[0][1]
                assert spine["lat"] == 48.8
                assert spine["lng"] == 2.3


def test_new_prefers_address_for_geocode():
    fields = {
        "poi_type": "restaurant",
        "title": "Osteria",
        "location": "Cetona, Italy",
        "address": "Via Roma 1, Cetona, Italy",
    }
    with patch("utils.geocode.geocode", return_value=(42.99, 11.95)) as geocode_fn:
        with patch("db.pois.insert_poi_row", return_value={"id": "poi-1"}) as insert:
            with patch.object(POI, "get", return_value=_sample_poi()):
                POI.new("list-1", "fake", user_id="user-1", **fields)
                geocode_fn.assert_called_once_with("Via Roma 1, Cetona, Italy", user_id="user-1")
                spine = insert.call_args[0][1]
                assert spine["lat"] == 42.99
                assert spine["lng"] == 11.95


def test_new_skips_geocode_when_coords_present():
    fields = {
        "poi_type": "restaurant",
        "title": "Osteria",
        "location": "Cetona, Italy",
        "address": "Via Roma 1, Cetona, Italy",
        "lat": 42.993,
        "lng": 11.952,
    }
    with patch("utils.geocode.geocode") as geocode_fn:
        with patch("db.pois.insert_poi_row", return_value={"id": "poi-1"}) as insert:
            with patch.object(POI, "get", return_value=_sample_poi()):
                POI.new("list-1", "fake", user_id="user-1", **fields)
                geocode_fn.assert_not_called()
                spine = insert.call_args[0][1]
                assert spine["lat"] == 42.993
                assert spine["lng"] == 11.952


def test_persist_update_geocodes_when_location_changes():
    current = _sample_poi(location="Old town")
    updated = _sample_poi(location="New town", lat=1.0, lng=2.0)
    changes = {"location": "New town"}
    with patch("utils.geocode.geocode", return_value=(3.0, 4.0)) as geocode:
        with patch("routes.auth.extract_user_id_from_token", return_value="user-1"):
            with patch.object(POI, "get", side_effect=[current, updated]):
                with patch("db.pois.update_poi_row", return_value={}):
                    result = POI._persist_update("poi-1", "fake", POI, changes)
                    geocode.assert_called_once_with("New town", user_id="user-1")
                    assert changes["lat"] == 3.0
                    assert changes["lng"] == 4.0
                    assert result.poi is updated
