"""participant last read

Revision ID: 8f6c1b2d3e02
Revises: 7e5b0a1c2d01
Create Date: 2026-10-02 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f6c1b2d3e02'
down_revision: Union[str, Sequence[str], None] = '7e5b0a1c2d01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('conversation_participant', sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=True))
    # Start everyone caught up, so existing chats don't all turn unread at once
    op.execute("UPDATE conversation_participant SET last_read_at = CURRENT_TIMESTAMP")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('conversation_participant', 'last_read_at')
