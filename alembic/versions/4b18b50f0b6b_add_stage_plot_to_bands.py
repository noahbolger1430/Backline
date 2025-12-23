"""add_stage_plot_to_bands

Revision ID: 4b18b50f0b6b
Revises: b1e807518aa4
Create Date: 2025-12-22 17:28:11.110822

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b18b50f0b6b'
down_revision: Union[str, Sequence[str], None] = 'b1e807518aa4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
