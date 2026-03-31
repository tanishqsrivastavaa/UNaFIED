"""
WebSocket authentication helpers
"""

import uuid
from fastapi import HTTPException, Query
from sqlmodel import Session, select
import jwt
from jwt import PyJWTError
from app.models.user import User
from app.core.security import SECRET_AUTH_KEY, ALGORITHM


async def authenticate_ws_token(token: str, session: Session) -> User:
    """
    Authenticate WebSocket connection using JWT token.
    Token is passed as query parameter.
    """
    try:
        payload = jwt.decode(token, SECRET_AUTH_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = session.exec(select(User).where(User.id == uuid.UUID(user_id))).first()

        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate token")
