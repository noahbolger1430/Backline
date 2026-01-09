"""Add genre_tags field to events for recommendation matching

Revision ID: h1a2b3c4d5e6
Revises: g1a2b3c4d5e6
Create Date: 2025-12-31 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h1a2b3c4d5e6'
down_revision: Union[str, None] = 'g1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add genre_tags column to events table
    op.add_column('events', sa.Column('genre_tags', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('events', 'genre_tags')

