"""adiciona em vagas os campos da planilha do cliente (código, localização,
headcount, faixa salarial em texto, etc.) e amplia idioma/país/modalidade;
copia o salário numérico existente para faixa_salarial

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-06

Downgrade: remove as colunas novas e volta idioma(50)/pais(100)/
modalidade(50) — falha se já houver valor maior que esses tamanhos (ex.:
vindo da importação). Nesse caso, encurte os valores antes de descer.
"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

_NOVAS_COLUNAS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("codigo", sa.String(50)),
    ("localizacao", sa.String(200)),
    ("headcount", sa.String(50)),
    ("data_inicio", sa.Text()),
    ("faixa_salarial", sa.Text()),
    ("moeda", sa.String(30)),
    ("tipo_salario", sa.String(50)),
    ("beneficios", sa.Text()),
    ("realocacao", sa.Text()),
    ("requisitos", sa.Text()),
    ("notas_internas", sa.Text()),
    ("jd_nome", sa.String(300)),
    ("jd_url", sa.String(1000)),
)


def upgrade() -> None:
    for nome, tipo in _NOVAS_COLUNAS:
        op.add_column("vagas", sa.Column(nome, tipo, nullable=True))
    op.create_index("ix_vagas_codigo", "vagas", ["codigo"])

    op.alter_column("vagas", "idioma", type_=sa.String(200), existing_type=sa.String(50), existing_nullable=True)
    op.alter_column("vagas", "pais", type_=sa.String(200), existing_type=sa.String(100), existing_nullable=True)
    op.alter_column("vagas", "modalidade", type_=sa.String(100), existing_type=sa.String(50), existing_nullable=True)

    # salario continua existindo; faixa_salarial passa a ser o campo exibido
    op.execute("UPDATE vagas SET faixa_salarial = salario::text WHERE salario IS NOT NULL")


def downgrade() -> None:
    op.alter_column("vagas", "modalidade", type_=sa.String(50), existing_type=sa.String(100), existing_nullable=True)
    op.alter_column("vagas", "pais", type_=sa.String(100), existing_type=sa.String(200), existing_nullable=True)
    op.alter_column("vagas", "idioma", type_=sa.String(50), existing_type=sa.String(200), existing_nullable=True)

    op.drop_index("ix_vagas_codigo", table_name="vagas")
    for nome, _tipo in reversed(_NOVAS_COLUNAS):
        op.drop_column("vagas", nome)
