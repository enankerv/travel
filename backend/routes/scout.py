"""Scout endpoints (URL and paste)."""
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from models import ScoutRequest, ScoutPasteRequest, ScoutResponse
from db.getaways import create_loading_getaway, update_getaway
from scout import generate_getaway_page, generate_getaway_page_from_paste
from routes.auth import extract_auth_token

router = APIRouter(tags=["scout"])


async def _process_scout(url: str, list_id: str, getaway_id: str, check_in: str, check_out: str, guests: int, auth_token: str):
    """Background task to process scout and update the getaway row."""
    try:
        result = await generate_getaway_page(
            url, check_in=check_in, check_out=check_out, guests=guests,
            list_id=list_id, auth_token=auth_token, getaway_id=getaway_id,
        )
        if result.get("thin_scrape"):
            update_getaway(getaway_id, {"import_status": "thin"}, auth_token)
        else:
            updates = {
                "import_status": "loaded",
                **{k: v for k, v in result.items() if k not in ["getaway_id", "path", "thin_scrape"]}
            }
            update_getaway(getaway_id, updates, auth_token)
    except Exception as e:
        update_getaway(getaway_id, {"import_status": "error", "import_error": str(e)}, auth_token)


async def _process_scout_paste(pasted_text: str, list_id: str, getaway_id: str, original_url: str, auth_token: str):
    """Background task to process paste scout and update the getaway row."""
    try:
        result = await generate_getaway_page_from_paste(
            pasted_text=pasted_text, original_url=original_url, list_id=list_id,
            auth_token=auth_token, getaway_id=getaway_id,
        )
        updates = {"import_status": "loaded", **{k: v for k, v in result.items() if k not in ["getaway_id", "path"]}}
        update_getaway(getaway_id, updates, auth_token)
    except Exception as e:
        update_getaway(getaway_id, {"import_status": "error", "import_error": str(e)}, auth_token)


@router.post("/scout", response_model=ScoutResponse)
async def scout_listing(req: ScoutRequest, authorization: Optional[str] = Header(None)):
    """Scout a URL and save to a list. If getaway_id is provided, updates that getaway (retry)."""
    url = str(req.url)
    list_id = req.list_id
    try:
        token = extract_auth_token(authorization)
        if req.getaway_id:
            getaway_id = req.getaway_id
            update_getaway(getaway_id, {"import_status": "loading"}, auth_token=token)
        else:
            loading_getaway = create_loading_getaway(list_id, url, auth_token=token)
            if not loading_getaway:
                raise Exception("Failed to create loading getaway")
            getaway_id = loading_getaway.get("id")
        asyncio.create_task(_process_scout(url, list_id, getaway_id, req.check_in, req.check_out, req.guests, token))
        return ScoutResponse(ok=True, getaway_id=getaway_id)
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e), thin_scrape=False)


@router.post("/scout-paste", response_model=ScoutResponse)
async def scout_from_paste(req: ScoutPasteRequest, authorization: Optional[str] = Header(None)):
    """Build a getaway report from pasted listing text. If getaway_id is provided, updates that getaway."""
    list_id = req.list_id
    try:
        token = extract_auth_token(authorization)
        if req.getaway_id:
            getaway_id = req.getaway_id
            update_getaway(getaway_id, {"import_status": "loading"}, auth_token=token)
        else:
            url = req.original_url or "paste"
            loading_getaway = create_loading_getaway(list_id, url, auth_token=token)
            if not loading_getaway:
                raise Exception("Failed to create loading getaway")
            getaway_id = loading_getaway.get("id")
        asyncio.create_task(_process_scout_paste(req.pasted_text, list_id, getaway_id, req.original_url, token))
        return ScoutResponse(ok=True, getaway_id=getaway_id)
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e))
