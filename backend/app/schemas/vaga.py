import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.db.models.vaga import Prioridade, StatusVaga

# limites espelham as colunas de `vagas`; os campos Text não têm limite no
# banco, o teto de 10.000 caracteres é regra de negócio (spec vagas, P8)
MAX_CODIGO = 50
MAX_CLIENTE = 200
MAX_CARGO = 200
MAX_IDIOMA = 200
MAX_PAIS = 200
MAX_LOCALIZACAO = 200
MAX_MODALIDADE = 100
MAX_HEADCOUNT = 50
MAX_MOEDA = 30
MAX_TIPO_SALARIO = 50
MAX_JD_NOME = 300
MAX_JD_URL = 1000
MAX_TEXTO_LONGO = 10_000


class VagaCampos(BaseModel):
    """Campos editáveis da vaga, comuns a criação e edição.

    O salário numérico (legado) não entra aqui de propósito: deixou de ser
    pedido no formulário e a edição não pode apagá-lo (spec vagas).
    """

    projeto_id: uuid.UUID
    codigo: str | None = Field(default=None, max_length=MAX_CODIGO)
    cliente: str = Field(min_length=1, max_length=MAX_CLIENTE)
    cargo: str = Field(min_length=1, max_length=MAX_CARGO)
    idioma: str | None = Field(default=None, max_length=MAX_IDIOMA)
    pais: str | None = Field(default=None, max_length=MAX_PAIS)
    localizacao: str | None = Field(default=None, max_length=MAX_LOCALIZACAO)
    modalidade: str | None = Field(default=None, max_length=MAX_MODALIDADE)
    headcount: str | None = Field(default=None, max_length=MAX_HEADCOUNT)
    data_inicio: str | None = Field(default=None, max_length=MAX_TEXTO_LONGO)
    faixa_salarial: str | None = Field(default=None, max_length=MAX_TEXTO_LONGO)
    moeda: str | None = Field(default=None, max_length=MAX_MOEDA)
    tipo_salario: str | None = Field(default=None, max_length=MAX_TIPO_SALARIO)
    comissao: float | None = Field(default=None, ge=0)
    beneficios: str | None = Field(default=None, max_length=MAX_TEXTO_LONGO)
    realocacao: str | None = Field(default=None, max_length=MAX_TEXTO_LONGO)
    requisitos: str | None = Field(default=None, max_length=MAX_TEXTO_LONGO)
    notas_internas: str | None = Field(default=None, max_length=MAX_TEXTO_LONGO)
    jd_nome: str | None = Field(default=None, max_length=MAX_JD_NOME)
    jd_url: str | None = Field(default=None, max_length=MAX_JD_URL)
    prioridade: Prioridade


class VagaCreate(VagaCampos):
    pass


class VagaUpdate(VagaCampos):
    pass


class VagaOut(BaseModel):
    id: uuid.UUID
    projeto_id: uuid.UUID
    codigo: str | None
    cliente: str
    cargo: str
    idioma: str | None
    pais: str | None
    localizacao: str | None
    modalidade: str | None
    headcount: str | None
    data_inicio: str | None
    salario: float | None
    faixa_salarial: str | None
    moeda: str | None
    tipo_salario: str | None
    comissao: float | None
    beneficios: str | None
    realocacao: str | None
    requisitos: str | None
    notas_internas: str | None
    jd_nome: str | None
    jd_url: str | None
    prioridade: Prioridade
    status: StatusVaga
    created_at: datetime
    candidatos_count: int = 0
    # tradução automática PT-BR só dos campos que já têm tradução válida para
    # o texto atual (spec traducao-vagas); o frontend escolhe pelo idioma
    traducoes: dict[str, str] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class VagaPrioridadeUpdate(BaseModel):
    prioridade: Prioridade


class VagaStatusUpdate(BaseModel):
    status: StatusVaga


class VagaPage(BaseModel):
    items: list[VagaOut]
    page: int
    page_size: int
    total: int
