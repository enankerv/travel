"""URL manipulation and parameter handling utilities."""
import re
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse, urljoin


def add_search_params(url: str, check_in: str | None, check_out: str | None, guests: int | None) -> str:
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


def generate_js_params(check_in: str | None, check_out: str | None, guests: int | None) -> str:
    """Generate JavaScript code to set cookies for date/guest params so pages show availability/prices."""
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


def is_js_heavy_site(url: str) -> bool:
    """Check if a URL is from a JS-heavy SPA (Airbnb, VRBO) that needs special handling."""
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    return "airbnb.com" in netloc or "vrbo.com" in netloc


def extract_url_slug(url: str) -> str:
    """Derive a rough villa name from URL path for use in image filtering."""
    return url.rstrip("/").split("/")[-1].split("?")[0].split("#")[0].replace("-", " ")


def resolve_image_src(src: str, base_url: str = "") -> str:
    """Resolve a potentially relative image src against the page's base URL."""
    if src.startswith("http://") or src.startswith("https://"):
        return src
    if src.startswith("//"):
        return "https:" + src
    if base_url:
        return urljoin(base_url, src)
    return src


def generate_slug(title: str) -> str:
    """Generate a URL-safe slug from a title."""
    slug = re.sub(r"[^\w\-]", "-", title.lower().replace(" ", "-")).strip("-") or "villa"
    return slug
