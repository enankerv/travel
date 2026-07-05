"""Scout geocode runs only after scout quota is consumed."""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from schema import VillaListing


@pytest.mark.asyncio
async def test_scout_geocode_runs_after_quota(monkeypatch):
    import scout as mod

    quota_called = []
    geocode_called = []

    def fake_quota(user_id: str):
        quota_called.append(user_id)
        return True, None

    def fake_geocode_listing(listing, *, user_id: str):
        geocode_called.append(user_id)
        return 1.0, 2.0

    monkeypatch.setattr(mod, "check_and_use_quota", fake_quota)
    monkeypatch.setattr(mod, "_geocode_listing", fake_geocode_listing)
    monkeypatch.setattr(mod, "extract_villa_two_pass", AsyncMock(return_value=VillaListing()))
    monkeypatch.setattr(mod, "upload_images_to_supabase", AsyncMock(return_value=[]))
    monkeypatch.setattr(mod.Getaway, "update_by_id", lambda *a, **k: None)

    bundle = mod.ScoutExtractionBundle(
        extraction_md="Villa in Tuscany",
        image_candidate_urls=(),
        source_url="https://example.com/v",
        raw_text_for_price="Villa in Tuscany",
        url_for_path_title="https://example.com/v",
        name_if_no_villa="Listing",
    )

    await mod.execute_scout_bundle_to_getaway(
        bundle, "poi-1", "token", "user-123",
    )

    assert quota_called == ["user-123"]
    assert geocode_called == ["user-123"]


@pytest.mark.asyncio
async def test_scout_geocode_skipped_when_quota_denied(monkeypatch):
    import scout as mod

    geocode_called = []

    monkeypatch.setattr(
        mod,
        "check_and_use_quota",
        lambda _uid: (False, "no credits"),
    )
    monkeypatch.setattr(mod, "_geocode_listing", lambda *a, **k: geocode_called.append(True))
    monkeypatch.setattr(mod.Getaway, "update_by_id", lambda *a, **k: None)

    bundle = mod.ScoutExtractionBundle(
        extraction_md="Villa",
        image_candidate_urls=(),
        source_url="https://example.com/v",
        raw_text_for_price="Villa",
        url_for_path_title=None,
        name_if_no_villa="Listing",
    )

    result = await mod.execute_scout_bundle_to_getaway(
        bundle, "poi-1", "token", "user-123",
    )

    assert result.get("quota_exceeded") is True
    assert geocode_called == []
