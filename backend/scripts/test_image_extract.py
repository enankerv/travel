#!/usr/bin/env python3
"""Test image extraction from pasted text. Run with a sample paste to debug.

Usage:
  python scripts/test_image_extract.py                    # Read from stdin
  python scripts/test_image_extract.py sample.txt         # Read from file
  python scripts/test_image_extract.py --sample          # Run with built-in Airbnb sample

No backend deps required - uses same regex patterns as utils.images.
"""
import re
import sys
import os

# Same patterns as backend/utils/images.py
MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\((https?://[^\s\)]+\.(?:jpe?g|png|webp))\)", re.IGNORECASE)
BARE_IMAGE_RE = re.compile(r"(?<!\()(?<!\])\b(https?://[^\s\)\]]+\.(?:jpe?g|png|webp))(?:\?[^\s\)\]]*)?", re.IGNORECASE)
# Current: only a0. Airbnb also uses a1, a2 - we'll test both
AIRBNB_PHOTO_RE_OLD = re.compile(r"(https?://a0\.muscache\.com/im/pictures/[^\s\)\]\"'<>]+)", re.IGNORECASE)
AIRBNB_PHOTO_RE_NEW = re.compile(r"(https?://a[0-9]?\.?muscache\.com/im/pictures/[^\s\)\]\"'<>]+)", re.IGNORECASE)

SAMPLE_AIRBNB_PASTE = """
Villa Example - Stunning Tuscan Retreat
4 bedrooms · 4 bathrooms · Sleeps 8

$4,200/week

Beautiful villa with pool. Lorem ipsum...

https://a0.muscache.com/im/pictures/abc123-1024x683.jpg
https://a1.muscache.com/im/pictures/xyz789.jpg?im_w=1200
"""


def main():
    if "--sample" in sys.argv:
        text = SAMPLE_AIRBNB_PASTE
        print("=== Using built-in sample ===\n")
    elif len(sys.argv) > 1 and sys.argv[1] != "--sample":
        with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        print(f"=== Read {len(text)} chars from {sys.argv[1]} ===\n")
    else:
        print("Paste your content below, then press Ctrl+D (Unix) or Ctrl+Z+Enter (Windows) to finish:\n")
        text = sys.stdin.read()

    print(f"Input length: {len(text)} chars")
    print(f"First 500 chars:\n{repr(text[:500])}\n")

    # Raw regex matches
    md_matches = MD_IMAGE_RE.findall(text)
    bare_matches = BARE_IMAGE_RE.findall(text)
    airbnb_old = AIRBNB_PHOTO_RE_OLD.findall(text)
    airbnb_new = AIRBNB_PHOTO_RE_NEW.findall(text)

    print("--- Raw regex matches ---")
    print(f"MD_IMAGE_RE (![alt](url)): {len(md_matches)}")
    for u in md_matches[:5]:
        print(f"  {u[:100]}...")
    print(f"BARE_IMAGE_RE (plain .jpg/.png/.webp): {len(bare_matches)}")
    for u in bare_matches[:5]:
        print(f"  {u[:100]}...")
    print(f"AIRBNB a0.muscache only: {len(airbnb_old)}")
    for u in airbnb_old[:5]:
        print(f"  {u[:100]}...")
    print(f"AIRBNB a[0-9].muscache (broad): {len(airbnb_new)}")
    for u in airbnb_new[:5]:
        print(f"  {u[:100]}...")

    if not (md_matches or bare_matches or airbnb_new):
        print("\n*** No image URLs found in paste ***")
        print("\nLikely cause: Pasting into a textarea only gives plain text.")
        print("Airbnb's 'Copy' may not include image URLs in the plain-text clipboard.")
        print("\nFix: Update PasteModal to use onPaste + clipboardData.getData('text/html')")
        print("     to extract <img src> URLs when HTML is available in the clipboard.")


if __name__ == "__main__":
    main()
