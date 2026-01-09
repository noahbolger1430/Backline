"""add_saved_tours_table

Revision ID: 89ac9bedec4e
Revises: cdfe7705de47
Create Date: 2026-01-03 14:55:00.495578

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '89ac9bedec4e'
down_revision: Union[str, Sequence[str], None] = 'cdfe7705de47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
