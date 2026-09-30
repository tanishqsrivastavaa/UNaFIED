import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ...core.security import get_current_user
from ...core.tools import get_datetime, web_search, summarize_url
from ...db.db import get_session
from ...models.user import User

router = APIRouter(tags=["tools"])


TOOL_REGISTRY: dict[str, Any] = {
    "get_datetime": get_datetime,
    "web_search": web_search,
    "summarize_url": summarize_url,
}


class ToolExecuteRequest(BaseModel):
    tool_name: str
    parameters: dict = {}


class ToolExecuteResponse(BaseModel):
    tool_name: str
    result: str
