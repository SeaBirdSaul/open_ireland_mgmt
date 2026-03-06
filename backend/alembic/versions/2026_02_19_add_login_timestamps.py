"""Add previous_login_at and last_login_at to user_table

Revision ID: 2026_02_19_add_login_timestamp
Revises: [previous_migration_id]
Create Date: 2026-02-19

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '[auto_generated]'
down_revision = '[previous_migration_id]'  # Set to latest migration ID
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user_table', sa.Column('previous_login_at', sa.DateTime(), nullable=True))
    op.add_column('user_table', sa.Column('last_login_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('user_table', 'last_login_at')
    op.drop_column('user_table', 'previous_login_at')