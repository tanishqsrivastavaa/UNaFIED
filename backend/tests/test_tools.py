"""
Tests for the agent tools: calculator, get_datetime, web_search.
"""

import pytest
from app.core.tools import calculator, get_datetime


def test_calculator_basic():
    """Basic arithmetic should work."""
    assert calculator("2 + 2") == "4"
    assert calculator("10 * 5") == "50"
    assert calculator("100 / 4") == "25.0"


def test_calculator_advanced():
    """Math functions should work."""
    assert calculator("sqrt(144)") == "12.0"
    assert calculator("3 ** 2") == "9"
    assert calculator("abs(-42)") == "42"


def test_calculator_error():
    """Invalid expressions should return an error string, not crash."""
    result = calculator("1 / 0")
    assert "Error" in result or "division" in result.lower()


def test_calculator_caret():
    """Caret should be converted to ** for exponentiation."""
    assert calculator("2^10") == "1024"


def test_get_datetime():
    """Should return a string with the current date."""
    result = get_datetime()
    assert "UTC" in result
    assert "," in result  # e.g. "Saturday, February 22, 2026 at 05:30 UTC"


@pytest.mark.asyncio
async def test_web_search_returns_string():
    """web_search should return a non-empty string."""
    from app.core.tools import web_search

    result = await web_search("Python programming language")
    assert isinstance(result, str)
    assert len(result) > 0
