"""Tests for Scout robots.txt checks."""
import asyncio
from unittest.mock import AsyncMock

import pytest

from utils.robots import robots_url_for, scout_url_allowed


def test_robots_url_for():
    assert robots_url_for("https://example.com/villa/1") == "https://example.com/robots.txt"


@pytest.mark.asyncio
async def test_scout_url_allowed_when_robots_missing(monkeypatch):
    async def fake_fetch(_url: str) -> None:
        return None

    monkeypatch.setattr("utils.robots.fetch_robots_txt", fake_fetch)
    assert await scout_url_allowed("https://example.com/listing") is True


@pytest.mark.asyncio
async def test_scout_url_disallowed_when_root_blocked(monkeypatch):
    async def fake_fetch(_url: str) -> str:
        return "User-agent: *\nDisallow: /\n"

    monkeypatch.setattr("utils.robots.fetch_robots_txt", fake_fetch)
    assert await scout_url_allowed("https://example.com/listing") is False


@pytest.mark.asyncio
async def test_scout_url_allowed_for_unblocked_path(monkeypatch):
    async def fake_fetch(_url: str) -> str:
        return "User-agent: *\nDisallow: /admin\n"

    monkeypatch.setattr("utils.robots.fetch_robots_txt", fake_fetch)
    assert await scout_url_allowed("https://example.com/villa/1") is True


def test_scrape_skips_crawl_when_robots_blocks(monkeypatch):
    import scout as mod

    async def disallow(_url: str) -> bool:
        return False

    crawl_mock = AsyncMock()

    monkeypatch.setattr(mod, "scout_url_allowed", disallow)
    monkeypatch.setattr(mod, "crawl_page", crawl_mock)

    result = asyncio.run(
        mod.scrape_and_thin_check("https://example.com/villa/1"),
    )

    assert result["is_thin"] is True
    assert result["robots_blocked"] is True
    crawl_mock.assert_not_called()
