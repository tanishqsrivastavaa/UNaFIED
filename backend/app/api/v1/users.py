from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session
from ...core.redis import get_redis
from ...core.security import get_current_user
from ...db.db import get_session
from ...models.user import User
from ...schemas.user import LoginRequest, UserCreate
from ...crud.user import (
    create_user,
    authenticate_user,
    rotate_refresh_token,
    revoke_refresh_token,
)

router = APIRouter(tags=["users"])


@router.post("/signup", response_model=User)
async def signup(user_data: UserCreate, session: Session = Depends(get_session)):
    new_user = await create_user(user_data, session)
    if not new_user:
        raise HTTPException(status_code=401, detail="Email already registered, please login.")
    return new_user


@router.post("/login")
async def login(body: LoginRequest, session: Session = Depends(get_session)):
    result = await authenticate_user(body, session)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return result


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
async def refresh_access_token(body: RefreshRequest, session: Session = Depends(get_session)):
    """Exchange a valid refresh token for a new access token + rotated refresh token."""
    result = await rotate_refresh_token(body.refresh_token, session)
    if not result:
        raise HTTPException(
            status_code=401,
            detail="Refresh token is invalid, expired, or already revoked.",
        )
    return result


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, session: Session = Depends(get_session)):
    """Revoke the refresh token, effectively logging the user out."""
    await revoke_refresh_token(body.refresh_token, session)
    # Always 204 regardless — don't leak whether token existed


@router.get("/me")
async def read_users_me(
    current_user: User = Depends(get_current_user),
    redis = Depends(get_redis)):
    return current_user