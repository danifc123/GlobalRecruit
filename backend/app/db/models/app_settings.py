from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# linha única (id fixo = 1) — não é por usuário, é o tema visual pra toda a
# operação. Cores nulas = "sem override", o frontend usa o padrão de
# _tokens.scss.
APP_SETTINGS_ID = 1


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    primary_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    accent_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    success_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    warning_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    danger_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
