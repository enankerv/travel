"""Board subgroup endpoints — nested frames on the cork board."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from db.subgroups import (
    create_subgroup,
    delete_subgroup,
    get_subgroup_by_id,
    get_subgroups_for_list,
    subgroup_belongs_to_list,
    update_subgroup,
)
from models import BoardSubgroup, BoardSubgroupCreate, BoardSubgroupDeleteResponse, BoardSubgroupUpdate
from routes.auth import extract_auth_token

router = APIRouter(prefix="/lists", tags=["subgroups"])


def _require_subgroup(subgroup_id: str, list_id: str, token: str) -> dict:
    if not subgroup_belongs_to_list(subgroup_id, list_id, token):
        raise HTTPException(status_code=404, detail="Subgroup not found")
    row = get_subgroup_by_id(subgroup_id, token)
    if not row:
        raise HTTPException(status_code=404, detail="Subgroup not found")
    return row


@router.get("/{list_id}/subgroups", response_model=list[BoardSubgroup])
async def list_subgroups_endpoint(
    list_id: str,
    authorization: Optional[str] = Header(None),
) -> list[BoardSubgroup]:
    try:
        token = extract_auth_token(authorization)
        rows = get_subgroups_for_list(list_id, token)
        return [BoardSubgroup.model_validate(r) for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{list_id}/subgroups/{subgroup_id}", response_model=BoardSubgroup)
async def get_subgroup_endpoint(
    list_id: str,
    subgroup_id: str,
    authorization: Optional[str] = Header(None),
) -> BoardSubgroup:
    try:
        token = extract_auth_token(authorization)
        row = _require_subgroup(subgroup_id, list_id, token)
        return BoardSubgroup.model_validate(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{list_id}/subgroups", response_model=BoardSubgroup)
async def create_subgroup_endpoint(
    list_id: str,
    body: BoardSubgroupCreate,
    authorization: Optional[str] = Header(None),
) -> BoardSubgroup:
    try:
        token = extract_auth_token(authorization)
        row = create_subgroup(list_id, token, **body.model_dump())
        if not row:
            raise HTTPException(status_code=400, detail="Invalid subgroup")
        return BoardSubgroup.model_validate(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/subgroups/{subgroup_id}", response_model=BoardSubgroup)
async def update_subgroup_endpoint(
    list_id: str,
    subgroup_id: str,
    body: BoardSubgroupUpdate,
    authorization: Optional[str] = Header(None),
) -> BoardSubgroup:
    try:
        token = extract_auth_token(authorization)
        _require_subgroup(subgroup_id, list_id, token)
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update.")
        row = update_subgroup(subgroup_id, token, **updates)
        if not row:
            raise HTTPException(status_code=400, detail="Invalid subgroup update")
        return BoardSubgroup.model_validate(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/subgroups/{subgroup_id}", response_model=BoardSubgroupDeleteResponse)
async def delete_subgroup_endpoint(
    list_id: str,
    subgroup_id: str,
    authorization: Optional[str] = Header(None),
) -> BoardSubgroupDeleteResponse:
    try:
        token = extract_auth_token(authorization)
        _require_subgroup(subgroup_id, list_id, token)
        if not delete_subgroup(subgroup_id, token):
            raise HTTPException(status_code=404, detail="Subgroup not found")
        return BoardSubgroupDeleteResponse(ok=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
