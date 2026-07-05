"""Tests for URL reachability helper."""
import pytest

from utils.url_verify import url_is_reachable


@pytest.mark.asyncio
async def test_rejects_non_http():
    assert await url_is_reachable("ftp://example.com") is False
    assert await url_is_reachable("not-a-url") is False
