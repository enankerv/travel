import asyncio
import hashlib
import json
import os
import re
import logging
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

import httpx
import instructor
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, DefaultMarkdownGenerator, PruningContentFilter
from jinja2 import Environment, FileSystemLoader

from schema import VillaListing, FactSheet

IMAGES_DIR = Path("site/images")

# Logging for extraction debugging
log = logging.getLogger("scout")

# Setup Jinja2
env = Environment(loader=FileSystemLoader('templates'))
template = env.get_template('villa.html')


def _url_with_params(url: str, check_in: str | None, check_out: str | None, guests: int | None) -> str:
    """Append check_in, check_out, guests as query params if provided."""
    if not any((check_in, check_out, guests)):
        return url
    parsed = urlparse(url)
    q = parse_qs(parsed.query)
    if check_in:
        q["check_in"] = [check_in]
    if check_out:
        q["check_out"] = [check_out]
    if guests is not None:
        q["guests"] = [str(guests)]
    new_query = urlencode(q, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _js_set_dates_guests(check_in: str | None, check_out: str | None, guests: int | None) -> str:
    """Set cookies and try to fill date/guest inputs so the page shows availability/prices."""
    parts = []
    if check_in:
        parts.append(f"document.cookie = 'check_in={check_in}; path=/';")
    if check_out:
        parts.append(f"document.cookie = 'check_out={check_out}; path=/';")
    if guests is not None:
        parts.append(f"document.cookie = 'guests={guests}; path=/';")
    if not parts:
        return ""
    return "(() => { " + " ".join(parts) + " })();"


def _strip_other_villas_block(markdown_text: str) -> str:
    """Remove the 'Other Properties' / 'More villas' / 'Recommended similar' block and any list of other villa names so the model never sees it."""
    text = markdown_text
    # Section heading + content (Other/More/Recommended similar/Related villas or properties)
    text = re.sub(
        r"\n#+\s*Other\s+(?:Top-?[Rr]ated\s+)?(?:Villas|Properties)[^\n]*\n[\s\S]*?(?=\n#+\s|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\n#+\s*More\s+(?:top-?rated\s+)?(?:villas|properties)[^\n]*\n[\s\S]*?(?=\n#+\s|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\n#+\s*Recommended similar (?:villas|properties)[^\n]*\n[\s\S]*?(?=\n#+\s|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\n(?:Recommended similar (?:villas|properties)|Similar (?:villas|properties))[:\s]*\n[\s\S]*?(?=\n\n|\n#|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    # Paragraph: "[Company] offers a range of top-rated villas in X, including A, B, C."
    text = re.sub(
        r"\n[^\n]*offers a range of top-rated villas[^\n]*(?:\n[^\n]*)*?(?=\n\n|\n#|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    # List of other villa names: "    Chianti Sanctuary Villa | Tuscany" (2+ consecutive lines of "Name | Region")
    lines = text.split("\n")
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Does this line look like "    Villa Name | Tuscany" or "- Villa Name | Tuscany"?
        if re.match(r"^\s*(?:[-*•]\s*)?.+\|\s*(?:Tuscany|Toscana)\s*$", line.strip(), re.IGNORECASE):
            # Peek ahead: is the next line also a "Name | Region" line?
            run = [line]
            j = i + 1
            while j < len(lines) and re.match(
                r"^\s*(?:[-*•]\s*)?.+\|\s*(?:Tuscany|Toscana)\s*$", lines[j].strip(), re.IGNORECASE
            ):
                run.append(lines[j])
                j += 1
            if len(run) >= 2:
                # Drop this run (other villas list)
                i = j
                continue
        out.append(line)
        i += 1
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _slice_main_property_only(markdown_text: str) -> str:
    """
    Keep only the main property block: from the first # Villa Name (or price line)
    until (not including) '## More top rated villas' / '## Other properties'.
    Also drop leading cookie banner.
    """
    text = markdown_text

    # 1. Drop leading cookie banner
    if re.search(r"We (?:value your privacy|use cookies to enhance)|This website uses (?:its own )?functional cookies", text, re.IGNORECASE):
        text = re.sub(
            r"^[\s\S]*?(?=\n#+\s+[A-Za-z]|\nFrom\s+[\d,]+)",
            "",
            text,
            flags=re.IGNORECASE,
        )
    text = text.lstrip()

    # 2. Start at first main property heading (# or ## Villa Name) or price line (From X € to Y €); include both when price comes first
    title_m = re.search(r"\n#+\s+[A-Za-z][^\n]+", text)
    price_m = re.search(r"(?:^|\n)From\s+[\d\s,]+\s*€\s+to\s+[\d\s,]+\s*€\s*/?\s*week", text, re.IGNORECASE)
    if title_m and price_m:
        start = min(title_m.start(), price_m.start())
        text = text[start :].lstrip()
    elif title_m:
        text = text[title_m.start() :].lstrip()
    elif price_m:
        text = text[price_m.start() :].lstrip()

    # 3. End before cross-sell section
    end_m = re.search(
        r"\n##\s*(?:More\s+top\s+rated\s+villas|Other\s+(?:top\s+rated\s+)?(?:villas|properties)|Recommended\s+similar)",
        text,
        re.IGNORECASE,
    )
    if end_m:
        text = text[: end_m.start()].rstrip()

    return re.sub(r"\n{3,}", "\n\n", text).strip()


async def _download_images(image_urls: list[str], slug: str, max_images: int = 1) -> list[str]:
    """Download images to site/images/<slug>/ and return relative web paths."""
    if not image_urls:
        return []
    dest = IMAGES_DIR / slug
    dest.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        for i, url in enumerate(image_urls[:max_images]):
            try:
                r = await client.get(url)
                if r.status_code != 200:
                    continue
                ct = r.headers.get("content-type", "")
                ext = ".jpg"
                if "png" in ct:
                    ext = ".png"
                elif "webp" in ct:
                    ext = ".webp"
                elif "gif" in ct:
                    ext = ".gif"
                fname = f"{i:02d}{ext}"
                (dest / fname).write_bytes(r.content)
                saved.append(f"/images/{slug}/{fname}")
                log.info("saved image %s", saved[-1])
            except Exception as e:
                log.warning("failed to download image %s: %s", url[:80], e)
    return saved


_SIZE_SUFFIX_RE = re.compile(r"[-_]\d+x\d+")  # matches -WxH or _WxH anywhere in the path
_URL_DIMS_RE = re.compile(r"[-_](\d+)x(\d+)")  # extracts width from -WxH or _WxH


def _image_base_key(src: str) -> str:
    """Normalise an image URL so different resolutions of the same photo share one key."""
    path = urlparse(src).path
    return _SIZE_SUFFIX_RE.sub("", path)


def _url_width(src: str) -> int:
    """Extract the largest width from a URL. Handles '-1024x683.jpg' and '_1920x1080_im_r7'.
    No dimensions found = treat as original/full-size."""
    matches = _URL_DIMS_RE.findall(urlparse(src).path)
    if matches:
        return max(int(w) for w, h in matches)
    return 99999


def _resolve_src(src: str, base_url: str) -> str:
    """Resolve a potentially relative image src against the page's base URL."""
    if src.startswith("http://") or src.startswith("https://"):
        return src
    if src.startswith("//"):
        return "https:" + src
    from urllib.parse import urljoin
    return urljoin(base_url, src)


def _pick_best_images_from_media(media: dict, villa_name: str = "", base_url: str = "", max_images: int = 1) -> list[str]:
    """Pick highest-scored, unique images. Dedup by base filename and prefer the largest resolution."""
    images = media.get("images", [])
    if not images:
        return []
    villa_lower = villa_name.lower().strip() if villa_name else ""

    best_per_key: dict[str, tuple[int, int, str]] = {}  # key -> (score, width, src)
    for img in images:
        raw_src = img.get("src", "")
        if not raw_src:
            continue
        src = _resolve_src(raw_src, base_url) if base_url else raw_src
        if not src.startswith("http"):
            continue
        if any(skip in src.lower() for skip in [".svg", "favicon", "pixel", "1x1", "tracking"]):
            continue
        alt = (img.get("alt") or "").lower()
        if alt and "|" in alt:
            other_name = alt.split("|")[0].strip()
            if other_name and villa_lower and other_name not in villa_lower and villa_lower not in other_name:
                continue
        key = _image_base_key(src)
        score = img.get("score", 0) or 0
        width = _url_width(src)
        prev = best_per_key.get(key)
        if prev is None or (score, width) > (prev[0], prev[1]):
            best_per_key[key] = (score, width, src)

    ranked = sorted(best_per_key.values(), key=lambda t: (t[0], t[1]), reverse=True)
    return [src for _, _, src in ranked[:max_images]]


VILLAS_JSON_DIR = Path("site/villas")


def _save_villa_json(slug: str, title: str, listing: VillaListing, original_url: str | None, image_paths: list[str]):
    """Persist structured villa data as JSON so the front-end can display it in the spreadsheet."""
    VILLAS_JSON_DIR.mkdir(parents=True, exist_ok=True)
    data = listing.model_dump()
    data["title"] = title
    data["slug"] = slug
    data["original_url"] = original_url or ""
    data["images"] = image_paths
    data["report_path"] = f"/villas/{slug}.html"
    with open(VILLAS_JSON_DIR / f"{slug}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log.info("saved villa JSON: %s.json", slug)


async def generate_villa_page(
    url: str,
    check_in: str | None = None,
    check_out: str | None = None,
    guests: int | None = None,
):
    print(f"🚀 Scouting: {url}")

    crawl_url = _url_with_params(url, check_in, check_out, guests)
    js_code = _js_set_dates_guests(check_in, check_out, guests)

    # JS-heavy SPAs (e.g. Airbnb) need wait for body, real UA, scroll to trigger lazy content
    parsed = urlparse(crawl_url)
    is_js_heavy = "airbnb.com" in parsed.netloc.lower() or "vrbo.com" in parsed.netloc.lower()

    # For Airbnb: wait for body, inject scroll to trigger lazy-loaded amenities, real-looking UA
    if is_js_heavy:
        scroll_js = "window.scrollTo(0, 1000);"
        js_code = f"{js_code}; {scroll_js}" if js_code else scroll_js

    # 1. THE EYES (Scrape) — exclude nav/header/footer; optional dates/guests via URL + cookies
    # Use fit_markdown (PruningContentFilter) to keep main content and drop low-value blocks
    prune_filter = PruningContentFilter(threshold=0.45, threshold_type="dynamic")
    md_generator = DefaultMarkdownGenerator(content_filter=prune_filter)
    run_config = CrawlerRunConfig(
        cache_mode="BYPASS",
        excluded_tags=["header", "footer", "nav", "form"],
        word_count_threshold=12,
        js_code=js_code if js_code else None,
        delay_before_return_html=5.0 if is_js_heavy else 2.0,  # hard sleep so Airbnb has time to render
        wait_for="css:body" if is_js_heavy else None,  # wait for body (or main content) before proceeding
        wait_until="domcontentloaded",  # networkidle hangs on SPAs that never stop fetching
        scan_full_page=is_js_heavy,
        scroll_delay=0.4 if is_js_heavy else 0.2,
        max_scroll_steps=20 if is_js_heavy else None,
        markdown_generator=md_generator,
        process_iframes=True,
        remove_overlay_elements=True,
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            if is_js_heavy else None
        ),
    )
    raw_markdown = ""
    crawl_image_urls: list[str] = []
    try:
        async with AsyncWebCrawler(config=BrowserConfig(headless=True)) as crawler:
            result = await crawler.arun(url=crawl_url, config=run_config)
            md = result.markdown
            raw_markdown = (getattr(md, "fit_markdown", None) or getattr(md, "raw_markdown", None) or (str(md) if md else "")) or ""
            # Derive rough villa name from URL slug for image filtering
            url_slug = url.rstrip("/").split("/")[-1].split("?")[0].split("#")[0].replace("-", " ")
            crawl_image_urls = _pick_best_images_from_media(result.media or {}, villa_name=url_slug, base_url=crawl_url)
            log.info("found %d candidate images from crawl", len(crawl_image_urls))
    except Exception as e:
        log.warning("crawl failed (will produce thin report): %s", e)
        print(f"⚠️  Crawl failed: {e}")

    # Strip cross-sell block, then keep only main property section (and drop leading cookie banner)
    raw_markdown = _strip_other_villas_block(raw_markdown)
    extraction_md = _slice_main_property_only(raw_markdown)

    word_count = len(extraction_md.split())
    thin_scrape = word_count < 30
    log.info("extraction input: len=%d chars, %d words%s", len(extraction_md), word_count, " (THIN)" if thin_scrape else "")
    log.debug("extraction snippet (first 1000 chars):\n%s", extraction_md[:1000] if len(extraction_md) > 1000 else extraction_md)

    if thin_scrape:
        print("⚠️ Thin scrape — skipping LLM, user will paste manually")
        return {"path": None, "thin_scrape": True}

    # 2. EXTRACT — Two-Pass (80/20): Markdown Fact Sheet first, then Pydantic from that
    client = instructor.from_provider("ollama/qwen3-coder:30b", mode=instructor.Mode.JSON)

    # Stage 1: Raw scrape → structured Markdown Fact Sheet (LLMs do better with Markdown first)
    print("🧠 Stage 1: Building Fact Sheet (Markdown)...")
    stage1_system = (
        "You are a professional researcher for Nankervis Digital. Your task is to extract villa data.\n\n"
        "Read the provided text.\n"
        "Find the 'Hard Facts': villa name, location, region, beds, baths, max guests, price range (EUR and USD using 1 EUR ≈ 1.16 USD), security deposit.\n"
        "Identify the 'Soft Facts': The Catch (cons/caveats), short summaries for Interiors, Exteriors, Location, plus amenities, pool features, extras, included/not included.\n"
        "Output ONLY a single structured Markdown fact sheet. Use clear section headings (## Villa Name, ## Location, ## Hard Facts, ## Amenities, ## Summaries, ## Included / Not Included, ## The Catch). "
        "Include only information that appears in the source; do not invent or guess. Do not include any conversational text—only the fact sheet."
    )
    stage1_user = (
        "Convert the following villa listing into a clean, structured Markdown fact sheet. "
        "Use only the content below. Output the fact_sheet field with that Markdown and nothing else.\n\n"
        "<villa_listing>\n" + extraction_md + "\n</villa_listing>"
    )
    fact_sheet_result = await asyncio.to_thread(
        client.create,
        model="qwen3-coder:30b",
        messages=[
            {"role": "system", "content": stage1_system},
            {"role": "user", "content": stage1_user},
        ],
        response_model=FactSheet,
        max_retries=2,
    )
    fact_sheet_md = fact_sheet_result.fact_sheet or ""
    log.info("fact sheet length: %d chars", len(fact_sheet_md))

    # Stage 2: Fact Sheet → Pydantic (JSON from clean Markdown)
    print("🧠 Stage 2: Extracting JSON from Fact Sheet...")
    stage2_system = (
        "You are a professional researcher for Nankervis Digital. Your task is to extract villa data.\n\n"
        "Read the provided Markdown fact sheet.\n"
        "Find the 'Hard Facts' (beds, baths, price, deposit).\n"
        "Identify the 'Soft Facts' (The Catch, summaries, amenities, included/not included).\n"
        "Output ONLY the JSON object with the exact keys requested. Do not include any conversational text. Do not wrap the object in a key like 'properties'."
    )
    stage2_user = (
        "Extract the villa listing into JSON from this fact sheet. Return one object with these exact keys: "
        "villa_name, location, region, max_guests, bedrooms, bathrooms, "
        "price_weekly_min_eur, price_weekly_max_eur, price_weekly_usd, security_deposit_eur, pool_features, amenities, "
        "interiors_summary, exteriors_summary, location_summary, extras, included_in_price, not_included, the_catch. "
        "Use numbers and text from the fact sheet only. If a value is missing, use null or empty list.\n\n"
        "<fact_sheet>\n" + fact_sheet_md + "\n</fact_sheet>"
    )
    listing = await asyncio.to_thread(
        client.create,
        model="qwen3-coder:30b",
        messages=[
            {"role": "system", "content": stage2_system},
            {"role": "user", "content": stage2_user},
        ],
        response_model=VillaListing,
        max_retries=2,
    )

    # Log what the model actually returned (helps debug empty fields)
    try:
        dumped = listing.model_dump()
        filled = {k: v for k, v in dumped.items() if v is not None and v != [] and v != ""}
        log.info("extraction result: %d fields filled: %s", len(filled), list(filled.keys()))
        empty = [k for k, v in dumped.items() if v is None or v == [] or v == ""]
        if empty:
            log.debug("empty fields: %s", empty)
    except Exception as e:
        log.warning("could not log extraction result: %s", e)

    # 3. THE BAKE (Generate HTML from structured data)
    title = url.split('/')[-1].split('?')[0].replace('-', ' ').title()
    if not title: title = "Tuscan Villa Listing"
    if listing.villa_name:
        title = listing.villa_name

    # Download hero images
    slug = re.sub(r"[^\w\-]", "-", title.lower().replace(" ", "-")).strip("-") or "villa"
    image_paths = await _download_images(crawl_image_urls, slug)
    print(f"📸 Saved {len(image_paths)} images")

    final_html = template.render(
        title=title,
        listing=listing,
        original_url=url,
        raw_scraped=raw_markdown,
        extraction_sent=extraction_md,
        images=image_paths,
    )

    # 4. SAVE
    os.makedirs("site/villas", exist_ok=True)
    filename = f"{slug}.html"
    filepath = os.path.join("site/villas", filename)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(final_html)

    _save_villa_json(slug, title, listing, url, image_paths)

    print(f"✅ Success! Page created at: {filepath}")
    return {"path": f"/villas/{filename}", "thin_scrape": thin_scrape}


_MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\((https?://[^\s\)]+\.(?:jpe?g|png|webp))\)", re.IGNORECASE)
_BARE_IMAGE_RE = re.compile(r"(?<!\()(?<!\])\b(https?://[^\s\)\]]+\.(?:jpe?g|png|webp))(?:\?[^\s\)\]]*)?", re.IGNORECASE)
_OG_IMAGE_RE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE)
_OG_IMAGE_RE2 = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', re.IGNORECASE)


async def _fetch_og_image(url: str) -> str | None:
    """Best-effort lightweight HTTP fetch to extract og:image from a page's static HTML.
    Won't work on heavy-JS sites like Airbnb, but catches many villa rental sites."""
    if not url:
        return None
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
            m = _OG_IMAGE_RE.search(text) or _OG_IMAGE_RE2.search(text)
            if m:
                og_url = m.group(1).replace("&amp;", "&")
                log.info("og:image found: %s", og_url[:100])
                return og_url
    except Exception as e:
        log.warning("og:image fetch failed for %s: %s", url[:80], e)
    return None

_JUNK_IMAGE_WORDS = {
    "favicon", "icon", "logo", "avatar", "badge", "sprite", "pixel",
    "1x1", "tracking", "analytics", "beacon", "spacer", "blank",
    "gravatar", "profile-pic", "emoji", "arrow", "button", "social",
    "share", "flag", "rating", "star-", "check", "bullet", "spinner",
    "loader", "placeholder", "widget", "banner-ad", "static/packages",
    "/user/", "profile_pic", "airbnb-logo", "superhog",
}


def _is_likely_property_photo(url: str) -> bool:
    """Heuristic: return True if URL looks like an actual property/listing photo."""
    low = url.lower()
    if any(junk in low for junk in _JUNK_IMAGE_WORDS):
        return False
    if low.endswith(".gif") or ".svg" in low:
        return False
    # Airbnb CDN: real property photos live under /im/pictures/ (not /static/)
    if "muscache.com" in low:
        return "/im/pictures/" in low
    return True


_AIRBNB_PHOTO_RE = re.compile(r"(https?://a0\.muscache\.com/im/pictures/[^\s\)\]\"'<>]+)", re.IGNORECASE)


def _extract_image_urls_from_text(text: str) -> list[str]:
    """Pull image URLs from pasted text, filtering out junk (icons, logos, tiny images).
    Dedupes by base key and returns up to 10."""
    raw = _MD_IMAGE_RE.findall(text) + _BARE_IMAGE_RE.findall(text) + _AIRBNB_PHOTO_RE.findall(text)
    seen_keys: set[str] = set()
    urls: list[str] = []
    for url in raw:
        if not _is_likely_property_photo(url):
            continue
        key = _image_base_key(url)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        urls.append(url)
    return urls[:10]


async def generate_villa_page_from_paste(
    pasted_text: str,
    original_url: str | None = None,
) -> str:
    """
    Build a villa report from pasted listing text (e.g. copied from Airbnb).
    Skips crawling; runs the same two-pass extraction and saves the report.
    Auto-extracts image URLs from the pasted content.
    """
    extraction_md = (pasted_text or "").strip()
    if not extraction_md:
        raise ValueError("Pasted text is empty.")

    log.info("manual paste: len=%d chars", len(extraction_md))

    # Same two-pass extraction as generate_villa_page
    client = instructor.from_provider("ollama/qwen3-coder:30b", mode=instructor.Mode.JSON)

    print("🧠 Stage 1: Building Fact Sheet (Markdown)...")
    stage1_system = (
        "You are a professional researcher for Nankervis Digital. Your task is to extract villa data.\n\n"
        "Read the provided text.\n"
        "Find the 'Hard Facts': villa name, location, region, beds, baths, max guests, price range (EUR and USD using 1 EUR ≈ 1.16 USD), security deposit.\n"
        "Identify the 'Soft Facts': The Catch (cons/caveats), short summaries for Interiors, Exteriors, Location, plus amenities, pool features, extras, included/not included.\n"
        "Output ONLY a single structured Markdown fact sheet. Use clear section headings (## Villa Name, ## Location, ## Hard Facts, ## Amenities, ## Summaries, ## Included / Not Included, ## The Catch). "
        "Include only information that appears in the source; do not invent or guess. Do not include any conversational text—only the fact sheet."
    )
    stage1_user = (
        "Convert the following villa listing into a clean, structured Markdown fact sheet. "
        "Use only the content below. Output the fact_sheet field with that Markdown and nothing else.\n\n"
        "<villa_listing>\n" + extraction_md + "\n</villa_listing>"
    )
    fact_sheet_result = await asyncio.to_thread(
        client.create,
        model="qwen3-coder:30b",
        messages=[
            {"role": "system", "content": stage1_system},
            {"role": "user", "content": stage1_user},
        ],
        response_model=FactSheet,
        max_retries=2,
    )
    fact_sheet_md = fact_sheet_result.fact_sheet or ""
    log.info("fact sheet length: %d chars", len(fact_sheet_md))

    print("🧠 Stage 2: Extracting JSON from Fact Sheet...")
    stage2_system = (
        "You are a professional researcher for Nankervis Digital. Your task is to extract villa data.\n\n"
        "Read the provided Markdown fact sheet.\n"
        "Find the 'Hard Facts' (beds, baths, price, deposit).\n"
        "Identify the 'Soft Facts' (The Catch, summaries, amenities, included/not included).\n"
        "Output ONLY the JSON object with the exact keys requested. Do not include any conversational text. Do not wrap the object in a key like 'properties'."
    )
    stage2_user = (
        "Extract the villa listing into JSON from this fact sheet. Return one object with these exact keys: "
        "villa_name, location, region, max_guests, bedrooms, bathrooms, "
        "price_weekly_min_eur, price_weekly_max_eur, price_weekly_usd, security_deposit_eur, pool_features, amenities, "
        "interiors_summary, exteriors_summary, location_summary, extras, included_in_price, not_included, the_catch. "
        "Use numbers and text from the fact sheet only. If a value is missing, use null or empty list.\n\n"
        "<fact_sheet>\n" + fact_sheet_md + "\n</fact_sheet>"
    )
    listing = await asyncio.to_thread(
        client.create,
        model="qwen3-coder:30b",
        messages=[
            {"role": "system", "content": stage2_system},
            {"role": "user", "content": stage2_user},
        ],
        response_model=VillaListing,
        max_retries=2,
    )

    title = (listing.villa_name or "").strip() or "Manual entry"
    slug = re.sub(r"[^\w\-]", "-", title.lower().replace(" ", "-")).strip("-") or "manual-entry"

    og_url = await _fetch_og_image(original_url)
    if og_url:
        image_candidates = [og_url]
        print(f"📸 Using og:image from original URL")
    else:
        image_candidates = _extract_image_urls_from_text(extraction_md)
        if image_candidates:
            print(f"📸 Using {len(image_candidates)} images extracted from paste")
        else:
            print("📸 No images found in paste text")
    image_paths = await _download_images(image_candidates, slug)
    if image_paths:
        print(f"📸 Saved {len(image_paths)} images")

    final_html = template.render(
        title=title,
        listing=listing,
        original_url=original_url or "",
        raw_scraped=extraction_md,
        extraction_sent=extraction_md,
        images=image_paths,
    )

    os.makedirs("site/villas", exist_ok=True)
    filename = f"{slug}.html"
    filepath = os.path.join("site/villas", filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(final_html)

    _save_villa_json(slug, title, listing, original_url, image_paths)

    print(f"✅ Success! Page created at: {filepath}")
    return f"/villas/{filename}"


if __name__ == "__main__":
    link = input("Paste the Airbnb link: ")
    asyncio.run(generate_villa_page(link))