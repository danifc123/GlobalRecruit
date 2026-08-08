"""schema inicial: projetos_parceiros, users, vagas, candidatos, pipeline_stages

Revision ID: 0001
Revises:
Create Date: 2026-08-08

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projetos_parceiros",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("cliente", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="ativo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    user_role = postgresql.ENUM("admin", "recruiter", "partner", name="user_role", create_type=False)
    user_role.create(op.get_bind())
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "partner_project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projetos_parceiros.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    prioridade = postgresql.ENUM("baixa", "media", "alta", name="prioridade", create_type=False)
    prioridade.create(op.get_bind())
    status_vaga = postgresql.ENUM(
        "aberta", "pausada", "fechada", name="status_vaga", create_type=False
    )
    status_vaga.create(op.get_bind())
    op.create_table(
        "vagas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "projeto_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projetos_parceiros.id"), nullable=False
        ),
        sa.Column("cliente", sa.String(200), nullable=False),
        sa.Column("cargo", sa.String(200), nullable=False),
        sa.Column("idioma", sa.String(50)),
        sa.Column("pais", sa.String(100)),
        sa.Column("modalidade", sa.String(50)),
        sa.Column("salario", sa.Numeric(12, 2)),
        sa.Column("comissao", sa.Numeric(12, 2)),
        sa.Column("prioridade", prioridade, nullable=False),
        sa.Column("status", status_vaga, nullable=False, server_default="aberta"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vagas_projeto_id", "vagas", ["projeto_id"])
    op.create_index("ix_vagas_status", "vagas", ["status"])
    op.create_index("ix_vagas_created_at", "vagas", ["created_at"])

    op.create_table(
        "candidatos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("vaga_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vagas.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_candidatos_vaga_id", "candidatos", ["vaga_id"])
    op.create_index("ix_candidatos_email", "candidatos", ["email"])

    estagio = postgresql.ENUM(
        "triagem", "entrevista", "proposta", "contratado", "rejeitado", name="estagio", create_type=False
    )
    estagio.create(op.get_bind())
    op.create_table(
        "pipeline_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "candidato_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidatos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("estagio", estagio, nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("ix_pipeline_stages_candidato_id", "pipeline_stages", ["candidato_id"])
    # acelera a query DISTINCT ON usada no /dashboard/stats (último estágio por candidato)
    op.create_index(
        "ix_pipeline_stages_candidato_updated",
        "pipeline_stages",
        ["candidato_id", sa.text("updated_at DESC")],
    )


def downgrade() -> None:
    op.drop_table("pipeline_stages")
    op.execute("DROP TYPE estagio")
    op.drop_table("candidatos")
    op.drop_table("vagas")
    op.execute("DROP TYPE status_vaga")
    op.execute("DROP TYPE prioridade")
    op.drop_table("users")
    op.execute("DROP TYPE user_role")
    op.drop_table("projetos_parceiros")
