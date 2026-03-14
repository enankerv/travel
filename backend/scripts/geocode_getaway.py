"""Geocode a location string.

Run from backend dir:
  python scripts/geocode_getaway.py "Cetona, Tuscany"
  python scripts/geocode_getaway.py "Bidwell, Ohio"

Requires: OPENCAGE_API_KEY in .env
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from utils.geocode import geocode


def main():
    if len(sys.argv) < 2:
        print('Usage: python scripts/geocode_getaway.py "location string"')
        sys.exit(1)

    query = " ".join(sys.argv[1:]).strip()
    if not query:
        print("Error: Location string is empty")
        sys.exit(1)

    print(f"Geocoding: {query!r}")
    lat, lng = geocode(query)

    if lat is None:
        print("No result or error")
        sys.exit(1)

    print(f"Result: {lat:.6f}, {lng:.6f}")


if __name__ == "__main__":
    main()
