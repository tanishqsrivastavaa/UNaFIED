"""utc timestamps and user timezone

Revision ID: 7a1afef9e0dc
Revises: 32e2f58d7ee6
Create Date: 2026-10-01 05:04:59.811627

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1afef9e0dc'
down_revision: Union[str, Sequence[str], None] = '32e2f58d7ee6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ("user", "created_at"),
    ("user_preferences", "created_at"),
    ("user_preferences", "updated_at"),
    ("refresh_token", "created_at"),
    ("refresh_token", "expires_at"),
    ("calendar_event", "start_time"),
    ("calendar_event", "end_time"),
    ("calendar_event", "created_at"),
    ("conversation", "created_at"),
    ("conversation", "updated_at"),
    ("message", "created_at"),
    ("conversation_participant", "joined_at"),
    ("conversation_participant", "left_at"),
    ("uploaded_file", "uploaded_at"),
]


def upgrade() -> None:
    """Upgrade schema."""
    # Existing values were written on a UTC machine into a GMT session, so they are already UTC.
    for table, column in COLUMNS:
        op.alter_column(
            table, column,
            type_=sa.DateTime(timezone=True),
            existing_type=sa.DateTime(),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )
    op.add_column("user", sa.Column("timezone", sa.String(), nullable=False, server_default="UTC"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("user", "timezone")
    for table, column in COLUMNS:
        op.alter_column(
            table, column,
            type_=sa.DateTime(),
            existing_type=sa.DateTime(timezone=True),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )
