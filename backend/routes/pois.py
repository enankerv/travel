"""POI endpoints — CRUD for the pois spine (subtype fields use subtype routes)."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query

from models import (
    POI,
    POICreate,
    POIUpdate,
    POIUpdateResponse,
    BulkPoiPositionsUpdate,
    BulkPoiPositionsResponse,
    poi_class_for_type,
)
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(prefix="/lists", tags=["pois"])


def _require_poi_in_list(poi: POI | None, list_id: str) -> POI:
    if not poi or poi.list_id != list_id:
        raise HTTPException(status_code=404, detail="POI not found")
    return poi


def _reject_subtyped_poi_type(poi_type: str) -> None:
    if poi_class_for_type(poi_type)._SUBTYPE_TABLE:
        raise HTTPException(
            status_code=400,
            detail=f"poi_type '{poi_type}' has a subtype table — use its dedicated route",
        )


@router.get("/{list_id}/pois", response_model=list[POI])
async def list_pois_endpoint(
    list_id: str,
    poi_type: Optional[str] = Query(None, description="Filter by poi_type (e.g. note, activity)"),
    authorization: Optional[str] = Header(None),
) -> list[POI]:
    """List POIs on a board (spine fields). Optional ``poi_type`` filter."""
    try:
        token = extract_auth_token(authorization)
        if poi_type:
            _reject_subtyped_poi_type(poi_type)
        return POI.for_list(list_id, token, poi_type=poi_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{list_id}/pois/positions", response_model=BulkPoiPositionsResponse)
async def bulk_update_poi_positions_endpoint(
    list_id: str,
    body: BulkPoiPositionsUpdate,
    authorization: Optional[str] = Header(None),
) -> BulkPoiPositionsResponse:
    """Bulk-update normalized board positions for POIs on a list."""
    try:
        token = extract_auth_token(authorization)
        from db.pois import bulk_update_poi_positions

        payload = [p.model_dump() for p in body.positions]
        updated = bulk_update_poi_positions(list_id, payload, token)
        if updated == 0:
            raise HTTPException(status_code=404, detail="No POIs updated")
        return BulkPoiPositionsResponse(updated=updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{list_id}/pois/{poi_id}", response_model=POI)
async def get_poi_endpoint(
    list_id: str,
    poi_id: str,
    authorization: Optional[str] = Header(None),
) -> POI:
    """Get one POI by id (spine fields)."""
    try:
        token = extract_auth_token(authorization)
        return _require_poi_in_list(POI.get(poi_id, token), list_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{list_id}/pois", response_model=POI)
async def create_poi_endpoint(
    list_id: str,
    body: POICreate,
    authorization: Optional[str] = Header(None),
) -> POI:
    """Create a spine-only POI (no subtype row)."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        _reject_subtyped_poi_type(body.poi_type)
        fields = body.model_dump(exclude_unset=True)
        poi = POI.new(list_id, token, user_id=user_id, **fields)
        if not poi:
            raise HTTPException(status_code=500, detail="Failed to create POI")
        return poi
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/pois/{poi_id}", response_model=POIUpdateResponse)
async def update_poi_endpoint(
    list_id: str,
    poi_id: str,
    body: POIUpdate,
    authorization: Optional[str] = Header(None),
) -> POIUpdateResponse:
    """Update spine fields on a POI."""
    try:
        token = extract_auth_token(authorization)
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update.")
        _require_poi_in_list(POI.get(poi_id, token), list_id)

        result = POI.update_by_id(poi_id, token, **updates)
        if not result:
            raise HTTPException(status_code=404, detail="POI not found")
        return POIUpdateResponse(ok=True, poi=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/pois/{poi_id}")
async def delete_poi_endpoint(
    list_id: str,
    poi_id: str,
    authorization: Optional[str] = Header(None),
) -> dict[str, bool]:
    """Delete a POI (cascades subtype, images, votes, comments)."""
    try:
        token = extract_auth_token(authorization)
        _require_poi_in_list(POI.get(poi_id, token), list_id)
        if not POI.delete_by_id(poi_id, token):
            raise HTTPException(status_code=404, detail="POI not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
