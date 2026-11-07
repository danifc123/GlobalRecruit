import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VagaTraducao(Base):
    """Tradução automática de um campo de texto da vaga (spec traducao-vagas).

    `hash_original` é o SHA-256 do texto original no momento da tradução: se o
    original mudar, o hash deixa de bater e o campo volta a ficar pendente.
    """

    __tablename__ = "vagas_traducoes"
    __table_args__ = (UniqueConstraint("vaga_id", "campo", "idioma", name="uq_vagas_traducoes_vaga_campo_idioma"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vaga_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vagas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campo: Mapped[str] = mapped_column(String(50), nullable=False)
    idioma: Mapped[str] = mapped_column(String(10), nullable=False)
    hash_original: Mapped[str] = mapped_column(String(64), nullable=False)
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
