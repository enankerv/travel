"""Generate signed URLs for Supabase Storage (private bucket)."""
import os
import re
from supabase import create_client

BUCKET = "villa-images"
EXPIRE_SEC = 3600  # 1 hour

# Match Supabase storage URL to extract path: .../object/public/villa-images/path or .../object/sign/...
_STORAGE_PATH_RE = re.compile(r"/storage/v1/object/(?:public|sign)/[^/]+/(.+)$")


def _extract_storage_path(url_or_path: str) -> str | None:
    """If url_or_path is a Supabase storage URL, extract the storage path. Else return as-is if it looks like a storage path."""
    if not url_or_path:
        return None
    # Legacy local paths (/images/slug/00.jpg) - no longer served; exclude
    if url_or_path.startswith("/images/"):
        return None
    if url_or_path.startswith("http"):
        m = _STORAGE_PATH_RE.search(url_or_path)
        return m.group(1) if m else None
    return url_or_path if "/" in url_or_path else None


def _get_storage_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def sign_image_paths(paths: list[str] | None) -> list[str]:
    """Convert storage paths (or old Supabase URLs) to signed URLs. Returns original if signing fails."""
    if not paths:
        return []
    client = _get_storage_client()
    if not client:
        return paths
    bucket = client.storage.from_(BUCKET)
    signed: list[str] = []
    for p in paths:
        storage_path = _extract_storage_path(p)
        if not storage_path:
            continue  # Skip legacy /images/ paths and invalid entries
        try:
            r = bucket.create_signed_url(storage_path, EXPIRE_SEC)
            url = r.get("signedUrl") or r.get("path") or p
            signed.append(url)
        except Exception:
            signed.append(p)
    return signed


def sign_villa_images(villa: dict) -> dict:
    """Return villa with images array replaced by signed URLs."""
    if not villa or "images" not in villa:
        return villa
    images = villa.get("images") or []
    villa = {**villa, "images": sign_image_paths(images)}
    return villa
