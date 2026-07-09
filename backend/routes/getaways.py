"""Getaway endpoints. A getaway is a POI (poi_type='getaway') addressed by poi id."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from models import (
    Getaway,
    GetawayImageUploadSlot,
    GetawayImageUploadUrlsRequest,
    GetawayImageUploadUrlsResponse,
)
from routes.auth import extract_auth_token
from db.pois import fetch_poi_image_paths
from utils.images import (
    MAX_GETAWAY_IMAGES,
    allocate_getaway_image_paths,
    content_type_to_ext,
    create_signed_getaway_upload_urls,
)

router = APIRouter(prefix="/lists", tags=["getaways"])


def _get_getaway_in_list(poi_id: str, list_id: str, token: str) -> Getaway:
    getaway = Getaway.get(poi_id, token)
    if not getaway or getaway.list_id != list_id:
        raise HTTPException(status_code=404, detail="Getaway not found")
    return getaway


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


@router.post("/{list_id}/getaways/{poi_id}/images/upload-urls", response_model=GetawayImageUploadUrlsResponse)
async def create_getaway_image_upload_urls_endpoint(
    list_id: str,
    poi_id: str,
    body: GetawayImageUploadUrlsRequest,
    authorization: Optional[str] = Header(None),
):
    """Return presigned upload URLs; poi_images rows are created by a storage trigger."""
    try:
        token = extract_auth_token(authorization)
        _get_getaway_in_list(poi_id, list_id, token)

        if not body.files:
            raise HTTPException(status_code=400, detail="No files requested.")

        existing_paths = fetch_poi_image_paths(poi_id, token)
        remaining = MAX_GETAWAY_IMAGES - len(existing_paths)
        if remaining <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum of {MAX_GETAWAY_IMAGES} photos per listing.",
            )

        requested = body.files[:remaining]
        invalid = [
            f.content_type
            for f in requested
            if content_type_to_ext(f.content_type) is None
        ]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail="Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
            )

        paths = allocate_getaway_image_paths(
            poi_id,
            start_index=len(existing_paths),
            content_types=[f.content_type for f in requested],
        )
        if not paths:
            raise HTTPException(status_code=400, detail="No valid image files requested.")

        signed = create_signed_getaway_upload_urls(paths, token)
        if len(signed) != len(paths):
            raise HTTPException(status_code=500, detail="Failed to create upload URLs.")

        return GetawayImageUploadUrlsResponse(
            uploads=[GetawayImageUploadSlot(**slot) for slot in signed],
        )
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
