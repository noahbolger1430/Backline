"""add_is_delivered_to_ticket_sales

Revision ID: m1n2o3p4q5r6
Revises: l1m2n3o4p5q6
Create Date: 2026-01-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm1n2o3p4q5r6'
down_revision: Union[str, Sequence[str], None] = 'l1m2n3o4p5q6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_delivered field to physical_ticket_sales table."""
    op.add_column('physical_ticket_sales', sa.Column('is_delivered', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    """Remove is_delivered field from physical_ticket_sales table."""
    op.drop_column('physical_ticket_sales', 'is_delivered')

