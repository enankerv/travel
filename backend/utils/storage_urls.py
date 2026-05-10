"""Generate signed URLs for getaway images stored in Supabase Storage.

Single-bucket world: every getaway image lives in ``getaway-images`` as a
relative storage path like ``<getaway_id>/00.jpg`` (see
``utils.images.upload_images_to_supabase``). No full URLs, no legacy buckets,
no per-row bucket detection — pass the paths straight to
``create_signed_urls`` and we're done.

Uses the user's auth token; RLS still applies (never service role).
"""

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


def sign_getaways_images(getaways: list[dict], auth_token: str) -> list[dict]:
    """Replace each getaway's ``images`` paths with signed URLs.

    Costs ONE ``POST /storage/v1/object/sign/getaway-images`` for the whole
    batch, regardless of how many getaways or images are involved.
    """
    if not getaways:
        return getaways

    # Flatten paths across getaways, remembering which getaway each came from.
    flat_paths: list[str] = []
    origin_getaway: list[int] = []
    for getaway_idx, getaway in enumerate(getaways):
        for path in getaway.get("images") or []:
            if not path:
                continue
            flat_paths.append(path)
            origin_getaway.append(getaway_idx)

    if not flat_paths:
        return [{**g, "images": []} for g in getaways]

    signed = _sign(flat_paths, auth_token)

    # Reassemble per-getaway. Order within each getaway is preserved because
    # we iterated each getaway's images in order when flattening.
    images_by_getaway: dict[int, list[str]] = {}
    for getaway_idx, signed_url in zip(origin_getaway, signed):
        if signed_url is None:
            continue
        images_by_getaway.setdefault(getaway_idx, []).append(signed_url)

    return [
        {**getaway, "images": images_by_getaway.get(idx, [])}
        for idx, getaway in enumerate(getaways)
    ]
