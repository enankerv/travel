"""Tests for truncate_for_extraction (scout input limits)."""
import pytest
from unittest.mock import patch

from utils.scout_limits import truncate_for_extraction


def test_passes_through_short_text():
    """Text under limit is returned unchanged."""
    text = "Short villa listing."
    with patch("utils.scout_limits.SCOUT_MAX_INPUT_CHARS", 9000):
        assert truncate_for_extraction(text) == text


def test_passes_through_empty():
    """Empty string is returned unchanged."""
    with patch("utils.scout_limits.SCOUT_MAX_INPUT_CHARS", 9000):
        assert truncate_for_extraction("") == ""
        assert truncate_for_extraction(None or "") == ""


def test_truncates_long_text():
    """Text over limit is truncated with suffix."""
    suffix = "\n\n[... truncated for cost limits ...]"
    with patch("utils.scout_limits.SCOUT_MAX_INPUT_CHARS", 50):
        text = "x" * 100
        result = truncate_for_extraction(text)
        assert len(result) == 50
        assert result.endswith(suffix)
        assert result.startswith("x" * (50 - len(suffix)))


def test_truncates_at_exact_limit():
    """Text exactly at limit is unchanged."""
    with patch("utils.scout_limits.SCOUT_MAX_INPUT_CHARS", 20):
        text = "x" * 20
        assert truncate_for_extraction(text) == text


def test_truncates_one_over_limit():
    """Text one char over limit gets truncated."""
    with patch("utils.scout_limits.SCOUT_MAX_INPUT_CHARS", 50):
        text = "x" * 51
        result = truncate_for_extraction(text)
        assert len(result) == 50
        assert "truncated" in result
