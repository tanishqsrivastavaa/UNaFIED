import os
import hashlib
from fastapi import Depends, HTTPException
from sqlmodel import Session, select
from dotenv import load_dotenv
import jwt
from jwt import PyJWTError
from datetime import datetime, timedelta, timezone
from fastapi.security import HTTPBearer
from passlib.context import CryptContext
from typing import Any
from app.db.db import get_session
from app.models.user import User
from ..config.settings import settings
import json
from ..core.redis import get_redis
import redis.asyncio as aioredis

load_dotenv()

SECRET_AUTH_KEY = settings.SECRET_AUTH_KEY
REFRESH_SECRET_KEY = os.getenv("REFRESH_SECRET_KEY", SECRET_AUTH_KEY + "_refresh")

ALGORITHM = "HS256"
ACCESS_TOKEN_TIME_LIMIT = 15  # 15 minutes
REFRESH_TOKEN_TIME_LIMIT = 60 * 24 * 7  # 7 days

bearer_scheme = HTTPBearer()


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password_hash(plain_password: str, hash_password: str) -> bool:
    return pwd_context.verify(plain_password, hash_password)



def create_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_TIME_LIMIT)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_AUTH_KEY, ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_TIME_LIMIT)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, REFRESH_SECRET_KEY, ALGORITHM)


def verify_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_AUTH_KEY, algorithms=[ALGORITHM])
        return payload
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


def verify_refresh_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, REFRESH_SECRET_AUTH_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate refresh token")


# --- Get Current User ---


def get_current_user(
    token: str = Depends(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        token_string = token.credentials
        payload = jwt.decode(token_string, SECRET_AUTH_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401, detail="Invalid authentication credentials"
            )

        user = session.exec(select(User).where(User.id == user_id)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except PyJWTError:
        raise HTTPException(
            status_code=401, detail="Could not validate credentials"
        )


async def get_current_user_hashed(
    token: str = Depends(bearer_scheme),
    session: Session = Depends(get_session),
    redis: aioredis.Redis = Depends(get_redis)
):

    try:
        token_string = token.credentials
        payload = jwt.decode(token_string, SECRET_AUTH_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    cache_key = f"user:{user_id}"
    cached = await redis.get(cache_key)
    if cached:
        return User(**json.loads(cached))

    user = session.exec(select(User).where(User.id==user_id)).first()

    if not user:
        raise HTTPException(statuscode=401,detail="User not found")
    
    await redis.setex(cache_key,300,user.model_dump_json())

    return user