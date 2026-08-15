"""remove papel 'partner' do enum; recrutador vira N:N com projetos_parceiros

Pré-requisito: nenhuma linha em `users` pode ter role='partner' antes de
rodar esta migration (o cast do enum quebra) — limpar/migrar essas linhas
manualmente antes.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-14

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_projetos_parceiros",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "projeto_parceiro_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projetos_parceiros.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    op.drop_column("users", "partner_project_id")

    # Postgres não permite remover valor de enum diretamente — recria o tipo
    # sem 'partner' (era 1:1 recrutador↔projeto; agora é N:N via tabela acima)
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    new_role = postgresql.ENUM("admin", "recruiter", "developer", name="user_role")
    new_role.create(op.get_bind())
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role")
    op.execute("DROP TYPE user_role_old")


def downgrade() -> None:
    op.execute("ALTER TYPE user_role RENAME TO user_role_new")
    old_role = postgresql.ENUM("admin", "recruiter", "partner", "developer", name="user_role")
    old_role.create(op.get_bind())
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role")
    op.execute("DROP TYPE user_role_new")

    op.add_column(
        "users",
        sa.Column(
            "partner_project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projetos_parceiros.id"),
            nullable=True,
        ),
    )
    op.drop_table("user_projetos_parceiros")
