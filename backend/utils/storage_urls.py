"""Generate signed URLs for Supabase Storage (private bucket).
Uses user auth_token for RLS - never service role."""
import re

DEFAULT_BUCKET = "getaway-images"
LEGACY_BUCKET = "villa-images"
EXPIRE_SEC = 3600  # 1 hour

# Match Supabase storage URL: .../object/public|sign/BUCKET/path (path = no query string)
_STORAGE_URL_RE = re.compile(r"/storage/v1/object/(?:public|sign)/([^/]+)/(.+?)(?:\?|$)")


def _parse_storage_url(url_or_path: str) -> tuple[str, str] | None:
    """If url_or_path is a Supabase storage URL, return (bucket, path). Else return None or (DEFAULT_BUCKET, path) for raw paths."""
    if not url_or_path:
        return None
    if url_or_path.startswith("/images/"):
        return None
    if url_or_path.startswith("http"):
        m = _STORAGE_URL_RE.search(url_or_path)
        if m:
            bucket, path = m.group(1), m.group(2)
            return (bucket, path) if path else None
        return None
    if "/" in url_or_path:
        return (DEFAULT_BUCKET, url_or_path)
    return None


def sign_image_paths(paths: list[str] | None, auth_token: str) -> list[str]:
    """Convert storage paths (or old Supabase URLs) to signed URLs. Uses auth_token for RLS.
    Supports both getaway-images and legacy villa-images bucket."""
    if not paths:
        return []
    from db import get_supabase_client
    client = get_supabase_client(auth_token)
    if not client:
        return paths
    signed: list[str] = []
    for p in paths:
        parsed = _parse_storage_url(p)
        if not parsed:
            continue
        bucket_name, storage_path = parsed
        try:
            bucket = client.storage.from_(bucket_name)
            r = bucket.create_signed_url(storage_path, EXPIRE_SEC)
            url = r.get("signed_url") or r.get("signedUrl") or p
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
