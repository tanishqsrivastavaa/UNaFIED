"""
- calculator: safe math expression evaluation
- get_datetime: current date/time
- web_search: search the web via DuckDuckGo instant-answer API (no API key needed)
- summarize_url: fetch a URL and return a trimmed text summary
"""

import math
import re
from datetime import datetime, timezone
from urllib.parse import quote_plus

import httpx



_SAFE_MATH_NAMES: dict = {
    k: v
    for k, v in math.__dict__.items()
    if not k.startswith("_")
}
_SAFE_MATH_NAMES["abs"] = abs
_SAFE_MATH_NAMES["round"] = round

_SAFE_EXPR_RE = re.compile(
    r"^[\d\s\+\-\*/\.\(\),\^%e]+"
    r"|(?:sqrt|sin|cos|tan|log|log2|log10|abs|round|pi|pow|exp|ceil|floor)"
    r"*$",
    re.IGNORECASE,
)


def calculator(expression: str) -> str:
    expr = expression.replace("^", "**")
    try:
        result = eval(expr, {"__builtins__": {}}, _SAFE_MATH_NAMES)  # noqa: S307
        return str(result)
    except Exception as exc:
        return f"Error evaluating '{expression}': {exc}"




def get_datetime() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%A, %B %d, %Y at %H:%M UTC")


_DDG_URL = "https://api.duckduckgo.com/"

# Need to add caching *redis

async def web_search(query: str) -> str:
    params = {"q": query, "format": "json", "no_html": 1, "skip_disambig": 1}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(_DDG_URL, params=params)
        resp.raise_for_status()
        data = resp.json()


    if data.get("AbstractText"):
        source = data.get("AbstractSource", "")
        url = data.get("AbstractURL", "")
        return f"{data['AbstractText']}\n\nSource: {source} ({url})"


    topics = data.get("RelatedTopics", [])
    if topics:
        lines = []
        for topic in topics[:5]:
            if "Text" in topic:
                first_url = topic.get("FirstURL", "")
                lines.append(f"• {topic['Text']}  ({first_url})")
        if lines:
            return "\n".join(lines)

    return "No results found. Try rephrasing your query."



async def summarize_url(url: str) -> str:

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "UNaFIED-Bot/1.0"})
            resp.raise_for_status()
            text = resp.text


        text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.S)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        if len(text) > 1500:
            text = text[:1500] + "…"

        return text if text else "Could not extract text from the page."

    except Exception as exc:
        return f"Error fetching URL: {exc}"