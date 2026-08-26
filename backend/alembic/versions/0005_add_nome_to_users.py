"""adiciona coluna nullable 'nome' em users — autoatualizável pelo próprio
usuário no dialog de Configurações, usuários existentes ficam sem valor

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-26

"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("nome", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "nome")
