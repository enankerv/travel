"""Villa data persistence utilities."""
import json
import logging
from pathlib import Path
from schema import VillaListing

log = logging.getLogger("scout.persistence")

VILLAS_JSON_DIR = Path("site/villas")


def save_villa_json(slug: str, title: str, listing: VillaListing, original_url: str | None, image_paths: list[str]):
    """Persist structured villa data as JSON so the front-end can display it in the spreadsheet."""
    VILLAS_JSON_DIR.mkdir(parents=True, exist_ok=True)
    data = listing.model_dump()
    data["title"] = title
    data["slug"] = slug
    data["original_url"] = original_url or ""
    data["images"] = image_paths
    data["report_path"] = f"/villas/{slug}.html"
    
    json_path = VILLAS_JSON_DIR / f"{slug}.json"
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("saved villa JSON: %s.json", slug)


def load_villa_json(slug: str) -> dict | None:
    """Load villa data from JSON file."""
    json_path = VILLAS_JSON_DIR / f"{slug}.json"
    if not json_path.exists():
        return None
    try:
        return json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        log.warning("failed to load villa JSON %s: %s", slug, e)
        return None


def list_all_villas() -> list[dict]:
    """Load all villa JSON files."""
    if not VILLAS_JSON_DIR.exists():
        return []
    villas = []
    for json_file in sorted(VILLAS_JSON_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
            villas.append(data)
        except Exception as e:
            log.warning("failed to load villa JSON %s: %s", json_file.name, e)
    return villas
