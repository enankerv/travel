"""FastAPI routes for lists, members, invites, and villas."""
from fastapi import APIRouter, HTTPException, Query, Header
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


def extract_auth_token(authorization: Optional[str] = Header(None)) -> str:
    """Extract JWT token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    return parts[1]


def extract_user_id_from_token(token: str) -> str:
    """Extract user_id from JWT token (without verification, as Supabase handles that)."""
    import base64
    import json
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        
        # Decode payload (add padding if needed)
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        
        decoded = base64.urlsafe_b64decode(payload)
        data = json.loads(decoded)
        user_id = data.get('sub')  # 'sub' claim contains user_id in Supabase JWT
        
        if not user_id:
            raise ValueError("No user_id in token")
        
        return user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# ============================================================================
# LIST ENDPOINTS
# ============================================================================

@router.post("/lists", response_model=ListResponse)
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


@router.get("/lists", response_model=list[ListResponse])
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


@router.get("/lists/{list_id}", response_model=ListResponse)
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


@router.delete("/lists/{list_id}")
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


# ============================================================================
# LIST MEMBER ENDPOINTS
# ============================================================================

@router.get("/lists/{list_id}/members")
async def get_members_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get all members of a list with profiles (full_name, avatar_url, email)."""
    try:
        token = extract_auth_token(authorization)
        data = get_list_members(list_id, token)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lists/{list_id}/members")
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


@router.put("/lists/{list_id}/members/{user_id}")
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


@router.delete("/lists/{list_id}/members/{user_id}")
async def remove_member_endpoint(list_id: str, user_id: str, authorization: Optional[str] = Header(None)):
    """Remove a user from a list. Only admin can do this."""
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


# ============================================================================
# INVITE ENDPOINTS
# ============================================================================

@router.post("/lists/{list_id}/invites", response_model=InviteResponse)
async def create_invite_endpoint(list_id: str, req: CreateInvite, created_by: str = Query(...), authorization: Optional[str] = Header(None)):
    """Create a shareable invite link. Only admin can do this."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        result = create_invite_token(
            list_id=list_id,
            created_by=user_id,
            role=req.role,
            expires_in_days=req.expires_in_days,
            max_uses=req.max_uses,
            auth_token=token,
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
async def accept_invite_endpoint(token: str, user_id: str = Query(...), authorization: Optional[str] = Header(None)):
    """Accept an invite and join a list."""
    try:
        token_auth = extract_auth_token(authorization)
        user_id_from_token = extract_user_id_from_token(token_auth)
        member = accept_invite(token, user_id_from_token, token_auth)
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
async def list_invites_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """List all invite tokens for a list. Only admin can do this."""
    try:
        token = extract_auth_token(authorization)
        tokens = list_invite_tokens(list_id, token)
        return {"invites": tokens}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/invites/{token}")
async def revoke_invite_endpoint(token: str, authorization: Optional[str] = Header(None)):
    """Revoke an invite token. Only admin can do this."""
    try:
        token_auth = extract_auth_token(authorization)
        result = revoke_invite_token(token, token_auth)
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
async def get_villas_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get all villas in a list. Image paths are signed for private bucket access."""
    try:
        from utils.storage_urls import sign_villa_images
        token = extract_auth_token(authorization)
        villas = get_list_villas(list_id, token)
        return [sign_villa_images(v, token) for v in villas]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/lists/{list_id}/villas/{villa_slug}")
async def update_villa_endpoint(list_id: str, villa_slug: str, updates: dict, authorization: Optional[str] = Header(None)):
    """Update villa fields."""
    try:
        from utils.storage_urls import sign_villa_images
        token = extract_auth_token(authorization)
        result = update_villa_by_slug(list_id, villa_slug, updates, token)
        if not result:
            raise HTTPException(status_code=404, detail="Villa not found")
        return {"ok": True, "villa": sign_villa_images(result, token)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/lists/{list_id}/villas/{villa_slug}")
async def delete_villa_endpoint(list_id: str, villa_slug: str, authorization: Optional[str] = Header(None)):
    """Delete a villa. Only admin or editor can do this."""
    try:
        token = extract_auth_token(authorization)
        success = delete_villa_by_slug(list_id, villa_slug, token)
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
async def scout_listing(req: ScoutRequest, authorization: Optional[str] = Header(None)):
    """Scout a URL and save to a list.
    
    Creates a loading villa row immediately, then processes in background.
    Returns villa_id so frontend can track the loading row via Supabase Realtime.
    """
    url = str(req.url)
    list_id = req.list_id
    
    try:
        token = extract_auth_token(authorization)
        
        # Create a loading villa placeholder immediately
        from db_lists import create_loading_villa
        loading_villa = create_loading_villa(list_id, url, auth_token=token)
        if not loading_villa:
            raise Exception("Failed to create loading villa")
        
        villa_id = loading_villa.get("id")
        
        # Process scout in background (fire and forget)
        import asyncio
        asyncio.create_task(_process_scout(url, list_id, villa_id, req.check_in, req.check_out, req.guests, token))
        
        return ScoutResponse(
            ok=True,
            villa_id=villa_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e), thin_scrape=False)


async def _process_scout(url: str, list_id: str, villa_id: str, check_in: str, check_out: str, guests: int, auth_token: str):
    """Background task to process scout and update the villa row."""
    try:
        from db_lists import update_villa
        result = await generate_villa_page(
            url,
            check_in=check_in,
            check_out=check_out,
            guests=guests,
            list_id=list_id,
            auth_token=auth_token,
            villa_id=villa_id,  # Pass villa_id to update instead of insert
        )
        
        # Update the loading villa with the result or status
        if result.get("thin_scrape"):
            update_villa(villa_id, {"scrap_status": "thin"}, auth_token)
        else:
            # Update with all the scraped data
            updates = {
                "scrap_status": "loaded",
                **{k: v for k, v in result.items() if k not in ["villa_id", "path", "thin_scrape"]}
            }
            update_villa(villa_id, updates, auth_token)
    except Exception as e:
        # Update villa with error status
        from db_lists import update_villa
        update_villa(villa_id, {
            "scrap_status": "error",
            "scrap_error": str(e)
        }, auth_token)


@router.post("/scout-paste", response_model=ScoutResponse)
async def scout_from_paste(req: ScoutPasteRequest, authorization: Optional[str] = Header(None)):
    """Build a villa report from pasted listing text.
    
    Creates a loading villa row immediately, then processes in background.
    """
    list_id = req.list_id
    
    try:
        token = extract_auth_token(authorization)
        
        # Create a loading villa placeholder immediately
        from db_lists import create_loading_villa
        url = req.original_url or "paste"
        loading_villa = create_loading_villa(list_id, url, auth_token=token)
        if not loading_villa:
            raise Exception("Failed to create loading villa")
        
        villa_id = loading_villa.get("id")
        
        # Process scout in background (fire and forget)
        import asyncio
        asyncio.create_task(_process_scout_paste(req.pasted_text, list_id, villa_id, req.original_url, token))
        
        return ScoutResponse(
            ok=True,
            villa_id=villa_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e))


async def _process_scout_paste(pasted_text: str, list_id: str, villa_id: str, original_url: str, auth_token: str):
    """Background task to process paste scout and update the villa row."""
    try:
        from db_lists import update_villa
        result = await generate_villa_page_from_paste(
            pasted_text=pasted_text,
            original_url=original_url,
            list_id=list_id,
            auth_token=auth_token,
            villa_id=villa_id,  # Pass villa_id to update instead of insert
        )
        
        # Update the loading villa with the result
        updates = {
            "scrap_status": "loaded",
            **{k: v for k, v in result.items() if k not in ["villa_id", "path"]}
        }
        update_villa(villa_id, updates, auth_token)
    except Exception as e:
        # Update villa with error status
        from db_lists import update_villa
        update_villa(villa_id, {
            "scrap_status": "error",
            "scrap_error": str(e)
        }, auth_token)
