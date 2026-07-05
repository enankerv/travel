"""Board snapshot — POIs with nested comments and votes for the cork board UI."""
from __future__ import annotations

from pydantic import BaseModel

from db.client import get_supabase_client
from db.pois import _SELECT_WITH_DETAILS, compose_poi_row
from db.subgroups import get_subgroups_for_list
from models import BoardPoi, BoardResponse, BoardSubgroup, Comment, ListMember, Profile, Vote, board_poi_from_row
from utils.storage_urls import sign_images

# Enriched on fetch, not stored columns — omit from PostgREST embeds.
_ENRICHED_FIELDS = frozenset({"first_name", "avatar_url", "profile"})


def _db_columns(model: type[BaseModel], *, exclude: frozenset[str] = _ENRICHED_FIELDS) -> str:
    """Build a PostgREST column list from a response model."""
    return ", ".join(name for name in model.model_fields if name not in exclude)


# Composed from the same POI embed as ``db.pois`` plus nested social rows.
# Profiles are a second batched query (user_id FKs point at auth.users, not profiles).
_BOARD_POI_EMBED = (
    f"{_SELECT_WITH_DETAILS}, "
    f"comments({_db_columns(Comment)}), "
    f"votes({_db_columns(Vote)})"
)
_BOARD_SELECT = f"*, list_members({_db_columns(ListMember)}), pois({_BOARD_POI_EMBED})"


def _collect_user_ids(members: list[dict], nested_by_poi: list[tuple[list[dict], list[dict]]]) -> set[str]:
    user_ids = {str(m["user_id"]) for m in members}
    for comments, votes in nested_by_poi:
        for row in comments:
            user_ids.add(str(row["user_id"]))
        for row in votes:
            user_ids.add(str(row["user_id"]))
    return user_ids


def fetch_board_snapshot(list_id: str, auth_token: str) -> BoardResponse | None:
    """Return list metadata, members, and POIs each with ``comments`` + ``votes``."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("lists")
        .select(_BOARD_SELECT)
        .eq("id", list_id)
        .single()
        .execute()
    )
    if not response.data:
        return None

    row = response.data
    members = row.pop("list_members") or []
    raw_pois = row.pop("pois") or []
    list_data = row

    poi_spines: list[dict] = []
    nested_by_poi: list[tuple[list[dict], list[dict]]] = []

    for raw in raw_pois:
        comments = raw.pop("comments", None) or []
        votes = raw.pop("votes", None) or []
        poi_spines.append(compose_poi_row(raw))
        nested_by_poi.append((comments, votes))

    signed = sign_images(poi_spines, auth_token)
    profiles = Profile.for_user_ids(list(_collect_user_ids(members, nested_by_poi)), auth_token)

    for m in members:
        p = profiles.get(str(m["user_id"]))
        m["profile"] = p.member_dict() if p else {}

    poi_payloads: list[BoardPoi] = []
    for spine, (comments, votes) in zip(signed, nested_by_poi):
        comments.sort(key=lambda c: c.get("created_at") or "")
        Profile.enrich_rows(comments, profiles)
        Profile.enrich_rows(votes, profiles)
        poi_payloads.append(board_poi_from_row(spine, comments, votes, auth_token))

    poi_payloads.sort(key=lambda p: p.created_at, reverse=True)

    list_data["member_count"] = len(members)
    list_data["getaway_count"] = sum(1 for p in poi_payloads if p.poi_type == "getaway")

    subgroups = [BoardSubgroup.model_validate(r) for r in get_subgroups_for_list(list_id, auth_token)]

    return BoardResponse.model_validate({
        "list": list_data,
        "members": members,
        "subgroups": subgroups,
        "pois": poi_payloads,
    })
