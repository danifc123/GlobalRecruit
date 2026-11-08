"""cria vagas_traducoes — tradução automática (PT-BR) dos textos das vagas,
uma linha por (vaga, campo, idioma), com hash do original para saber quando
re-traduzir

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-07

Aditiva. Downgrade apaga só as traduções; os textos originais das vagas não
são tocados.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vagas_traducoes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vaga_id", UUID(as_uuid=True), sa.ForeignKey("vagas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("campo", sa.String(50), nullable=False),
        sa.Column("idioma", sa.String(10), nullable=False),
        sa.Column("hash_original", sa.String(64), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("vaga_id", "campo", "idioma", name="uq_vagas_traducoes_vaga_campo_idioma"),
    )
    op.create_index("ix_vagas_traducoes_vaga_id", "vagas_traducoes", ["vaga_id"])


def downgrade() -> None:
    op.drop_index("ix_vagas_traducoes_vaga_id", table_name="vagas_traducoes")
    op.drop_table("vagas_traducoes")
