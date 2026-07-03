"""Point of interest domain model (entity + persistence)."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field

from utils.geocode import geocode_from_location_region

PoiType = Literal["restaurant", "activity", "business", "place", "other"]

# Extensible type-specific payload; graduates to dedicated columns/tables later.
PoiMetadata = dict[str, Any]


class PoiInput(BaseModel):
    """Fields accepted when creating a POI."""

    model_config = ConfigDict(extra="ignore")

    poi_type: PoiType = "other"
    name: str = Field(min_length=1)
    description: str | None = None
    location: str | None = None
    region: str | None = None
    lat: float | None = None
    lng: float | None = None
    source_url: str | None = None
    notes: str | None = None
    metadata: PoiMetadata | None = None


class PoiPatch(BaseModel):
    """Fields accepted when partially updating a POI."""

    model_config = ConfigDict(extra="ignore")

    poi_type: PoiType | None = None
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    location: str | None = None
    region: str | None = None
    lat: float | None = None
    lng: float | None = None
    source_url: str | None = None
    notes: str | None = None
    metadata: PoiMetadata | None = None


class Poi(BaseModel):
    """
    A persisted point of interest on a list.

    Returned by all read and write operations. Input shapes are ``PoiInput``
    (create) and ``PoiPatch`` (update).
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    list_id: str
    user_id: str | None
    poi_type: PoiType
    name: str
    description: str | None = None
    location: str | None = None
    region: str | None = None
    lat: float | None = None
    lng: float | None = None
    source_url: str | None = None
    notes: str | None = None
    metadata: PoiMetadata = Field(default_factory=dict)
    created_at: str
    updated_at: str

    @classmethod
    def _table(cls, auth_token: str):
        from db.client import get_supabase_client

        return get_supabase_client(auth_token).table("pois")

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> Self:
        """Parse a DB row into a fully typed persisted POI."""
        return cls.model_validate(row)

    @classmethod
    def list_for(
        cls,
        list_id: str,
        auth_token: str,
        *,
        poi_type: PoiType | None = None,
    ) -> list[Self]:
        query = (
            cls._table(auth_token)
            .select("*")
            .eq("list_id", list_id)
            .order("created_at", desc=True)
        )
        if poi_type is not None:
            query = query.eq("poi_type", poi_type)
        response = query.execute()
        return [cls.from_row(row) for row in (response.data or [])]

    @classmethod
    def get(cls, list_id: str, poi_id: str, auth_token: str) -> Self | None:
        response = (
            cls._table(auth_token)
            .select("*")
            .eq("list_id", list_id)
            .eq("id", poi_id)
            .execute()
        )
        if not response.data:
            return None
        return cls.from_row(response.data[0])

    @classmethod
    def create(cls, list_id: str, user_id: str, auth_token: str, input: PoiInput) -> Self:
        data = input.model_dump(exclude_unset=True)
        data["name"] = input.name.strip()
        if data.get("metadata") is None:
            data["metadata"] = {}
        cls._geocode_fields(data)
        data["list_id"] = list_id
        data["user_id"] = user_id

        response = cls._table(auth_token).insert(data).execute()
        if not response.data:
            raise RuntimeError("Failed to create POI")
        return cls.from_row(response.data[0])

    def update(self, auth_token: str, patch: PoiPatch) -> Self:
        updates = patch.model_dump(exclude_unset=True)
        if not updates:
            raise ValueError("No fields to update")

        type(self)._geocode_on_location_change(self.model_dump(), updates)

        response = (
            type(self)
            ._table(auth_token)
            .update(updates)
            .eq("list_id", self.list_id)
            .eq("id", self.id)
            .execute()
        )
        if not response.data:
            raise LookupError("POI not found")
        return type(self).from_row(response.data[0])

    def delete(self, auth_token: str) -> None:
        response = (
            type(self)
            ._table(auth_token)
            .delete()
            .eq("list_id", self.list_id)
            .eq("id", self.id)
            .execute()
        )
        if not response.data:
            raise LookupError("POI not found")

    @staticmethod
    def _geocode_fields(data: dict[str, Any]) -> None:
        if data.get("lat") is not None and data.get("lng") is not None:
            return
        lat, lng = geocode_from_location_region(data.get("location"), data.get("region"))
        if lat is not None and lng is not None:
            data["lat"] = lat
            data["lng"] = lng

    @staticmethod
    def _geocode_on_location_change(current: Mapping[str, Any], updates: dict[str, Any]) -> None:
        def _strip(value: Any) -> str:
            return (value or "").strip() if isinstance(value, str) else ""

        touched_loc = "location" in updates
        touched_reg = "region" in updates
        if not touched_loc and not touched_reg:
            return

        old_loc = _strip(current.get("location"))
        old_reg = _strip(current.get("region"))
        new_loc = _strip(updates["location"]) if touched_loc else old_loc
        new_reg = _strip(updates["region"]) if touched_reg else old_reg

        if new_loc != old_loc or new_reg != old_reg:
            lat, lng = geocode_from_location_region(new_loc, new_reg)
            updates["lat"] = lat
            updates["lng"] = lng


class PoiDeleteResult(BaseModel):
    ok: Literal[True] = True
