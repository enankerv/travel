"""List member endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query

from models import AddListMember, UpdateMemberRole
from db.list_members import add_list_member, get_list_members, update_member_role, remove_list_member
from routes.auth import extract_auth_token

router = APIRouter(prefix="/lists", tags=["members"])


@router.get("/{list_id}/members")
async def get_members_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get all members of a list with profiles."""
    try:
        token = extract_auth_token(authorization)
        data = get_list_members(list_id, token)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{list_id}/members")
async def add_member_endpoint(list_id: str, req: AddListMember, invited_by: str = Query(...), authorization: Optional[str] = Header(None)):
    """Add a user to a list. Only admin can do this."""
    try:
        token = extract_auth_token(authorization)
        member = add_list_member(list_id, req.user_id, req.role, invited_by=invited_by, auth_token=token)
        if not member:
            raise HTTPException(status_code=400, detail="User already in list or not found")
        return {"ok": True, "member": member}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/members/{user_id}")
async def update_member_endpoint(list_id: str, user_id: str, req: UpdateMemberRole, authorization: Optional[str] = Header(None)):
    """Change a member's role. Only admin can do this."""
    try:
        token = extract_auth_token(authorization)
        result = update_member_role(list_id, user_id, req.role, token)
        if not result:
            raise HTTPException(status_code=404, detail="Member not found")
        return {"ok": True, "role": req.role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/members/{user_id}")
async def remove_member_endpoint(list_id: str, user_id: str, authorization: Optional[str] = Header(None)):
    """Remove a user from a list."""
    try:
        token = extract_auth_token(authorization)
        success = remove_list_member(list_id, user_id, token)
        if not success:
            raise HTTPException(status_code=404, detail="Member not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
