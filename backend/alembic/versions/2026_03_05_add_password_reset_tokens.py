"""
add password reset tokens table

Revision ID: 2026_03_05_add_password_reset_tokens
Revises: 2026_02_19_add_login_timestamps
Create Date: 2020-03-05
"""

from alembix import op
import sqlalchemy as sa

revision = "2026_03_05_add_password_reset_tokens"
down_revision = "2026_02_19_add_login_timestamps"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("requested_ip", sa.String(length=512), nullable=True),
        sa.Column("requested_user_agent", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user_table.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_password_reset_tokens_user_id",
        "password_reset_tokens",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_password_reset_tokens_token_hash",
        "password_reset_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_password_reset_tokens_expires_at",
        "password_reset_tokens",
        ["expires_at"],
        unique=False,
    )
    op.create_table(
        "ix_password_reset_user_active",
        "password_reset_tokens",
        ["user_id", "consumed_at", "expires_at"],
        unique=False,
    )

def downgrade() -> None:
    op.drop_index("ix_password_reset_user_active", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_expired_at", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_token_hash", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")