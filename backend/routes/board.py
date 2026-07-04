"""Board snapshot endpoint — POIs with nested comments and votes."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from models import BoardResponse
from routes.auth import extract_auth_token

router = APIRouter(prefix="/lists", tags=["board"])


@router.get("/{list_id}/board", response_model=BoardResponse)
async def get_board_endpoint(
    list_id: str,
    authorization: Optional[str] = Header(None),
) -> BoardResponse:
    """Full cork-board payload: list, members, POIs each with comments + votes."""
    try:
        token = extract_auth_token(authorization)
        snapshot = BoardResponse.snapshot(list_id, token)
        if not snapshot:
            raise HTTPException(status_code=404, detail="List not found")
        return snapshot
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
