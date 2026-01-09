"""add_event_equipment_claims_table

Revision ID: b7c8d9e0f1a2
Revises: a5b6c7d8e9f0
Create Date: 2025-12-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, Sequence[str], None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create event_equipment_claims table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'event_equipment_claims' not in tables:
        op.create_table(
            'event_equipment_claims',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('event_id', sa.Integer(), nullable=False),
            sa.Column('equipment_id', sa.Integer(), nullable=False),
            sa.Column('band_member_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['equipment_id'], ['member_equipment.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['band_member_id'], ['band_members.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('event_id', 'equipment_id', name='uq_event_equipment_claim')
        )
        op.create_index(op.f('ix_event_equipment_claims_id'), 'event_equipment_claims', ['id'], unique=False)
        op.create_index(op.f('ix_event_equipment_claims_event_id'), 'event_equipment_claims', ['event_id'], unique=False)
        op.create_index(op.f('ix_event_equipment_claims_equipment_id'), 'event_equipment_claims', ['equipment_id'], unique=False)
        op.create_index(op.f('ix_event_equipment_claims_band_member_id'), 'event_equipment_claims', ['band_member_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop event_equipment_claims table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'event_equipment_claims' in tables:
        op.drop_index(op.f('ix_event_equipment_claims_band_member_id'), table_name='event_equipment_claims')
        op.drop_index(op.f('ix_event_equipment_claims_equipment_id'), table_name='event_equipment_claims')
        op.drop_index(op.f('ix_event_equipment_claims_event_id'), table_name='event_equipment_claims')
        op.drop_index(op.f('ix_event_equipment_claims_id'), table_name='event_equipment_claims')
        op.drop_table('event_equipment_claims')

