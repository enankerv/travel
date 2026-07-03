"""Point of interest (POI) endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query

from models import PoiCreate, PoiUpdate, PoiResponse
from utils.geocode import geocode_from_location_region
from db.pois import (
    get_list_pois,
    get_poi_by_slug,
    insert_poi,
    update_poi_by_slug,
    delete_poi_by_slug,
)
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(prefix="/lists", tags=["pois"])


def _apply_geocode_if_location_changed(current: dict, updates: dict) -> None:
    """When location or region in `updates` differs from `current`, re-geocode into lat/lng."""

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


def _apply_geocode_on_create(data: dict) -> None:
    """Geocode from location/region when lat/lng not explicitly provided."""
    if data.get("lat") is not None and data.get("lng") is not None:
        return
    lat, lng = geocode_from_location_region(data.get("location"), data.get("region"))
    if lat is not None and lng is not None:
        data["lat"] = lat
        data["lng"] = lng


@router.get("/{list_id}/pois", response_model=list[PoiResponse])
async def get_pois_endpoint(
    list_id: str,
    poi_type: Optional[str] = Query(None, description="Filter by POI type"),
    authorization: Optional[str] = Header(None),
):
    """Get all POIs in a list."""
    try:
        token = extract_auth_token(authorization)
        return get_list_pois(list_id, token, poi_type=poi_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{list_id}/pois", response_model=PoiResponse)
async def create_poi_endpoint(
    list_id: str,
    body: PoiCreate,
    authorization: Optional[str] = Header(None),
):
    """Create a new POI in a list."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        data = body.model_dump(exclude_unset=True)
        _apply_geocode_on_create(data)
        result = insert_poi(list_id, user_id, data, token)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create POI")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/pois/{poi_slug}")
async def update_poi_endpoint(
    list_id: str,
    poi_slug: str,
    body: PoiUpdate,
    authorization: Optional[str] = Header(None),
):
    """Update a POI."""
    try:
        token = extract_auth_token(authorization)
        current = get_poi_by_slug(list_id, poi_slug, token)
        if not current:
            raise HTTPException(status_code=404, detail="POI not found")
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update.")
        _apply_geocode_if_location_changed(current, updates)

        result = update_poi_by_slug(list_id, poi_slug, updates, token)
        if not result:
            raise HTTPException(status_code=404, detail="POI not found")
        full = get_poi_by_slug(list_id, result.get("slug") or poi_slug, token)
        return {"ok": True, "poi": full or result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/pois/{poi_slug}")
async def delete_poi_endpoint(
    list_id: str,
    poi_slug: str,
    authorization: Optional[str] = Header(None),
):
    """Delete a POI."""
    try:
        token = extract_auth_token(authorization)
        success = delete_poi_by_slug(list_id, poi_slug, token)
        if not success:
            raise HTTPException(status_code=404, detail="POI not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
