"""Add gig_views table for recommendation system

Revision ID: g1a2b3c4d5e6
Revises: c028b66340ec
Create Date: 2024-12-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g1a2b3c4d5e6'
down_revision: Union[str, None] = 'c028b66340ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create gig_views table
    op.create_table(
        'gig_views',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('band_id', sa.Integer(), nullable=False),
        sa.Column('viewed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['band_id'], ['bands.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'band_id', 'viewed_at', name='unique_gig_view_timestamp'),
    )
    op.create_index(op.f('ix_gig_views_band_id'), 'gig_views', ['band_id'], unique=False)
    op.create_index(op.f('ix_gig_views_event_id'), 'gig_views', ['event_id'], unique=False)
    op.create_index(op.f('ix_gig_views_id'), 'gig_views', ['id'], unique=False)
    op.create_index(op.f('ix_gig_views_viewed_at'), 'gig_views', ['viewed_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_gig_views_viewed_at'), table_name='gig_views')
    op.drop_index(op.f('ix_gig_views_id'), table_name='gig_views')
    op.drop_index(op.f('ix_gig_views_event_id'), table_name='gig_views')
    op.drop_index(op.f('ix_gig_views_band_id'), table_name='gig_views')
    op.drop_table('gig_views')

