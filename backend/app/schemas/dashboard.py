from pydantic import BaseModel


class DashboardStats(BaseModel):
    vagas_abertas: int
    candidatos_em_pipeline: int
    candidatos_contratados: int
    clientes_ativos: int
    pct_modalidade_remota: float
