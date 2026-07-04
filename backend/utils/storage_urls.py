"""Generate signed URLs for POI images stored in Supabase Storage.

Single-bucket world: every POI image lives in ``getaway-images`` as a
relative storage path like ``<poi_id>/00.jpg`` (see
``utils.images.upload_images_to_supabase``). No full URLs, no legacy buckets,
no per-row bucket detection — pass the paths straight to
``create_signed_urls`` and we're done.

Uses the user's auth token; RLS still applies (never service role).
"""
from __future__ import annotations

BUCKET = "getaway-images"
EXPIRE_SEC = 3600  # 1 hour


def _sign(paths: list[str], auth_token: str) -> list[str | None]:
    """Sign ``paths`` in one Storage round trip. Returns a same-length list
    with the signed URL at each position, or ``None`` if that path failed."""
    if not paths:
        return []
    # Lazy import: ``db/__init__.py`` imports ``db.getaways`` which imports
    # this module, so importing ``db.client`` at top would deadlock.
    from db.client import get_supabase_client

    client = get_supabase_client(auth_token)
    try:
        results = client.storage.from_(BUCKET).create_signed_urls(paths, EXPIRE_SEC)
    except Exception:
        return [None] * len(paths)

    out: list[str | None] = []
    for res in results:
        url = (
            res.get("signedURL")
            or res.get("signedUrl")
            or res.get("signed_url")
        )
        out.append(url if url and not res.get("error") else None)
    return out


def sign_images(rows: list[dict], auth_token: str) -> list[dict]:
    """Replace each row's ``images`` paths with signed URLs.

    Works for any rows carrying an ``images`` list of storage paths (POIs,
    getaways, etc.). Costs ONE ``POST /storage/v1/object/sign/getaway-images``
    for the whole batch, regardless of how many rows or images are involved.
    """
    if not rows:
        return rows

    # Flatten paths across rows, remembering which row each came from.
    flat_paths: list[str] = []
    origin_row: list[int] = []
    for row_idx, row in enumerate(rows):
        for path in row.get("images") or []:
            if not path:
                continue
            flat_paths.append(path)
            origin_row.append(row_idx)

    if not flat_paths:
        return [{**r, "images": []} for r in rows]

    signed = _sign(flat_paths, auth_token)

    # Reassemble per-row. Order within each row is preserved because we
    # iterated each row's images in order when flattening.
    images_by_row: dict[int, list[str]] = {}
    for row_idx, signed_url in zip(origin_row, signed):
        if signed_url is None:
            continue
        images_by_row.setdefault(row_idx, []).append(signed_url)

    return [
        {**row, "images": images_by_row.get(idx, [])}
        for idx, row in enumerate(rows)
    ]
