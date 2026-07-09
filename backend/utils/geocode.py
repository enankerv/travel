"""OpenCage geocoding — single entry point with cache and per-user quota."""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import urlopen

log = logging.getLogger("geocode")

GEOCODE_RATE_LIMIT_PER_MIN = int(os.getenv("GEOCODE_RATE_LIMIT_PER_MIN", "5"))
GEOCODE_MAX_PER_USER_PER_DAY = int(os.getenv("GEOCODE_MAX_PER_USER_PER_DAY", "30"))

_WINDOW_SECONDS = 60
_quota_lock = threading.Lock()
_user_minute_timestamps: dict[str, list[float]] = {}
_user_day_counts: dict[str, tuple[str, int]] = {}
_query_cache: dict[str, tuple[float | None, float | None]] = {}

_last_opencage_request: float = 0
_OPENCAGE_MIN_INTERVAL = 1.0


def reset_geocode_state_for_tests() -> None:
    """Clear quota and cache. For testing only."""
    global _last_opencage_request
    with _quota_lock:
        _user_minute_timestamps.clear()
        _user_day_counts.clear()
        _query_cache.clear()
    _last_opencage_request = 0


def _normalize_query(query: str) -> str | None:
    q = " ".join((query or "").lower().split())
    return q if len(q) >= 2 else None


def _cache_get(query: str) -> tuple[float | None, float | None] | None:
    key = _normalize_query(query)
    if not key:
        return None
    with _quota_lock:
        return _query_cache.get(key)


def _cache_set(query: str, lat: float | None, lng: float | None) -> None:
    key = _normalize_query(query)
    if not key:
        return
    with _quota_lock:
        _query_cache[key] = (lat, lng)


def _reserve_user_geocode(user_id: str) -> bool:
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with _quota_lock:
        timestamps = [t for t in _user_minute_timestamps.get(user_id, []) if t > cutoff]
        if len(timestamps) >= GEOCODE_RATE_LIMIT_PER_MIN:
            return False

        day_key, count = _user_day_counts.get(user_id, (today, 0))
        if day_key != today:
            day_key, count = today, 0
        if count >= GEOCODE_MAX_PER_USER_PER_DAY:
            return False

        timestamps.append(now)
        _user_minute_timestamps[user_id] = timestamps
        _user_day_counts[user_id] = (day_key, count + 1)
        return True


def _wait_for_opencage_slot() -> None:
    global _last_opencage_request
    now = time.monotonic()
    elapsed = now - _last_opencage_request
    if elapsed < _OPENCAGE_MIN_INTERVAL:
        time.sleep(_OPENCAGE_MIN_INTERVAL - elapsed)
    _last_opencage_request = time.monotonic()


def _fetch_opencage(query: str) -> tuple[float | None, float | None]:
    key = os.environ.get("OPENCAGE_API_KEY")
    if not key:
        log.warning("OPENCAGE_API_KEY not set, skipping geocoding")
        return (None, None)

    _wait_for_opencage_slot()

    url = (
        "https://api.opencagedata.com/geocode/v1/json"
        f"?q={quote(query)}"
        f"&key={key}"
        "&limit=1"
        "&no_annotations=1"
    )

    try:
        with urlopen(url, timeout=10) as resp:
            data = resp.read().decode()
    except Exception as exc:
        log.warning("geocode request failed: %s", exc)
        return (None, None)

    try:
        payload = json.loads(data)
    except json.JSONDecodeError as exc:
        log.warning("geocode response parse failed: %s", exc)
        return (None, None)

    if payload.get("status", {}).get("code") != 200:
        log.warning("geocode API error: %s", payload.get("status", {}))
        return (None, None)

    results = payload.get("results") or []
    if not results:
        return (None, None)

    geom = results[0].get("geometry") or {}
    lat, lng = geom.get("lat"), geom.get("lng")
    if lat is not None and lng is not None:
        return float(lat), float(lng)
    return (None, None)


def location_query(location: str | None, region: str | None = None) -> str | None:
    """Build a comma-joined OpenCage query from location and optional region."""
    parts = [(location or "").strip(), (region or "").strip()]
    q = ", ".join(p for p in parts if p)
    return q or None


def geocode_query_for_poi_fields(fields: dict) -> str | None:
    """Prefer a street address over a loose location label for OpenCage."""
    address = str(fields.get("address") or "").strip()
    if address:
        return address
    return location_query(fields.get("location"))


def location_query_if_changed(
    *,
    current_location: str | None,
    current_region: str | None,
    changes: dict,
) -> str | None:
    """Return a geocode query when ``changes`` alters location or region; else None."""
    old_loc = (current_location or "").strip()
    old_reg = (current_region or "").strip()
    new_loc = (changes["location"] or "").strip() if "location" in changes else old_loc
    new_reg = (changes["region"] or "").strip() if "region" in changes else old_reg
    if new_loc == old_loc and new_reg == old_reg:
        return None
    return location_query(new_loc, new_reg)


def geocode(query: str, *, user_id: str) -> tuple[float | None, float | None]:
    """
    Geocode a location string to (lat, lng).

    Cache hit → no quota, no API call.
    Cache miss → per-user rate/daily cap, then OpenCage (1 req/sec globally).
    """
    q = (query or "").strip()
    if len(q) < 2:
        return (None, None)

    cached = _cache_get(q)
    if cached is not None:
        return cached

    if not _reserve_user_geocode(user_id):
        log.info("geocode quota exceeded for user %s", user_id[:8])
        return (None, None)

    result = _fetch_opencage(q)
    _cache_set(q, *result)
    return result
