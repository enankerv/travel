"""Getaway scouting and data extraction engine."""
import logging

from schema import VillaListing
from utils.urls import (
    add_search_params, generate_js_params, is_js_heavy_site,
    extract_url_slug, generate_slug
)
from utils.text_cleaning import (
    strip_other_villas_block, extract_main_property_only, is_thin_scrape
)
from utils.images import (
    pick_best_images_from_media,
    upload_images_to_supabase,
    extract_image_urls_from_text,
    fetch_og_image,
)
from utils.crawler import crawl_page
from utils.extraction import extract_villa_two_pass, extract_price_from_text
from utils.scout_limits import truncate_for_extraction, truncate_for_extraction_preserving_images
from utils.geocode import geocode as geocode_location
from db.scout_quota import check_and_use_quota
from db import update_getaway, insert_getaway_images

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("scout")


def _listing_to_getaway_row(
    listing, slug: str, source_url: str, name: str, raw_text: str | None = None,
    lat: float | None = None, lng: float | None = None,
) -> dict:
    """Map extracted VillaListing to getaways table row (no images; those go to getaway_images)."""
    ld = listing.model_dump()
    parts = [
        ld.get("interiors_summary"),
        ld.get("exteriors_summary"),
        ld.get("location_summary"),
    ]
    description = "\n\n".join(p for p in parts if p and str(p).strip()) or None
    pool = ld.get("pool_features") or []
    am = ld.get("amenities") or []
    extras = ld.get("extras") or []
    amenities = [x for x in (pool + am + extras) if x and str(x).strip()]
    price = None
    price_currency = None
    if raw_text:
        regex_price, regex_currency = extract_price_from_text(raw_text)
        if regex_price is not None:
            price, price_currency = regex_price, regex_currency
            log.info("price from text (currency symbols): %s %s", price_currency, price)
    if price is None:
        price = ld.get("price_weekly_usd") or ld.get("price_weekly_min_eur")
        price_currency = "USD" if ld.get("price_weekly_usd") is not None else ("EUR" if (ld.get("price_weekly_min_eur") or ld.get("price_weekly_max_eur")) else None)
    return {
        "slug": slug,
        "source_url": source_url,
        "import_status": "loaded",
        "name": name or (ld.get("villa_name") or "").strip() or None,
        "location": ld.get("location"),
        "region": ld.get("region"),
        "bedrooms": ld.get("bedrooms"),
        "bathrooms": ld.get("bathrooms"),
        "max_guests": ld.get("max_guests"),
        "price": price,
        "price_currency": price_currency,
        "price_period": "week",
        "deposit": ld.get("security_deposit_eur"),
        "amenities": amenities if amenities else None,
        "included": ld.get("included_in_price"),
        "description": description,
        "caveats": ld.get("the_catch"),
        "lat": lat,
        "lng": lng,
    }


def _display_title_for_listing(
    listing: VillaListing,
    *,
    url_for_path_title: str | None = None,
    name_if_no_villa: str = "Listing",
) -> str:
    """Prefer villa_name; else last URL path segment as title; else fixed default."""
    villa = (listing.villa_name or "").strip()
    if villa:
        return villa
    if url_for_path_title:
        seg = url_for_path_title.split("/")[-1].split("?")[0].replace("-", " ").strip()
        if seg:
            return seg.title()
    return name_if_no_villa


def _geocode_listing(listing: VillaListing) -> tuple[float | None, float | None]:
    loc = (listing.location or "").strip()
    reg = (listing.region or "").strip()
    geocode_query = ", ".join(p for p in [loc, reg] if p)
    if not geocode_query:
        return None, None
    lat, lng = geocode_location(geocode_query)
    if lat is not None:
        log.info("geocoded %r -> %.4f, %.4f", geocode_query, lat, lng)
    return lat, lng


async def persist_listing_to_getaway(
    listing: VillaListing,
    *,
    name: str,
    slug: str,
    source_url: str,
    raw_text_for_price: str | None,
    image_candidate_urls: list[str],
    getaway_id: str,
    auth_token: str,
) -> dict:
    """
    Upload candidate images, geocode, map listing to row, update getaway + images.
    Shared by URL scout and paste flows after LLM extraction.
    """
    image_urls: list[str] = []
    if image_candidate_urls:
        image_urls = await upload_images_to_supabase(image_candidate_urls, getaway_id, auth_token) or []
    if image_urls:
        print(f"[IMG] Uploaded {len(image_urls)} images to Supabase")

    lat, lng = _geocode_listing(listing)
    row = _listing_to_getaway_row(
        listing, slug=slug, source_url=source_url, name=name,
        raw_text=raw_text_for_price, lat=lat, lng=lng,
    )
    update_getaway(getaway_id, row, auth_token=auth_token)
    if image_urls:
        insert_getaway_images(getaway_id, image_urls, auth_token)
    print("[OK] Success! Getaway updated in Supabase")
    return {"path": f"/getaways/{slug}", "getaway_id": getaway_id}


async def scrape_and_thin_check(
    url: str,
    check_in: str | None = None,
    check_out: str | None = None,
    guests: int | None = None,
) -> dict:
    """
    Scrape URL and run thin check. Returns {is_thin: bool, extraction_md?, crawl_image_urls?, url}.
    When is_thin=True, extraction_md and crawl_image_urls are None.
    """
    print(f"[SCOUT] Scraping: {url}")
    crawl_url = add_search_params(url, check_in, check_out, guests)
    js_code = generate_js_params(check_in, check_out, guests)
    if is_js_heavy_site(crawl_url):
        scroll_js = "window.scrollTo(0, 1000);"
        js_code = f"{js_code}; {scroll_js}" if js_code else scroll_js

    raw_markdown, media = await crawl_page(crawl_url, js_code, is_js_heavy_site(crawl_url))
    if not raw_markdown:
        print("[WARN] Crawl failed — skipping extraction")
        return {"is_thin": True, "extraction_md": None, "crawl_image_urls": None, "url": url}

    url_slug = extract_url_slug(url)
    crawl_image_urls = pick_best_images_from_media(media, villa_name=url_slug, base_url=crawl_url)
    log.info("found %d candidate images from crawl", len(crawl_image_urls))

    raw_markdown = strip_other_villas_block(raw_markdown)
    extraction_md = extract_main_property_only(raw_markdown)
    extraction_md = truncate_for_extraction(extraction_md)
    if is_thin_scrape(extraction_md):
        print("[WARN] Thin scrape — skipping LLM, user will paste manually")
        return {"is_thin": True, "extraction_md": None, "crawl_image_urls": None, "url": url}

    return {"is_thin": False, "extraction_md": extraction_md, "crawl_image_urls": crawl_image_urls, "url": url}


async def run_llm_and_update_getaway(
    extraction_md: str,
    crawl_image_urls: list,
    url: str,
    getaway_id: str,
    auth_token: str,
):
    """Run LLM extraction and update getaway. Assumes quota already consumed."""
    listing = await extract_villa_two_pass(extraction_md)
    name = _display_title_for_listing(
        listing, url_for_path_title=url, name_if_no_villa="Listing",
    )
    slug = generate_slug(name)
    return await persist_listing_to_getaway(
        listing,
        name=name,
        slug=slug,
        source_url=url,
        raw_text_for_price=extraction_md,
        image_candidate_urls=crawl_image_urls or [],
        getaway_id=getaway_id,
        auth_token=auth_token,
    )


def prepare_manual_paste_extraction_md(pasted_text: str) -> str:
    """Normalize pasted listing text the same way as the paste scout pipeline before LLM."""
    extraction_md = (pasted_text or "").strip()
    if not extraction_md:
        raise ValueError("Pasted text is empty.")
    log.info("manual paste: len=%d chars", len(extraction_md))
    extraction_md = strip_other_villas_block(extraction_md)
    extraction_md = extract_main_property_only(extraction_md)
    return truncate_for_extraction_preserving_images(extraction_md)


async def image_candidate_urls_for_paste(
    extraction_md: str,
    original_url: str | None,
) -> list[str]:
    """Resolve image URLs for a paste flow: og:image first, else markdown image links."""
    og_url = await fetch_og_image(original_url)
    if og_url:
        print("[IMG] Using og:image from original URL")
        return [og_url]
    candidates = extract_image_urls_from_text(extraction_md)
    if candidates:
        print(f"[IMG] Using {len(candidates)} images extracted from paste")
    else:
        print("[IMG] No images found in paste text")
    return candidates


async def generate_getaway_page(
    url: str,
    check_in: str | None = None,
    check_out: str | None = None,
    guests: int | None = None,
    list_id: str | None = None,
    auth_token: str | None = None,
    getaway_id: str | None = None,
    user_id: str | None = None,
):
    """Full flow: scrape, thin check, charge, LLM, update. Used when route awaits everything."""
    scraped = await scrape_and_thin_check(url, check_in, check_out, guests)
    if scraped["is_thin"]:
        return {"path": None, "thin_scrape": True, "getaway_id": getaway_id}

    if not user_id:
        if getaway_id and auth_token:
            update_getaway(getaway_id, {"import_status": "error", "import_error": "Sign in to scout listings."}, auth_token)
        return {"path": None, "thin_scrape": False, "getaway_id": getaway_id, "quota_exceeded": True}

    allowed, quota_error = check_and_use_quota(user_id)
    if not allowed:
        if getaway_id and auth_token:
            update_getaway(getaway_id, {"import_status": "error", "import_error": quota_error}, auth_token)
        return {"path": None, "thin_scrape": False, "getaway_id": getaway_id, "quota_exceeded": True}

    result = await run_llm_and_update_getaway(
        scraped["extraction_md"], scraped["crawl_image_urls"] or [], scraped["url"],
        getaway_id, auth_token,
    )
    return {**result, "thin_scrape": False}


async def generate_getaway_page_from_paste(
    pasted_text: str,
    original_url: str |  None = None,
    list_id: str | None = None,
    auth_token: str | None = None,
    getaway_id: str | None = None,
    user_id: str | None = None,
) -> dict:
    """
    Build a getaway report from pasted listing text. Updates the given getaway row.

    Mirrors generate_getaway_page: requires user_id and consumes scout quota here (not only in the route)
    so callers always hit the same billing rules.
    """
    if not (pasted_text or "").strip():
        raise ValueError("Pasted text is empty.")
    if not getaway_id or not auth_token:
        raise ValueError("getaway_id and auth_token required")

    if not user_id:
        update_getaway(
            getaway_id,
            {"import_status": "error", "import_error": "Sign in to scout listings."},
            auth_token,
        )
        return {"path": None, "getaway_id": getaway_id, "quota_exceeded": True}

    allowed, quota_error = check_and_use_quota(user_id)
    if not allowed:
        update_getaway(
            getaway_id,
            {"import_status": "error", "import_error": quota_error},
            auth_token,
        )
        return {"path": None, "getaway_id": getaway_id, "quota_exceeded": True}

    extraction_md = prepare_manual_paste_extraction_md(pasted_text)
    listing = await extract_villa_two_pass(extraction_md)
    name = _display_title_for_listing(
        listing, url_for_path_title=None, name_if_no_villa="Manual entry",
    )
    slug = generate_slug(name)
    image_candidates = await image_candidate_urls_for_paste(extraction_md, original_url)

    return await persist_listing_to_getaway(
        listing,
        name=name,
        slug=slug,
        source_url=original_url or "",
        raw_text_for_price=pasted_text,
        image_candidate_urls=image_candidates,
        getaway_id=getaway_id,
        auth_token=auth_token,
    )


if __name__ == "__main__":
    print("Scout is designed to run via the API with list_id and auth. Use POST /api/scout instead.")
