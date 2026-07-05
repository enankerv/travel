"""Board subgroup persistence — nested frames on the cork board."""
from __future__ import annotations

from db.client import get_supabase_client

_SUBGROUP_COLUMNS = (
    "id, list_id, parent_subgroup_id, name, "
    "board_x, board_y, board_w, board_h, board_z, created_at, updated_at"
)

# Top-level subgroup on the board = depth 1; max nested frames below that.
MAX_SUBGROUP_DEPTH = 5


def _bounds_valid(*, board_x: float, board_y: float, board_w: float, board_h: float) -> bool:
    return (
        0 <= board_x <= 1
        and 0 <= board_y <= 1
        and 0 < board_w <= 1
        and 0 < board_h <= 1
        and board_x + board_w <= 1.000001
        and board_y + board_h <= 1.000001
    )


def get_subgroups_for_list(list_id: str, auth_token: str) -> list[dict]:
    client = get_supabase_client(auth_token)
    response = (
        client.table("board_subgroups")
        .select(_SUBGROUP_COLUMNS)
        .eq("list_id", list_id)
        .order("board_z")
        .order("created_at")
        .execute()
    )
    return response.data or []


def get_subgroup_by_id(subgroup_id: str, auth_token: str) -> dict | None:
    client = get_supabase_client(auth_token)
    response = (
        client.table("board_subgroups")
        .select(_SUBGROUP_COLUMNS)
        .eq("id", subgroup_id)
        .execute()
    )
    if not response.data:
        return None
    return response.data[0]


def _parent_valid(list_id: str, parent_subgroup_id: str | None, auth_token: str) -> bool:
    if parent_subgroup_id is None:
        return True
    parent = get_subgroup_by_id(parent_subgroup_id, auth_token)
    return parent is not None and str(parent["list_id"]) == str(list_id)


def _would_create_cycle(
    subgroup_id: str,
    new_parent_id: str | None,
    rows: list[dict],
) -> bool:
    if new_parent_id is None:
        return False
    by_id = {str(r["id"]): r for r in rows}
    current: str | None = str(new_parent_id)
    while current:
        if current == str(subgroup_id):
            return True
        row = by_id.get(current)
        current = str(row["parent_subgroup_id"]) if row and row.get("parent_subgroup_id") else None
    return False


def _depth_from_root(subgroup_id: str | None, rows: list[dict]) -> int:
    """Depth from the board root: top-level subgroup = 1, root = 0."""
    if subgroup_id is None:
        return 0
    by_id = {str(r["id"]): r for r in rows}
    depth = 0
    current: str | None = str(subgroup_id)
    while current:
        depth += 1
        row = by_id.get(current)
        if not row:
            break
        parent = row.get("parent_subgroup_id")
        current = str(parent) if parent else None
    return depth


def _subtree_height(subgroup_id: str, rows: list[dict]) -> int:
    """Height of the subtree rooted at ``subgroup_id``, including that node."""
    by_parent: dict[str | None, list[str]] = {}
    for row in rows:
        parent = row.get("parent_subgroup_id")
        parent_key = str(parent) if parent else None
        by_parent.setdefault(parent_key, []).append(str(row["id"]))

    def height(node: str) -> int:
        children = by_parent.get(node, [])
        if not children:
            return 1
        return 1 + max(height(child) for child in children)

    return height(str(subgroup_id))


def _exceeds_max_depth(
    parent_id: str | None,
    rows: list[dict],
    *,
    moved_subgroup_id: str | None = None,
) -> bool:
    """True if placing under ``parent_id`` would exceed ``MAX_SUBGROUP_DEPTH``."""
    base_depth = _depth_from_root(parent_id, rows) + 1
    if moved_subgroup_id is None:
        return base_depth > MAX_SUBGROUP_DEPTH
    total = base_depth + _subtree_height(moved_subgroup_id, rows) - 1
    return total > MAX_SUBGROUP_DEPTH


def subgroup_belongs_to_list(subgroup_id: str, list_id: str, auth_token: str) -> bool:
    row = get_subgroup_by_id(subgroup_id, auth_token)
    return row is not None and str(row["list_id"]) == str(list_id)


def create_subgroup(
    list_id: str,
    auth_token: str,
    *,
    name: str,
    parent_subgroup_id: str | None = None,
    board_x: float = 0.35,
    board_y: float = 0.35,
    board_w: float = 0.3,
    board_h: float = 0.25,
    board_z: int = 0,
) -> dict | None:
    name = (name or "").strip()
    if not name:
        return None
    if not _bounds_valid(board_x=board_x, board_y=board_y, board_w=board_w, board_h=board_h):
        return None
    if not _parent_valid(list_id, parent_subgroup_id, auth_token):
        return None
    rows = get_subgroups_for_list(list_id, auth_token)
    if _exceeds_max_depth(parent_subgroup_id, rows):
        return None

    client = get_supabase_client(auth_token)
    response = client.table("board_subgroups").insert({
        "list_id": list_id,
        "parent_subgroup_id": parent_subgroup_id,
        "name": name,
        "board_x": board_x,
        "board_y": board_y,
        "board_w": board_w,
        "board_h": board_h,
        "board_z": board_z,
    }).execute()
    return response.data[0] if response.data else None


def update_subgroup(subgroup_id: str, auth_token: str, **fields) -> dict | None:
    current = get_subgroup_by_id(subgroup_id, auth_token)
    if not current:
        return None

    list_id = str(current["list_id"])
    data = dict(fields)

    if "name" in data and data["name"] is not None:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            return None

    if "parent_subgroup_id" in data:
        parent_id = data["parent_subgroup_id"]
        if parent_id is not None and str(parent_id) == str(subgroup_id):
            return None
        if not _parent_valid(list_id, parent_id, auth_token):
            return None
        rows = get_subgroups_for_list(list_id, auth_token)
        if _would_create_cycle(subgroup_id, parent_id, rows):
            return None
        if _exceeds_max_depth(parent_id, rows, moved_subgroup_id=subgroup_id):
            return None

    board_x = data.get("board_x", current["board_x"])
    board_y = data.get("board_y", current["board_y"])
    board_w = data.get("board_w", current["board_w"])
    board_h = data.get("board_h", current["board_h"])
    if not _bounds_valid(board_x=board_x, board_y=board_y, board_w=board_w, board_h=board_h):
        return None

    if not data:
        return current

    client = get_supabase_client(auth_token)
    response = (
        client.table("board_subgroups")
        .update(data)
        .eq("id", subgroup_id)
        .execute()
    )
    return response.data[0] if response.data else None


def delete_subgroup(subgroup_id: str, auth_token: str) -> bool:
    """Delete a subgroup (cascades child subgroups and POIs)."""
    client = get_supabase_client(auth_token)
    response = client.table("board_subgroups").delete().eq("id", subgroup_id).execute()
    return bool(response.data)
