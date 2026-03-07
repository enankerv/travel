"""FastAPI routes for lists, members, invites, and villas."""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from models import (
    ListCreate, ListUpdate, ListResponse, AddListMember, UpdateMemberRole,
    CreateInvite, InviteResponse, InviteTokenDetails, AcceptInvite,
    VillaResponse, ScoutRequest, ScoutPasteRequest, ScoutResponse,
)
from db_lists import (
    create_list, get_user_lists, get_list_by_id, update_list, delete_list,
    add_list_member, get_list_members, update_member_role, remove_list_member,
    create_invite_token, get_invite_token, accept_invite, list_invite_tokens, revoke_invite_token,
    insert_villa, get_list_villas, get_villa_by_slug, update_villa, update_villa_by_slug, delete_villa, delete_villa_by_slug,
)

from scout import generate_villa_page, generate_villa_page_from_paste
from utils.urls import generate_slug

router = APIRouter(prefix="/api", tags=["api"])


# ============================================================================
# LIST ENDPOINTS
# ============================================================================

@router.post("/lists", response_model=ListResponse)
async def create_new_list(req: ListCreate, user_id: str = Query(...)):
    """Create a new list."""
    try:
        result = create_list(user_id, req.name, req.description)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create list")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lists", response_model=list[ListResponse])
async def get_user_lists_endpoint(user_id: str = Query(...)):
    """Get all lists for a user (owned + member of)."""
    try:
        lists = get_user_lists(user_id)
        return lists
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lists/{list_id}", response_model=ListResponse)
async def get_list_endpoint(list_id: str):
    """Get a specific list with members."""
    try:
        list_data = get_list_by_id(list_id)
        if not list_data:
            raise HTTPException(status_code=404, detail="List not found")
        return list_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/lists/{list_id}", response_model=ListResponse)
async def update_list_endpoint(list_id: str, req: ListUpdate):
    """Update a list (name/description). Only creator can do this."""
    try:
        updates = req.dict(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        result = update_list(list_id, updates)
        if not result:
            raise HTTPException(status_code=404, detail="List not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/lists/{list_id}")
async def delete_list_endpoint(list_id: str):
    """Delete a list. Only creator can do this."""
    try:
        success = delete_list(list_id)
        if not success:
            raise HTTPException(status_code=404, detail="List not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# LIST MEMBER ENDPOINTS
# ============================================================================

@router.get("/lists/{list_id}/members")
async def get_members_endpoint(list_id: str):
    """Get all members of a list."""
    try:
        members = get_list_members(list_id)
        return {"members": members}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lists/{list_id}/members")
async def add_member_endpoint(list_id: str, req: AddListMember, invited_by: str = Query(...)):
    """Add a user to a list. Only admin can do this."""
    try:
        member = add_list_member(list_id, req.user_id, req.role, invited_by=invited_by)
        if not member:
            raise HTTPException(status_code=400, detail="User already in list or not found")
        return {"ok": True, "member": member}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/lists/{list_id}/members/{user_id}")
async def update_member_endpoint(list_id: str, user_id: str, req: UpdateMemberRole):
    """Change a member's role. Only admin can do this."""
    try:
        result = update_member_role(list_id, user_id, req.role)
        if not result:
            raise HTTPException(status_code=404, detail="Member not found")
        return {"ok": True, "role": req.role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/lists/{list_id}/members/{user_id}")
async def remove_member_endpoint(list_id: str, user_id: str):
    """Remove a user from a list. Only admin can do this."""
    try:
        success = remove_list_member(list_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Member not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# INVITE ENDPOINTS
# ============================================================================

@router.post("/lists/{list_id}/invites", response_model=InviteResponse)
async def create_invite_endpoint(list_id: str, req: CreateInvite, created_by: str = Query(...)):
    """Create a shareable invite link. Only admin can do this."""
    try:
        result = create_invite_token(
            list_id=list_id,
            created_by=created_by,
            role=req.role,
            expires_in_days=req.expires_in_days,
            max_uses=req.max_uses,
        )
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create invite")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invites/{token}", response_model=InviteTokenDetails)
async def get_invite_endpoint(token: str):
    """Get invite details (for accepting)."""
    try:
        invite = get_invite_token(token)
        if not invite:
            raise HTTPException(status_code=404, detail="Invalid or expired invite token")
        return {
            "token": token,
            "role": invite["role"],
            "list_id": invite["list_id"],
            "list_name": invite["lists"]["name"],
            "expires_at": invite.get("expires_at"),
            "uses_count": invite["uses_count"],
            "max_uses": invite.get("max_uses"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invites/{token}/accept")
async def accept_invite_endpoint(token: str, user_id: str = Query(...)):
    """Accept an invite and join a list."""
    try:
        member = accept_invite(token, user_id)
        if not member:
            raise HTTPException(status_code=400, detail="Failed to join list")
        return {"ok": True, "message": "Successfully joined list"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lists/{list_id}/invites")
async def list_invites_endpoint(list_id: str):
    """List all invite tokens for a list. Only admin can do this."""
    try:
        tokens = list_invite_tokens(list_id)
        return {"invites": tokens}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/invites/{token}")
async def revoke_invite_endpoint(token: str):
    """Revoke an invite token. Only admin can do this."""
    try:
        result = revoke_invite_token(token)
        if not result:
            raise HTTPException(status_code=404, detail="Invite token not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# VILLA ENDPOINTS
# ============================================================================

@router.get("/lists/{list_id}/villas", response_model=list[VillaResponse])
async def get_villas_endpoint(list_id: str):
    """Get all villas in a list."""
    try:
        villas = get_list_villas(list_id)
        return villas
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/lists/{list_id}/villas/{villa_slug}")
async def update_villa_endpoint(list_id: str, villa_slug: str, updates: dict):
    """Update villa fields."""
    try:
        result = update_villa_by_slug(list_id, villa_slug, updates)
        if not result:
            raise HTTPException(status_code=404, detail="Villa not found")
        return {"ok": True, "villa": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/lists/{list_id}/villas/{villa_slug}")
async def delete_villa_endpoint(list_id: str, villa_slug: str):
    """Delete a villa. Only admin or editor can do this."""
    try:
        success = delete_villa_by_slug(list_id, villa_slug)
        if not success:
            raise HTTPException(status_code=404, detail="Villa not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SCOUT ENDPOINTS (updated for lists)
# ============================================================================

@router.post("/scout", response_model=ScoutResponse)
async def scout_listing(req: ScoutRequest):
    """Scout a URL and save to a list."""
    url = str(req.url)
    list_id = req.list_id
    
    try:
        result = await generate_villa_page(
            url,
            check_in=req.check_in,
            check_out=req.check_out,
            guests=req.guests,
            list_id=list_id,  # Pass list_id instead of user_id
        )
        
        villa_id = result.get("villa_id")
        return ScoutResponse(
            ok=True,
            path=result.get("path"),
            thin_scrape=result.get("thin_scrape", False),
            villa_id=villa_id,
        )
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e), thin_scrape=False)


@router.post("/scout-paste", response_model=ScoutResponse)
async def scout_from_paste(req: ScoutPasteRequest):
    """Build a villa report from pasted listing text."""
    list_id = req.list_id
    
    try:
        result = await generate_villa_page_from_paste(
            pasted_text=req.pasted_text,
            original_url=req.original_url,
            list_id=list_id,  # Pass list_id instead of user_id
        )
        
        villa_id = result.get("villa_id")
        return ScoutResponse(
            ok=True,
            path=result.get("path"),
            villa_id=villa_id,
        )
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e))
