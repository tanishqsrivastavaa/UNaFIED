from typing import Annotated
from fastapi import Depends, APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlmodel import Session, select
from ...config.settings import settings
from ...core.push import push_configured
from ...core.security import get_current_user_hashed
from ...db.db import get_session
from ...models.push import PushSubscription
from ...models.user import User


router = APIRouter(tags=["push"])

# The server posts to whatever endpoint it is given, so only accept real push services' https URLs.
Endpoint = Annotated[str, Field(pattern=r"^https://", max_length=2048)]


class Keys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=256)
    auth: str = Field(min_length=1, max_length=256)


class Subscription(BaseModel):
    """What the browser's PushSubscription.toJSON() gives; other fields are ignored."""

    endpoint: Endpoint
    keys: Keys


class Unsubscribe(BaseModel):
    endpoint: Endpoint


@router.get("/key")
def public_key():
    """The key browsers subscribe with; null when this server has push turned off."""
    return {"public_key": settings.VAPID_PUBLIC_KEY if push_configured() else None}


@router.post("/subscriptions", status_code=204)
def subscribe(
    body: Subscription,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    found = session.exec(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)).first()
    sub = found or PushSubscription(endpoint=body.endpoint)
    # The same browser signed in as someone else now alerts them, not the last person
    sub.user_id = current_user.id
    sub.p256dh, sub.auth = body.keys.p256dh, body.keys.auth
    session.add(sub)
    session.commit()


@router.delete("/subscriptions", status_code=204)
def unsubscribe(
    body: Unsubscribe,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    session.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == body.endpoint, PushSubscription.user_id == current_user.id
        )
    )
    session.commit()
