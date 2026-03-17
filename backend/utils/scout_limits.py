"""Scout API input limits to cap LLM costs."""
import asyncio
import os

# Max chars sent to LLM per scout (prevents runaway costs). ~4 chars ≈ 1 token; 9k ≈ 2.2k tokens.
SCOUT_MAX_INPUT_CHARS = int(os.getenv("SCOUT_MAX_INPUT_CHARS", "9000"))

# Max scout requests per user per minute (rate limiting).
SCOUT_RATE_LIMIT_PER_MIN = int(os.getenv("SCOUT_RATE_LIMIT_PER_MIN", "10"))

# Max concurrent scouts (crawl + LLM). Caps resource usage.
SCOUT_MAX_CONCURRENT = int(os.getenv("SCOUT_MAX_CONCURRENT", "10"))

scout_semaphore = asyncio.Semaphore(SCOUT_MAX_CONCURRENT)


def truncate_for_extraction(text: str) -> str:
    """Truncate text to SCOUT_MAX_INPUT_CHARS to cap LLM cost. Preserves start (usually most relevant)."""
    if not text or len(text) <= SCOUT_MAX_INPUT_CHARS:
        return text
    suffix = "\n\n[... truncated for cost limits ...]"
    return text[: SCOUT_MAX_INPUT_CHARS - len(suffix)] + suffix
