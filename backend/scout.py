"""Getaway scouting and data extraction engine."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from schema import VillaListing
from utils.urls import (
    add_search_params, generate_js_params, is_js_heavy_site,
    extract_url_slug,
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
from utils.scout_limits import (
    SCOUT_MAX_INPUT_CHARS,
    truncate_for_extraction,
    truncate_for_extraction_preserving_images,
)
from utils.geocode import geocode_from_location_region
from db.scout_quota import check_and_use_quota
from models import Getaway

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("scout")


@dataclass(frozen=True)
class ScoutExtractionBundle:
    """
    Normalized input for LLM extraction + persist (URL scout and paste scout).

    Same shape for both paths: markdown for the model, image URLs to try, listing URL,
    raw text for regex price hints, and title fallback hints.
    """

    extraction_md: str
    image_candidate_urls: tuple[str, ...]
    source_url: str
    raw_text_for_price: str
    url_for_path_title: str | None
    name_if_no_villa: str


def scout_bundle_from_scrape_dict(scraped: dict) -> ScoutExtractionBundle:
    """
    Build a bundle from scrape_and_thin_check output.

    Callers must return early when ``scraped["is_thin"]`` is true (no LLM work); this
    function only validates that contract for clearer misuse errors.
    """
    md = scraped.get("extraction_md") or ""
    if scraped.get("is_thin") or not md.strip():
        raise ValueError(
            "Expected a non-thin scrape with extraction_md — handle is_thin before building a bundle."
        )
    source = scraped.get("url") or ""
    images = scraped.get("crawl_image_urls") or scraped.get("image_candidate_urls") or []
    return ScoutExtractionBundle(
        extraction_md=md,
        image_candidate_urls=tuple(images),
        source_url=source,
        raw_text_for_price=md,
        url_for_path_title=source,
        name_if_no_villa="Listing",
    )


async def scout_bundle_from_paste_inputs(
    pasted_text: str,
    original_url: str | None,
) -> ScoutExtractionBundle:
    """Normalize paste text and resolve image candidates (og:image or markdown URLs)."""
    extraction_md = prepare_manual_paste_extraction_md(pasted_text)
    listing_url = (original_url or "").strip() or None
    images = await image_candidate_urls_for_paste(extraction_md, listing_url)
    return ScoutExtractionBundle(
        extraction_md=extraction_md,
        image_candidate_urls=tuple(images),
        source_url=listing_url or "",
        raw_text_for_price=pasted_text,
        url_for_path_title=listing_url,
        name_if_no_villa="Manual entry",
    )


async def execute_scout_bundle_to_getaway(
    bundle: ScoutExtractionBundle,
    poi_id: str,
    auth_token: str,
    user_id: str | None,
) -> dict:
    """Sign-in + scout quota, then LLM extraction + DB update from a bundle."""
    if early := _early_return_unless_user_and_quota(poi_id, auth_token, user_id):
        return early
    return await _llm_extract_and_persist_from_md(
        bundle.extraction_md,
        source_url=bundle.source_url,
        raw_text_for_price=bundle.raw_text_for_price,
        image_candidate_urls=list(bundle.image_candidate_urls),
        url_for_path_title=bundle.url_for_path_title,
        name_if_no_villa=bundle.name_if_no_villa,
        poi_id=poi_id,
        auth_token=auth_token,
    )


def _listing_to_getaway_row(
    listing, source_url: str, name: str, raw_text: str | None = None,
    lat: float | None = None, lng: float | None = None,
) -> dict:
    """Map extracted VillaListing to a flat poi+getaway row.

    Keys are split across the pois spine (title/description/location/lat/lng/
    source_url) and the getaways subtype by ``db.update_getaway``; images are
    handled separately via ``insert_getaway_images``.
    """
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
        # pois spine
        "source_url": source_url,
        "title": name or (ld.get("villa_name") or "").strip() or None,
        "location": ld.get("location"),
        "description": description,
        "lat": lat,
        "lng": lng,
        # getaways subtype
        "import_status": "loaded",
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
        "caveats": ld.get("the_catch"),
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
    lat, lng = geocode_from_location_region(listing.location, listing.region)
    if lat is not None:
        q = ", ".join(
            p
            for p in [(listing.location or "").strip(), (listing.region or "").strip()]
            if p
        )
        log.info("geocoded %r -> %.4f, %.4f", q, lat, lng)
    return lat, lng


async def persist_listing_to_getaway(
    listing: VillaListing,
    *,
    name: str,
    source_url: str,
    raw_text_for_price: str | None,
    image_candidate_urls: list[str],
    poi_id: str,
    auth_token: str,
) -> dict:
    """
    Upload candidate images, geocode, map listing to row, update poi + getaway + images.
    Shared by URL scout and paste flows after LLM extraction.
    """
    image_urls: list[str] = []
    if image_candidate_urls:
        image_urls = await upload_images_to_supabase(image_candidate_urls, poi_id, auth_token) or []
    if image_urls:
        print(f"[IMG] Uploaded {len(image_urls)} images to Supabase")

    lat, lng = _geocode_listing(listing)
    row = _listing_to_getaway_row(
        listing, source_url=source_url, name=name,
        raw_text=raw_text_for_price, lat=lat, lng=lng,
    )
    if image_urls:
        row["thumbnail_url"] = image_urls[0]
    Getaway.update_by_id(poi_id, auth_token, **row)
    if image_urls:
        Getaway.replace_images_by_id(poi_id, image_urls, auth_token)
    print("[OK] Success! Getaway updated in Supabase")
    return {"path": f"/getaways/{poi_id}", "poi_id": poi_id}


def _early_return_unless_user_and_quota(
    poi_id: str | None,
    auth_token: str | None,
    user_id: str | None,
) -> dict | None:
    """
    If the user is missing or scout quota is exhausted, update the getaway (when possible)
    and return a response dict the caller should return. Otherwise return None.
    """
    err: dict = {"path": None, "poi_id": poi_id, "quota_exceeded": True}

    if not user_id:
        if poi_id and auth_token:
            Getaway.update_by_id(
                poi_id, auth_token,
                import_status="error", import_error="Sign in to scout listings.",
            )
        return err

    allowed, quota_error = check_and_use_quota(user_id)
    if not allowed:
        if poi_id and auth_token:
            Getaway.update_by_id(
                poi_id, auth_token,
                import_status="error", import_error=quota_error,
            )
        return err
    return None


async def _llm_extract_and_persist_from_md(
    extraction_md: str,
    *,
    source_url: str,
    raw_text_for_price: str | None,
    image_candidate_urls: list[str],
    url_for_path_title: str | None,
    name_if_no_villa: str,
    poi_id: str,
    auth_token: str,
) -> dict:
    """Run two-pass LLM extraction on markdown, derive title, persist row + images."""
    listing = await extract_villa_two_pass(extraction_md)
    name = _display_title_for_listing(
        listing, url_for_path_title=url_for_path_title, name_if_no_villa=name_if_no_villa,
    )
    return await persist_listing_to_getaway(
        listing,
        name=name,
        source_url=source_url,
        raw_text_for_price=raw_text_for_price,
        image_candidate_urls=image_candidate_urls or [],
        poi_id=poi_id,
        auth_token=auth_token,
    )


async def scrape_and_thin_check(
    url: str,
    check_in: str | None = None,
    check_out: str | None = None,
    guests: int | None = None,
) -> dict:
    """
    Scrape URL and run thin check.

    Returns a dict with ``is_thin``, ``url`` / ``source_url`` (listing URL), and when not thin:
    ``extraction_md``, ``crawl_image_urls`` (legacy name), and ``image_candidate_urls`` (same list
    as paste bundle field). Thin or failed crawls set text/image fields to None.
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
        return {
            "is_thin": True,
            "extraction_md": None,
            "crawl_image_urls": None,
            "image_candidate_urls": None,
            "url": url,
            "source_url": url,
        }

    url_slug = extract_url_slug(url)
    crawl_image_urls = pick_best_images_from_media(media, villa_name=url_slug, base_url=crawl_url)
    log.info("found %d candidate images from crawl", len(crawl_image_urls))

    raw_markdown = strip_other_villas_block(raw_markdown)
    extraction_md = extract_main_property_only(raw_markdown)
    extraction_md = truncate_for_extraction(extraction_md)
    if is_thin_scrape(extraction_md):
        print("[WARN] Thin scrape — skipping LLM, user will paste manually")
        return {
            "is_thin": True,
            "extraction_md": None,
            "crawl_image_urls": None,
            "image_candidate_urls": None,
            "url": url,
            "source_url": url,
        }

    return {
        "is_thin": False,
        "extraction_md": extraction_md,
        "crawl_image_urls": crawl_image_urls,
        "image_candidate_urls": crawl_image_urls,
        "url": url,
        "source_url": url,
    }


def manual_paste_exceeds_scout_input_limit(pasted_text: str | None) -> bool:
    """True when text will be truncated by prepare_manual_paste_extraction_md (same pre-truncate steps)."""
    extraction_md = (pasted_text or "").strip()
    if not extraction_md:
        return False
    extraction_md = strip_other_villas_block(extraction_md)
    extraction_md = extract_main_property_only(extraction_md)
    return len(extraction_md) > SCOUT_MAX_INPUT_CHARS


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
    poi_id: str | None = None,
    user_id: str | None = None,
):
    """Full flow: scrape, thin check, charge, LLM, update. Used when route awaits everything."""
    scraped = await scrape_and_thin_check(url, check_in, check_out, guests)
    if scraped["is_thin"]:
        return {"path": None, "thin_scrape": True, "poi_id": poi_id}

    bundle = scout_bundle_from_scrape_dict(scraped)
    result = await execute_scout_bundle_to_getaway(
        bundle, poi_id, auth_token, user_id,
    )
    return {**result, "thin_scrape": False}


async def generate_getaway_page_from_paste(
    pasted_text: str,
    original_url: str |  None = None,
    list_id: str | None = None,
    auth_token: str | None = None,
    poi_id: str | None = None,
    user_id: str | None = None,
) -> dict:
    """
    Build a getaway report from pasted listing text. Updates the given poi row.

    Mirrors generate_getaway_page: requires user_id and consumes scout quota here (not only in the route)
    so callers always hit the same billing rules.
    """
    if not (pasted_text or "").strip():
        raise ValueError("Pasted text is empty.")
    if not poi_id or not auth_token:
        raise ValueError("poi_id and auth_token required")

    bundle = await scout_bundle_from_paste_inputs(pasted_text, original_url)
    return await execute_scout_bundle_to_getaway(
        bundle, poi_id, auth_token, user_id,
    )


if __name__ == "__main__":
    print("Scout is designed to run via the API with list_id and auth. Use POST /api/scout instead.")
