"""Point of interest domain model (entity + persistence)."""
from __future__ import annotations

from typing import Literal, Optional, Self

from pydantic import BaseModel, ConfigDict, Field

from utils.geocode import geocode_from_location_region

PoiType = Literal["restaurant", "activity", "business", "place", "other"]

READONLY_FIELDS = frozenset({"id", "list_id", "user_id", "created_at", "updated_at"})


class Poi(BaseModel):
    """
    A point of interest on a list — restaurants, activities, places, etc.

    Single domain class for validation, geocoding, and DB access. Routes act as
    thin controllers that parse auth and delegate here.
    """

    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = None
    list_id: Optional[str] = None
    user_id: Optional[str] = None
    poi_type: PoiType = "other"
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    region: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def _table(cls, auth_token: str):
        from db.client import get_supabase_client

        return get_supabase_client(auth_token).table("pois")

    @classmethod
    def from_row(cls, row: dict) -> Self:
        return cls.model_validate(row)

    @classmethod
    def list_for(cls, list_id: str, auth_token: str, poi_type: str | None = None) -> list[Self]:
        query = (
            cls._table(auth_token)
            .select("*")
            .eq("list_id", list_id)
            .order("created_at", desc=True)
        )
        if poi_type:
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
    def create(cls, list_id: str, user_id: str, auth_token: str, fields: dict) -> Self:
        data = {k: v for k, v in fields.items() if k not in READONLY_FIELDS}
        name = (data.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")
        data["name"] = name
        if data.get("metadata") is None:
            data["metadata"] = {}
        cls._geocode_fields(data)
        data["list_id"] = list_id
        data["user_id"] = user_id

        response = cls._table(auth_token).insert(data).execute()
        if not response.data:
            raise RuntimeError("Failed to create POI")
        return cls.from_row(response.data[0])

    def update(self, auth_token: str, fields: dict) -> Self:
        if not self.id or not self.list_id:
            raise ValueError("Cannot update an unpersisted POI")

        updates = {k: v for k, v in fields.items() if k not in READONLY_FIELDS}
        if not updates:
            raise ValueError("No fields to update")

        current = self.model_dump()
        cls = type(self)
        cls._geocode_on_location_change(current, updates)

        response = (
            cls._table(auth_token)
            .update(updates)
            .eq("list_id", self.list_id)
            .eq("id", self.id)
            .execute()
        )
        if not response.data:
            raise LookupError("POI not found")
        return cls.from_row(response.data[0])

    def delete(self, auth_token: str) -> bool:
        if not self.id or not self.list_id:
            raise ValueError("Cannot delete an unpersisted POI")

        response = (
            type(self)
            ._table(auth_token)
            .delete()
            .eq("list_id", self.list_id)
            .eq("id", self.id)
            .execute()
        )
        return bool(response.data)

    @staticmethod
    def _geocode_fields(data: dict) -> None:
        if data.get("lat") is not None and data.get("lng") is not None:
            return
        lat, lng = geocode_from_location_region(data.get("location"), data.get("region"))
        if lat is not None and lng is not None:
            data["lat"] = lat
            data["lng"] = lng

    @staticmethod
    def _geocode_on_location_change(current: dict, updates: dict) -> None:
        def _strip(s: Optional[str]) -> str:
            return (s or "").strip()

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
