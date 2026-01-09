"""add_rehearsal_tables

Revision ID: 970180c05ef7
Revises: 028f0009ad52
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '970180c05ef7'
down_revision: Union[str, Sequence[str], None] = '028f0009ad52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create rehearsals table
    op.create_table(
        'rehearsals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('band_id', sa.Integer(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('is_recurring', sa.String(), nullable=False),
        sa.Column('recurrence_frequency', sa.String(), nullable=True),
        sa.Column('recurrence_start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('recurrence_end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rehearsal_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('location', sa.String(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['band_id'], ['bands.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rehearsals_id'), 'rehearsals', ['id'], unique=False)
    op.create_index(op.f('ix_rehearsals_band_id'), 'rehearsals', ['band_id'], unique=False)
    
    # Create rehearsal_instances table
    op.create_table(
        'rehearsal_instances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rehearsal_id', sa.Integer(), nullable=False),
        sa.Column('instance_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('location', sa.String(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['rehearsal_id'], ['rehearsals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rehearsal_instances_id'), 'rehearsal_instances', ['id'], unique=False)
    op.create_index(op.f('ix_rehearsal_instances_rehearsal_id'), 'rehearsal_instances', ['rehearsal_id'], unique=False)
    op.create_index(op.f('ix_rehearsal_instances_instance_date'), 'rehearsal_instances', ['instance_date'], unique=False)
    
    # Create rehearsal_attachments table
    op.create_table(
        'rehearsal_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rehearsal_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('file_name', sa.String(), nullable=False),
        sa.Column('file_type', sa.String(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('uploaded_by_user_id', sa.Integer(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['rehearsal_id'], ['rehearsals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rehearsal_attachments_id'), 'rehearsal_attachments', ['id'], unique=False)
    op.create_index(op.f('ix_rehearsal_attachments_rehearsal_id'), 'rehearsal_attachments', ['rehearsal_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_rehearsal_attachments_rehearsal_id'), table_name='rehearsal_attachments')
    op.drop_index(op.f('ix_rehearsal_attachments_id'), table_name='rehearsal_attachments')
    op.drop_table('rehearsal_attachments')
    
    op.drop_index(op.f('ix_rehearsal_instances_instance_date'), table_name='rehearsal_instances')
    op.drop_index(op.f('ix_rehearsal_instances_rehearsal_id'), table_name='rehearsal_instances')
    op.drop_index(op.f('ix_rehearsal_instances_id'), table_name='rehearsal_instances')
    op.drop_table('rehearsal_instances')
    
    op.drop_index(op.f('ix_rehearsals_band_id'), table_name='rehearsals')
    op.drop_index(op.f('ix_rehearsals_id'), table_name='rehearsals')
    op.drop_table('rehearsals')

