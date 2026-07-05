"""Board snapshot endpoint — POIs with nested comments and votes."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from board_chat import board_chat_reply, board_pin_context_from_poi
from db.scout_quota import check_and_use_quota
from models import BoardChatRequest, BoardChatResponse, BoardResponse
from routes.auth import extract_auth_token, extract_user_id_from_token

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


@router.post("/{list_id}/board/chat", response_model=BoardChatResponse)
async def board_chat_endpoint(
    list_id: str,
    body: BoardChatRequest,
    authorization: Optional[str] = Header(None),
) -> BoardChatResponse:
    """Ephemeral board chat — history is client-held only."""
    try:
        token = extract_auth_token(authorization)
        snapshot = BoardResponse.snapshot(list_id, token)
        if not snapshot:
            raise HTTPException(status_code=404, detail="List not found")

        user_id = extract_user_id_from_token(token)
        allowed, quota_error = check_and_use_quota(user_id)
        if not allowed:
            raise HTTPException(
                status_code=402,
                detail=quota_error or "You're out of scout credits. Buy a pack to continue.",
            )

        pin_rows = [board_pin_context_from_poi(p) for p in snapshot.pois]
        result = await board_chat_reply(
            message=body.message,
            history=[m.model_dump() for m in body.history],
            list_name=snapshot.list.name,
            pin_rows=pin_rows,
        )
        return BoardChatResponse(
            reply=result.reply,
            sources=[{"title": s.title, "uri": s.uri} for s in result.sources],
            suggestions=[
                {
                    "poi_type": s.poi_type,
                    "title": s.title,
                    "description": s.description,
                    "location": s.location,
                    "address": s.address,
                    "lat": s.lat,
                    "lng": s.lng,
                    "source_url": s.source_url,
                    "thumbnail_url": s.thumbnail_url,
                }
                for s in result.suggestions
            ],
        )
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
