"""Merge divergent migration branches

Revision ID: 95074e84ea73
Revises: 5d449316d93c, 831d2e150938
Create Date: 2026-01-11 13:04:07.731121

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95074e84ea73'
down_revision: Union[str, Sequence[str], None] = ('5d449316d93c', '831d2e150938')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
