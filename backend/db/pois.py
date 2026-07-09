"""Low-level POI table operations (data-mapper).

Dumb persistence for the ``pois`` spine, its 1:1 subtype rows, and images. The
domain models (``models.POI`` / ``models.Getaway``) own the field->table
mapping and orchestration; this module just talks to PostgREST. Keep SQL here,
behavior there. Every call takes the user's auth token so Supabase RLS scopes
access per user (never the service role).
"""
from __future__ import annotations

from db.client import get_supabase_client
from utils.storage_urls import sign_images

# PostgREST select that pulls the spine, the getaway subtype (1:1), and images.
_SELECT_WITH_DETAILS = "*, getaways(*), poi_images(image_url, position)"


def compose_poi_row(row: dict) -> dict:
    """Flatten a pois row embedded with ``getaways`` + ``poi_images``.

    Merges the subtype fields onto the spine and turns image rows into an
    ordered ``images`` list of storage paths (signing happens separately).
    """
    getaway = row.pop("getaways", None)
    if isinstance(getaway, list):
        getaway = getaway[0] if getaway else None
    if getaway:
        getaway.pop("poi_id", None)
        row.update(getaway)

    images = row.pop("poi_images", None) or []
    row["images"] = [
        img["image_url"]
        for img in sorted(images, key=lambda i: (i.get("position") or 0))
    ]
    return row


# ---- reads -----------------------------------------------------------------

def fetch_poi_row(poi_id: str, auth_token: str) -> dict | None:
    """One composed + signed POI row by id (spine + subtype + images)."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("pois")
        .select(_SELECT_WITH_DETAILS)
        .eq("id", poi_id)
        .execute()
    )
    if not response.data:
        return None
    return sign_images([compose_poi_row(response.data[0])], auth_token)[0]


def fetch_poi_row_in_list(poi_id: str, list_id: str, auth_token: str) -> dict | None:
    """One composed + signed POI row when it belongs to ``list_id``."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("pois")
        .select(_SELECT_WITH_DETAILS)
        .eq("id", poi_id)
        .eq("list_id", list_id)
        .execute()
    )
    if not response.data:
        return None
    return sign_images([compose_poi_row(response.data[0])], auth_token)[0]


def fetch_list_poi_rows(list_id: str, auth_token: str, poi_type: str | None = None) -> list[dict]:
    """Composed + signed POI rows for a list, optionally filtered by poi_type."""
    client = get_supabase_client(auth_token)
    query = client.table("pois").select(_SELECT_WITH_DETAILS).eq("list_id", list_id)
    if poi_type is not None:
        query = query.eq("poi_type", poi_type)
    response = query.order("created_at", desc=True).execute()
    rows = [compose_poi_row(r) for r in (response.data or [])]
    return sign_images(rows, auth_token)


# ---- writes ----------------------------------------------------------------

def insert_poi_row(list_id: str, fields: dict, auth_token: str, user_id: str | None = None) -> dict | None:
    """Insert a spine row (caller supplies validated spine columns)."""
    client = get_supabase_client(auth_token)
    data = dict(fields)
    data["list_id"] = list_id
    if user_id is not None:
        data["user_id"] = user_id
    response = client.table("pois").insert(data).execute()
    return response.data[0] if response.data else None


def update_poi_row(
    poi_id: str,
    fields: dict,
    auth_token: str,
    *,
    list_id: str | None = None,
) -> dict | None:
    """Update spine columns on a POI. When ``list_id`` is set, only rows on that list match."""
    if not fields:
        return None
    client = get_supabase_client(auth_token)
    query = client.table("pois").update(fields).eq("id", poi_id)
    if list_id is not None:
        query = query.eq("list_id", list_id)
    response = query.execute()
    return response.data[0] if response.data else None


def bulk_update_poi_positions(
    list_id: str,
    positions: list[dict],
    auth_token: str,
) -> int:
    """Update board_x/board_y for many POIs on one list via a single RPC call."""
    if not positions:
        return 0
    client = get_supabase_client(auth_token)
    response = client.rpc(
        "bulk_update_poi_positions",
        {"p_list_id": list_id, "p_positions": positions},
    ).execute()
    count = response.data
    return int(count) if count is not None else 0


def delete_poi_row(
    poi_id: str,
    auth_token: str,
    *,
    list_id: str | None = None,
) -> bool:
    """Delete a POI (subtype rows, images, votes, comments cascade)."""
    client = get_supabase_client(auth_token)
    query = client.table("pois").delete().eq("id", poi_id)
    if list_id is not None:
        query = query.eq("list_id", list_id)
    response = query.execute()
    return bool(response.data)


def insert_subtype_row(table: str, poi_id: str, fields: dict, auth_token: str) -> None:
    """Insert the 1:1 subtype row (e.g. getaways) keyed by ``poi_id``."""
    client = get_supabase_client(auth_token)
    data = dict(fields)
    data["poi_id"] = poi_id
    client.table(table).insert(data).execute()


def update_subtype_row(table: str, poi_id: str, fields: dict, auth_token: str) -> None:
    """Update the 1:1 subtype row keyed by ``poi_id``."""
    if not fields:
        return
    client = get_supabase_client(auth_token)
    client.table(table).update(fields).eq("poi_id", poi_id).execute()


def fetch_poi_image_paths(poi_id: str, auth_token: str) -> list[str]:
    """Ordered storage paths for a POI's gallery (unsigned)."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("poi_images")
        .select("image_url, position")
        .eq("poi_id", poi_id)
        .order("position")
        .execute()
    )
    return [r["image_url"] for r in (response.data or [])]
