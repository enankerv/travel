"""Tests for geocode cache and per-user quota."""
from unittest.mock import patch

import pytest

from utils.geocode import (
    GEOCODE_MAX_PER_USER_PER_DAY,
    GEOCODE_RATE_LIMIT_PER_MIN,
    _cache_get,
    _cache_set,
    _reserve_user_geocode,
    geocode,
    reset_geocode_state_for_tests,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_geocode_state_for_tests()
    yield
    reset_geocode_state_for_tests()


def test_cache_dedupes_queries():
    _cache_set("Paris, France", 48.85, 2.35)
    assert _cache_get("  paris,   france ") == (48.85, 2.35)


def test_reserve_user_geocode_rate_limit():
    with patch("utils.geocode.GEOCODE_RATE_LIMIT_PER_MIN", 2):
        assert _reserve_user_geocode("user-a") is True
        assert _reserve_user_geocode("user-a") is True
        assert _reserve_user_geocode("user-a") is False


def test_reserve_user_geocode_daily_limit():
    with patch("utils.geocode.GEOCODE_MAX_PER_USER_PER_DAY", 2):
        assert _reserve_user_geocode("user-b") is True
        assert _reserve_user_geocode("user-b") is True
        assert _reserve_user_geocode("user-b") is False


def test_geocode_skips_api_when_over_quota(monkeypatch):
    def fail_fetch(_query: str):
        raise AssertionError("should not call OpenCage")

    monkeypatch.setenv("OPENCAGE_API_KEY", "test-key")
    monkeypatch.setattr("utils.geocode._fetch_opencage", fail_fetch)

    with patch("utils.geocode._reserve_user_geocode", return_value=False):
        lat, lng = geocode("Paris, France", user_id="user-c")
        assert (lat, lng) == (None, None)


def test_geocode_uses_cache_without_quota(monkeypatch):
    _cache_set("Paris, France", 1.0, 2.0)

    def fail_fetch(_query: str):
        raise AssertionError("should not call OpenCage")

    monkeypatch.setenv("OPENCAGE_API_KEY", "test-key")
    monkeypatch.setattr("utils.geocode._fetch_opencage", fail_fetch)

    with patch("utils.geocode._reserve_user_geocode") as reserve:
        lat, lng = geocode("Paris, France", user_id="user-c")
        assert (lat, lng) == (1.0, 2.0)
        reserve.assert_not_called()


def test_location_query_if_changed():
    from utils.geocode import location_query_if_changed

    assert location_query_if_changed(
        current_location="Old town",
        current_region="Tuscany",
        changes={"location": "Old town"},
    ) is None

    assert location_query_if_changed(
        current_location="Old town",
        current_region="Tuscany",
        changes={"location": "New town"},
    ) == "New town, Tuscany"


def test_geocode_enforces_quota_on_cache_miss(monkeypatch):
    monkeypatch.setenv("OPENCAGE_API_KEY", "test-key")
    monkeypatch.setattr("utils.geocode._fetch_opencage", lambda _q: (10.0, 20.0))

    with patch("utils.geocode.GEOCODE_RATE_LIMIT_PER_MIN", 1):
        assert geocode("Town A", user_id="user-d") == (10.0, 20.0)
        assert geocode("Town B", user_id="user-d") == (None, None)
