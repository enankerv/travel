"""Getaway scouting and data extraction engine."""
import logging
from urllib.parse import urlparse

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
from utils.geocode import geocode as geocode_location

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


async def generate_getaway_page(
    url: str,
    check_in: str | None = None,
    check_out: str | None = None,
    guests: int | None = None,
    list_id: str | None = None,
    auth_token: str | None = None,
    getaway_id: str | None = None,
):
    """Scrape a listing URL and extract structured data. If getaway_id is provided, updates that getaway."""
    print(f"[SCOUT] Scouting: {url}")

    crawl_url = add_search_params(url, check_in, check_out, guests)
    js_code = generate_js_params(check_in, check_out, guests)
    if is_js_heavy_site(crawl_url):
        scroll_js = "window.scrollTo(0, 1000);"
        js_code = f"{js_code}; {scroll_js}" if js_code else scroll_js

    raw_markdown, media = await crawl_page(crawl_url, js_code, is_js_heavy_site(crawl_url))
    if not raw_markdown:
        print("[WARN] Crawl failed — skipping extraction")
        return {"path": None, "thin_scrape": True, "getaway_id": getaway_id}

    url_slug = extract_url_slug(url)
    crawl_image_urls = pick_best_images_from_media(media, villa_name=url_slug, base_url=crawl_url)
    log.info("found %d candidate images from crawl", len(crawl_image_urls))

    raw_markdown = strip_other_villas_block(raw_markdown)
    extraction_md = extract_main_property_only(raw_markdown)
    if is_thin_scrape(extraction_md):
        print("[WARN] Thin scrape — skipping LLM, user will paste manually")
        return {"path": None, "thin_scrape": True, "getaway_id": getaway_id}

    listing = await extract_villa_two_pass(extraction_md)

    title = url.split("/")[-1].split("?")[0].replace("-", " ").title()
    if not title:
        title = "Listing"
    if listing.villa_name:
        title = (listing.villa_name or "").strip() or title
    slug = generate_slug(title)

    image_urls: list[str] = []
    if getaway_id and crawl_image_urls:
        image_urls = await upload_images_to_supabase(crawl_image_urls, getaway_id, auth_token) or []
    if image_urls:
        print(f"[IMG] Uploaded {len(image_urls)} images to Supabase")

    from db import update_getaway, insert_getaway_images
    if not getaway_id or not auth_token:
        raise ValueError("getaway_id and auth_token required")

    lat, lng = None, None
    loc = (listing.location or "").strip()
    reg = (listing.region or "").strip()
    geocode_query = ", ".join(p for p in [loc, reg] if p)
    if geocode_query:
        lat, lng = geocode_location(geocode_query)
        if lat is not None:
            log.info("geocoded %r -> %.4f, %.4f", geocode_query, lat, lng)

    row = _listing_to_getaway_row(
        listing, slug=slug, source_url=url, name=title, raw_text=extraction_md,
        lat=lat, lng=lng,
    )
    update_getaway(getaway_id, row, auth_token=auth_token)
    if image_urls:
        insert_getaway_images(getaway_id, image_urls, auth_token)
    print("[OK] Success! Getaway updated in Supabase")
    return {"path": f"/getaways/{slug}", "thin_scrape": False, "getaway_id": getaway_id}


async def generate_getaway_page_from_paste(
    pasted_text: str,
    original_url: str | None = None,
    list_id: str | None = None,
    auth_token: str | None = None,
    getaway_id: str | None = None,
) -> dict:
    """Build a getaway report from pasted listing text. If getaway_id is provided, updates that getaway."""
    extraction_md = (pasted_text or "").strip()
    if not extraction_md:
        raise ValueError("Pasted text is empty.")
    log.info("manual paste: len=%d chars", len(extraction_md))

    listing = await extract_villa_two_pass(extraction_md)
    title = (listing.villa_name or "").strip() or "Manual entry"
    slug = generate_slug(title)

    og_url = await fetch_og_image(original_url)
    if og_url:
        image_candidates = [og_url]
        print("[IMG] Using og:image from original URL")
    else:
        image_candidates = extract_image_urls_from_text(extraction_md)
        if image_candidates:
            print(f"[IMG] Using {len(image_candidates)} images extracted from paste")
        else:
            print("[IMG] No images found in paste text")

    image_urls: list[str] = []
    if getaway_id and image_candidates:
        image_urls = await upload_images_to_supabase(image_candidates, getaway_id, auth_token) or []
    if image_urls:
        print(f"[IMG] Uploaded {len(image_urls)} images to Supabase")

    from db import update_getaway, insert_getaway_images
    if not getaway_id or not auth_token:
        raise ValueError("getaway_id and auth_token required")

    lat, lng = None, None
    loc = (listing.location or "").strip()
    reg = (listing.region or "").strip()
    geocode_query = ", ".join(p for p in [loc, reg] if p)
    if geocode_query:
        lat, lng = geocode_location(geocode_query)
        if lat is not None:
            log.info("geocoded %r -> %.4f, %.4f", geocode_query, lat, lng)

    row = _listing_to_getaway_row(
        listing, slug=slug, source_url=original_url or "", name=title, raw_text=pasted_text,
        lat=lat, lng=lng,
    )
    update_getaway(getaway_id, row, auth_token=auth_token)
    if image_urls:
        insert_getaway_images(getaway_id, image_urls, auth_token)
    print("[OK] Success! Getaway updated in Supabase")
    return {"path": f"/getaways/{slug}", "getaway_id": getaway_id}


if __name__ == "__main__":
    print("Scout is designed to run via the API with list_id and auth. Use POST /api/scout instead.")
