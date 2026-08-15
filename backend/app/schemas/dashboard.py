import uuid

from pydantic import BaseModel


class VagaPorIdioma(BaseModel):
    idioma: str
    count: int


class CandidatoParado(BaseModel):
    id: uuid.UUID
    nome: str
    vaga_cargo: str
    dias_parado: int


class VagaSemCandidato(BaseModel):
    id: uuid.UUID
    cargo: str
    cliente: str


class DashboardStats(BaseModel):
    vagas_abertas: int
    vagas_alta_prioridade: int
    candidatos_em_pipeline: int
    candidatos_contratados: int
    clientes_ativos: int
    pct_modalidade_remota: float
    vagas_por_idioma: list[VagaPorIdioma] = []
    candidatos_parados: list[CandidatoParado] = []
    vagas_sem_candidato: list[VagaSemCandidato] = []
