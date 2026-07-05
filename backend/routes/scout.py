"""Scout endpoints (URL and paste)."""
from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from models import ScoutRequest, ScoutPasteRequest, ScoutResponse, Getaway
from db.scout_quota import get_quota_status
from scout import (
    ScoutExtractionBundle,
    execute_scout_bundle_to_getaway,
    generate_getaway_page_from_paste,
    manual_paste_exceeds_scout_input_limit,
    scout_bundle_from_scrape_dict,
    scrape_and_thin_check,
)
from routes.auth import extract_auth_token, extract_user_id_from_token
from utils.rate_limit import check_scout_rate_limit
from utils.scout_limits import scout_semaphore

router = APIRouter(tags=["scout"])

_RESULT_KEYS_EXCLUDED_FROM_GETAWAY_MERGE = frozenset({"poi_id", "path", "quota_exceeded", "thin_scrape"})


def _scout_token_and_user_id(authorization: Optional[str]) -> tuple[str, str]:
    token = extract_auth_token(authorization)
    return token, extract_user_id_from_token(token)


def _require_scout_rate_limit(user_id: str, detail: str) -> None:
    if not check_scout_rate_limit(user_id):
        raise HTTPException(status_code=429, detail=detail)


def _ensure_loading_getaway(
    *,
    list_id: str,
    poi_id: Optional[str],
    new_row_source_url: str,
    auth_token: str,
    user_id: Optional[str] = None,
) -> str:
    """Mark existing row loading or insert a loading placeholder; return poi id."""
    if poi_id:
        Getaway.update_by_id(poi_id, auth_token, import_status="loading")
        return poi_id
    loading = Getaway.new(
        list_id, auth_token,
        user_id=user_id, source_url=new_row_source_url, import_status="loading",
    )
    if not loading:
        raise Exception("Failed to create loading getaway")
    return loading.id


def _preflight_scout_quota_or_raise(user_id: str) -> None:
    """
    Fast 402 when user has no credits (read-only). Actual charge runs in background
    inside scout (``execute_scout_bundle_to_getaway`` / paste pipeline).
    """
    if not get_quota_status(user_id).get("can_scout"):
        raise HTTPException(
            status_code=402,
            detail="You're out of scout credits. Buy a pack to continue.",
        )


def _loaded_updates_from_scout_result(result: dict) -> dict:
    return {
        "import_status": "loaded",
        **{k: v for k, v in result.items() if k not in _RESULT_KEYS_EXCLUDED_FROM_GETAWAY_MERGE},
    }


def _apply_scout_result_to_getaway(poi_id: str, auth_token: str, result: dict) -> None:
    """Merge a successful scout dict onto the poi row (no-op if quota already handled an error)."""
    if result.get("quota_exceeded"):
        return
    Getaway.update_by_id(poi_id, auth_token, **_loaded_updates_from_scout_result(result))


def _record_scout_background_failure(poi_id: str, auth_token: str, exc: BaseException) -> None:
    Getaway.update_by_id(poi_id, auth_token, import_status="error", import_error=str(exc))


async def _run_url_scout_llm_background(
    bundle: ScoutExtractionBundle,
    poi_id: str,
    auth_token: str,
    user_id: str,
) -> None:
    """Background: scout bundle (quota + LLM + persist) for URL listings."""
    async with scout_semaphore:
        try:
            result = await execute_scout_bundle_to_getaway(
                bundle, poi_id, auth_token, user_id,
            )
            _apply_scout_result_to_getaway(poi_id, auth_token, result)
        except Exception as e:
            _record_scout_background_failure(poi_id, auth_token, e)


async def _run_paste_scout_background(
    pasted_text: str,
    list_id: str,
    poi_id: str,
    original_url: str | None,
    auth_token: str,
    user_id: str,
) -> None:
    """Background: quota gate + bundle build + LLM (see generate_getaway_page_from_paste)."""
    async with scout_semaphore:
        try:
            result = await generate_getaway_page_from_paste(
                pasted_text=pasted_text,
                original_url=original_url,
                list_id=list_id,
                auth_token=auth_token,
                poi_id=poi_id,
                user_id=user_id,
            )
            _apply_scout_result_to_getaway(poi_id, auth_token, result)
        except Exception as e:
            _record_scout_background_failure(poi_id, auth_token, e)


@router.post("/scout", response_model=ScoutResponse)
async def scout_listing(req: ScoutRequest, authorization: Optional[str] = Header(None)):
    """Scout a URL and save to a list. If getaway_id is provided, updates that getaway (retry)."""
    url = str(req.url)
    list_id = req.list_id
    try:
        token, user_id = _scout_token_and_user_id(authorization)
        _require_scout_rate_limit(
            user_id,
            "Too many scout requests. Try again in a little while.",
        )
        poi_id = _ensure_loading_getaway(
            list_id=list_id,
            poi_id=req.poi_id,
            new_row_source_url=url,
            auth_token=token,
            user_id=user_id,
        )
        scraped = await scrape_and_thin_check(url, req.check_in, req.check_out, req.guests)
        if scraped["is_thin"]:
            Getaway.update_by_id(poi_id, token, import_status="thin")
            return ScoutResponse(ok=True, poi_id=poi_id, thin_scrape=True)

        _preflight_scout_quota_or_raise(user_id)
        bundle = scout_bundle_from_scrape_dict(scraped)
        asyncio.create_task(_run_url_scout_llm_background(bundle, poi_id, token, user_id))
        return ScoutResponse(ok=True, poi_id=poi_id, thin_scrape=False)
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e), thin_scrape=False)


@router.post("/scout-paste", response_model=ScoutResponse)
async def scout_from_paste(req: ScoutPasteRequest, authorization: Optional[str] = Header(None)):
    """Build a getaway report from pasted listing text. Charge upfront, LLM runs in background."""
    list_id = req.list_id
    try:
        token, user_id = _scout_token_and_user_id(authorization)
        _require_scout_rate_limit(
            user_id,
            "Too many scout requests. Try again in a minute.",
        )
        _preflight_scout_quota_or_raise(user_id)

        poi_id = _ensure_loading_getaway(
            list_id=list_id,
            poi_id=req.poi_id,
            new_row_source_url=req.original_url or "paste",
            auth_token=token,
            user_id=user_id,
        )
        truncated = manual_paste_exceeds_scout_input_limit(req.pasted_text)
        asyncio.create_task(
            _run_paste_scout_background(
                req.pasted_text,
                list_id,
                poi_id,
                req.original_url,
                token,
                user_id,
            )
        )
        return ScoutResponse(ok=True, poi_id=poi_id, truncated=truncated)
    except HTTPException:
        raise
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e), thin_scrape=False)


@router.get("/scout-quota")
async def scout_quota_status(authorization: Optional[str] = Header(None)):
    """Get current user's scout quota status (free remaining, credits)."""
    token = extract_auth_token(authorization)
    user_id = extract_user_id_from_token(token)
    return get_quota_status(user_id)
