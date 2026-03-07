"""Supabase client initialization and utilities."""
import os
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    )

supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_supabase() -> Client:
    """Get the Supabase client instance."""
    return supabase_client


def insert_villa(user_id: str, villa_data: dict) -> dict:
    """Insert a new villa for a user."""
    villa_data["user_id"] = user_id
    response = supabase_client.table("villas").insert(villa_data).execute()
    return response.data[0] if response.data else None


def get_user_villas(user_id: str) -> list[dict]:
    """Get all villas for a user."""
    response = supabase_client.table("villas").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return response.data or []


def get_villa_by_slug(user_id: str, slug: str) -> dict:
    """Get a specific villa by slug for a user."""
    response = supabase_client.table("villas").select("*").eq("user_id", user_id).eq("slug", slug).execute()
    return response.data[0] if response.data else None


def update_villa(user_id: str, villa_id: str, updates: dict) -> dict:
    """Update a villa."""
    response = supabase_client.table("villas").update(updates).eq("id", villa_id).eq("user_id", user_id).execute()
    return response.data[0] if response.data else None


def update_villa_by_slug(user_id: str, slug: str, updates: dict) -> dict:
    """Update a villa by slug."""
    response = supabase_client.table("villas").update(updates).eq("user_id", user_id).eq("slug", slug).execute()
    return response.data[0] if response.data else None


def delete_villa(user_id: str, villa_id: str) -> bool:
    """Delete a villa."""
    response = supabase_client.table("villas").delete().eq("id", villa_id).eq("user_id", user_id).execute()
    return len(response.data) > 0 if response.data else False


def delete_villa_by_slug(user_id: str, slug: str) -> bool:
    """Delete a villa by slug."""
    response = supabase_client.table("villas").delete().eq("user_id", user_id).eq("slug", slug).execute()
    return len(response.data) > 0 if response.data else False
