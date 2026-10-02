"""push subscriptions

Revision ID: 7e5b0a1c2d01
Revises: 252e69e29d3b
Create Date: 2026-10-02 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e5b0a1c2d01'
down_revision: Union[str, Sequence[str], None] = '252e69e29d3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Names match what Postgres would pick, like the rest of the schema
    op.create_table('push_subscription',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('endpoint', sa.String(), nullable=False),
    sa.Column('p256dh', sa.String(), nullable=False),
    sa.Column('auth', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='push_subscription_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='push_subscription_pkey'),
    sa.UniqueConstraint('endpoint', name='push_subscription_endpoint_key')
    )
    op.create_index('ix_push_subscription_user_id', 'push_subscription', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_push_subscription_user_id', table_name='push_subscription')
    op.drop_table('push_subscription')
