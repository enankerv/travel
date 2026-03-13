"""List endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from models import ListCreate, ListUpdate, ListResponse
from db.lists import create_list, get_user_lists, get_list_by_id, update_list, delete_list
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(prefix="/lists", tags=["lists"])


@router.post("", response_model=ListResponse)
async def create_new_list(req: ListCreate, authorization: Optional[str] = Header(None)):
    """Create a new list."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        result = create_list(user_id, req.name, req.description, auth_token=token)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create list")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=list[ListResponse])
async def get_user_lists_endpoint(authorization: Optional[str] = Header(None)):
    """Get all lists for a user (owned + member of)."""
    try:
        token = extract_auth_token(authorization)
        lists = get_user_lists(token)
        return lists
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{list_id}", response_model=ListResponse)
async def get_list_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get a specific list with members."""
    try:
        token = extract_auth_token(authorization)
        list_data = get_list_by_id(list_id, token)
        if not list_data:
            raise HTTPException(status_code=404, detail="List not found")
        return list_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/lists/{list_id}", response_model=ListResponse)
async def update_list_endpoint(list_id: str, req: ListUpdate, authorization: Optional[str] = Header(None)):
    """Update a list (name/description). Only creator can do this."""
    try:
        token = extract_auth_token(authorization)
        updates = req.dict(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        result = update_list(list_id, updates, token)
        if not result:
            raise HTTPException(status_code=404, detail="List not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}")
async def delete_list_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Delete a list. Only creator can do this."""
    try:
        token = extract_auth_token(authorization)
        success = delete_list(list_id, token)
        if not success:
            raise HTTPException(status_code=404, detail="List not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
