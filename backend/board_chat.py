"""Ephemeral board chat — Gemini multi-turn, no persistence."""
from __future__ import annotations

import asyncio
import json
import os
import re
from dataclasses import dataclass, replace
from typing import Any

from google import genai
from google.genai import types

from utils.images import fetch_og_image
from utils.url_verify import url_is_reachable

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# At most one deep-search retry when place URLs fail verification (per user message).
URL_RECOVERY_MAX_FOLLOW_UPS = 1

# Caps per chat turn — limits Gemini output, URL verification, and og:image fetches.
BOARD_CHAT_MAX_SUGGESTIONS = int(os.getenv("BOARD_CHAT_MAX_SUGGESTIONS", "5"))
BOARD_CHAT_MAX_OUTPUT_TOKENS = int(os.getenv("BOARD_CHAT_MAX_OUTPUT_TOKENS", "2048"))
BOARD_CHAT_MAX_REPLY_CHARS = int(os.getenv("BOARD_CHAT_MAX_REPLY_CHARS", "2500"))
BOARD_CHAT_RECOVERY_MAX_OUTPUT_TOKENS = int(
    os.getenv("BOARD_CHAT_RECOVERY_MAX_OUTPUT_TOKENS", "1024")
)

POI_SUGGESTION_FENCE = "board-poi-suggestions"
_CHAT_SUGGESTION_POI_TYPES = frozenset({"activity", "restaurant", "flight", "poi"})
_POI_SUGGESTIONS_BLOCK_RE = re.compile(
    rf"```(?:{POI_SUGGESTION_FENCE}|json:{POI_SUGGESTION_FENCE})\s*\n(.*?)\n```",
    re.DOTALL | re.IGNORECASE,
)

SYSTEM_INSTRUCTION_BASE = (
    "You are a helpful travel planning assistant on a collaborative cork board. "
    "Answer concisely and practically. Help with destinations, activities, "
    "logistics, and trip ideas. Keep replies short — avoid long lists in prose."
)

POI_SUGGESTION_INSTRUCTIONS = f"""\
Place suggestions (saveable board pins):
When you recommend a specific place the user might add to their board — a restaurant,
activity, attraction, flight leg, or general pin — append a fenced JSON block AFTER your
prose using exactly this fence label:

```{POI_SUGGESTION_FENCE}
[
  {{
    "poi_type": "restaurant",
    "title": "Place name",
    "description": "One or two sentences on why it fits",
    "location": "City or area",
    "address": "Street address when known",
    "lat": null,
    "lng": null,
    "source_url": "https://official-or-booking-url (required)",
    "thumbnail_url": "https://direct-image-url when known (optional)"
  }}
]
```

Rules:
- Only include the block when suggesting concrete place(s) to visit — not for pure logistics Q&A.
- ``poi_type`` must be one of: activity, restaurant, flight, poi (never getaway or note).
- ``title`` and ``source_url`` are required for every item — never include a place without a verified https URL.
- Use Google Search this turn to find each place's official site, booking page, or Maps/listing URL before adding it.
- Use null for unknown lat/lng — do not guess coordinates.
- Never invent ``source_url`` — only URLs returned by search for that specific place.
- Prefer copying ``source_url`` from Google Search grounding citations over paraphrasing URLs from memory.
- Include ``thumbnail_url`` only for a direct https image you verified; we also try og:image from ``source_url`` server-side.
- Suggest at most {BOARD_CHAT_MAX_SUGGESTIONS} places per reply — pick the best fits, not an exhaustive list.
- You may suggest multiple places in one array; keep prose natural above the fence.
- Put ALL places in ONE ```{POI_SUGGESTION_FENCE}``` block at the END — never embed JSON arrays inline between paragraphs."""

POI_SUGGESTION_INSTRUCTIONS_NO_SEARCH = """\
Place suggestions (saveable board pins):
Do NOT include a ```board-poi-suggestions``` block on this turn — live search is off and
every saveable pin requires a verified URL. Describe places in prose only and tell the user
to ask again with "find links for …" if they want add-to-board cards."""

URL_INSTRUCTIONS_WITH_SEARCH = """\
URLs and websites (Google Search enabled for this turn):
- Use search to find current official websites, booking pages, and hours for every place suggestion.
- Every ```board-poi-suggestions``` item MUST include a ``source_url`` from search results.
- Only share URLs you found via search — never guess or fabricate links.
- Prefer markdown links like [Place name](url) in prose when you have a verified URL.
- If search does not surface a reliable URL for a place, omit that place from the JSON block."""

URL_INSTRUCTIONS_WITHOUT_SEARCH = """\
URLs and websites (no live web access this turn):
- Do not invent or guess URLs, phone numbers, or booking links.
- Do not emit ```board-poi-suggestions``` — saveable pins require verified URLs from search.
- For general area advice, describe places by name and location instead.
- If the user wants add-to-board cards, tell them to ask explicitly (e.g. "find restaurants near … with links")."""

# When BOARD_CHAT_GOOGLE_SEARCH=auto, only ground messages that likely need live URLs.
_SEARCH_HINT_RE = re.compile(
    r"(?:"
    r"\b(?:website|web\s*site|url|urls?|link|links)\b|"
    r"\b(?:book(?:ing)?|reserve|reservation|tickets?)\b|"
    r"\b(?:official\s+(?:site|website|page))\b|"
    r"\b(?:menu|hours|open\s+(?:now|today)|phone\s*#?|contact\s+info)\b|"
    r"\b(?:airbnb|vrbo|booking\.com|hotels\.com|expedia)\b|"
    r"\b(?:look\s*up|lookup|google)\b.*\b(?:website|link|url|book)\b|"
    r"\b(?:find|get)\s+(?:me\s+)?(?:the\s+)?(?:website|link|url|booking)\b|"
    r"\bwhere\s+(?:can|do)\s+(?:i|we)\s+book\b|"
    r"https?://|www\."
    r")",
    re.IGNORECASE,
)

# Place-recommendation queries need search so suggestions can include required URLs.
_SUGGESTION_HINT_RE = re.compile(
    r"(?:"
    r"\b(?:suggest|suggestion|recommend|recommendation|ideas?)\b|"
    r"\b(?:restaurant|restaurants|caf[eé]|bar|bistro|eatery)\b|"
    r"\b(?:activity|activities|attraction|attractions|museum|hike|trail|beach)\b|"
    r"\b(?:things to do|what to do|where to eat|where should|places to)\b|"
    r"\b(?:spots?|visit|dinner|lunch|breakfast|nearby)\b"
    r")",
    re.IGNORECASE,
)

BOARD_PINS_SCHEMA = """\
Each row below is one pin on the user's cork board. Columns:
  title     — display name shown on the pin
  type      — pin category: getaway | activity | restaurant | flight | note | poi
  location  — place name or address when the user set one
  lat       — latitude (WGS84 decimal degrees), or blank if not geocoded
  lng       — longitude (WGS84 decimal degrees), or blank if not geocoded
  details   — short extra context (description snippet, price, guests, region, etc.)"""

_TABLE_HEADER = "title | type | location | lat | lng | details"
_TABLE_RULE = "------|------|----------|-----|-----|--------"


@dataclass(frozen=True)
class BoardPinContext:
    title: str
    poi_type: str
    location: str | None
    lat: float | None
    lng: float | None
    details: str | None


@dataclass(frozen=True)
class BoardChatPoiSuggestion:
    poi_type: str
    title: str
    description: str | None = None
    location: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    source_url: str | None = None
    thumbnail_url: str | None = None


@dataclass(frozen=True)
class BoardChatSource:
    title: str
    uri: str


@dataclass(frozen=True)
class BoardChatResult:
    reply: str
    sources: list[BoardChatSource]
    suggestions: list[BoardChatPoiSuggestion]


def _cell(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("|", "/")).strip()


def _pin_details(poi) -> str | None:
    parts: list[str] = []
    description = getattr(poi, "description", None)
    if description:
        snippet = re.sub(r"\s+", " ", str(description)).strip()
        if len(snippet) > 140:
            snippet = snippet[:137] + "..."
        parts.append(snippet)

    region = getattr(poi, "region", None)
    if region:
        parts.append(f"region: {region}")

    price = getattr(poi, "price", None)
    if price is not None:
        currency = getattr(poi, "price_currency", None) or "USD"
        period = getattr(poi, "price_period", None)
        price_line = f"price: {currency} {price:g}"
        if period:
            price_line += f" / {period}"
        parts.append(price_line)

    max_guests = getattr(poi, "max_guests", None)
    bedrooms = getattr(poi, "bedrooms", None)
    if max_guests is not None:
        parts.append(f"guests: {max_guests}")
    if bedrooms is not None:
        parts.append(f"bedrooms: {bedrooms}")

    return "; ".join(parts) if parts else None


def _optional_http_url(raw: Any) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if text.startswith("http://") or text.startswith("https://"):
        return text
    return None


def _normalize_suggestion(raw: Any) -> BoardChatPoiSuggestion | None:
    if not isinstance(raw, dict):
        return None
    poi_type = str(raw.get("poi_type") or "poi").strip().lower()
    if poi_type == "note":
        return None
    if poi_type not in _CHAT_SUGGESTION_POI_TYPES:
        poi_type = "poi"
    title = str(raw.get("title") or "").strip()
    if not title:
        return None
    source_url = _optional_http_url(raw.get("source_url"))

    def _optional_str(key: str) -> str | None:
        val = raw.get(key)
        if val is None:
            return None
        text = str(val).strip()
        return text or None

    def _optional_float(key: str) -> float | None:
        val = raw.get(key)
        if val is None or val == "":
            return None
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    return BoardChatPoiSuggestion(
        poi_type=poi_type,
        title=title[:200],
        description=_optional_str("description"),
        location=_optional_str("location"),
        address=_optional_str("address"),
        lat=_optional_float("lat"),
        lng=_optional_float("lng"),
        source_url=source_url,
        thumbnail_url=_optional_http_url(raw.get("thumbnail_url")),
    )


def _title_match_score(place_title: str, source_title: str) -> int:
    place = place_title.lower()
    source = source_title.lower()
    if place and (place in source or source in place):
        return 100
    stop = frozenset({"the", "a", "an", "and", "of", "at", "in", "&"})
    place_tokens = {t for t in re.findall(r"\w+", place) if t not in stop and len(t) > 1}
    source_tokens = {t for t in re.findall(r"\w+", source) if t not in stop and len(t) > 1}
    return len(place_tokens & source_tokens)


def _grounding_candidates_for_suggestion(
    suggestion: BoardChatPoiSuggestion,
    sources: list[BoardChatSource],
    *,
    used_uris: set[str],
) -> list[str]:
    ranked: list[tuple[int, str]] = []
    for src in sources:
        if src.uri in used_uris:
            continue
        score = _title_match_score(suggestion.title, src.title)
        if score > 0:
            ranked.append((score, src.uri))
    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return [uri for _, uri in ranked]


async def _first_reachable_url(candidates: list[str]) -> str | None:
    seen: set[str] = set()
    for url in candidates:
        if not url or url in seen:
            continue
        seen.add(url)
        if await url_is_reachable(url):
            return url
    return None


@dataclass(frozen=True)
class EnrichedSuggestions:
    accepted: list[BoardChatPoiSuggestion]
    rejected: list[BoardChatPoiSuggestion]


async def enrich_poi_suggestions(
    suggestions: list[BoardChatPoiSuggestion],
    sources: list[BoardChatSource],
    *,
    used_uris: set[str] | None = None,
) -> EnrichedSuggestions:
    """Require a verified reachable source_url, then best-effort thumbnails."""

    enriched: list[BoardChatPoiSuggestion] = []
    rejected: list[BoardChatPoiSuggestion] = []
    taken = used_uris if used_uris is not None else set()

    for suggestion in suggestions:
        grounding_urls = _grounding_candidates_for_suggestion(
            suggestion, sources, used_uris=taken,
        )
        candidates: list[str] = []
        for url in grounding_urls:
            candidates.append(url)
        if suggestion.source_url and suggestion.source_url not in candidates:
            candidates.append(suggestion.source_url)

        source_url = await _first_reachable_url(candidates)
        if not source_url:
            rejected.append(suggestion)
            continue

        taken.add(source_url)
        current = replace(suggestion, source_url=source_url)

        if not current.thumbnail_url:
            og_url = await fetch_og_image(source_url)
            if og_url:
                current = replace(current, thumbnail_url=og_url)

        enriched.append(current)

    return EnrichedSuggestions(accepted=enriched, rejected=rejected)


def _cap_suggestions(
    suggestions: list[BoardChatPoiSuggestion],
) -> list[BoardChatPoiSuggestion]:
    return suggestions[:BOARD_CHAT_MAX_SUGGESTIONS]


def _truncate_display_reply(text: str) -> str:
    if len(text) <= BOARD_CHAT_MAX_REPLY_CHARS:
        return text
    suffix = "\n\n[... truncated for length ...]"
    return text[: BOARD_CHAT_MAX_REPLY_CHARS - len(suffix)] + suffix


def _suggestion_dedupe_key(suggestion: BoardChatPoiSuggestion) -> str:
    return suggestion.title.strip().lower()


def _merge_suggestions(
    primary: list[BoardChatPoiSuggestion],
    extra: list[BoardChatPoiSuggestion],
) -> list[BoardChatPoiSuggestion]:
    seen = {_suggestion_dedupe_key(s) for s in primary}
    merged = list(primary)
    for suggestion in extra:
        key = _suggestion_dedupe_key(suggestion)
        if key in seen:
            continue
        seen.add(key)
        merged.append(suggestion)
    return merged


def _unresolved_after_recovery(
    rejected: list[BoardChatPoiSuggestion],
    accepted: list[BoardChatPoiSuggestion],
) -> list[BoardChatPoiSuggestion]:
    """Places still missing a verified card — exclude any already saved in accepted."""
    accepted_keys = {_suggestion_dedupe_key(s) for s in accepted}
    return [p for p in rejected if _suggestion_dedupe_key(p) not in accepted_keys]


def _format_places_for_url_recovery(rejected: list[BoardChatPoiSuggestion]) -> str:
    lines: list[str] = []
    for place in rejected[:BOARD_CHAT_MAX_SUGGESTIONS]:
        bits = [f"title: {place.title}", f"type: {place.poi_type}"]
        if place.location:
            bits.append(f"location: {place.location}")
        if place.address:
            bits.append(f"address: {place.address}")
        if place.description:
            bits.append(f"notes: {place.description}")
        lines.append("- " + "; ".join(bits))
    return "\n".join(lines)


def _suggestions_from_parsed_payload(parsed: Any) -> list[BoardChatPoiSuggestion]:
    items = parsed if isinstance(parsed, list) else (
        parsed.get("suggestions", []) if isinstance(parsed, dict) else []
    )
    if not isinstance(items, list):
        return []
    suggestions: list[BoardChatPoiSuggestion] = []
    for item in items:
        suggestion = _normalize_suggestion(item)
        if suggestion:
            suggestions.append(suggestion)
    return suggestions


def parse_poi_suggestions_json_only(text: str) -> list[BoardChatPoiSuggestion]:
    """Recovery turn: decode JSON suggestions only; ignore all prose and markdown."""
    raw = (text or "").strip()
    if not raw:
        return []

    suggestions: list[BoardChatPoiSuggestion] = []
    block = _POI_SUGGESTIONS_BLOCK_RE.search(raw)
    if block:
        try:
            parsed = json.loads(block.group(1).strip())
            suggestions.extend(_suggestions_from_parsed_payload(parsed))
        except json.JSONDecodeError:
            pass
    if suggestions:
        return suggestions

    for start, end in _json_array_spans(raw):
        try:
            parsed = json.loads(raw[start:end])
        except json.JSONDecodeError:
            continue
        suggestions.extend(_suggestions_from_parsed_payload(parsed))
    if suggestions:
        return suggestions

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return _suggestions_from_parsed_payload(parsed)


def _url_recovery_user_message(rejected: list[BoardChatPoiSuggestion]) -> str:
    places = _format_places_for_url_recovery(rejected)
    return (
        "URL recovery (JSON only — no other text):\n"
        "The places below were suggested but their URLs failed our server check. "
        "Use Google Search to find each place's official website, Google Maps/business "
        "listing, or major booking page. This is the only automatic retry.\n\n"
        "Respond with ONLY a raw JSON array — no markdown fences, no explanation, "
        "no prose before or after. We discard anything that is not valid JSON.\n\n"
        "Each object must include poi_type, title, and source_url (https, from search). "
        "Optional: description, location, address, lat, lng, thumbnail_url.\n\n"
        f"Places needing verified links:\n{places}\n\n"
        "Example shape (return the array only):\n"
        '[{"poi_type":"restaurant","title":"Example","source_url":"https://example.com"}]'
    )


async def _recover_suggestions_via_follow_up(
    client: genai.Client,
    *,
    contents: list[types.Content],
    assistant_reply: str,
    rejected: list[BoardChatPoiSuggestion],
    list_name: str,
    pin_rows: list[BoardPinContext],
    used_uris: set[str],
) -> tuple[list[BoardChatPoiSuggestion], list[BoardChatSource], list[BoardChatPoiSuggestion]]:
    """Second Gemini turn — JSON-only response, search forced."""
    recovery_contents = [
        *contents,
        types.Content(role="model", parts=[types.Part(text=assistant_reply)]),
        types.Content(
            role="user",
            parts=[types.Part(text=_url_recovery_user_message(rejected))],
        ),
    ]
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=recovery_contents,
        config=types.GenerateContentConfig(
            system_instruction=(
                "You are a structured data API. Output ONLY a valid JSON array. "
                "No markdown, no code fences, no commentary."
            ),
            tools=[types.Tool(google_search=types.GoogleSearch())],
            max_output_tokens=BOARD_CHAT_RECOVERY_MAX_OUTPUT_TOKENS,
        ),
    )
    follow_text = (response.text or "").strip()
    # JSON-only recovery: parse suggestions from the response; never surface follow_text.
    parsed = parse_poi_suggestions_json_only(follow_text)
    sources = _extract_grounding_sources(response)
    result = await enrich_poi_suggestions(parsed, sources, used_uris=used_uris)
    return result.accepted, sources, result.rejected


def _merge_sources(
    primary: list[BoardChatSource],
    extra: list[BoardChatSource],
) -> list[BoardChatSource]:
    seen = {s.uri for s in primary}
    merged = list(primary)
    for src in extra:
        if src.uri in seen:
            continue
        seen.add(src.uri)
        merged.append(src)
    return merged


def _json_array_spans(text: str) -> list[tuple[int, int]]:
    """Return (start, end) spans for top-level JSON arrays using bracket balancing."""
    spans: list[tuple[int, int]] = []
    i = 0
    n = len(text)
    while i < n:
        if text[i] != "[":
            i += 1
            continue
        start = i
        depth = 0
        in_string = False
        escape = False
        for j in range(i, n):
            ch = text[j]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    spans.append((start, j + 1))
                    i = j + 1
                    break
        else:
            i += 1
    return spans


def _strip_and_collect_loose_poi_json(
    text: str,
    suggestions: list[BoardChatPoiSuggestion],
) -> str:
    """Remove inline POI JSON arrays from display text and append parsed suggestions."""
    display = text
    for start, end in reversed(_json_array_spans(display)):
        payload = display[start:end]
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            continue
        found = _suggestions_from_parsed_payload(parsed)
        if not found:
            continue
        suggestions.extend(found)
        display = (display[:start] + display[end:]).strip()
    return re.sub(r"\n{3,}", "\n\n", display).strip()


def _strip_loose_poi_json_from_display(text: str) -> str:
    """Remove unfenced POI suggestion JSON arrays from user-facing text."""
    return _strip_and_collect_loose_poi_json(text, [])


def parse_poi_suggestions_from_reply(text: str) -> tuple[str, list[BoardChatPoiSuggestion]]:
    """Strip suggestion fences from display text and return validated suggestions."""
    suggestions: list[BoardChatPoiSuggestion] = []

    def _replace_block(match: re.Match[str]) -> str:
        payload = match.group(1).strip()
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            return ""
        for suggestion in _suggestions_from_parsed_payload(parsed):
            suggestions.append(suggestion)
        return ""

    display = _POI_SUGGESTIONS_BLOCK_RE.sub(_replace_block, text)
    display = _strip_and_collect_loose_poi_json(display, suggestions)
    return display, suggestions


def board_pin_context_from_poi(poi) -> BoardPinContext:
    location = getattr(poi, "location", None) or getattr(poi, "address", None)
    lat = getattr(poi, "lat", None)
    lng = getattr(poi, "lng", None)
    return BoardPinContext(
        title=getattr(poi, "title", None) or "Untitled",
        poi_type=getattr(poi, "poi_type", None) or "poi",
        location=location,
        lat=lat if lat is not None else None,
        lng=lng if lng is not None else None,
        details=_pin_details(poi),
    )


def format_board_pins_table(rows: list[BoardPinContext]) -> str:
    if not rows:
        return "(no pins on the board yet)"

    lines = [_TABLE_HEADER, _TABLE_RULE]
    for row in rows[:40]:
        lat = f"{row.lat:.5f}" if row.lat is not None else ""
        lng = f"{row.lng:.5f}" if row.lng is not None else ""
        lines.append(
            " | ".join(
                [
                    _cell(row.title),
                    _cell(row.poi_type),
                    _cell(row.location),
                    lat,
                    lng,
                    _cell(row.details),
                ]
            )
        )
    if len(rows) > 40:
        lines.append(f"…and {len(rows) - 40} more pins not shown")
    return "\n".join(lines)


def _google_search_mode() -> str:
    return os.getenv("BOARD_CHAT_GOOGLE_SEARCH", "auto").strip().lower()


def _message_needs_place_search(message: str, history: list[dict[str, str]]) -> bool:
    if _SUGGESTION_HINT_RE.search(message):
        return True
    for item in reversed(history[-4:]):
        if item.get("role") != "user":
            continue
        if _SUGGESTION_HINT_RE.search(item.get("content") or ""):
            return True
        break
    return False


def _message_needs_web_search(message: str, history: list[dict[str, str]]) -> bool:
    if _SEARCH_HINT_RE.search(message):
        return True
    # Short follow-ups like "what's the website?" or "link?"
    if len(message) <= 80 and re.search(
        r"\b(?:website|link|url|book(?:ing)?)\b", message, re.IGNORECASE,
    ):
        return True
    # User asked for links in the previous turn.
    for item in reversed(history[-4:]):
        if item.get("role") != "user":
            continue
        prior = item.get("content") or ""
        if _SEARCH_HINT_RE.search(prior):
            return True
        break
    return False


def _use_google_search(message: str, history: list[dict[str, str]]) -> bool:
    mode = _google_search_mode()
    if mode in ("0", "false", "no", "off"):
        return False
    if mode in ("1", "true", "yes", "on", "always"):
        return True
    return _message_needs_web_search(message, history) or _message_needs_place_search(
        message, history,
    )


def _extract_grounding_sources(response) -> list[BoardChatSource]:
    if not response.candidates:
        return []
    meta = getattr(response.candidates[0], "grounding_metadata", None)
    if not meta:
        return []

    seen: set[str] = set()
    sources: list[BoardChatSource] = []
    for chunk in getattr(meta, "grounding_chunks", None) or []:
        web = getattr(chunk, "web", None)
        if not web:
            continue
        uri = getattr(web, "uri", None) or ""
        if not uri or uri in seen:
            continue
        seen.add(uri)
        title = getattr(web, "title", None) or uri
        sources.append(BoardChatSource(title=title, uri=uri))
    return sources


def _build_system_instruction(
    *, list_name: str, pins_table: str, use_search: bool,
) -> str:
    url_block = URL_INSTRUCTIONS_WITH_SEARCH if use_search else URL_INSTRUCTIONS_WITHOUT_SEARCH
    suggestion_block = POI_SUGGESTION_INSTRUCTIONS if use_search else POI_SUGGESTION_INSTRUCTIONS_NO_SEARCH
    return "\n\n".join(
        [
            SYSTEM_INSTRUCTION_BASE,
            suggestion_block,
            url_block,
            f"Trip board name: {list_name}",
            BOARD_PINS_SCHEMA,
            pins_table,
        ]
    )


def _generate_content_config(
    *,
    list_name: str,
    pin_rows: list[BoardPinContext],
    use_search: bool,
) -> types.GenerateContentConfig:
    config_kwargs: dict = {
        "system_instruction": _build_system_instruction(
            list_name=list_name,
            pins_table=format_board_pins_table(pin_rows),
            use_search=use_search,
        ),
        "max_output_tokens": BOARD_CHAT_MAX_OUTPUT_TOKENS,
    }
    if use_search:
        config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
    return types.GenerateContentConfig(**config_kwargs)


async def board_chat_reply(
    *,
    message: str,
    history: list[dict[str, str]],
    list_name: str,
    pin_rows: list[BoardPinContext],
) -> BoardChatResult:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    contents: list[types.Content] = []
    for item in history:
        role = "user" if item.get("role") == "user" else "model"
        text = (item.get("content") or "").strip()
        if not text:
            continue
        contents.append(types.Content(role=role, parts=[types.Part(text=text)]))

    contents.append(types.Content(role="user", parts=[types.Part(text=message.strip())]))

    use_search = _use_google_search(message, history)
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=_generate_content_config(
            list_name=list_name,
            pin_rows=pin_rows,
            use_search=use_search,
        ),
    )
    reply = (response.text or "").strip()
    if not reply:
        raise RuntimeError("Empty response from model")
    display_reply, suggestions = parse_poi_suggestions_from_reply(reply)
    suggestions = _cap_suggestions(suggestions)
    sources = _extract_grounding_sources(response)
    enrich_result = await enrich_poi_suggestions(suggestions, sources)
    accepted = enrich_result.accepted
    rejected = enrich_result.rejected
    used_uris = {s.source_url for s in accepted if s.source_url}

    for _ in range(URL_RECOVERY_MAX_FOLLOW_UPS):
        if not rejected:
            break
        recovered, follow_sources, rejected = (
            await _recover_suggestions_via_follow_up(
                client,
                contents=contents,
                assistant_reply=display_reply,
                rejected=rejected,
                list_name=list_name,
                pin_rows=pin_rows,
                used_uris=used_uris,
            )
        )
        sources = _merge_sources(sources, follow_sources)
        accepted = _cap_suggestions(_merge_suggestions(accepted, recovered))
        used_uris.update(s.source_url for s in recovered if s.source_url)

    unresolved = _unresolved_after_recovery(rejected, accepted)
    if unresolved:
        names = ", ".join(p.title for p in unresolved[:BOARD_CHAT_MAX_SUGGESTIONS])
        display_reply = (
            f"{display_reply}\n\n"
            f"I couldn't verify working links for: {names}. "
            "Try asking for one place at a time with its city (e.g. "
            "\"find the official website for Helderberg Mountain Brewing in East Berne\")."
        ).strip()

    display_reply = _truncate_display_reply(display_reply)
    accepted = _cap_suggestions(accepted)

    return BoardChatResult(
        reply=display_reply,
        sources=sources,
        suggestions=accepted,
    )
