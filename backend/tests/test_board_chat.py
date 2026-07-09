"""Tests for board chat POI suggestion parsing."""
import asyncio

from board_chat import (
    BoardChatPoiSuggestion,
    BoardChatSource,
    enrich_poi_suggestions,
    parse_poi_suggestions_from_reply,
    parse_poi_suggestions_json_only,
)


def test_parse_strips_fence_and_returns_suggestions():
    raw = """Try this spot for lunch.

```board-poi-suggestions
[
  {
    "poi_type": "restaurant",
    "title": "Osteria del Borgo",
    "description": "Rustic Tuscan pasta",
    "location": "Cetona",
    "address": "Via Roma 1, Cetona, Italy",
    "source_url": "https://example.com/osteria"
  }
]
```"""
    display, suggestions = parse_poi_suggestions_from_reply(raw)
    assert "board-poi-suggestions" not in display
    assert display == "Try this spot for lunch."
    assert len(suggestions) == 1
    assert suggestions[0].poi_type == "restaurant"
    assert suggestions[0].title == "Osteria del Borgo"
    assert suggestions[0].address == "Via Roma 1, Cetona, Italy"
    assert suggestions[0].source_url == "https://example.com/osteria"


def test_parse_ignores_invalid_items():
    raw = """Here you go.

```board-poi-suggestions
[
  {"poi_type": "getaway", "title": "Villa", "source_url": "https://example.com/v"},
  {"poi_type": "activity", "title": "Hike the trail", "source_url": "https://example.com/hike"}
]
```"""
    _, suggestions = parse_poi_suggestions_from_reply(raw)
    assert len(suggestions) == 2
    assert suggestions[0].poi_type == "poi"
    assert suggestions[1].poi_type == "activity"


def test_parse_thumbnail_url():
    raw = """Here.

```board-poi-suggestions
[{"poi_type": "activity", "title": "Trail", "source_url": "https://example.com/trail", "thumbnail_url": "https://cdn.example.com/trail.jpg"}]
```"""
    _, suggestions = parse_poi_suggestions_from_reply(raw)
    assert suggestions[0].thumbnail_url == "https://cdn.example.com/trail.jpg"


def test_fill_missing_descriptions_from_prose():
    from board_chat import _fill_missing_descriptions

    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="restaurant",
            title="Osteria del Borgo",
            location="Cetona",
        )
    ]
    prose = (
        "For dinner, try Osteria del Borgo — rustic pasta in a quiet hill town. "
        "Great for a slow evening."
    )
    filled = _fill_missing_descriptions(suggestions, prose)
    assert filled[0].description == (
        "For dinner, try Osteria del Borgo — rustic pasta in a quiet hill town."
    )


def test_fill_missing_descriptions_keeps_json_description():
    from board_chat import _fill_missing_descriptions

    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="restaurant",
            title="Osteria del Borgo",
            location="Cetona",
            description="Gemini wrote this blurb.",
        )
    ]
    filled = _fill_missing_descriptions(suggestions, "Osteria del Borgo is also mentioned here.")
    assert filled[0].description == "Gemini wrote this blurb."


def test_enrich_maps_grounding():
    from board_chat import BoardMapsSource

    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="restaurant",
            title="Osteria del Borgo",
            location="Cetona, Italy",
            description="Perfect for a long lunch after exploring.",
        )
    ]
    maps_sources = [
        BoardMapsSource(
            title="Osteria del Borgo",
            uri="https://maps.google.com/?cid=123",
            place_id="places/ChIJ123",
        )
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, [], maps_sources))
    accepted = result.accepted[0]
    assert accepted.source_url == "https://maps.google.com/?cid=123"
    assert accepted.thumbnail_url is None
    assert accepted.description == "Perfect for a long lunch after exploring."
    assert accepted.lat is None


def test_enrich_maps_preserves_gemini_address():
    from board_chat import BoardMapsSource

    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="restaurant",
            title="Osteria del Borgo",
            location="Cetona, Italy",
            address="Via Roma 1, Cetona, Italy",
        )
    ]
    maps_sources = [
        BoardMapsSource(
            title="Osteria del Borgo",
            uri="https://maps.google.com/?cid=123",
            place_id="places/ChIJ123",
        )
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, [], maps_sources))
    accepted = result.accepted[0]
    assert accepted.source_url == "https://maps.google.com/?cid=123"
    assert accepted.address == "Via Roma 1, Cetona, Italy"


def test_enrich_rejects_place_without_maps_match():
    suggestions = [
        BoardChatPoiSuggestion(poi_type="restaurant", title="Unknown Place", location="Nowhere"),
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, [], []))
    assert result.accepted == []
    assert len(result.rejected) == 1


def test_enrich_flight_requires_reachable_url(monkeypatch):
    import board_chat as mod

    async def verify(url: str) -> bool:
        return url == "https://airline.example/flight"

    monkeypatch.setattr(mod, "url_is_reachable", verify)
    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="flight",
            title="JFK to CDG",
            source_url="https://airline.example/flight",
        )
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, [], []))
    assert result.accepted[0].source_url == "https://airline.example/flight"
    assert result.accepted[0].thumbnail_url is None


def test_enrich_legacy_without_maps(monkeypatch):
    import board_chat as mod

    async def always_ok(_url: str) -> bool:
        return True

    monkeypatch.setattr(mod, "url_is_reachable", always_ok)
    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="restaurant",
            title="Osteria del Borgo",
            source_url="https://example.com/osteria",
        )
    ]
    sources = [
        BoardChatSource(title="Osteria del Borgo — Official Site", uri="https://example.com/osteria"),
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, sources, []))
    assert result.accepted[0].source_url == "https://example.com/osteria"
    assert result.accepted[0].thumbnail_url is None


def test_enrich_drops_suggestion_without_reachable_url(monkeypatch):
    import board_chat as mod

    async def never_ok(_url: str) -> bool:
        return False

    monkeypatch.setattr("board_chat.url_is_reachable", never_ok)
    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="restaurant",
            title="Unknown Place",
            source_url="https://example.com/nope",
        ),
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, []))
    assert result.accepted == []


def test_enrich_drops_suggestion_without_url(monkeypatch):
    import board_chat as mod

    async def always_ok(_url: str) -> bool:
        return True

    monkeypatch.setattr("board_chat.url_is_reachable", always_ok)
    suggestions = [
        BoardChatPoiSuggestion(poi_type="restaurant", title="Unknown Place"),
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, [], []))
    assert result.accepted == []


def test_parse_strips_loose_json_array_from_display():
    raw = """Here are breweries.

[{"poi_type":"poi","title":"Helderberg","source_url":"https://example.com/h"}]"""
    display, suggestions = parse_poi_suggestions_from_reply(raw)
    assert display == "Here are breweries."
    assert len(suggestions) == 1
    assert suggestions[0].title == "Helderberg"


def test_parse_strips_multiple_inline_json_arrays():
    raw = """Here are a few breweries near Cobleskill, NY:

Serious Brewing Company (Howes Cave, NY) - Farm brewery close to Cobleskill.
[
  {
    "poi_type": "brewery",
    "title": "Serious Brewing Company",
    "description": "Farm brewery",
    "location": "Howes Cave, NY",
    "source_url": "https://www.seriousbrewingcompany.com/"
  }
]
Green Wolf Brewing Company (Middleburgh, NY) - Local ales.
[
  {
    "poi_type": "brewery",
    "title": "Green Wolf Brewing Company",
    "location": "Middleburgh, NY",
    "source_url": "https://greenwolfbrewing.com/"
  }
]
Helderberg Mountain Brewing Company (East Berne, NY) - Small batch beers.
[
  {
    "poi_type": "brewery",
    "title": "Helderberg Mountain Brewing Company",
    "location": "East Berne, NY",
    "source_url": "https://www.helderbergbrewing.com/"
  }
]"""
    display, suggestions = parse_poi_suggestions_from_reply(raw)
    assert "[" not in display
    assert "poi_type" not in display
    assert "Serious Brewing Company (Howes Cave, NY)" in display
    assert "Green Wolf Brewing Company (Middleburgh, NY)" in display
    assert len(suggestions) == 3
    titles = {s.title for s in suggestions}
    assert titles == {
        "Serious Brewing Company",
        "Green Wolf Brewing Company",
        "Helderberg Mountain Brewing Company",
    }


def test_board_chat_reply_ignores_recovery_prose(monkeypatch):
    import board_chat as mod

    first_text = """Here are breweries.

```board-poi-suggestions
[{"poi_type":"poi","title":"Helderberg","source_url":"https://bad.example/h"}]
```"""

    recovery_text = (
        "I've re-checked the links for the breweries. I was able to find verified, "
        'working links.\n\n'
        '[{"poi_type":"poi","title":"Helderberg","source_url":"https://good.example/h"}]'
    )

    responses = iter([first_text, recovery_text])

    class FakeResp:
        def __init__(self, text: str):
            self.text = text
            self.candidates = []

    class FakeModels:
        def generate_content(self, **_kwargs):
            return FakeResp(next(responses))

    class FakeClient:
        models = FakeModels()

    enrich_calls = [0]

    async def fake_enrich(suggestions, sources, maps_sources=None, used_uris=None):
        enrich_calls[0] += 1
        if enrich_calls[0] == 1:
            return mod.EnrichedSuggestions(accepted=[], rejected=list(suggestions))
        return mod.EnrichedSuggestions(accepted=list(suggestions), rejected=[])

    async def verify(url: str) -> bool:
        return url == "https://good.example/h"

    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setattr(mod.genai, "Client", lambda **_kw: FakeClient())
    monkeypatch.setattr(mod, "enrich_poi_suggestions", fake_enrich)
    monkeypatch.setattr(mod, "url_is_reachable", verify)

    result = asyncio.run(
        mod.board_chat_reply(
            message="find breweries near Cobleskill",
            history=[],
            list_name="Trip",
            pin_rows=[],
        )
    )

    assert "re-checked" not in result.reply
    assert "verified, working links" not in result.reply
    assert "Here are breweries" in result.reply
    assert len(result.suggestions) == 1
    assert result.suggestions[0].source_url == "https://good.example/h"


def test_parse_json_only_ignores_prose():
    raw = (
        "I've re-checked and found working links.\n\n"
        '[{"poi_type":"poi","title":"Helderberg Mountain Brewing Company",'
        '"source_url":"https://example.com/h"}]'
    )
    suggestions = parse_poi_suggestions_json_only(raw)
    assert len(suggestions) == 1
    assert suggestions[0].title == "Helderberg Mountain Brewing Company"


def test_parse_json_only_strips_fence_if_present():
    raw = """```board-poi-suggestions
[{"poi_type":"poi","title":"Green Wolf","source_url":"https://example.com/gw"}]
```"""
    suggestions = parse_poi_suggestions_json_only(raw)
    assert len(suggestions) == 1
    assert suggestions[0].title == "Green Wolf"


def test_unresolved_excludes_recovered_places():
    from board_chat import _unresolved_after_recovery, BoardChatPoiSuggestion

    rejected = [
        BoardChatPoiSuggestion(poi_type="poi", title="Helderberg Mountain Brewing Company"),
        BoardChatPoiSuggestion(poi_type="poi", title="Frog Alley Brewing Company"),
    ]
    accepted = [
        BoardChatPoiSuggestion(
            poi_type="poi",
            title="Helderberg Mountain Brewing Company",
            source_url="https://example.com/helderberg",
        ),
    ]
    unresolved = _unresolved_after_recovery(rejected, accepted)
    assert len(unresolved) == 1
    assert unresolved[0].title == "Frog Alley Brewing Company"


def test_parse_drops_note_suggestions():
    raw = """Here.

```board-poi-suggestions
[
  {"poi_type": "note", "title": "Reminder", "source_url": "https://example.com/n"},
  {"poi_type": "restaurant", "title": "Bistro", "source_url": "https://example.com/b"}
]
```"""
    _, suggestions = parse_poi_suggestions_from_reply(raw)
    assert len(suggestions) == 1
    assert suggestions[0].title == "Bistro"


def test_cap_suggestions_limits_count():
    from board_chat import _cap_suggestions, BoardChatPoiSuggestion

    suggestions = [
        BoardChatPoiSuggestion(poi_type="poi", title=f"Place {i}")
        for i in range(10)
    ]
    capped = _cap_suggestions(suggestions)
    assert len(capped) == 5
    assert capped[0].title == "Place 0"
    assert capped[-1].title == "Place 4"


def test_truncate_display_reply():
    from board_chat import _truncate_display_reply

    short = "Hello world"
    assert _truncate_display_reply(short) == short

    long = "x" * 3000
    truncated = _truncate_display_reply(long)
    assert len(truncated) <= 2500
    assert truncated.endswith("[... truncated for length ...]")


def test_url_recovery_max_follow_ups_is_one():
    from board_chat import URL_RECOVERY_MAX_FOLLOW_UPS

    assert URL_RECOVERY_MAX_FOLLOW_UPS == 1


def test_parse_no_block():
    display, suggestions = parse_poi_suggestions_from_reply("Just general advice.")
    assert display == "Just general advice."
    assert suggestions == []


def test_message_needs_place_search_for_landmarks():
    from board_chat import _message_needs_place_search

    assert _message_needs_place_search(
        "what other large tourist landmarks am I missing in these places?",
        [],
    )


def test_reply_looks_like_incomplete_list_intro():
    from board_chat import _reply_looks_like_incomplete_list_intro

    assert _reply_looks_like_incomplete_list_intro(
        "Here are some other major landmarks you might want to add:",
    )
    assert not _reply_looks_like_incomplete_list_intro(
        "Here are some other major landmarks you might want to add:\n- Colosseum",
    )


def test_reply_has_incomplete_poi_fence():
    from board_chat import _reply_has_incomplete_poi_fence

    assert _reply_has_incomplete_poi_fence(
        "Here you go.\n\n```board-poi-suggestions\n[{\"poi_type\": \"poi\","
    )
    assert not _reply_has_incomplete_poi_fence(
        "Here.\n\n```board-poi-suggestions\n[{\"poi_type\":\"poi\",\"title\":\"X\"}]\n```"
    )


def test_append_incomplete_reply_notice():
    from board_chat import _append_incomplete_reply_notice

    out = _append_incomplete_reply_notice("Here are some options:")
    assert "cut off" in out
    assert out.startswith("Here are some options:")


def test_parse_strips_echoed_pins_table():
    raw = """No problem, adding these!

title | type | location | lat | lng | details
------|------|----------|-----|-----|--------
St. Peter's Basilica | poi | Piazza San Pietro, 00120 Città del Vaticano, Vatican City | 41.90224 | 12.45738 | The largest church in the world.
Vatican Museums | activity | Viale Vaticano, 00120 Città del Vaticano, Vatican City | 41.90647 | 12.45367 | Explore an immense collection of art."""
    display, suggestions = parse_poi_suggestions_from_reply(raw)
    assert display == "No problem, adding these!"
    assert "title | type" not in display
    assert len(suggestions) == 2
    assert suggestions[0].title == "St. Peter's Basilica"
    assert suggestions[0].lat == 41.90224
    assert suggestions[0].address == "Piazza San Pietro, 00120 Città del Vaticano, Vatican City"
    assert suggestions[1].poi_type == "activity"


def test_enrich_uses_coords_when_maps_miss(monkeypatch):
    suggestions = [
        BoardChatPoiSuggestion(
            poi_type="poi",
            title="St. Peter's Basilica",
            address="Piazza San Pietro, Vatican City",
            lat=41.90224,
            lng=12.45738,
        )
    ]
    result = asyncio.run(enrich_poi_suggestions(suggestions, [], []))
    accepted = result.accepted[0]
    assert accepted.source_url == "https://www.google.com/maps?q=41.90224,12.45738"
    assert accepted.lat == 41.90224


def test_message_needs_place_search_for_add_followup():
    from board_chat import _message_needs_place_search

    assert _message_needs_place_search("Oh add the Vatican too", [])
