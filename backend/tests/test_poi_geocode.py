"""Tests for geocoding hooks on POI create/update."""
import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from unittest.mock import patch

import pytest

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
    with patch("utils.geocode.apply_geocode_on_create") as geocode:
        with patch("db.pois.insert_poi_row", return_value={"id": "poi-1"}):
            with patch.object(POI, "get", return_value=_sample_poi()):
                POI.new("list-1", "fake", **fields)
                geocode.assert_called_once_with(fields)


def test_persist_update_geocodes_when_location_changes():
    current = _sample_poi(location="Old town")
    updated = _sample_poi(location="New town", lat=1.0, lng=2.0)
    changes = {"location": "New town"}
    with patch("utils.geocode.apply_geocode_if_location_changed") as geocode:
        with patch.object(POI, "get", side_effect=[current, updated]):
            with patch("db.pois.update_poi_row", return_value={}):
                result = POI._persist_update("poi-1", "fake", POI, changes)
                geocode.assert_called_once_with(current, changes)
                assert result is updated
