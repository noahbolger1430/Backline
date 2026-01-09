"""add_setlist_id_to_rehearsal_attachments

Revision ID: k1l2m3n4o5p6
Revises: 01caea1f528d
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, Sequence[str], None] = '01caea1f528d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Make file_path and file_name nullable (for setlist attachments)
    op.alter_column('rehearsal_attachments', 'file_path', nullable=True, existing_type=sa.String())
    op.alter_column('rehearsal_attachments', 'file_name', nullable=True, existing_type=sa.String())
    
    # Add setlist_id column to rehearsal_attachments table
    op.add_column('rehearsal_attachments', sa.Column('setlist_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_rehearsal_attachments_setlist_id',
        'rehearsal_attachments',
        'setlists',
        ['setlist_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index(op.f('ix_rehearsal_attachments_setlist_id'), 'rehearsal_attachments', ['setlist_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_rehearsal_attachments_setlist_id'), table_name='rehearsal_attachments')
    op.drop_constraint('fk_rehearsal_attachments_setlist_id', 'rehearsal_attachments', type_='foreignkey')
    op.drop_column('rehearsal_attachments', 'setlist_id')
    
    # Revert file_path and file_name to NOT NULL (set default values first for existing nulls)
    op.execute("UPDATE rehearsal_attachments SET file_path = '' WHERE file_path IS NULL")
    op.execute("UPDATE rehearsal_attachments SET file_name = '' WHERE file_name IS NULL")
    op.alter_column('rehearsal_attachments', 'file_path', nullable=False, existing_type=sa.String())
    op.alter_column('rehearsal_attachments', 'file_name', nullable=False, existing_type=sa.String())

