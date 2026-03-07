"""
Migration script to move existing villa data from JSON files to Supabase.

Usage:
    python migrate_to_supabase.py --user-id <your-user-uuid>

This script will:
1. Read all villa JSON files from site/villas/
2. Insert them into Supabase database
3. Associate them with the specified user_id
"""

import json
import argparse
from pathlib import Path
from db import insert_villa

VILLAS_JSON_DIR = Path("site/villas")


def migrate_villas_to_supabase(user_id: str):
    """Migrate all JSON villas to Supabase for a specific user."""
    if not VILLAS_JSON_DIR.exists():
        print(f"❌ No villas directory found at {VILLAS_JSON_DIR}")
        return

    villa_files = list(VILLAS_JSON_DIR.glob("*.json"))
    if not villa_files:
        print("❌ No villa JSON files found")
        return

    print(f"📚 Found {len(villa_files)} villa files to migrate")

    migrated = 0
    failed = 0

    for villa_file in villa_files:
        try:
            # Load villa data
            villa_data = json.loads(villa_file.read_text(encoding="utf-8"))

            # Insert into Supabase
            result = insert_villa(user_id, villa_data)
            if result:
                print(f"✅ Migrated: {villa_data.get('slug', 'unknown')}")
                migrated += 1
            else:
                print(f"⚠️  Failed to migrate: {villa_file.name}")
                failed += 1

        except Exception as e:
            print(f"❌ Error migrating {villa_file.name}: {e}")
            failed += 1

    print(f"\n📊 Migration complete!")
    print(f"   ✅ Migrated: {migrated}")
    print(f"   ❌ Failed: {failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate villa data from JSON to Supabase")
    parser.add_argument(
        "--user-id",
        required=True,
        help="Supabase user ID to associate villas with (UUID format)",
    )

    args = parser.parse_args()

    print(f"🚀 Starting migration for user: {args.user_id}")
    migrate_villas_to_supabase(args.user_id)
