"""add_instance_id_to_rehearsal_attachments

Revision ID: f1a2b3c4d5e6
Revises: 970180c05ef7, 8e7d91915a1d
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = ['970180c05ef7', '8e7d91915a1d']
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add instance_id column to rehearsal_attachments table
    op.add_column('rehearsal_attachments', sa.Column('instance_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_rehearsal_attachments_instance_id',
        'rehearsal_attachments',
        'rehearsal_instances',
        ['instance_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index(op.f('ix_rehearsal_attachments_instance_id'), 'rehearsal_attachments', ['instance_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_rehearsal_attachments_instance_id'), table_name='rehearsal_attachments')
    op.drop_constraint('fk_rehearsal_attachments_instance_id', 'rehearsal_attachments', type_='foreignkey')
    op.drop_column('rehearsal_attachments', 'instance_id')

