"""Add gig_engagements table for ML training data collection

Revision ID: i1a2b3c4d5e6
Revises: h1a2b3c4d5e6
Create Date: 2025-12-31 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i1a2b3c4d5e6'
down_revision: Union[str, None] = 'h1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gig_engagements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('band_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('engagement_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('source', sa.String(length=50), nullable=True),
        sa.Column('list_position', sa.Integer(), nullable=True),
        sa.Column('search_query', sa.String(length=255), nullable=True),
        sa.Column('filters_applied', sa.Text(), nullable=True),
        sa.Column('recommendation_score', sa.Float(), nullable=True),
        sa.Column('session_id', sa.String(length=100), nullable=True),
        sa.Column('device_type', sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(['band_id'], ['bands.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Create indexes for common query patterns
    op.create_index('ix_gig_engagements_id', 'gig_engagements', ['id'])
    op.create_index('ix_gig_engagements_event_id', 'gig_engagements', ['event_id'])
    op.create_index('ix_gig_engagements_band_id', 'gig_engagements', ['band_id'])
    op.create_index('ix_gig_engagements_user_id', 'gig_engagements', ['user_id'])
    op.create_index('ix_gig_engagements_engagement_type', 'gig_engagements', ['engagement_type'])
    op.create_index('ix_gig_engagements_created_at', 'gig_engagements', ['created_at'])
    op.create_index('ix_gig_engagements_session_id', 'gig_engagements', ['session_id'])
    
    # Composite index for ML training data extraction
    op.create_index(
        'ix_gig_engagements_band_event_type',
        'gig_engagements',
        ['band_id', 'event_id', 'engagement_type']
    )


def downgrade() -> None:
    op.drop_index('ix_gig_engagements_band_event_type', 'gig_engagements')
    op.drop_index('ix_gig_engagements_session_id', 'gig_engagements')
    op.drop_index('ix_gig_engagements_created_at', 'gig_engagements')
    op.drop_index('ix_gig_engagements_engagement_type', 'gig_engagements')
    op.drop_index('ix_gig_engagements_user_id', 'gig_engagements')
    op.drop_index('ix_gig_engagements_band_id', 'gig_engagements')
    op.drop_index('ix_gig_engagements_event_id', 'gig_engagements')
    op.drop_index('ix_gig_engagements_id', 'gig_engagements')
    op.drop_table('gig_engagements')

