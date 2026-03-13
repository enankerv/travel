"""Invite endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query

from models import CreateInvite, InviteResponse, InviteTokenDetails
from db.invite_tokens import (
    create_invite_token,
    get_invite_for_accept_rpc,
    accept_invite,
    list_invite_tokens,
    revoke_invite_token,
)
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(tags=["invites"])


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
async def get_invite_endpoint(token: str, authorization: Optional[str] = Header(None)):
    """Get invite details via RPC - returns one row only."""
    try:
        token_auth = extract_auth_token(authorization)
        invite = get_invite_for_accept_rpc(token, token_auth)
        if not invite:
            raise HTTPException(status_code=404, detail="Invalid or expired invite token")
        return {
            "token": token,
            "role": invite["role"],
            "list_id": invite["list_id"],
            "list_name": invite["list_name"],
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
