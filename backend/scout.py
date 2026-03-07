"""Villa scouting and data extraction engine."""
import asyncio
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
    pick_best_images_from_media, download_images, extract_image_urls_from_text, fetch_og_image
)
from utils.crawler import crawl_page
from utils.extraction import extract_villa_two_pass
from utils.persistence import save_villa_json

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("scout")


async def generate_villa_page(
    url: str,
    check_in: str | None = None,
    check_out: str | None = None,
    guests: int | None = None,
    list_id: str | None = None,
    auth_token: str | None = None,
    villa_id: str | None = None,
):
    """Scrape a villa listing URL and extract structured data.
    
    If villa_id is provided, updates that villa instead of creating a new one.
    """
    print(f"[SCOUT] Scouting: {url}")

    # Prepare URL with optional parameters
    crawl_url = add_search_params(url, check_in, check_out, guests)
    js_code = generate_js_params(check_in, check_out, guests)
    
    # For JS-heavy sites, add scroll to trigger lazy loading
    if is_js_heavy_site(crawl_url):
        scroll_js = "window.scrollTo(0, 1000);"
        js_code = f"{js_code}; {scroll_js}" if js_code else scroll_js

    # Crawl the page
    raw_markdown, media = await crawl_page(crawl_url, js_code, is_js_heavy_site(crawl_url))
    
    if not raw_markdown:
        print("[WARN] Crawl failed — skipping extraction")
        return {"path": None, "thin_scrape": True, "villa_id": villa_id}

    # Get images from crawl result
    url_slug = extract_url_slug(url)
    crawl_image_urls = pick_best_images_from_media(media, villa_name=url_slug, base_url=crawl_url)
    log.info("found %d candidate images from crawl", len(crawl_image_urls))

    # Clean and prepare markdown for extraction
    raw_markdown = strip_other_villas_block(raw_markdown)
    extraction_md = extract_main_property_only(raw_markdown)

    # Check if scrape is too thin
    if is_thin_scrape(extraction_md):
        print("[WARN] Thin scrape — skipping LLM, user will paste manually")
        return {"path": None, "thin_scrape": True, "villa_id": villa_id}

    # Extract villa data via LLM
    listing = await extract_villa_two_pass(extraction_md)

    # Generate slug and save data
    title = url.split('/')[-1].split('?')[0].replace('-', ' ').title()
    if not title:
        title = "Tuscan Villa Listing"
    if listing.villa_name:
        title = listing.villa_name

    slug = generate_slug(title)
    image_paths = await download_images(crawl_image_urls, slug)
    print(f"[IMG] Saved {len(image_paths)} images")

    # Try to import db_lists for Supabase support
    try:
        from db_lists import update_villa
        if villa_id and auth_token:
            villa_obj = listing.model_dump()
            villa_obj["title"] = title
            villa_obj["slug"] = slug
            villa_obj["original_url"] = url
            villa_obj["images"] = image_paths
            result = update_villa(villa_id, villa_obj, auth_token=auth_token)
            print(f"[OK] Success! Villa updated in Supabase")
            return {"path": f"/villas/{slug}", "thin_scrape": False, "villa_id": villa_id}
    except Exception as e:
        log.warning("failed to update villa in Supabase: %s, falling back to JSON", e)
    
    # Fallback to JSON
    save_villa_json(slug, title, listing, url, image_paths)
    print(f"[OK] Success! Villa data saved")
    return {"path": f"/villas/{slug}", "thin_scrape": False, "villa_id": villa_id}


async def generate_villa_page_from_paste(
    pasted_text: str,
    original_url: str | None = None,
    list_id: str | None = None,
    auth_token: str | None = None,
    villa_id: str | None = None,
) -> str:
    """Build a villa report from pasted listing text (e.g. copied from Airbnb).
    Skips crawling; runs the same two-pass extraction and saves the report.
    Auto-extracts image URLs from the pasted content.
    
    If villa_id is provided, updates that villa instead of creating a new one.
    """
    extraction_md = (pasted_text or "").strip()
    if not extraction_md:
        raise ValueError("Pasted text is empty.")

    log.info("manual paste: len=%d chars", len(extraction_md))

    # Extract villa data via LLM (same two-pass process)
    listing = await extract_villa_two_pass(extraction_md)

    # Generate title and slug
    title = (listing.villa_name or "").strip() or "Manual entry"
    slug = generate_slug(title)

    # Get images: try og:image first, then extract from pasted text
    og_url = await fetch_og_image(original_url)
    if og_url:
        image_candidates = [og_url]
        print(f"[IMG] Using og:image from original URL")
    else:
        image_candidates = extract_image_urls_from_text(extraction_md)
        if image_candidates:
            print(f"[IMG] Using {len(image_candidates)} images extracted from paste")
        else:
            print("[IMG] No images found in paste text")

    image_paths = await download_images(image_candidates, slug)
    if image_paths:
        print(f"[IMG] Saved {len(image_paths)} images")

    # Try to save/update in Supabase
    try:
        from db_lists import update_villa
        if villa_id and auth_token:
            villa_obj = listing.model_dump()
            villa_obj["title"] = title
            villa_obj["slug"] = slug
            villa_obj["original_url"] = original_url
            villa_obj["images"] = image_paths
            result = update_villa(villa_id, villa_obj, auth_token=auth_token)
            print(f"[OK] Success! Villa updated in Supabase")
            return {"path": f"/villas/{slug}", "villa_id": villa_id}
    except Exception as e:
        log.warning("failed to update villa in Supabase: %s, falling back to JSON", e)
    
    # Fallback to JSON
    save_villa_json(slug, title, listing, original_url, image_paths)
    print(f"[OK] Success! Villa data saved")
    return {"path": f"/villas/{slug}", "villa_id": villa_id}


if __name__ == "__main__":
    link = input("Paste the Airbnb link: ")
    asyncio.run(generate_villa_page(link))
