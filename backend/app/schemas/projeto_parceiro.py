import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjetoParceiroCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    cliente: str = Field(min_length=1, max_length=200)


class ProjetoParceiroOut(BaseModel):
    id: uuid.UUID
    nome: str
    cliente: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
