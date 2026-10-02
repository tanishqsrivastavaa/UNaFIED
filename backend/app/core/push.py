import json
from pywebpush import WebPushException, webpush
from ..config.settings import settings
from ..models.push import PushSubscription
from .logger import logger

# A reminder alert that can't reach a phone within half an hour is stale
TTL_SECONDS = 30 * 60


def push_configured() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def send_push(subscription: PushSubscription, payload: dict) -> bool:
    """Blocking; call it off the event loop. Returns False when the browser has
    dropped the subscription, so the caller deletes it. Other failures are logged."""
    try:
        webpush(
            {"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
            json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            # A fresh dict each time: webpush writes the push service's address into it.
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=TTL_SECONDS,
            # Lets a sleeping phone wake for it.
            headers={"Urgency": "high"},
            timeout=10,
        )
    except WebPushException as e:
        if e.status_code in (404, 410):
            return False
        logger.warning(f"Push to subscription {subscription.id} failed: {e}")
    except Exception:
        logger.exception(f"Push to subscription {subscription.id} failed")
    return True
