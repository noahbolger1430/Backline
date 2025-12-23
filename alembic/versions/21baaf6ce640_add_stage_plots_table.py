"""add_stage_plots_table

Revision ID: 21baaf6ce640
Revises: 4b18b50f0b6b
Create Date: 2025-12-22 17:51:18.426817

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21baaf6ce640'
down_revision: Union[str, Sequence[str], None] = '4b18b50f0b6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if table already exists (it was created manually before this migration)
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'stage_plots' not in tables:
        # Create stage_plots table
        op.create_table(
            'stage_plots',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('band_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False, server_default='Default Stage Plot'),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('items_json', sa.Text(), nullable=False, server_default='[]'),
            sa.Column('settings_json', sa.Text(), nullable=False, server_default='{}'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['band_id'], ['bands.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_stage_plots_id'), 'stage_plots', ['id'], unique=False)
        op.create_index(op.f('ix_stage_plots_band_id'), 'stage_plots', ['band_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Check if table exists before dropping
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'stage_plots' in tables:
        op.drop_index(op.f('ix_stage_plots_band_id'), table_name='stage_plots')
        op.drop_index(op.f('ix_stage_plots_id'), table_name='stage_plots')
        op.drop_table('stage_plots')
