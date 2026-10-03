import asyncio
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session
from ...core.redis import get_redis
from ...config.settings import settings
from ...core.security import get_current_user, google_email_from_code
from ...db.db import get_session
from ...models.user import User
from ...schemas.user import LoginRequest, UserCreate, UserRead, PreferencesRead, PreferencesUpdate
from ...services.preferences import get_preferences
from ...core.email import email_configured
from ...core.clock import utcnow
from ...crud.user import (
    create_user,
    authenticate_user,
    authenticate_google_user,
    rotate_refresh_token,
    revoke_refresh_token,
)

router = APIRouter(tags=["users"])


@router.post("/signup", response_model=UserRead)
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


class GoogleLoginRequest(BaseModel):
    code: str


@router.get("/auth/google")
def google_client_id():
    """The client ID the sign-in button needs; null when Google sign-in is off (it takes the ID and the secret)."""
    return {"client_id": settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_SECRET else None}


@router.post("/auth/google")
async def google_login(body: GoogleLoginRequest, session: Session = Depends(get_session)):
    # Both steps call Google over the network, so keep them off the event loop.
    email = await asyncio.to_thread(google_email_from_code, body.code)
    result = await authenticate_google_user(email, session)
    if not result:
        raise HTTPException(
            status_code=409,
            detail="This email already has a password. Sign in with your email and password instead.",
        )
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


@router.get("/me", response_model=UserRead)
async def read_users_me(
    current_user: User = Depends(get_current_user),
    redis = Depends(get_redis)):
    return current_user


class TimezoneUpdate(BaseModel):
    timezone: str


@router.patch("/me", status_code=204)
async def update_my_timezone(
    body: TimezoneUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    redis = Depends(get_redis),
):
    try:
        ZoneInfo(body.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=422, detail="Unknown time zone")
    current_user.timezone = body.timezone
    session.add(current_user)
    session.commit()
    await redis.delete(f"user:{current_user.id}")  # chat routes cache the user for 5 minutes


def _preferences_read(prefs) -> PreferencesRead:
    return PreferencesRead(
        reminder_lead_minutes=prefs.reminder_lead_minutes,
        email_notifications=prefs.email_notifications,
        email_available=email_configured(),
    )


@router.get("/me/preferences", response_model=PreferencesRead)
def read_my_preferences(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return _preferences_read(get_preferences(session, current_user.id))


@router.patch("/me/preferences", response_model=PreferencesRead)
def update_my_preferences(
    changes: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    prefs = get_preferences(session, current_user.id)
    for field, value in changes.model_dump(exclude_none=True).items():
        setattr(prefs, field, value)
    prefs.updated_at = utcnow()
    session.add(prefs)
    session.commit()
    session.refresh(prefs)
    return _preferences_read(prefs)

