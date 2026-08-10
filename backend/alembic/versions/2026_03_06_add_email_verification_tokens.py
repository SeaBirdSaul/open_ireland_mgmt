"""
add email verification tokens table

Revision ID: 2026_03_06_add_email_verification_tokens
Revises: 2026_03_05_add_password_reset_tokens
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa

revision = "2026_03_06_add_email_verification_tokens"
down_revision = "2026_03_05_add_password_reset_tokens"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("requested_ip", sa.String(lenght=64), nullable=True),
        sa.Column("requested_user_agent", sa.String(length=512), nullable=True),
        sa.ForeignKeyContraint(["user_id"], ["user_table.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"], unique=False)
    op.create_index("ix_email_verification_tokens_token_hash", "email_verification_tokens", ["token_hash"], unique=True)
    op.create_index("ix_email_verification_tokens_expires_at", "email_verification_tokens", ["expires_at"], unique=False)
    op.create_index("ix_email_verify_user_active", "email_verification_tokens", ["user_id", "consumed_at", "expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_email_verify_user_active", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_expires_at", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_token_hash", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")