"""add_image_path_to_venues

Revision ID: b0c8cce6e448
Revises: eaafa8f15afd
Create Date: 2025-12-20 12:12:01.791954

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0c8cce6e448'
down_revision: Union[str, Sequence[str], None] = 'eaafa8f15afd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
