"""Point of interest (POI) endpoints — thin controllers over the Poi domain model."""
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

from poi import READONLY_FIELDS, Poi
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(prefix="/lists", tags=["pois"])


def _writable_fields(body: Poi) -> dict:
    return body.model_dump(exclude=READONLY_FIELDS, exclude_unset=True)


@router.get("/{list_id}/pois", response_model=list[Poi])
async def get_pois_endpoint(
    list_id: str,
    poi_type: Optional[str] = Query(None, description="Filter by POI type"),
    authorization: Optional[str] = Header(None),
):
    """Get all POIs in a list."""
    try:
        token = extract_auth_token(authorization)
        return Poi.list_for(list_id, token, poi_type=poi_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{list_id}/pois", response_model=Poi)
async def create_poi_endpoint(
    list_id: str,
    body: Poi,
    authorization: Optional[str] = Header(None),
):
    """Create a new POI in a list."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        return Poi.create(list_id, user_id, token, _writable_fields(body))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/pois/{poi_id}", response_model=Poi)
async def update_poi_endpoint(
    list_id: str,
    poi_id: str,
    body: Poi,
    authorization: Optional[str] = Header(None),
):
    """Update a POI."""
    try:
        token = extract_auth_token(authorization)
        poi = Poi.get(list_id, poi_id, token)
        if not poi:
            raise HTTPException(status_code=404, detail="POI not found")
        return poi.update(token, _writable_fields(body))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError:
        raise HTTPException(status_code=404, detail="POI not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/pois/{poi_id}")
async def delete_poi_endpoint(
    list_id: str,
    poi_id: str,
    authorization: Optional[str] = Header(None),
):
    """Delete a POI."""
    try:
        token = extract_auth_token(authorization)
        poi = Poi.get(list_id, poi_id, token)
        if not poi:
            raise HTTPException(status_code=404, detail="POI not found")
        if not poi.delete(token):
            raise HTTPException(status_code=404, detail="POI not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
