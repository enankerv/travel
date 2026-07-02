#!/usr/bin/env python3
"""Experiment: can Gemini suggest Airbnbs and other places to stay?

Compares plain Gemini (may hallucinate URLs) vs Google Search grounding
(real web results with citations).

Run from backend/:
  python scripts/experiment_stay_suggestions.py "Cetona, Tuscany"
  python scripts/experiment_stay_suggestions.py "Chamonix, France" --guests 6 --budget "300/night"
  python scripts/experiment_stay_suggestions.py "Big Sur, CA" --search-only
  python scripts/experiment_stay_suggestions.py "Lisbon, Portugal" --plain-only

Requires GEMINI_API_KEY in .env. Optional: GEMINI_MODEL (default gemini-2.5-flash).
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import textwrap
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

URL_RE = re.compile(r"https?://[^\s\)\]\"'<>]+", re.IGNORECASE)
TITLE_RE = re.compile(r"<title[^>]*>([^<]+)</title>", re.IGNORECASE)
FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

LISTING_HOSTS = ("airbnb.", "vrbo.", "booking.com", "hotels.com", "expedia.")


def build_prompt(
    area: str,
    *,
    guests: int | None,
    check_in: str | None,
    check_out: str | None,
    budget: str | None,
    notes: str | None,
) -> str:
    lines = [
        f"I'm planning a trip near {area}.",
        "Suggest 3–5 specific places to stay (Airbnb, VRBO, boutique hotels, etc.).",
        "For each listing include: name, platform, location, sleeps/guests, price hint if known,",
        "why it fits, and a direct listing URL when you can find one.",
        "Prefer whole-home rentals with character; skip generic chain hotels unless they're standouts.",
        "If you cannot find a real URL, say so — do not invent one.",
    ]
    if guests:
        lines.append(f"Group size: {guests} guests.")
    if check_in and check_out:
        lines.append(f"Dates: {check_in} to {check_out}.")
    elif check_in:
        lines.append(f"Check-in around: {check_in}.")
    if budget:
        lines.append(f"Budget: {budget}.")
    if notes:
        lines.append(f"Other preferences: {notes}.")
    return "\n".join(lines)


def extract_urls_from_text(text: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for match in URL_RE.findall(text):
        url = match.rstrip(".,;)")
        if url not in seen:
            seen.add(url)
            out.append(url)
    return out


def extract_grounding_urls(response) -> list[tuple[str, str]]:
    """Return (title, uri) pairs from grounding metadata."""
    if not response.candidates:
        return []
    meta = getattr(response.candidates[0], "grounding_metadata", None)
    if not meta:
        return []
    pairs: list[tuple[str, str]] = []
    for chunk in getattr(meta, "grounding_chunks", None) or []:
        web = getattr(chunk, "web", None)
        if not web:
            continue
        title = getattr(web, "title", None) or "(untitled)"
        uri = getattr(web, "uri", None) or ""
        if uri:
            pairs.append((title, uri))
    return pairs


def _verdict(status: int, final_url: str, title: str) -> str:
    title_l = title.lower()
    host = urlparse(final_url).netloc.lower()

    if status == 429 or "bot or not" in title_l:
        return "blocked (bot check — URL may still be valid in a browser)"
    if status == 404 or "not found" in title_l or "404" in title_l:
        return "dead (404 / not found)"
    if status >= 400:
        return f"HTTP error ({status})"
    if "vertexaisearch.cloud.google.com" in final_url:
        return "redirect link expired or invalid"
    if any(h in host for h in LISTING_HOSTS):
        return "looks like a live listing page"
    return "loaded OK"


def verify_url(client: httpx.Client, url: str) -> dict:
    started = time.perf_counter()
    try:
        response = client.get(url)
        final_url = str(response.url)
        title = ""
        content_type = response.headers.get("content-type", "")
        if content_type.startswith("text/") or "html" in content_type:
            match = TITLE_RE.search(response.text[:100_000])
            if match:
                title = match.group(1).strip()
        return {
            "input_url": url,
            "status": response.status_code,
            "final_url": final_url,
            "title": title,
            "verdict": _verdict(response.status_code, final_url, title),
            "elapsed_s": time.perf_counter() - started,
            "error": None,
        }
    except Exception as exc:
        return {
            "input_url": url,
            "status": None,
            "final_url": None,
            "title": "",
            "verdict": "fetch failed",
            "elapsed_s": time.perf_counter() - started,
            "error": f"{type(exc).__name__}: {exc}",
        }


def print_url_checks(label: str, checks: list[dict]) -> None:
    if not checks:
        return
    print(f"\n--- URL verification: {label} ({len(checks)}) ---")
    for i, check in enumerate(checks, 1):
        print(f"\n  [{i}] {check['input_url']}")
        if check["error"]:
            print(f"      error:   {check['error']}")
        else:
            print(f"      status:  {check['status']}")
            print(f"      final:   {check['final_url']}")
            if check["title"]:
                print(f"      title:   {check['title'][:120]}")
        print(f"      verdict: {check['verdict']} ({check['elapsed_s']:.1f}s)")


def print_grounding(response) -> list[tuple[str, str]]:
    if not response.candidates:
        return []
    meta = getattr(response.candidates[0], "grounding_metadata", None)
    if not meta:
        print("\n(no grounding metadata)")
        return []

    queries = getattr(meta, "web_search_queries", None) or []
    if queries:
        print("\n--- Search queries ---")
        for q in queries:
            print(f"  • {q}")

    chunks = getattr(meta, "grounding_chunks", None) or []
    pairs: list[tuple[str, str]] = []
    if chunks:
        print(f"\n--- Sources ({len(chunks)}) ---")
        for i, chunk in enumerate(chunks, 1):
            web = getattr(chunk, "web", None)
            if not web:
                continue
            title = getattr(web, "title", None) or "(untitled)"
            uri = getattr(web, "uri", None) or ""
            print(f"  [{i}] {title}\n      {uri}")
            if uri:
                pairs.append((title, uri))
    return pairs


def verify_urls_for_response(
    http: httpx.Client,
    response,
    *,
    verify_text_urls: bool,
    verify_grounding_urls: bool,
) -> None:
    text_urls = extract_urls_from_text(response.text or "") if verify_text_urls else []
    grounding_pairs = extract_grounding_urls(response) if verify_grounding_urls else []
    grounding_urls = [uri for _, uri in grounding_pairs]

    text_checks = [verify_url(http, url) for url in text_urls]
    grounding_checks = [verify_url(http, url) for url in grounding_urls]

    print_url_checks("URLs in model text", text_checks)
    print_url_checks("Grounding citation URLs (follow redirects)", grounding_checks)

    text_ok = sum(1 for c in text_checks if "live listing" in c["verdict"] or c["verdict"] == "loaded OK")
    grounding_ok = sum(
        1 for c in grounding_checks
        if "live listing" in c["verdict"] or c["verdict"] == "loaded OK" or "blocked" in c["verdict"]
    )
    if text_checks or grounding_checks:
        print("\n--- URL summary ---")
        if text_checks:
            print(f"  Model text URLs: {text_ok}/{len(text_checks)} look usable")
        if grounding_checks:
            print(f"  Grounding URLs:  {grounding_ok}/{len(grounding_checks)} reachable (incl. bot-blocked)")
        if text_checks and text_ok < len(text_checks):
            print("  ⚠ URLs printed by Gemini in prose are often wrong even with search grounding.")
        if grounding_checks and grounding_ok >= text_ok:
            print("  → Prefer grounding citation URLs over URLs copied into the answer text.")


def run_mode(
    client: genai.Client,
    http: httpx.Client,
    prompt: str,
    *,
    label: str,
    use_search: bool,
    verify_urls: bool,
) -> None:
    print("\n" + "=" * 72)
    print(label)
    print("=" * 72)

    config = None
    if use_search:
        config = types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
        )

    started = time.perf_counter()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=config,
    )
    elapsed = time.perf_counter() - started

    text = (response.text or "").strip()
    print(textwrap.indent(text or "(empty response)", prefix="  "))
    print(f"\n--- {elapsed:.1f}s ---")

    if use_search:
        print_grounding(response)

    if verify_urls:
        verify_urls_for_response(
            http,
            response,
            verify_text_urls=True,
            verify_grounding_urls=use_search,
        )

    usage = getattr(response, "usage_metadata", None)
    if usage:
        prompt_toks = getattr(usage, "prompt_token_count", None)
        out_toks = getattr(usage, "candidates_token_count", None)
        if prompt_toks is not None or out_toks is not None:
            print(f"Tokens: prompt={prompt_toks}, output={out_toks}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Experiment with Gemini stay suggestions")
    parser.add_argument("area", help='Area to search, e.g. "Cetona, Tuscany"')
    parser.add_argument("--guests", type=int, help="Number of guests")
    parser.add_argument("--check-in", dest="check_in", help="Check-in date (free text)")
    parser.add_argument("--check-out", dest="check_out", help="Check-out date (free text)")
    parser.add_argument("--budget", help='Budget hint, e.g. "$200/night" or "€1500/week"')
    parser.add_argument("--notes", help="Extra preferences (pool, walkable, etc.)")
    parser.add_argument(
        "--search-only",
        action="store_true",
        help="Only run grounded (Google Search) mode",
    )
    parser.add_argument(
        "--plain-only",
        action="store_true",
        help="Only run plain Gemini (no search — expect hallucinated URLs)",
    )
    parser.add_argument(
        "--no-verify-urls",
        action="store_true",
        help="Skip HTTP checks on returned URLs",
    )
    args = parser.parse_args()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: set GEMINI_API_KEY in backend/.env")
        sys.exit(1)

    if args.search_only and args.plain_only:
        print("Error: use at most one of --search-only / --plain-only")
        sys.exit(1)

    prompt = build_prompt(
        args.area,
        guests=args.guests,
        check_in=args.check_in,
        check_out=args.check_out,
        budget=args.budget,
        notes=args.notes,
    )

    print(f"Model: {GEMINI_MODEL}")
    print("\n--- Prompt ---")
    print(textwrap.indent(prompt, prefix="  "))

    client = genai.Client(api_key=api_key)
    verify_urls = not args.no_verify_urls

    run_plain = not args.search_only
    run_search = not args.plain_only

    with httpx.Client(follow_redirects=True, timeout=20.0, headers=FETCH_HEADERS) as http:
        if run_plain:
            run_mode(
                client,
                http,
                prompt,
                label="PLAIN GEMINI (no web search — URLs may be hallucinated)",
                use_search=False,
                verify_urls=verify_urls,
            )

        if run_search:
            run_mode(
                client,
                http,
                prompt,
                label="GEMINI + GOOGLE SEARCH (grounded — check Sources below)",
                use_search=True,
                verify_urls=verify_urls,
            )

    if run_plain and run_search:
        print("\n" + "=" * 72)
        print("Takeaway: compare URLs above. Grounded mode cites real pages; plain mode often invents links.")
        print("=" * 72)


if __name__ == "__main__":
    main()
