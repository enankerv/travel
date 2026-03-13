"""Image handling, filtering, and upload utilities."""
import io
import re
import logging
from urllib.parse import urlparse

import httpx

log = logging.getLogger("scout.images")

SUPABASE_BUCKET = "getaway-images"

# Regex patterns for image extraction
MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\((https?://[^\s\)]+\.(?:jpe?g|png|webp))\)", re.IGNORECASE)
BARE_IMAGE_RE = re.compile(r"(?<!\()(?<!\])\b(https?://[^\s\)\]]+\.(?:jpe?g|png|webp))(?:\?[^\s\)\]]*)?", re.IGNORECASE)
# Airbnb uses a0, a1, a2 muscache subdomains
AIRBNB_PHOTO_RE = re.compile(r"(https?://a[0-9]?\.?muscache\.com/im/pictures/[^\s\)\]\"'<>]+)", re.IGNORECASE)

SIZE_SUFFIX_RE = re.compile(r"[-_]\d+x\d+")
URL_DIMS_RE = re.compile(r"[-_](\d+)x(\d+)")

JUNK_IMAGE_WORDS = {
    "favicon", "icon", "logo", "avatar", "badge", "sprite", "pixel",
    "1x1", "tracking", "analytics", "beacon", "spacer", "blank",
    "gravatar", "profile-pic", "emoji", "arrow", "button", "social",
    "share", "flag", "rating", "star-", "check", "bullet", "spinner",
    "loader", "placeholder", "widget", "banner-ad", "static/packages",
    "/user/", "profile_pic", "airbnb-logo", "superhog",
}


def image_base_key(src: str) -> str:
    """Normalise an image URL so different resolutions of the same photo share one key."""
    path = urlparse(src).path
    return SIZE_SUFFIX_RE.sub("", path)


def url_width(src: str) -> int:
    """Extract the largest width from a URL. Handles '-1024x683.jpg' and '_1920x1080_im_r7'.
    No dimensions found = treat as original/full-size."""
    matches = URL_DIMS_RE.findall(urlparse(src).path)
    if matches:
        return max(int(w) for w, h in matches)
    return 99999


def is_likely_property_photo(url: str) -> bool:
    """Heuristic: return True if URL looks like an actual property/listing photo."""
    low = url.lower()
    if any(junk in low for junk in JUNK_IMAGE_WORDS):
        return False
    if low.endswith(".gif") or ".svg" in low:
        return False
    if "muscache.com" in low:
        return "/im/pictures/" in low
    return True


async def upload_images_to_supabase(
    image_urls: list[str],
    getaway_id: str,
    auth_token: str,
    max_images: int = 5,
) -> list[str] | None:
    """Download images from URLs and upload to Supabase Storage. Returns storage paths (getaway_id/filename) or None on failure.
    Uses auth_token for Storage RLS (authenticated user must have list access)."""
    from db_lists import get_supabase_client

    if not auth_token:
        log.warning("auth_token required for storage upload")
        return None

    client = get_supabase_client(auth_token)
    bucket = client.storage.from_(SUPABASE_BUCKET)
    bucket._headers["authorization"] = f"Bearer {auth_token}"
    public_urls: list[str] = []

    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client_http:
        for i, img_url in enumerate(image_urls[:max_images]):
            try:
                r = await client_http.get(img_url)
                if r.status_code != 200:
                    continue
                ct = r.headers.get("content-type", "")
                ext = "jpg"
                if "png" in ct:
                    ext = "png"
                elif "webp" in ct:
                    ext = "webp"
                elif "gif" in ct:
                    ext = "gif"
                path = f"{getaway_id}/{i:02d}.{ext}"
                mime = ct or f"image/{ext}"
                # storage-py: upload(path, file, file_options); file can be bytes
                bucket.upload(
                    path,
                    r.content,
                    file_options={"content-type": mime, "upsert": "true"},
                )
                public_urls.append(path)
                log.info("uploaded image to Supabase: %s", path)
            except Exception as e:
                log.warning("failed to upload image %s: %s", img_url[:80], e, exc_info=True)

    return public_urls if public_urls else None


def pick_best_images_from_media(media: dict, villa_name: str = "", base_url: str = "", max_images: int = 1) -> list[str]:
    """Pick highest-scored, unique images from crawl result. Dedup by base filename and prefer largest resolution."""
    images = media.get("images", [])
    if not images:
        return []
    villa_lower = villa_name.lower().strip() if villa_name else ""

    best_per_key: dict[str, tuple[int, int, str]] = {}
    for img in images:
        raw_src = img.get("src", "")
        if not raw_src:
            continue
        src = raw_src if not base_url else base_url + raw_src if raw_src.startswith("/") else raw_src
        if not src.startswith("http"):
            continue
        if any(skip in src.lower() for skip in [".svg", "favicon", "pixel", "1x1", "tracking"]):
            continue
        alt = (img.get("alt") or "").lower()
        if alt and "|" in alt:
            other_name = alt.split("|")[0].strip()
            if other_name and villa_lower and other_name not in villa_lower and villa_lower not in other_name:
                continue
        key = image_base_key(src)
        score = img.get("score", 0) or 0
        width = url_width(src)
        prev = best_per_key.get(key)
        if prev is None or (score, width) > (prev[0], prev[1]):
            best_per_key[key] = (score, width, src)

    ranked = sorted(best_per_key.values(), key=lambda t: (t[0], t[1]), reverse=True)
    return [src for _, _, src in ranked[:max_images]]


def extract_image_urls_from_text(text: str) -> list[str]:
    """Pull image URLs from pasted text, filtering out junk (icons, logos, tiny images).
    Dedupes by base key and returns up to 10."""
    raw = MD_IMAGE_RE.findall(text) + BARE_IMAGE_RE.findall(text) + AIRBNB_PHOTO_RE.findall(text)
    seen_keys: set[str] = set()
    urls: list[str] = []
    for url in raw:
        if not is_likely_property_photo(url):
            continue
        key = image_base_key(url)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        urls.append(url)
    return urls[:10]


async def fetch_og_image(url: str) -> str | None:
    """Best-effort lightweight HTTP fetch to extract og:image from a page's static HTML."""
    if not url:
        return None
    og_image_re = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE)
    og_image_re2 = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', re.IGNORECASE)
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=10,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
            },
        ) as client:
            r = await client.get(url)
            if r.status_code != 200:
                return None
            text = r.text[:20000]
            m = og_image_re.search(text) or og_image_re2.search(text)
            if m:
                og_url = m.group(1).replace("&amp;", "&")
                log.info("og:image found: %s", og_url[:100])
                return og_url
    except Exception as e:
        log.warning("og:image fetch failed for %s: %s", url[:80], e)
    return None
