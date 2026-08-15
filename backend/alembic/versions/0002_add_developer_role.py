"""adiciona 'developer' ao enum user_role — role com acesso irrestrito

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-09

"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'developer'")


def downgrade() -> None:
    # Postgres não suporta remover valor de enum diretamente — downgrade
    # exigiria recriar o tipo do zero; deixado como no-op de propósito.
    pass
