"""Web crawling and markdown extraction utilities."""
import logging
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, DefaultMarkdownGenerator, PruningContentFilter

log = logging.getLogger("scout.crawler")


def create_crawler_config(url: str, js_code: str = "", is_js_heavy: bool = False) -> CrawlerRunConfig:
    """Create a crawler configuration optimized for villa listing pages."""
    prune_filter = PruningContentFilter(threshold=0.45, threshold_type="dynamic")
    md_generator = DefaultMarkdownGenerator(content_filter=prune_filter)
    
    return CrawlerRunConfig(
        cache_mode="BYPASS",
        excluded_tags=["header", "footer", "nav", "form"],
        word_count_threshold=12,
        js_code=js_code if js_code else None,
        delay_before_return_html=5.0 if is_js_heavy else 2.0,
        wait_for="css:body" if is_js_heavy else None,
        wait_until="domcontentloaded",
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


async def crawl_page(url: str, js_code: str = "", is_js_heavy: bool = False) -> tuple[str, dict]:
    """Crawl a page and extract markdown and media.
    
    Returns:
        (markdown_text, media_dict)
    """
    config = create_crawler_config(url, js_code, is_js_heavy)
    raw_markdown = ""
    media = {}
    
    try:
        async with AsyncWebCrawler(config=BrowserConfig(headless=True)) as crawler:
            result = await crawler.arun(url=url, config=config)
            md = result.markdown
            raw_markdown = (getattr(md, "fit_markdown", None) or getattr(md, "raw_markdown", None) or (str(md) if md else "")) or ""
            media = result.media or {}
            log.info("crawl succeeded: %d chars markdown, %d media items", len(raw_markdown), len(media.get("images", [])))
    except Exception as e:
        log.warning("crawl failed: %s", e)
    
    return raw_markdown, media
