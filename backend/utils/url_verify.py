"""Best-effort HTTP reachability checks for external URLs."""
from __future__ import annotations

import logging

import httpx

log = logging.getLogger("url_verify")

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; GetawayGather/1.0; +https://getawaygather.com)"
    ),
    "Accept": "text/html,application/xhtml+xml",
}


def _status_ok(status: int | None) -> bool:
    if status is None:
        return False
    if status == 403:
        # Bot wall — URL likely exists (common for booking sites).
        return True
    return 200 <= status < 400


async def url_is_reachable(url: str, *, timeout: float = 10.0) -> bool:
    """Return True if URL responds (HEAD, then GET if HEAD is inconclusive)."""
    if not url.startswith(("http://", "https://")):
        return False
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            headers=_DEFAULT_HEADERS,
        ) as client:
            head = await client.head(url)
            if _status_ok(head.status_code):
                return True
            # Many sites mishandle HEAD (404/405/etc.) but respond to GET.
            get = await client.get(url)
            return _status_ok(get.status_code)
    except Exception as exc:
        log.debug("url verify failed for %s: %s", url[:80], exc)
        return False
