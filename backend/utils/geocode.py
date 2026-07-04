"""OpenCage geocoding for getaway locations. Rate limited to 1 req/sec (free tier)."""
from __future__ import annotations

import json
import logging
import os
import time
from urllib.parse import quote
from urllib.request import urlopen

log = logging.getLogger("scout.geocode")

# Last request timestamp for rate limiting (1 req/sec on free tier)
_last_request_time: float = 0
_MIN_INTERVAL = 1.0


def _rate_limit() -> None:
    """Enforce 1 request per second for OpenCage free tier."""
    global _last_request_time
    now = time.monotonic()
    elapsed = now - _last_request_time
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)
    _last_request_time = time.monotonic()


def geocode(query: str) -> tuple[float | None, float | None]:
    """
    Forward geocode a location string (e.g. "Bidwell, Ohio" or "Rio Grande, Gallia County, Ohio").
    Returns (lat, lng) or (None, None) if not found or on error.
    Uses OpenCage API. Requires OPENCAGE_API_KEY env var.
    """
    key = os.environ.get("OPENCAGE_API_KEY")
    if not key:
        log.warning("OPENCAGE_API_KEY not set, skipping geocoding")
        return (None, None)

    query = (query or "").strip()
    if len(query) < 2:
        return (None, None)

    _rate_limit()

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
    except Exception as e:
        log.warning("geocode request failed: %s", e)
        return (None, None)

    try:
        j = json.loads(data)
    except json.JSONDecodeError as e:
        log.warning("geocode response parse failed: %s", e)
        return (None, None)

    if j.get("status", {}).get("code") != 200:
        log.warning("geocode API error: %s", j.get("status", {}))
        return (None, None)

    results = j.get("results") or []
    if not results:
        return (None, None)

    geom = results[0].get("geometry") or {}
    lat = geom.get("lat")
    lng = geom.get("lng")
    if lat is not None and lng is not None:
        return (float(lat), float(lng))
    return (None, None)


def geocode_from_location_region(
    location: str | None, region: str | None
) -> tuple[float | None, float | None]:
    """Geocode using the same query shape as scout (location, region comma-joined)."""
    loc = (location or "").strip()
    reg = (region or "").strip()
    q = ", ".join(p for p in [loc, reg] if p)
    if not q:
        return (None, None)
    return geocode(q)


def apply_geocode_if_location_changed(current, updates: dict) -> None:
    """When location or region in ``updates`` differs from ``current``, set lat/lng."""

    def _strip(s: str | None) -> str:
        return (s or "").strip()

    touched_loc = "location" in updates
    touched_reg = "region" in updates
    if not touched_loc and not touched_reg:
        return
    old_loc = _strip(current.location)
    old_reg = _strip(getattr(current, "region", None))
    new_loc = _strip(updates["location"]) if touched_loc else old_loc
    new_reg = _strip(updates["region"]) if touched_reg else old_reg
    if new_loc != old_loc or new_reg != old_reg:
        lat, lng = geocode_from_location_region(new_loc, new_reg)
        updates["lat"] = lat
        updates["lng"] = lng


def apply_geocode_on_create(fields: dict) -> None:
    """Geocode into lat/lng when create payload has location but no coords."""
    if fields.get("lat") is not None and fields.get("lng") is not None:
        return
    loc = (fields.get("location") or "").strip()
    if not loc:
        return
    lat, lng = geocode_from_location_region(loc, None)
    if lat is not None and lng is not None:
        fields["lat"] = lat
        fields["lng"] = lng
