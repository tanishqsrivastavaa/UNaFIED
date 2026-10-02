import uuid
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from ..models.user import UserPreferences


def get_preferences(session: Session, user_id: uuid.UUID) -> UserPreferences:
    """A person's settings, created with the defaults the first time they're asked for."""
    query = select(UserPreferences).where(UserPreferences.user_id == user_id)
    prefs = session.exec(query).first()
    if prefs is None:
        session.add(UserPreferences(user_id=user_id))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()  # another request created it first
        prefs = session.exec(query).one()
    return prefs
