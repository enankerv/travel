"""Tests for the Poi domain model."""
import pytest
from pydantic import ValidationError

from poi import Poi, PoiInput, PoiPatch


def _sample_row(**overrides: object) -> dict:
    row = {
        "id": "abc",
        "list_id": "list-1",
        "user_id": "user-1",
        "poi_type": "restaurant",
        "name": "Trattoria da Enzo",
        "description": None,
        "location": None,
        "region": None,
        "lat": None,
        "lng": None,
        "source_url": None,
        "notes": None,
        "metadata": {},
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    row.update(overrides)
    return row


def test_poi_from_row_is_fully_typed():
    poi = Poi.from_row(_sample_row())
    assert poi.id == "abc"
    assert poi.list_id == "list-1"
    assert poi.name == "Trattoria da Enzo"
    assert poi.poi_type == "restaurant"
    assert poi.metadata == {}


def test_poi_from_row_requires_persisted_fields():
    with pytest.raises(ValidationError):
        Poi.from_row({"name": "Incomplete"})


def test_poi_input_requires_name():
    with pytest.raises(ValidationError):
        PoiInput(name="")


def test_poi_input_defaults_type_to_other():
    poi_input = PoiInput(name="Florence")
    assert poi_input.poi_type == "other"


def test_poi_patch_allows_partial_fields():
    patch = PoiPatch(name="Updated")
    assert patch.model_dump(exclude_unset=True) == {"name": "Updated"}


def test_poi_patch_ignores_extra_fields():
    patch = PoiPatch.model_validate({"name": "Updated", "unexpected": "ignored"})
    assert patch.model_dump(exclude_unset=True) == {"name": "Updated"}


def test_poi_update_requires_at_least_one_field():
    poi = Poi.from_row(_sample_row())
    with pytest.raises(ValueError, match="No fields to update"):
        poi.update("token", PoiPatch())


def test_poi_delete_raises_when_not_found(monkeypatch):
    poi = Poi.from_row(_sample_row())

    class FakeResponse:
        data = []

    class FakeQuery:
        def delete(self):
            return self

        def eq(self, *_args):
            return self

        def execute(self):
            return FakeResponse()

    class FakeTable:
        def delete(self):
            return FakeQuery()

    monkeypatch.setattr(Poi, "_table", classmethod(lambda cls, _token: FakeTable()))

    with pytest.raises(LookupError):
        poi.delete("token")
