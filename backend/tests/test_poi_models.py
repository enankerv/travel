"""Tests for the Poi domain model."""
import pytest

from poi import Poi


def test_poi_validates_from_row():
    poi = Poi.model_validate(
        {
            "id": "abc",
            "list_id": "list-1",
            "poi_type": "restaurant",
            "name": "Trattoria da Enzo",
            "metadata": {},
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
    )
    assert poi.name == "Trattoria da Enzo"
    assert poi.poi_type == "restaurant"


def test_poi_defaults_type_to_other():
    poi = Poi(name="Florence")
    assert poi.poi_type == "other"


def test_poi_ignores_extra_fields():
    poi = Poi.model_validate({"name": "Test", "unexpected": "ignored"})
    assert not hasattr(poi, "unexpected") or "unexpected" not in poi.model_dump()


def test_poi_create_requires_name():
    with pytest.raises(ValueError, match="name is required"):
        Poi.create("list-1", "user-1", "token", {})


def test_poi_update_requires_persisted_id():
    poi = Poi(name="Florence")
    with pytest.raises(ValueError, match="unpersisted"):
        poi.update("token", {"name": "Updated"})


def test_poi_metadata_defaults_empty():
    poi = Poi(name="Test")
    assert poi.metadata == {}
