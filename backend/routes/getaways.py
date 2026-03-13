"""Getaway endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from models import GetawayResponse
from db.getaways import (
    get_list_getaways,
    get_getaway_by_slug,
    update_getaway_by_slug,
    delete_getaway_by_slug,
)
from routes.auth import extract_auth_token

router = APIRouter(prefix="/lists", tags=["getaways"])


@router.get("/{list_id}/getaways", response_model=list[GetawayResponse])
async def get_getaways_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get all getaways in a list. Image paths are signed for private bucket access."""
    try:
        from utils.storage_urls import sign_getaway_images
        token = extract_auth_token(authorization)
        getaways = get_list_getaways(list_id, token)
        return [sign_getaway_images(g, token) for g in getaways]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/getaways/{getaway_slug}")
async def update_getaway_endpoint(list_id: str, getaway_slug: str, updates: dict, authorization: Optional[str] = Header(None)):
    """Update getaway fields."""
    try:
        from utils.storage_urls import sign_getaway_images
        token = extract_auth_token(authorization)
        result = update_getaway_by_slug(list_id, getaway_slug, updates, token)
        if not result:
            raise HTTPException(status_code=404, detail="Getaway not found")
        full = get_getaway_by_slug(list_id, result.get("slug") or getaway_slug, token)
        return {"ok": True, "getaway": sign_getaway_images(full or result, token)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/getaways/{getaway_slug}")
async def delete_getaway_endpoint(list_id: str, getaway_slug: str, authorization: Optional[str] = Header(None)):
    """Delete a getaway. Only admin or editor can do this."""
    try:
        token = extract_auth_token(authorization)
        success = delete_getaway_by_slug(list_id, getaway_slug, token)
        if not success:
            raise HTTPException(status_code=404, detail="Getaway not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
