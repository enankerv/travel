"""robots.txt checks for Scout crawling."""
from __future__ import annotations

import logging
from urllib.parse import urlparse, urlunparse
from urllib.robotparser import RobotFileParser

import httpx

log = logging.getLogger("robots")

SCOUT_USER_AGENT = (
    "Mozilla/5.0 (compatible; GetawayGatherScout/1.0; +https://getawaygather.com)"
)

_ROBOTS_TIMEOUT = 10.0


def robots_url_for(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme}")
    return urlunparse((parsed.scheme, parsed.netloc, "/robots.txt", "", "", ""))


async def fetch_robots_txt(robots_url: str) -> str | None:
    """Fetch robots.txt body, or None when missing/unreachable."""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=_ROBOTS_TIMEOUT,
            headers={"User-Agent": SCOUT_USER_AGENT},
        ) as client:
            resp = await client.get(robots_url)
            if resp.status_code >= 400:
                log.debug("robots.txt unavailable (%s): %s", resp.status_code, robots_url)
                return None
            return resp.text
    except Exception as exc:
        log.debug("robots.txt fetch failed for %s: %s", robots_url, exc)
        return None


def _parser_from_body(robots_url: str, body: str) -> RobotFileParser:
    rp = RobotFileParser()
    rp.set_url(robots_url)
    rp.parse(body.splitlines())
    return rp


async def scout_url_allowed(url: str, *, user_agent: str = SCOUT_USER_AGENT) -> bool:
    """
    Return True if robots.txt permits fetching ``url`` for ``user_agent``.

    Missing or unreachable robots.txt is treated as allow-all (usual crawler convention).
    """
    robots_url = robots_url_for(url)
    body = await fetch_robots_txt(robots_url)
    if body is None:
        return True
    rp = _parser_from_body(robots_url, body)
    allowed = rp.can_fetch(user_agent, url)
    if not allowed:
        log.info("robots.txt disallows %s for %s", url, user_agent)
    return allowed
