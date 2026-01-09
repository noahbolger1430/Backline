"""add_venue_favorites_table

Revision ID: 01caea1f528d
Revises: i1a2b3c4d5e6
Create Date: 2025-12-31 18:01:00.505715

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01caea1f528d'
down_revision: Union[str, Sequence[str], None] = 'i1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create venue_favorites table
    op.create_table(
        'venue_favorites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('band_id', sa.Integer(), nullable=False),
        sa.Column('venue_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['band_id'], ['bands.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['venue_id'], ['venues.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('band_id', 'venue_id', name='unique_band_venue_favorite'),
    )
    op.create_index(op.f('ix_venue_favorites_band_id'), 'venue_favorites', ['band_id'], unique=False)
    op.create_index(op.f('ix_venue_favorites_id'), 'venue_favorites', ['id'], unique=False)
    op.create_index(op.f('ix_venue_favorites_venue_id'), 'venue_favorites', ['venue_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_venue_favorites_venue_id'), table_name='venue_favorites')
    op.drop_index(op.f('ix_venue_favorites_id'), table_name='venue_favorites')
    op.drop_index(op.f('ix_venue_favorites_band_id'), table_name='venue_favorites')
    op.drop_table('venue_favorites')
