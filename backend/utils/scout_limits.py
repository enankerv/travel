"""Scout API input limits to cap LLM costs."""
import os

# Max chars sent to LLM per scout (prevents runaway costs). ~4 chars ≈ 1 token; 9k ≈ 2.2k tokens.
SCOUT_MAX_INPUT_CHARS = int(os.getenv("SCOUT_MAX_INPUT_CHARS", "9000"))
