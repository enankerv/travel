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
activity, attraction, or general pin — append a fenced JSON block AFTER your prose using
exactly this fence label:

```{POI_SUGGESTION_FENCE}
[
  {{
    "poi_type": "restaurant",
    "title": "Place name",
    "location": "City or area",
    "address": "123 Main St, City, Region",
    "description": "One sentence on why it fits this trip"
  }}
]
```

Rules:
- Only include the block when suggesting concrete place(s) to visit — not for pure logistics Q&A.
- ``poi_type`` must be one of: activity, restaurant, poi (never getaway or note).
- ``title``, ``location``, and ``description`` are required for every item.
- ``location`` is the city, neighborhood, or region.
- ``address`` is the full street address when you can determine it from Google Maps grounding
  (street number and name when available). Use your best effort — omit only when no address
  is available.
- ``description`` must be one practical sentence on why this place fits the user's trip — not a generic tagline.
- The server adds verified Google Maps links from grounding.
- Do NOT include ``source_url``, ``lat``, ``lng``, or ``thumbnail_url`` for restaurants, activities, or general pins.
- For ``poi_type`` ``flight`` only: include ``source_url`` (https booking or airline page from search).
- Suggest at most {BOARD_CHAT_MAX_SUGGESTIONS} places per reply — pick the best fits, not an exhaustive list.
- Your visible prose must name every suggested place (bullets or a short list). Never stop at an introduction
  like "Here are some options:" — complete the list in prose before the JSON block.
- The ```{POI_SUGGESTION_FENCE}``` block must be valid, complete JSON with a closing fence — incomplete blocks are discarded.
- Put ALL places in ONE ```{POI_SUGGESTION_FENCE}``` block at the END — never embed JSON arrays inline between paragraphs."""

POI_SUGGESTION_INSTRUCTIONS_NO_SEARCH = """\
Place suggestions (saveable board pins):
You may include a ```board-poi-suggestions``` block with ``title``, ``location``, ``poi_type``,
``address`` when known, and a required one-sentence ``description`` for restaurants, activities,
and general pins. Include the most specific street address you know; the server adds Maps links.
For ``flight`` suggestions, only include items when you have a verified ``source_url`` from context;
otherwise describe flights in prose only."""

POI_SUGGESTION_INSTRUCTIONS_MAPS = """\
Google Maps grounding is enabled for this turn. When suggesting restaurants, activities, or pins,
use grounded place data to fill ``address`` with the most specific street address you can verify —
not just repeating the city in ``location``."""

URL_INSTRUCTIONS_WITH_SEARCH = """\
URLs and websites (Google Search enabled for this turn):
- Use search for flight booking links and general trip logistics when helpful.
- Restaurant/activity/poi cards do not need URLs in JSON — include ``address`` from Maps when known;
  the server adds verified Maps links.
- For ``flight`` items in ```board-poi-suggestions```, include a verified ``source_url`` from search.
- Prefer markdown links like [Place name](url) in prose when you have a verified URL."""

URL_INSTRUCTIONS_WITHOUT_SEARCH = """\
URLs and websites (no live web access this turn):
- Do not invent or guess URLs, phone numbers, or booking links.
- Restaurant/activity/poi cards can still be suggested without URLs — include ``address`` when known.
- For ``flight`` cards, omit the JSON block unless you have a verified URL from conversation context."""

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
    r"\b(?:landmark|landmarks|monument|monuments|sightseeing|sights?)\b|"
    r"\b(?:things to do|what to do|where to eat|where should|places to)\b|"
    r"\b(?:spots?|visit|dinner|lunch|breakfast|nearby)\b"
    r")",
    re.IGNORECASE,
)

_BOARD_CONTEXT_HINT_RE = re.compile(
    r"(?:"
    r"\b(?:what|which)\s+(?:else|other)\b|"
    r"\bam\s+i\s+missing\b|"
    r"\b(?:these|those)\s+places\b|"
    r"\bon\s+(?:the|my)\s+board\b|"
    r"\btourist\b.*\b(?:landmark|attraction|spot|place)s?\b|"
    r"\b(?:add|include)\b.*\b(?:too|also|as well)\b|"
    r"\badd\s+(?:the\s+)?\w"
    r")",
    re.IGNORECASE,
)

_POI_SUGGESTIONS_FENCE_OPEN_RE = re.compile(
    rf"```{POI_SUGGESTION_FENCE}\b",
    re.IGNORECASE,
)

BOARD_PINS_SCHEMA = """\
The board pins table below is read-only context about pins already on the board.
Never reproduce this table format (or its header row) in your reply — not for new
suggestions and not to show edits. New places belong in conversational prose plus the
```board-poi-suggestions``` JSON block only.

Column meanings:
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
class BoardMapsSource:
    title: str
    uri: str
    place_id: str | None = None


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


async def _enrich_flight_suggestion(
    suggestion: BoardChatPoiSuggestion,
    sources: list[BoardChatSource],
    *,
    used_uris: set[str],
) -> BoardChatPoiSuggestion | None:
    grounding_urls = _grounding_candidates_for_suggestion(
        suggestion, sources, used_uris=used_uris,
    )
    candidates: list[str] = []
    for url in grounding_urls:
        candidates.append(url)
    if suggestion.source_url and suggestion.source_url not in candidates:
        candidates.append(suggestion.source_url)

    source_url = await _first_reachable_url(candidates)
    if not source_url:
        return None

    used_uris.add(source_url)
    return replace(
        suggestion,
        source_url=source_url,
        thumbnail_url=None,
        lat=None,
        lng=None,
    )


def _best_maps_source_for_suggestion(
    suggestion: BoardChatPoiSuggestion,
    maps_sources: list[BoardMapsSource],
    *,
    used_place_ids: set[str],
) -> BoardMapsSource | None:
    ranked: list[tuple[int, BoardMapsSource]] = []
    for src in maps_sources:
        key = src.place_id or src.uri
        if not key or key in used_place_ids:
            continue
        score = _title_match_score(suggestion.title, src.title)
        if score > 0:
            ranked.append((score, src))
    if not ranked:
        return None
    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return ranked[0][1]


def _suggestion_from_maps(
    suggestion: BoardChatPoiSuggestion,
    maps: BoardMapsSource,
) -> BoardChatPoiSuggestion:
    return replace(
        suggestion,
        title=(maps.title[:200] if maps.title else suggestion.title),
        source_url=maps.uri,
        thumbnail_url=None,
    )


async def _enrich_place_suggestion(
    suggestion: BoardChatPoiSuggestion,
    maps_sources: list[BoardMapsSource],
    *,
    used_place_ids: set[str],
) -> BoardChatPoiSuggestion | None:
    maps = _best_maps_source_for_suggestion(
        suggestion, maps_sources, used_place_ids=used_place_ids,
    )
    if maps and maps.uri:
        key = maps.place_id or maps.uri
        if key:
            used_place_ids.add(key)
        return _suggestion_from_maps(suggestion, maps)

    if suggestion.lat is not None and suggestion.lng is not None:
        return replace(
            suggestion,
            source_url=f"https://www.google.com/maps?q={suggestion.lat},{suggestion.lng}",
            thumbnail_url=None,
        )
    return None


async def _enrich_legacy_url_suggestion(
    suggestion: BoardChatPoiSuggestion,
    sources: list[BoardChatSource],
    *,
    used_uris: set[str],
) -> BoardChatPoiSuggestion | None:
    """Fallback when Maps grounding is unavailable for this turn."""
    grounding_urls = _grounding_candidates_for_suggestion(
        suggestion, sources, used_uris=used_uris,
    )
    candidates: list[str] = list(grounding_urls)
    if suggestion.source_url and suggestion.source_url not in candidates:
        candidates.append(suggestion.source_url)

    source_url = await _first_reachable_url(candidates)
    if not source_url:
        return None

    used_uris.add(source_url)
    return replace(suggestion, source_url=source_url, thumbnail_url=None)


@dataclass(frozen=True)
class EnrichedSuggestions:
    accepted: list[BoardChatPoiSuggestion]
    rejected: list[BoardChatPoiSuggestion]


async def enrich_poi_suggestions(
    suggestions: list[BoardChatPoiSuggestion],
    sources: list[BoardChatSource],
    maps_sources: list[BoardMapsSource] | None = None,
    *,
    used_uris: set[str] | None = None,
) -> EnrichedSuggestions:
    """Hydrate suggestions from Gemini Maps grounding, then verified URLs."""

    enriched: list[BoardChatPoiSuggestion] = []
    rejected: list[BoardChatPoiSuggestion] = []
    taken = used_uris if used_uris is not None else set()
    used_place_ids: set[str] = set()
    maps = maps_sources or []

    for suggestion in suggestions:
        if suggestion.poi_type == "flight":
            current = await _enrich_flight_suggestion(suggestion, sources, used_uris=taken)
        else:
            current = await _enrich_place_suggestion(
                suggestion,
                maps,
                used_place_ids=used_place_ids,
            )
            if not current:
                current = await _enrich_legacy_url_suggestion(
                    suggestion, sources, used_uris=taken,
                )

        if not current or not current.source_url:
            rejected.append(suggestion)
            continue

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


def _text_needs_place_search(text: str) -> bool:
    return bool(_SUGGESTION_HINT_RE.search(text) or _BOARD_CONTEXT_HINT_RE.search(text))


def _reply_has_incomplete_poi_fence(text: str) -> bool:
    if _POI_SUGGESTIONS_BLOCK_RE.search(text):
        return False
    return bool(_POI_SUGGESTIONS_FENCE_OPEN_RE.search(text))


def _reply_looks_like_incomplete_list_intro(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if "\n" in stripped:
        return False
    return bool(
        re.search(
            r":\s*$|"
            r"\b(?:here are|here's|you might want to add|you could add|consider adding)\b",
            stripped,
            re.IGNORECASE,
        )
    )


def _append_incomplete_reply_notice(display_reply: str) -> str:
    notice = (
        "My reply was cut off before I could finish listing places or building saveable cards. "
        "Try asking for fewer landmarks at a time, or ask again."
    )
    if not display_reply.strip():
        return notice
    return f"{display_reply.rstrip()}\n\n{notice}"


def _suggestion_dedupe_key(suggestion: BoardChatPoiSuggestion) -> str:
    return suggestion.title.strip().lower()


def _description_from_prose(title: str, prose: str) -> str | None:
    """Pull a one-sentence blurb for a place from Gemini's prose reply."""
    if not title.strip() or not prose.strip():
        return None

    title_lower = title.strip().lower()
    for sentence in re.split(r"(?<=[.!?])\s+", prose.strip()):
        cleaned = re.sub(r"\s+", " ", sentence).strip()
        if not cleaned or title_lower not in cleaned.lower():
            continue
        cleaned = re.sub(r"^[-*•]\s*", "", cleaned)
        if len(cleaned) > 300:
            cleaned = cleaned[:297].rstrip() + "..."
        return cleaned
    return None


def _fill_missing_descriptions(
    suggestions: list[BoardChatPoiSuggestion],
    prose: str,
) -> list[BoardChatPoiSuggestion]:
    if not prose.strip():
        return suggestions
    filled: list[BoardChatPoiSuggestion] = []
    for suggestion in suggestions:
        if (suggestion.description or "").strip():
            filled.append(suggestion)
            continue
        description = _description_from_prose(suggestion.title, prose)
        if description:
            filled.append(replace(suggestion, description=description))
        else:
            filled.append(suggestion)
    return filled


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
        "Each object must include poi_type, title, and description. "
        "For flight: source_url (https, from search). "
        "For other types: location when known; address when you can determine a street address.\n\n"
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
    result = await enrich_poi_suggestions(
        parsed, sources, maps_sources=[], used_uris=used_uris,
    )
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


def _optional_float_str(value: str) -> float | None:
    cleaned = value.strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _suggestion_from_pins_table_row(line: str) -> BoardChatPoiSuggestion | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("…"):
        return None
    parts = [part.strip() for part in stripped.split("|")]
    if len(parts) != 6:
        return None
    title, poi_type, location, lat_s, lng_s, description = parts
    if not title or title.lower() == "title":
        return None
    normalized_type = poi_type.strip().lower() or "poi"
    if normalized_type not in _CHAT_SUGGESTION_POI_TYPES:
        normalized_type = "poi"
    address = location or None
    return BoardChatPoiSuggestion(
        poi_type=normalized_type,
        title=title[:200],
        location=address,
        address=address,
        description=description or None,
        lat=_optional_float_str(lat_s),
        lng=_optional_float_str(lng_s),
    )


def _strip_and_collect_pins_table(
    text: str,
    suggestions: list[BoardChatPoiSuggestion],
) -> str:
    """Remove echoed board-pin tables from display text and salvage parsed rows."""
    lines = text.splitlines()
    out_lines: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if (
            line.strip() == _TABLE_HEADER
            and i + 1 < len(lines)
            and lines[i + 1].strip() == _TABLE_RULE
        ):
            i += 2
            while i < len(lines):
                row = lines[i]
                if not row.strip():
                    i += 1
                    break
                suggestion = _suggestion_from_pins_table_row(row)
                if suggestion:
                    suggestions.append(suggestion)
                elif "|" not in row:
                    out_lines.append(row)
                    i += 1
                    break
                i += 1
            continue
        out_lines.append(line)
        i += 1
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out_lines)).strip()


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
    display = _strip_and_collect_pins_table(display, suggestions)
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
    if _text_needs_place_search(message):
        return True
    for item in reversed(history[-4:]):
        if item.get("role") != "user":
            continue
        if _text_needs_place_search(item.get("content") or ""):
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


def _google_maps_mode() -> str:
    return os.getenv("BOARD_CHAT_GOOGLE_MAPS", "auto").strip().lower()


def _use_google_maps(message: str, history: list[dict[str, str]]) -> bool:
    mode = _google_maps_mode()
    if mode in ("0", "false", "no", "off"):
        return False
    if mode in ("1", "true", "yes", "on", "always"):
        return True
    return _message_needs_place_search(message, history)


def _pin_centroid(pin_rows: list[BoardPinContext]) -> tuple[float, float] | None:
    coords = [
        (row.lat, row.lng)
        for row in pin_rows
        if row.lat is not None and row.lng is not None
    ]
    if not coords:
        return None
    lat = sum(item[0] for item in coords) / len(coords)
    lng = sum(item[1] for item in coords) / len(coords)
    return lat, lng


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


def _extract_maps_grounding(response) -> list[BoardMapsSource]:
    if not response.candidates:
        return []
    meta = getattr(response.candidates[0], "grounding_metadata", None)
    if not meta:
        return []

    seen: set[str] = set()
    sources: list[BoardMapsSource] = []
    for chunk in getattr(meta, "grounding_chunks", None) or []:
        maps = getattr(chunk, "maps", None)
        if not maps:
            continue
        uri = getattr(maps, "uri", None) or ""
        place_id = getattr(maps, "place_id", None) or getattr(maps, "placeId", None) or None
        title = getattr(maps, "title", None) or uri
        key = place_id or uri
        if not key or key in seen:
            continue
        seen.add(key)
        sources.append(
            BoardMapsSource(
                title=str(title),
                uri=str(uri),
                place_id=str(place_id) if place_id else None,
            )
        )
    return sources


def _build_system_instruction(
    *, list_name: str, pins_table: str, use_search: bool, use_maps: bool,
) -> str:
    url_block = URL_INSTRUCTIONS_WITH_SEARCH if use_search else URL_INSTRUCTIONS_WITHOUT_SEARCH
    suggestion_block = POI_SUGGESTION_INSTRUCTIONS if use_search else POI_SUGGESTION_INSTRUCTIONS_NO_SEARCH
    parts = [
        SYSTEM_INSTRUCTION_BASE,
        suggestion_block,
        url_block,
    ]
    if use_maps:
        parts.append(POI_SUGGESTION_INSTRUCTIONS_MAPS)
    parts.extend([
        f"Trip board name: {list_name}",
        BOARD_PINS_SCHEMA,
        pins_table,
    ])
    return "\n\n".join(parts)


def _generate_content_config(
    *,
    list_name: str,
    pin_rows: list[BoardPinContext],
    use_search: bool,
    use_maps: bool,
) -> types.GenerateContentConfig:
    config_kwargs: dict = {
        "system_instruction": _build_system_instruction(
            list_name=list_name,
            pins_table=format_board_pins_table(pin_rows),
            use_search=use_search,
            use_maps=use_maps,
        ),
        "max_output_tokens": BOARD_CHAT_MAX_OUTPUT_TOKENS,
    }
    tools: list[types.Tool] = []
    if use_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))
    if use_maps:
        tools.append(types.Tool(google_maps=types.GoogleMaps()))
    if tools:
        config_kwargs["tools"] = tools
    if use_maps:
        centroid = _pin_centroid(pin_rows)
        if centroid:
            config_kwargs["tool_config"] = types.ToolConfig(
                retrieval_config=types.RetrievalConfig(
                    lat_lng=types.LatLng(latitude=centroid[0], longitude=centroid[1]),
                    language_code="en_US",
                ),
            )
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
    use_maps = _use_google_maps(message, history)
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=_generate_content_config(
            list_name=list_name,
            pin_rows=pin_rows,
            use_search=use_search,
            use_maps=use_maps,
        ),
    )
    reply = (response.text or "").strip()
    if not reply:
        raise RuntimeError("Empty response from model")
    display_reply, suggestions = parse_poi_suggestions_from_reply(reply)
    suggestions = _fill_missing_descriptions(suggestions, display_reply)
    suggestions = _cap_suggestions(suggestions)
    sources = _extract_grounding_sources(response)
    maps_sources = _extract_maps_grounding(response)
    enrich_result = await enrich_poi_suggestions(suggestions, sources, maps_sources)
    accepted = enrich_result.accepted
    rejected = enrich_result.rejected
    used_uris = {s.source_url for s in accepted if s.source_url}

    for _ in range(URL_RECOVERY_MAX_FOLLOW_UPS):
        recovery_candidates = (
            [s for s in rejected if s.poi_type == "flight"]
            if maps_sources
            else rejected
        )
        if not recovery_candidates:
            break
        recovered, follow_sources, rejected = (
            await _recover_suggestions_via_follow_up(
                client,
                contents=contents,
                assistant_reply=display_reply,
                rejected=recovery_candidates,
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
        if maps_sources:
            display_reply = (
                f"{display_reply}\n\n"
                f"I couldn't match these on Google Maps: {names}. "
                "Try asking for one place at a time with its city "
                '(e.g. "Osteria del Borgo in Cetona").'
            ).strip()
        else:
            display_reply = (
                f"{display_reply}\n\n"
                f"I couldn't verify working links for: {names}. "
                "Try asking for one place at a time with its city."
            ).strip()

    if (
        not accepted
        and (
            _reply_has_incomplete_poi_fence(reply)
            or _reply_looks_like_incomplete_list_intro(display_reply)
        )
    ):
        display_reply = _append_incomplete_reply_notice(display_reply)

    display_reply = _truncate_display_reply(display_reply)
    accepted = _cap_suggestions(accepted)

    return BoardChatResult(
        reply=display_reply,
        sources=sources,
        suggestions=accepted,
    )
