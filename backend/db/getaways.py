"""Getaways and getaway_images table operations."""
import secrets
from db.client import get_supabase_client


def _attach_images_to_getaways(rows: list[dict]) -> list[dict]:
    """Flatten getaway_images into an 'images' array (sorted by position) on each row."""
    for row in rows:
        imgs = row.pop("getaway_images", None) or []
        row["images"] = [x["image_url"] for x in sorted(imgs, key=lambda i: (i.get("position") or 0))]
    return rows


def create_loading_getaway(list_id: str, url: str, auth_token: str = None) -> dict:
    """Create a placeholder getaway row with 'loading' status."""
    client = get_supabase_client(auth_token)
    slug = f"loading-{secrets.token_hex(4)}"
    data = {"list_id": list_id, "slug": slug, "source_url": url, "import_status": "loading"}
    response = client.table("getaways").insert(data).execute()
    return response.data[0] if response.data else None


def insert_getaway(list_id: str, user_id: str, getaway_data: dict, auth_token: str = None) -> dict:
    """Insert a new getaway into a list."""
    client = get_supabase_client(auth_token)
    getaway_data["list_id"] = list_id
    getaway_data["user_id"] = user_id
    response = client.table("getaways").insert(getaway_data).execute()
    return response.data[0] if response.data else None


def get_list_getaways(list_id: str, auth_token: str) -> list[dict]:
    """Get all getaways in a list, with images from getaway_images."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .select("*, getaway_images(image_url, position)")
        .eq("list_id", list_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = response.data or []
    return _attach_images_to_getaways(rows)


def get_getaway_by_slug(list_id: str, slug: str, auth_token: str) -> dict:
    """Get a specific getaway by slug in a list."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .select("*, getaway_images(image_url, position)")
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    if not response.data:
        return None
    rows = _attach_images_to_getaways([response.data[0]])
    return rows[0]


def update_getaway(getaway_id: str, updates: dict, auth_token: str) -> dict:
    """Update a getaway."""
    client = get_supabase_client(auth_token)
    response = client.table("getaways").update(updates).eq("id", getaway_id).execute()
    return response.data[0] if response.data else None


def update_getaway_by_slug(list_id: str, slug: str, updates: dict, auth_token: str) -> dict:
    """Update a getaway by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .update(updates)
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return response.data[0] if response.data else None


def delete_getaway(getaway_id: str, auth_token: str) -> bool:
    """Delete a getaway (getaway_images cascade)."""
    client = get_supabase_client(auth_token)
    response = client.table("getaways").delete().eq("id", getaway_id).execute()
    return len(response.data) > 0 if response.data else False


def delete_getaway_by_slug(list_id: str, slug: str, auth_token: str) -> bool:
    """Delete a getaway by slug."""
    client = get_supabase_client(auth_token)
    response = (
        client.table("getaways")
        .delete()
        .eq("list_id", list_id)
        .eq("slug", slug)
        .execute()
    )
    return len(response.data) > 0 if response.data else False


def insert_getaway_images(getaway_id: str, image_urls: list[str], auth_token: str) -> None:
    """Insert image rows into getaway_images. Replaces any existing images for that getaway."""
    if not image_urls:
        return
    client = get_supabase_client(auth_token)
    client.table("getaway_images").delete().eq("getaway_id", getaway_id).execute()
    rows = [{"getaway_id": getaway_id, "image_url": url, "position": i} for i, url in enumerate(image_urls)]
    client.table("getaway_images").insert(rows).execute()
