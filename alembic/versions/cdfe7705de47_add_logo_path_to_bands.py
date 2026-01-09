"""add_logo_path_to_bands

Revision ID: cdfe7705de47
Revises: m1n2o3p4q5r6
Create Date: 2026-01-01 20:23:30.007727

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cdfe7705de47'
down_revision: Union[str, Sequence[str], None] = 'm1n2o3p4q5r6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('bands', sa.Column('logo_path', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('bands', 'logo_path')
