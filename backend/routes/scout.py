"""Scout endpoints (URL and paste)."""
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from models import ScoutRequest, ScoutPasteRequest, ScoutResponse
from db.getaways import create_loading_getaway, update_getaway
from db.scout_quota import check_and_use_quota, get_quota_status
from scout import scrape_and_thin_check, run_llm_and_update_getaway, generate_getaway_page_from_paste
from routes.auth import extract_auth_token, extract_user_id_from_token
from utils.rate_limit import check_scout_rate_limit
from utils.scout_limits import scout_semaphore, SCOUT_MAX_INPUT_CHARS
from utils.text_cleaning import strip_other_villas_block, extract_main_property_only

router = APIRouter(tags=["scout"])


async def _process_scout_llm(scraped: dict, getaway_id: str, auth_token: str):
    """Background task: run LLM and update getaway. Quota already consumed."""
    async with scout_semaphore:
        try:
            result = await run_llm_and_update_getaway(
                scraped["extraction_md"], scraped["crawl_image_urls"] or [], scraped["url"],
                getaway_id, auth_token,
            )
            updates = {"import_status": "loaded", **{k: v for k, v in result.items() if k not in ["getaway_id", "path"]}}
            update_getaway(getaway_id, updates, auth_token)
        except Exception as e:
            update_getaway(getaway_id, {"import_status": "error", "import_error": str(e)}, auth_token)


async def _process_scout_paste(pasted_text: str, list_id: str, getaway_id: str, original_url: str, auth_token: str, user_id: str):
    """Background task to process paste scout and update the getaway row."""
    async with scout_semaphore:
        try:
            result = await generate_getaway_page_from_paste(
                pasted_text=pasted_text, original_url=original_url, list_id=list_id,
                auth_token=auth_token, getaway_id=getaway_id, user_id=user_id,
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
        user_id = extract_user_id_from_token(token)
        if not check_scout_rate_limit(user_id):
            raise HTTPException(status_code=429, detail="Too many scout requests. Try again in a little while.")
        if req.getaway_id:
            getaway_id = req.getaway_id
            update_getaway(getaway_id, {"import_status": "loading"}, auth_token=token)
        else:
            loading_getaway = create_loading_getaway(list_id, url, auth_token=token)
            if not loading_getaway:
                raise Exception("Failed to create loading getaway")
            getaway_id = loading_getaway.get("id")
        scraped = await scrape_and_thin_check(url, req.check_in, req.check_out, req.guests)
        if scraped["is_thin"]:
            update_getaway(getaway_id, {"import_status": "thin"}, auth_token=token)
            return ScoutResponse(ok=True, getaway_id=getaway_id, thin_scrape=True)

        allowed, quota_error = check_and_use_quota(user_id)
        if not allowed:
            update_getaway(getaway_id, {"import_status": "error", "import_error": quota_error}, auth_token=token)
            raise HTTPException(status_code=402, detail=quota_error)

        asyncio.create_task(_process_scout_llm(scraped, getaway_id, token))
        return ScoutResponse(ok=True, getaway_id=getaway_id, thin_scrape=False)
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e), thin_scrape=False)


@router.post("/scout-paste", response_model=ScoutResponse)
async def scout_from_paste(req: ScoutPasteRequest, authorization: Optional[str] = Header(None)):
    """Build a getaway report from pasted listing text. Charge upfront, LLM runs in background."""
    list_id = req.list_id
    try:
        token = extract_auth_token(authorization)
        user_id = extract_user_id_from_token(token)
        if not check_scout_rate_limit(user_id):
            raise HTTPException(status_code=429, detail="Too many scout requests. Try again in a minute.")

        allowed, quota_error = check_and_use_quota(user_id)
        if not allowed:
            raise HTTPException(status_code=402, detail=quota_error)

        if req.getaway_id:
            getaway_id = req.getaway_id
            update_getaway(getaway_id, {"import_status": "loading"}, auth_token=token)
        else:
            url = req.original_url or "paste"
            loading_getaway = create_loading_getaway(list_id, url, auth_token=token)
            if not loading_getaway:
                raise Exception("Failed to create loading getaway")
            getaway_id = loading_getaway.get("id")
        # Check if truncation will occur (same logic as scout.py: cut then truncate)
        cut = strip_other_villas_block(req.pasted_text or "")
        cut = extract_main_property_only(cut)
        truncated = len(cut) > SCOUT_MAX_INPUT_CHARS
        asyncio.create_task(_process_scout_paste(req.pasted_text, list_id, getaway_id, req.original_url, token, user_id))
        return ScoutResponse(ok=True, getaway_id=getaway_id, truncated=truncated)
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e))


@router.get("/scout-quota")
async def scout_quota_status(authorization: Optional[str] = Header(None)):
    """Get current user's scout quota status (free remaining, credits)."""
    token = extract_auth_token(authorization)
    user_id = extract_user_id_from_token(token)
    return get_quota_status(user_id)
