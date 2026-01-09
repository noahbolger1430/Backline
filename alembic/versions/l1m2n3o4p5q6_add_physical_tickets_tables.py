"""add_physical_tickets_tables

Revision ID: l1m2n3o4p5q6
Revises: k1l2m3n4o5p6
Create Date: 2026-01-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l1m2n3o4p5q6'
down_revision: Union[str, Sequence[str], None] = 'k1l2m3n4o5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create physical ticket tables."""
    # Create physical_ticket_pools table
    op.create_table(
        'physical_ticket_pools',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('total_quantity', sa.Integer(), nullable=False),
        sa.Column('ticket_prefix', sa.String(length=50), nullable=False),
        sa.Column('start_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('end_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id')
    )
    op.create_index(op.f('ix_physical_ticket_pools_id'), 'physical_ticket_pools', ['id'], unique=False)
    op.create_index(op.f('ix_physical_ticket_pools_event_id'), 'physical_ticket_pools', ['event_id'], unique=True)

    # Create physical_ticket_allocations table
    op.create_table(
        'physical_ticket_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ticket_pool_id', sa.Integer(), nullable=False),
        sa.Column('band_event_id', sa.Integer(), nullable=False),
        sa.Column('allocated_quantity', sa.Integer(), nullable=False),
        sa.Column('ticket_start_number', sa.Integer(), nullable=False),
        sa.Column('ticket_end_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ticket_pool_id'], ['physical_ticket_pools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['band_event_id'], ['band_events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_pool_id', 'band_event_id', name='uq_pool_band_allocation')
    )
    op.create_index(op.f('ix_physical_ticket_allocations_id'), 'physical_ticket_allocations', ['id'], unique=False)
    op.create_index(op.f('ix_physical_ticket_allocations_ticket_pool_id'), 'physical_ticket_allocations', ['ticket_pool_id'], unique=False)
    op.create_index(op.f('ix_physical_ticket_allocations_band_event_id'), 'physical_ticket_allocations', ['band_event_id'], unique=False)

    # Create physical_ticket_sales table
    op.create_table(
        'physical_ticket_sales',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('allocation_id', sa.Integer(), nullable=False),
        sa.Column('ticket_number', sa.String(length=100), nullable=False),
        sa.Column('purchaser_name', sa.String(length=255), nullable=False),
        sa.Column('purchaser_email', sa.String(length=255), nullable=True),
        sa.Column('purchaser_phone', sa.String(length=50), nullable=True),
        sa.Column('delivery_address', sa.Text(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_paid', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('delivery_assigned_to_member_id', sa.Integer(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['allocation_id'], ['physical_ticket_allocations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['delivery_assigned_to_member_id'], ['band_members.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_number')
    )
    op.create_index(op.f('ix_physical_ticket_sales_id'), 'physical_ticket_sales', ['id'], unique=False)
    op.create_index(op.f('ix_physical_ticket_sales_allocation_id'), 'physical_ticket_sales', ['allocation_id'], unique=False)
    op.create_index(op.f('ix_physical_ticket_sales_ticket_number'), 'physical_ticket_sales', ['ticket_number'], unique=True)
    op.create_index(op.f('ix_physical_ticket_sales_delivery_assigned_to_member_id'), 'physical_ticket_sales', ['delivery_assigned_to_member_id'], unique=False)
    op.create_index(op.f('ix_physical_ticket_sales_created_by_user_id'), 'physical_ticket_sales', ['created_by_user_id'], unique=False)


def downgrade() -> None:
    """Drop physical ticket tables."""
    # Drop physical_ticket_sales table
    op.drop_index(op.f('ix_physical_ticket_sales_created_by_user_id'), table_name='physical_ticket_sales')
    op.drop_index(op.f('ix_physical_ticket_sales_delivery_assigned_to_member_id'), table_name='physical_ticket_sales')
    op.drop_index(op.f('ix_physical_ticket_sales_ticket_number'), table_name='physical_ticket_sales')
    op.drop_index(op.f('ix_physical_ticket_sales_allocation_id'), table_name='physical_ticket_sales')
    op.drop_index(op.f('ix_physical_ticket_sales_id'), table_name='physical_ticket_sales')
    op.drop_table('physical_ticket_sales')

    # Drop physical_ticket_allocations table
    op.drop_index(op.f('ix_physical_ticket_allocations_band_event_id'), table_name='physical_ticket_allocations')
    op.drop_index(op.f('ix_physical_ticket_allocations_ticket_pool_id'), table_name='physical_ticket_allocations')
    op.drop_index(op.f('ix_physical_ticket_allocations_id'), table_name='physical_ticket_allocations')
    op.drop_table('physical_ticket_allocations')

    # Drop physical_ticket_pools table
    op.drop_index(op.f('ix_physical_ticket_pools_event_id'), table_name='physical_ticket_pools')
    op.drop_index(op.f('ix_physical_ticket_pools_id'), table_name='physical_ticket_pools')
    op.drop_table('physical_ticket_pools')

