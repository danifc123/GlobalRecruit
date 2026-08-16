import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.db.models.pipeline_stage import Estagio


class CandidatoCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    email: EmailStr
    vaga_id: uuid.UUID


class PipelineStageOut(BaseModel):
    id: uuid.UUID
    estagio: Estagio
    updated_at: datetime

    model_config = {"from_attributes": True}


class OutraCandidatura(BaseModel):
    id: uuid.UUID
    vaga_id: uuid.UUID
    vaga_cargo: str
    vaga_cliente: str
    estagio_atual: Estagio | None

    model_config = {"from_attributes": True}


class CandidatoOut(BaseModel):
    id: uuid.UUID
    nome: str
    email: EmailStr
    vaga_id: uuid.UUID
    created_at: datetime
    estagio_atual: Estagio | None
    historico: list[PipelineStageOut] = []
    outras_candidaturas: list[OutraCandidatura] = []

    model_config = {"from_attributes": True}


class PipelineStageUpdate(BaseModel):
    estagio: Estagio
