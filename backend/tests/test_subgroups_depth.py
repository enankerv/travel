"""Unit tests for board subgroup depth limits."""
import pytest

from db.subgroups import (
    MAX_SUBGROUP_DEPTH,
    _depth_from_root,
    _exceeds_max_depth,
    _subtree_height,
)


def _chain_rows(depth: int) -> list[dict]:
    """Build a linear chain sg-1 → sg-2 → … of length ``depth`` (top-level = depth 1)."""
    rows = []
    for i in range(1, depth + 1):
        rows.append({
            "id": f"sg-{i}",
            "list_id": "list-1",
            "parent_subgroup_id": f"sg-{i - 1}" if i > 1 else None,
            "name": f"Level {i}",
        })
    return rows


def test_max_depth_constant():
    assert MAX_SUBGROUP_DEPTH == 5


def test_depth_from_root():
    rows = _chain_rows(3)
    assert _depth_from_root(None, rows) == 0
    assert _depth_from_root("sg-1", rows) == 1
    assert _depth_from_root("sg-3", rows) == 3


def test_subtree_height():
    rows = _chain_rows(3)
    assert _subtree_height("sg-3", rows) == 1
    assert _subtree_height("sg-1", rows) == 3


def test_create_at_max_depth_allowed():
    rows = _chain_rows(MAX_SUBGROUP_DEPTH - 1)
    parent = f"sg-{MAX_SUBGROUP_DEPTH - 1}"
    assert _depth_from_root(parent, rows) == MAX_SUBGROUP_DEPTH - 1
    assert not _exceeds_max_depth(parent, rows)


def test_create_beyond_max_depth_rejected():
    rows = _chain_rows(MAX_SUBGROUP_DEPTH)
    parent = f"sg-{MAX_SUBGROUP_DEPTH}"
    assert _exceeds_max_depth(parent, rows)


def test_move_subtree_respects_total_depth():
    rows = _chain_rows(5)
    # sg-1..sg-5 linear; moving sg-1 under sg-4 would stack 5 levels under sg-4's parent
    assert not _exceeds_max_depth("sg-3", rows, moved_subgroup_id="sg-4")
    assert _exceeds_max_depth("sg-4", rows, moved_subgroup_id="sg-1")
