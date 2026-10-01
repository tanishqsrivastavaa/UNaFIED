import uuid
from typing import List, Literal, Optional
from fastapi import Depends, APIRouter, HTTPException
from sqlmodel import Session, select
from ...core.clock import utcnow
from ...core.security import get_current_user_hashed
from ...db.db import get_session
from ...models.reminder import Reminder
from ...models.user import User
from ...schemas.reminders import ReminderRead, ReminderUpdate


router = APIRouter(tags=["reminders"])


@router.get("/", response_model=List[ReminderRead])
def list_reminders(
    status: Optional[Literal["proposed", "confirmed", "sent", "dismissed"]] = None,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    query = select(Reminder).where(Reminder.user_id == current_user.id)
    if status:
        query = query.where(Reminder.status == status)
    return session.exec(query.order_by(Reminder.due_at)).all()


@router.patch("/{reminder_id}", response_model=ReminderRead)
def update_reminder(
    reminder_id: uuid.UUID,
    changes: ReminderUpdate,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    reminder = session.exec(
        select(Reminder).where(
            Reminder.id == reminder_id, Reminder.user_id == current_user.id
        )
    ).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    for field, value in changes.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(reminder, field, value)
    reminder.updated_at = utcnow()
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return reminder
