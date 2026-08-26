import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Estagio(str, enum.Enum):
    TRIAGEM = "triagem"
    ENTREVISTA = "entrevista"
    PROPOSTA = "proposta"
    CONTRATADO = "contratado"
    REJEITADO = "rejeitado"
    CONCLUIDO = "concluido"


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidato_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidatos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    estagio: Mapped[Estagio] = mapped_column(
        Enum(Estagio, name="estagio", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    candidato: Mapped["Candidato"] = relationship(back_populates="pipeline_stages")
