"""Point of interest (POI) endpoints — thin controllers over the Poi domain model."""
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query

from poi import Poi, PoiDeleteResult, PoiInput, PoiPatch, PoiType
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(prefix="/lists", tags=["pois"])

AuthHeader = Annotated[str | None, Header()]


@router.get("/{list_id}/pois", response_model=list[Poi])
async def get_pois_endpoint(
    list_id: str,
    poi_type: Annotated[PoiType | None, Query(description="Filter by POI type")] = None,
    authorization: AuthHeader = None,
) -> list[Poi]:
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
    body: PoiInput,
    authorization: AuthHeader = None,
) -> Poi:
    """Create a new POI in a list."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        return Poi.create(list_id, user_id, token, body)
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
    body: PoiPatch,
    authorization: AuthHeader = None,
) -> Poi:
    """Update a POI."""
    try:
        token = extract_auth_token(authorization)
        poi = Poi.get(list_id, poi_id, token)
        if poi is None:
            raise HTTPException(status_code=404, detail="POI not found")
        return poi.update(token, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError:
        raise HTTPException(status_code=404, detail="POI not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/pois/{poi_id}", response_model=PoiDeleteResult)
async def delete_poi_endpoint(
    list_id: str,
    poi_id: str,
    authorization: AuthHeader = None,
) -> PoiDeleteResult:
    """Delete a POI."""
    try:
        token = extract_auth_token(authorization)
        poi = Poi.get(list_id, poi_id, token)
        if poi is None:
            raise HTTPException(status_code=404, detail="POI not found")
        poi.delete(token)
        return PoiDeleteResult()
    except LookupError:
        raise HTTPException(status_code=404, detail="POI not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
