"""cria app_settings — linha única (id=1) com o tema visual customizável
do sistema (admin/developer, dialog de Configurações > Aparência)

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-26

"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("primary_color", sa.String(7), nullable=True),
        sa.Column("accent_color", sa.String(7), nullable=True),
        sa.Column("success_color", sa.String(7), nullable=True),
        sa.Column("warning_color", sa.String(7), nullable=True),
        sa.Column("danger_color", sa.String(7), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute("INSERT INTO app_settings (id) VALUES (1)")


def downgrade() -> None:
    op.drop_table("app_settings")
