"""
Tests for the agent tools: calculator, get_datetime, web_search.
"""

import pytest
from app.core.tools import get_datetime


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
