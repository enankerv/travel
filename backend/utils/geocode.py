"""OpenCage geocoding for getaway locations. Rate limited to 1 req/sec (free tier)."""
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
