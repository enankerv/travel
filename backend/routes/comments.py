"""Comment endpoints. List members can read; only owner can update/delete."""
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from db.comments import get_comments_for_list, create_comment, update_comment, delete_comment
from db.list_members import get_list_members
from routes.auth import extract_auth_token, extract_user_id_from_token

router = APIRouter(prefix="/lists", tags=["comments"])


def _ensure_list_member(list_id: str, user_id: str, token: str) -> None:
    """Raise 403 if user is not a member of the list."""
    data = get_list_members(list_id, token)
    members = data.get("members") or []
    if not any(str(m.get("user_id")) == str(user_id) for m in members):
        from db.lists import get_list_by_id
        lst = get_list_by_id(list_id, token)
        if not lst or str(lst.get("user_id")) != str(user_id):
            raise HTTPException(status_code=403, detail="Must be a list member")


@router.get("/{list_id}/comments")
async def get_comments_endpoint(list_id: str, authorization: Optional[str] = Header(None)):
    """Get all comments for getaways in a list. List members only."""
    try:
        token = extract_auth_token(authorization)
        _ensure_list_member(list_id, extract_user_id_from_token(token), token)
        comments = get_comments_for_list(list_id, token)
        return {"comments": comments}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{list_id}/getaways/{getaway_id}/comments")
async def create_comment_endpoint(
    list_id: str, getaway_id: str,
    body: dict,
    authorization: Optional[str] = Header(None),
):
    """Create a comment on a getaway. Must be list member."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        _ensure_list_member(list_id, user_id, token)
        comment_body = body.get("body", "").strip()
        if not comment_body:
            raise HTTPException(status_code=400, detail="Comment body is required")
        result = create_comment(list_id, getaway_id, user_id, comment_body, token)
        if result is None:
            raise HTTPException(status_code=400, detail="Getaway not found or invalid")
        return {"comment": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}/comments/{comment_id}")
async def update_comment_endpoint(
    list_id: str, comment_id: str,
    body: dict,
    authorization: Optional[str] = Header(None),
):
    """Update a comment. Only owner can update."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        _ensure_list_member(list_id, user_id, token)
        comment_body = body.get("body", "").strip()
        if not comment_body:
            raise HTTPException(status_code=400, detail="Comment body is required")
        result = update_comment(comment_id, user_id, comment_body, token)
        if result is None:
            raise HTTPException(status_code=404, detail="Comment not found or not owner")
        return {"comment": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}/comments/{comment_id}")
async def delete_comment_endpoint(
    list_id: str, comment_id: str,
    authorization: Optional[str] = Header(None),
):
    """Delete a comment. Only owner can delete."""
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        success = delete_comment(comment_id, user_id, token)
        if not success:
            raise HTTPException(status_code=404, detail="Comment not found or not owner")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
