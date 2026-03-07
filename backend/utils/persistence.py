"""Villa data persistence utilities - supports both JSON (legacy) and Supabase."""
import json
import logging
from pathlib import Path
from schema import VillaListing

log = logging.getLogger("scout.persistence")

VILLAS_JSON_DIR = Path("site/villas")

# Try to import Supabase support (optional - falls back to JSON if not available)
try:
    from db import insert_villa, get_user_villas, get_villa_by_slug, update_villa_by_slug, delete_villa_by_slug
    SUPABASE_ENABLED = True
except ImportError:
    SUPABASE_ENABLED = False
    log.warning("Supabase not configured - falling back to JSON persistence")


def save_villa_json(slug: str, title: str, listing: VillaListing, original_url: str | None, image_paths: list[str], user_id: str = None):
    """Persist structured villa data. Uses Supabase if available, otherwise JSON."""
    data = listing.model_dump()
    data["title"] = title
    data["slug"] = slug
    data["original_url"] = original_url or ""
    data["images"] = image_paths
    data["report_path"] = f"/villas/{slug}.html"
    
    # Try Supabase first if user_id provided
    if SUPABASE_ENABLED and user_id:
        try:
            result = insert_villa(user_id, data)
            if result:
                log.info("saved villa to Supabase: %s", slug)
                return
        except Exception as e:
            log.warning("failed to save villa to Supabase: %s, falling back to JSON", e)
    
    # Fallback to JSON
    VILLAS_JSON_DIR.mkdir(parents=True, exist_ok=True)
    json_path = VILLAS_JSON_DIR / f"{slug}.json"
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("saved villa JSON: %s.json", slug)


def load_villa_json(slug: str, user_id: str = None) -> dict | None:
    """Load villa data from Supabase or JSON file."""
    # Try Supabase first if user_id provided
    if SUPABASE_ENABLED and user_id:
        try:
            result = get_villa_by_slug(user_id, slug)
            if result:
                log.info("loaded villa from Supabase: %s", slug)
                return result
        except Exception as e:
            log.warning("failed to load villa from Supabase: %s, trying JSON", e)
    
    # Fallback to JSON
    json_path = VILLAS_JSON_DIR / f"{slug}.json"
    if not json_path.exists():
        return None
    try:
        return json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        log.warning("failed to load villa JSON %s: %s", slug, e)
        return None


def list_all_villas(user_id: str = None) -> list[dict]:
    """Load all villas from Supabase or JSON files."""
    # Try Supabase first if user_id provided
    if SUPABASE_ENABLED and user_id:
        try:
            villas = get_user_villas(user_id)
            log.info("loaded %d villas from Supabase", len(villas))
            return villas
        except Exception as e:
            log.warning("failed to load villas from Supabase: %s, trying JSON", e)
    
    # Fallback to JSON
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
