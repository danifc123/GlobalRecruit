"""adiciona 'concluido' ao enum estagio — usado quando uma vaga é
reativada e fecha o processo dos candidatos ainda em andamento

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-26

"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE estagio ADD VALUE IF NOT EXISTS 'concluido'")


def downgrade() -> None:
    # Postgres não suporta remover valor de enum diretamente — downgrade
    # exigiria recriar o tipo do zero; deixado como no-op de propósito
    # (mesmo padrão da 0002).
    pass
