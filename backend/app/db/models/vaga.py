import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
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
    cliente: Mapped[str] = mapped_column(String(200), nullable=False)
    cargo: Mapped[str] = mapped_column(String(200), nullable=False)
    idioma: Mapped[str | None] = mapped_column(String(50))
    pais: Mapped[str | None] = mapped_column(String(100))
    modalidade: Mapped[str | None] = mapped_column(String(50))
    salario: Mapped[float | None] = mapped_column(Numeric(12, 2))
    comissao: Mapped[float | None] = mapped_column(Numeric(12, 2))
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
