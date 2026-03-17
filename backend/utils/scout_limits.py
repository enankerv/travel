"""Scout API input limits to cap LLM costs."""
import asyncio
import os
import re

# Max chars sent to LLM per scout (prevents runaway costs). ~4 chars ≈ 1 token; 9k ≈ 2.2k tokens.
SCOUT_MAX_INPUT_CHARS = int(os.getenv("SCOUT_MAX_INPUT_CHARS", "9000"))

# Max scout requests per user per minute (rate limiting).
SCOUT_RATE_LIMIT_PER_MIN = int(os.getenv("SCOUT_RATE_LIMIT_PER_MIN", "10"))

# Max concurrent scouts (crawl + LLM). Caps resource usage.
SCOUT_MAX_CONCURRENT = int(os.getenv("SCOUT_MAX_CONCURRENT", "10"))

scout_semaphore = asyncio.Semaphore(SCOUT_MAX_CONCURRENT)

# Trailing block of URLs appended by frontend (one per line after \n\n)
_TRAILING_URL_RE = re.compile(r"\n\n(https?://[^\s\n]+(?:\nhttps?://[^\s\n]+)*)\s*$")


def _split_trailing_image_urls(text: str) -> tuple[str, list[str]]:
    """If text ends with \\n\\n + URLs (one per line), return (text_part, url_list). Else (text, [])."""
    m = _TRAILING_URL_RE.search(text)
    if not m:
        return text, []
    urls = [u.strip() for u in m.group(1).split("\n") if u.strip().startswith("http")]
    if not urls:
        return text, []
    text_part = text[: m.start()].rstrip()
    return text_part, urls


def truncate_for_extraction(text: str) -> str:
    """Truncate text to SCOUT_MAX_INPUT_CHARS to cap LLM cost. Preserves start (usually most relevant)."""
    if not text or len(text) <= SCOUT_MAX_INPUT_CHARS:
        return text
    suffix = "\n\n[... truncated for cost limits ...]"
    return text[: SCOUT_MAX_INPUT_CHARS - len(suffix)] + suffix


def truncate_for_extraction_preserving_images(text: str) -> str:
    """Truncate text for LLM, but never cut off trailing image URLs appended by the frontend."""
    text_part, image_urls = _split_trailing_image_urls(text)
    truncated_text = truncate_for_extraction(text_part)
    if not image_urls:
        return truncated_text
    return truncated_text + "\n\n" + "\n".join(image_urls)
