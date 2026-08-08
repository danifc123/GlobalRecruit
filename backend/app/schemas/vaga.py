import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.db.models.vaga import Prioridade, StatusVaga


class VagaCreate(BaseModel):
    projeto_id: uuid.UUID
    cliente: str = Field(min_length=1, max_length=200)
    cargo: str = Field(min_length=1, max_length=200)
    idioma: str | None = Field(default=None, max_length=50)
    pais: str | None = Field(default=None, max_length=100)
    modalidade: str | None = Field(default=None, max_length=50)
    salario: float | None = Field(default=None, ge=0)
    comissao: float | None = Field(default=None, ge=0)
    prioridade: Prioridade


class VagaOut(BaseModel):
    id: uuid.UUID
    projeto_id: uuid.UUID
    cliente: str
    cargo: str
    idioma: str | None
    pais: str | None
    modalidade: str | None
    salario: float | None
    comissao: float | None
    prioridade: Prioridade
    status: StatusVaga
    created_at: datetime

    model_config = {"from_attributes": True}


class VagaPage(BaseModel):
    items: list[VagaOut]
    page: int
    page_size: int
    total: int
