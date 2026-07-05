"""Ephemeral board chat — Gemini multi-turn, no persistence."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass

from google import genai
from google.genai import types

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

SYSTEM_INSTRUCTION_BASE = (
    "You are a helpful travel planning assistant on a collaborative cork board. "
    "Answer concisely and practically. Help with destinations, activities, "
    "logistics, and trip ideas."
)

URL_INSTRUCTIONS_WITH_SEARCH = """\
URLs and websites (Google Search enabled for this turn):
- Use search to find current official websites, booking pages, and hours.
- Only share URLs you found via search — never guess or fabricate links.
- Prefer markdown links like [Place name](url) when you have a verified URL.
- If search does not surface a reliable URL, say so and give the name/address instead."""

URL_INSTRUCTIONS_WITHOUT_SEARCH = """\
URLs and websites (no live web access this turn):
- Do not invent or guess URLs, phone numbers, or booking links.
- For general area advice, describe places by name and location instead.
- If the user needs a current website or booking page, tell them to ask explicitly
  (e.g. "find the website for …") so you can look it up."""

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
class BoardChatSource:
    title: str
    uri: str


@dataclass(frozen=True)
class BoardChatResult:
    reply: str
    sources: list[BoardChatSource]


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
    return _message_needs_web_search(message, history)


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
    return "\n\n".join(
        [
            SYSTEM_INSTRUCTION_BASE,
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
    }
    if use_search:
        config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
    return types.GenerateContentConfig(**config_kwargs)


def board_chat_reply(
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
    return BoardChatResult(reply=reply, sources=_extract_grounding_sources(response))
