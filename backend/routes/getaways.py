"""Getaway endpoints. A getaway is a POI (poi_type='getaway') addressed by poi id."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from models import Getaway
from routes.auth import extract_auth_token

router = APIRouter(prefix="/lists", tags=["getaways"])


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

        outcome = Getaway.update_by_id(poi_id, token, list_id=list_id, **updates)
        if outcome.status == "not_found":
            raise HTTPException(status_code=404, detail="Getaway not found")
        return {"ok": True, "getaway": outcome.poi}
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
