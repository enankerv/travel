"""Generate signed URLs for Supabase Storage (private bucket).
Uses user auth_token for RLS - never service role."""
import re

BUCKET = "getaway-images"
EXPIRE_SEC = 3600  # 1 hour

# Match Supabase storage URL to extract path: .../object/public/getaway-images/path or .../object/sign/...
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


def sign_image_paths(paths: list[str] | None, auth_token: str) -> list[str]:
    """Convert storage paths (or old Supabase URLs) to signed URLs. Uses auth_token for RLS."""
    if not paths:
        return []
    from db_lists import get_supabase_client
    client = get_supabase_client(auth_token)
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


def sign_getaway_images(getaway: dict, auth_token: str) -> dict:
    """Return getaway with images array replaced by signed URLs. Uses auth_token for RLS."""
    if not getaway or "images" not in getaway:
        return getaway
    images = getaway.get("images") or []
    getaway = {**getaway, "images": sign_image_paths(images, auth_token)}
    return getaway
