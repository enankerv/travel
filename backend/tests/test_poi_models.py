"""Tests for POI Pydantic models."""
from models import PoiCreate, PoiUpdate, PoiResponse


def test_poi_create_requires_name():
    poi = PoiCreate(name="Trattoria da Enzo", poi_type="restaurant")
    assert poi.name == "Trattoria da Enzo"
    assert poi.poi_type == "restaurant"
    assert poi.metadata is None


def test_poi_create_defaults_type_to_other():
    poi = PoiCreate(name="Florence")
    assert poi.poi_type == "other"


def test_poi_update_ignores_extra_fields():
    poi = PoiUpdate.model_validate({"name": "Updated", "unexpected": "ignored"})
    dumped = poi.model_dump(exclude_unset=True)
    assert dumped == {"name": "Updated"}
    assert "unexpected" not in dumped


def test_poi_response_accepts_metadata():
    poi = PoiResponse(
        id="abc",
        list_id="list-1",
        slug="florence",
        poi_type="place",
        name="Florence",
        metadata={"population": 380000},
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )
    assert poi.metadata["population"] == 380000
