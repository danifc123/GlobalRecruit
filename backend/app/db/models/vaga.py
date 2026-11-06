import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Prioridade(str, enum.Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"


class StatusVaga(str, enum.Enum):
    ABERTA = "aberta"
    PAUSADA = "pausada"
    FECHADA = "fechada"


class Vaga(Base):
    __tablename__ = "vagas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    projeto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projetos_parceiros.id"), nullable=False, index=True
    )
    # Role ID da planilha do cliente (ex.: "DSR-001"); não é único — a
    # planilha repete o mesmo código para cargos diferentes
    codigo: Mapped[str | None] = mapped_column(String(50), index=True)
    cliente: Mapped[str] = mapped_column(String(200), nullable=False)
    cargo: Mapped[str] = mapped_column(String(200), nullable=False)
    idioma: Mapped[str | None] = mapped_column(String(200))
    pais: Mapped[str | None] = mapped_column(String(200))
    localizacao: Mapped[str | None] = mapped_column(String(200))
    modalidade: Mapped[str | None] = mapped_column(String(100))
    # headcount e data_inicio são texto livre: a planilha traz "multiple",
    # "30 per mo", "ASAP (2 HC)" além de números e datas
    headcount: Mapped[str | None] = mapped_column(String(50))
    data_inicio: Mapped[str | None] = mapped_column(Text)
    # legado: não é mais preenchido pelo formulário; faixa_salarial substitui
    salario: Mapped[float | None] = mapped_column(Numeric(12, 2))
    faixa_salarial: Mapped[str | None] = mapped_column(Text)
    moeda: Mapped[str | None] = mapped_column(String(30))
    tipo_salario: Mapped[str | None] = mapped_column(String(50))
    comissao: Mapped[float | None] = mapped_column(Numeric(12, 2))
    beneficios: Mapped[str | None] = mapped_column(Text)
    realocacao: Mapped[str | None] = mapped_column(Text)
    requisitos: Mapped[str | None] = mapped_column(Text)
    notas_internas: Mapped[str | None] = mapped_column(Text)
    jd_nome: Mapped[str | None] = mapped_column(String(300))
    jd_url: Mapped[str | None] = mapped_column(String(1000))
    prioridade: Mapped[Prioridade] = mapped_column(
        Enum(Prioridade, name="prioridade", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    status: Mapped[StatusVaga] = mapped_column(
        Enum(StatusVaga, name="status_vaga", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=StatusVaga.ABERTA,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    projeto: Mapped["ProjetoParceiro"] = relationship(back_populates="vagas")
    candidatos: Mapped[list["Candidato"]] = relationship(back_populates="vaga")
