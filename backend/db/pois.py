"""Points of interest (POI) table operations."""
from db.client import get_supabase_client
from utils.urls import generate_slug


def _unique_slug(client, list_id: str, base_slug: str) -> str:
    """Return a slug unique within the list, appending -2, -3, … on collision."""
    slug = base_slug
    n = 2
    while True:
        response = (
            client.table("pois")
            .select("id")
            .eq("list_id", list_id)
            .eq("slug", slug)
            .limit(1)
            .execute()
        )
        if not response.data:
            return slug
        slug = f"{base_slug}-{n}"
        n += 1


def insert_poi(list_id: str, user_id: str, poi_data: dict, auth_token: str = None) -> dict:
    """Insert a new POI into a list."""
    client = get_supabase_client(auth_token)
    base_slug = generate_slug(poi_data.get("name") or "poi")
    poi_data["slug"] = _unique_slug(client, list_id, base_slug)
    poi_data["list_id"] = list_id
    poi_data["user_id"] = user_id
    if "metadata" not in poi_data or poi_data["metadata"] is None:
        poi_data["metadata"] = {}
    response = client.table("pois").insert(poi_data).execute()
    return response.data[0] if response.data else None


def get_list_pois(list_id: str, auth_token: str, poi_type: str | None = None) -> list[dict]:
    """Get all POIs in a list, optionally filtered by type."""
    client = get_supabase_client(auth_token)
    query = (
        client.table("pois")
        .select("*")
        .eq("list_id", list_id)
        .order("created_at", desc=True)
    )
    if poi_type:
        query = query.eq("poi_type", poi_type)
    response = query.execute()
    return response.data or []


def get_poi_by_slug(list_id: str, slug: str, auth_token: str) -> dict | None:
    """Get one POI by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("pois")
        .select("*")
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return response.data[0] if response.data else None


def update_poi_by_slug(list_id: str, slug: str, updates: dict, auth_token: str) -> dict | None:
    """Update a POI by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("pois")
        .update(updates)
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return response.data[0] if response.data else None


def delete_poi_by_slug(list_id: str, slug: str, auth_token: str) -> bool:
    """Delete a POI by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("pois")
        .delete()
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return len(response.data) > 0 if response.data else False
