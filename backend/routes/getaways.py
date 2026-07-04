"""Getaway endpoints. A getaway is a POI (poi_type='getaway') addressed by poi id."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from models import Getaway
from utils.geocode import geocode_from_location_region
from routes.auth import extract_auth_token

router = APIRouter(prefix="/lists", tags=["getaways"])


def _apply_geocode_if_location_changed(current: Getaway, updates: dict) -> None:
    """When location or region in `updates` differs from `current`, re-geocode into lat/lng."""

    def _strip(s: Optional[str]) -> str:
        return (s or "").strip()

    touched_loc = "location" in updates
    touched_reg = "region" in updates
    if not touched_loc and not touched_reg:
        return
    old_loc = _strip(current.location)
    old_reg = _strip(getattr(current, "region", None))
    new_loc = _strip(updates["location"]) if touched_loc else old_loc
    new_reg = _strip(updates["region"]) if touched_reg else old_reg
    if new_loc != old_loc or new_reg != old_reg:
        lat, lng = geocode_from_location_region(new_loc, new_reg)
        updates["lat"] = lat
        updates["lng"] = lng


@router.get("/{list_id}/getaways", response_model=list[Getaway])
async def get_getaways_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get all getaways in a list (images returned as signed URLs)."""
    try:
        token = extract_auth_token(authorization)
        return Getaway.for_list(list_id, token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/getaways/{poi_id}")
async def update_getaway_endpoint(
    list_id: str,
    poi_id: str,
    body: Getaway.Update,
    authorization: Optional[str] = Header(None),
):
    """Update getaway fields allowed by the listing editor (extra body keys ignored)."""
    try:
        token = extract_auth_token(authorization)
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update.")
        if "location" in updates or "region" in updates:
            current = Getaway.get(poi_id, token)
            if not current:
                raise HTTPException(status_code=404, detail="Getaway not found")
            _apply_geocode_if_location_changed(current, updates)

        result = Getaway.update_by_id(poi_id, token, **updates)
        if not result:
            raise HTTPException(status_code=404, detail="Getaway not found")
        return {"ok": True, "getaway": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/getaways/{poi_id}")
async def delete_getaway_endpoint(list_id: str, poi_id: str, authorization: Optional[str] = Header(None)):
    """Delete a getaway. Only admin or editor can do this."""
    try:
        token = extract_auth_token(authorization)
        if not Getaway.delete_by_id(poi_id, token):
            raise HTTPException(status_code=404, detail="Getaway not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
