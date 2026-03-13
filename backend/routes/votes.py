"""Vote endpoints. List members can read all votes; users can add/remove only their own."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from db.votes import get_votes_for_list, add_vote, remove_vote
from db.list_members import get_list_members
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(prefix="/lists", tags=["votes"])


def _ensure_list_member(list_id: str, user_id: str, token: str) -> None:
    """Raise 403 if user is not a member of the list."""
    data = get_list_members(list_id, token)
    members = data.get("members") or []
    if not any(str(m.get("user_id")) == str(user_id) for m in members):
        # Also check list owner
        from db.lists import get_list_by_id
        lst = get_list_by_id(list_id, token)
        if not lst or str(lst.get("user_id")) != str(user_id):
            raise HTTPException(status_code=403, detail="Must be a list member to vote")


@router.get("/{list_id}/votes")
async def get_votes_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get all votes for getaways in a list. List members only."""
    try:
        token = extract_auth_token(authorization)
        votes = get_votes_for_list(list_id, token)
        return {"votes": votes}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{list_id}/getaways/{getaway_id}/vote")
async def add_vote_endpoint(list_id: str, getaway_id: str, authorization: Optional[str] = Header(None)):
    """Add current user's vote. Must be list member."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        _ensure_list_member(list_id, user_id, token)
        result = add_vote(list_id, getaway_id, user_id, token)
        if result is None:
            raise HTTPException(status_code=400, detail="Already voted or getaway not in list")
        return {"ok": True, "vote": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/getaways/{getaway_id}/vote")
async def remove_vote_endpoint(list_id: str, getaway_id: str, authorization: Optional[str] = Header(None)):
    """Remove current user's vote."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        success = remove_vote(list_id, getaway_id, user_id, token)
        if not success:
            raise HTTPException(status_code=404, detail="Vote not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
