"""In-memory rate limiting for Scout API. Per-user, sliding 60s window."""
import time
import threading
from utils.scout_limits import SCOUT_RATE_LIMIT_PER_MIN

_WINDOW_SECONDS = 60
_user_timestamps: dict[str, list[float]] = {}
_lock = threading.Lock()


def reset_for_tests() -> None:
    """Clear rate limit state. For testing only."""
    with _lock:
        _user_timestamps.clear()


def check_scout_rate_limit(user_id: str) -> bool:
    """
    Check if user is within rate limit. If allowed, records the request.
    Returns True if allowed, False if over limit.
    """
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS

    with _lock:
        timestamps = _user_timestamps.get(user_id, [])
        # Prune old timestamps
        timestamps = [t for t in timestamps if t > cutoff]

        if len(timestamps) >= SCOUT_RATE_LIMIT_PER_MIN:
            return False

        timestamps.append(now)
        _user_timestamps[user_id] = timestamps
        return True
