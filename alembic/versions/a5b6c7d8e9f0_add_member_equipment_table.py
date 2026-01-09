"""add_member_equipment_table

Revision ID: a5b6c7d8e9f0
Revises: 7ca4678e3848
Create Date: 2025-12-30 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, Sequence[str], None] = '7ca4678e3848'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create member_equipment table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'member_equipment' not in tables:
        op.create_table(
            'member_equipment',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('band_member_id', sa.Integer(), nullable=False),
            sa.Column('category', sa.String(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('brand', sa.String(length=255), nullable=True),
            sa.Column('model', sa.String(length=255), nullable=True),
            sa.Column('specs', sa.Text(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('available_for_share', sa.Integer(), nullable=True, server_default='1'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['band_member_id'], ['band_members.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_member_equipment_id'), 'member_equipment', ['id'], unique=False)
        op.create_index(op.f('ix_member_equipment_band_member_id'), 'member_equipment', ['band_member_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop member_equipment table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'member_equipment' in tables:
        op.drop_index(op.f('ix_member_equipment_band_member_id'), table_name='member_equipment')
        op.drop_index(op.f('ix_member_equipment_id'), table_name='member_equipment')
        op.drop_table('member_equipment')

