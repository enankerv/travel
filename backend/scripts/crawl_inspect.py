"""Inspect crawl4ai output for a URL.

Run from backend dir:
  python scripts/crawl_inspect.py
  python scripts/crawl_inspect.py https://www.airbnb.com/rooms/49214793
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.crawler import create_crawler_config
from utils.urls import is_js_heavy_site
from crawl4ai import AsyncWebCrawler, BrowserConfig


async def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.airbnb.com/rooms/49214793"
    is_heavy = is_js_heavy_site(url)
    js_code = "window.scrollTo(0, 1000);" if is_heavy else ""
    config = create_crawler_config(url, js_code, is_heavy)

    print(f"Crawling: {url}")
    print(f"JS heavy: {is_heavy}")
    print("-" * 60)

    async with AsyncWebCrawler(config=BrowserConfig(headless=True)) as crawler:
        result = await crawler.arun(url=url, config=config)

    # Result attributes
    print("Result attributes:", [a for a in dir(result) if not a.startswith("_")])
    print()

    # HTML
    html = getattr(result, "html", None)
    if html:
        print(f"html length: {len(html)} chars")
        # Search for lat/lng
        import re
        lat_m = re.search(r'"lat"\s*:\s*([-0-9.]+)', html)
        lng_m = re.search(r'"lng"\s*:\s*([-0-9.]+)', html)
        if lat_m and lng_m:
            print(f"  Found lat: {lat_m.group(1)}, lng: {lng_m.group(1)}")
        else:
            print("  No lat/lng pattern found")
        # Snippet
        print("\nhtml snippet (first 500 chars):")
        print(html[:500])
        print("\n...")
    else:
        print("html: not found")

    # Markdown
    md = getattr(result, "markdown", None)
    if md:
        raw = getattr(md, "fit_markdown", None) or getattr(md, "raw_markdown", None) or str(md)
        print(f"\nmarkdown length: {len(raw)} chars")
        print("\nmarkdown snippet (first 800 chars):")
        print(raw[:800])
    else:
        print("\nmarkdown: not found")

    # Media
    media = getattr(result, "media", None) or {}
    print(f"\nmedia keys: {list(media.keys())}")
    if media.get("images"):
        print(f"  images: {len(media['images'])} items")


if __name__ == "__main__":
    asyncio.run(main())
