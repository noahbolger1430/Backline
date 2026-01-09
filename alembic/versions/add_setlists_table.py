"""add_setlists_table

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if table already exists
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'setlists' not in tables:
        # Create setlists table
        op.create_table(
            'setlists',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('band_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('songs_json', sa.Text(), nullable=False, server_default='[]'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['band_id'], ['bands.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_setlists_id'), 'setlists', ['id'], unique=False)
        op.create_index(op.f('ix_setlists_band_id'), 'setlists', ['band_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Check if table exists before dropping
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'setlists' in tables:
        op.drop_index(op.f('ix_setlists_band_id'), table_name='setlists')
        op.drop_index(op.f('ix_setlists_id'), table_name='setlists')
        op.drop_table('setlists')

