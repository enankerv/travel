"""Tests for Scout API rate limiting."""
import pytest
from unittest.mock import patch

from utils.rate_limit import check_scout_rate_limit, reset_for_tests


@pytest.fixture(autouse=True)
def reset_rate_limit():
    """Clear rate limit state before each test."""
    reset_for_tests()
    yield
    reset_for_tests()


def test_allows_requests_under_limit():
    """Within limit, all requests are allowed."""
    with patch("utils.rate_limit.SCOUT_RATE_LIMIT_PER_MIN", 3):
        assert check_scout_rate_limit("user1") is True
        assert check_scout_rate_limit("user1") is True
        assert check_scout_rate_limit("user1") is True


def test_denies_request_over_limit():
    """Over limit, request is denied."""
    with patch("utils.rate_limit.SCOUT_RATE_LIMIT_PER_MIN", 3):
        assert check_scout_rate_limit("user1") is True
        assert check_scout_rate_limit("user1") is True
        assert check_scout_rate_limit("user1") is True
        assert check_scout_rate_limit("user1") is False


def test_per_user_isolation():
    """Each user has independent limit."""
    with patch("utils.rate_limit.SCOUT_RATE_LIMIT_PER_MIN", 2):
        assert check_scout_rate_limit("user_a") is True
        assert check_scout_rate_limit("user_a") is True
        assert check_scout_rate_limit("user_a") is False
        assert check_scout_rate_limit("user_b") is True
        assert check_scout_rate_limit("user_b") is True
        assert check_scout_rate_limit("user_b") is False


def test_limit_of_one():
    """Edge case: limit of 1 allows one, denies second."""
    with patch("utils.rate_limit.SCOUT_RATE_LIMIT_PER_MIN", 1):
        assert check_scout_rate_limit("user1") is True
        assert check_scout_rate_limit("user1") is False
