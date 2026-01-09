"""add_venue_equipment_table

Revision ID: c028b66340ec
Revises: b7c8d9e0f1a2
Create Date: 2025-12-30 18:07:23.337903

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c028b66340ec'
down_revision: Union[str, Sequence[str], None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create venue_equipment table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'venue_equipment' not in tables:
        op.create_table(
            'venue_equipment',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('venue_id', sa.Integer(), nullable=False),
            sa.Column('category', sa.String(), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('brand', sa.String(255), nullable=True),
            sa.Column('model', sa.String(255), nullable=True),
            sa.Column('specs', sa.Text(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['venue_id'], ['venues.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_venue_equipment_id'), 'venue_equipment', ['id'], unique=False)
        op.create_index(op.f('ix_venue_equipment_venue_id'), 'venue_equipment', ['venue_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop venue_equipment table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'venue_equipment' in tables:
        op.drop_index(op.f('ix_venue_equipment_venue_id'), table_name='venue_equipment')
        op.drop_index(op.f('ix_venue_equipment_id'), table_name='venue_equipment')
        op.drop_table('venue_equipment')
