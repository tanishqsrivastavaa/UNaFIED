import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ...core.security import get_current_user
from ...core.tools import calculator, get_datetime, web_search, summarize_url
from ...db.db import get_session
from ...models.user import User

router = APIRouter(tags=["tools"])


TOOL_REGISTRY: dict[str, Any] = {
    "calculator": calculator,
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


@router.post("/execute", response_model=ToolExecuteResponse)
async def execute_tool(
    body: ToolExecuteRequest,
    current_user: User = Depends(get_current_user),
):
    tool_fn = TOOL_REGISTRY.get(body.tool_name)
    if not tool_fn:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tool: '{body.tool_name}'. Available: {list(TOOL_REGISTRY.keys())}",
        )

    try:
        import asyncio

        if asyncio.iscoroutinefunction(tool_fn):
            result = await tool_fn(**body.parameters)
        else:
            result = tool_fn(**body.parameters)
    except TypeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid parameters: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Tool execution error: {exc}")

    return ToolExecuteResponse(tool_name=body.tool_name, result=str(result))
