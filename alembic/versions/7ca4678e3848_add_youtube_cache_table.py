"""add_youtube_cache_table

Revision ID: 7ca4678e3848
Revises: 7898ff772b66
Create Date: 2025-12-29 23:45:14.641729

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ca4678e3848'
down_revision: Union[str, Sequence[str], None] = '7898ff772b66'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create youtube_cache table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'youtube_cache' not in tables:
        op.create_table(
            'youtube_cache',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('setlist_id', sa.Integer(), nullable=False),
            sa.Column('song_title', sa.String(length=255), nullable=False),
            sa.Column('song_artist', sa.String(length=255), nullable=False, server_default=''),
            sa.Column('video_id', sa.String(length=50), nullable=True),
            sa.Column('video_title', sa.String(length=500), nullable=True),
            sa.Column('channel_title', sa.String(length=255), nullable=True),
            sa.Column('thumbnail_url', sa.Text(), nullable=True),
            sa.Column('found', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['setlist_id'], ['setlists.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('setlist_id', 'song_title', 'song_artist', name='uq_youtube_cache_setlist_song')
        )
        op.create_index(op.f('ix_youtube_cache_id'), 'youtube_cache', ['id'], unique=False)
        op.create_index(op.f('ix_youtube_cache_setlist_id'), 'youtube_cache', ['setlist_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop youtube_cache table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'youtube_cache' in tables:
        op.drop_index(op.f('ix_youtube_cache_setlist_id'), table_name='youtube_cache')
        op.drop_index(op.f('ix_youtube_cache_id'), table_name='youtube_cache')
        op.drop_table('youtube_cache')
