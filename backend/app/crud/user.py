from datetime import datetime, timedelta, timezone
from sqlmodel import select, Session
from ..models.user import User
from ..models.token import RefreshToken
from ..schemas.user import UserCreate, LoginRequest
from ..core.security import (
    get_password_hash,
    verify_password_hash,
    create_token,
    create_refresh_token,
    hash_token,
    REFRESH_TOKEN_TIME_LIMIT,
)


async def create_user(user_data: UserCreate, session: Session) -> User | None:
    statement = select(User).where(User.email == user_data.email)
    existing_user = session.exec(statement=statement).first()

    if existing_user:
        return None

    hashed_password = get_password_hash(user_data.password)
    new_user = User(email=user_data.email, hashed_password=hashed_password)

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    return new_user


async def authenticate_user(body: LoginRequest, session: Session) -> dict | None:
    user = session.exec(select(User).where(User.email == body.email)).first()

    if not user or not verify_password_hash(body.password, user.hashed_password):
        return None

    access_token = create_token({"sub": str(user.id)})
    raw_refresh_token = create_refresh_token({"sub": str(user.id)})

    # Persist a hashed copy of the refresh token
    token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_TIME_LIMIT),
    )
    session.add(token_record)
    session.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh_token,
        "token_type": "Bearer",
    }


async def rotate_refresh_token(
    raw_token: str,
    session: Session,
) -> dict | None:
    """
    Verify, revoke the old refresh token and issue a new pair.
    Returns None if the token is invalid, expired, or revoked.
    """
    token_hash = hash_token(raw_token)

    db_token = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).first()

    if not db_token:
        return None
    if db_token.is_revoked:
        return None
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    # Revoke old token
    db_token.is_revoked = True
    session.add(db_token)

    # Issue new tokens
    new_access = create_token({"sub": str(db_token.user_id)})
    new_refresh_raw = create_refresh_token({"sub": str(db_token.user_id)})

    new_token_record = RefreshToken(
        user_id=db_token.user_id,
        token_hash=hash_token(new_refresh_raw),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_TIME_LIMIT),
    )
    session.add(new_token_record)
    session.commit()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh_raw,
        "token_type": "Bearer",
    }


async def revoke_refresh_token(raw_token: str, session: Session) -> bool:
    """Mark a refresh token as revoked (logout)."""
    token_hash = hash_token(raw_token)
    db_token = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).first()

    if not db_token or db_token.is_revoked:
        return False

    db_token.is_revoked = True
    session.add(db_token)
    session.commit()
    return True