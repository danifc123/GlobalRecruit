"""Converte uma linha crua da planilha nos dados de uma vaga (ou em erro).

Regras na spec `importacao-vagas`: normalização, mapeamento de status e de
prioridade, linhas ignoradas e com erro, limites de tamanho.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime

from app.db.models.vaga import Prioridade, StatusVaga
from app.schemas import vaga as limites
from app.services.importacao_vagas.leitura import Coluna, LinhaPlanilha

_VALORES_VAZIOS = frozenset({"", "NA", "N/A"})
_FORMATO_DATA = "%d/%m/%Y"

# coluna da planilha -> atributo de texto da vaga
COLUNA_PARA_CAMPO: dict[Coluna, str] = {
    Coluna.ID: "codigo",
    Coluna.CLIENT: "cliente",
    Coluna.ROLE: "cargo",
    Coluna.LANGUAGE: "idioma",
    Coluna.JD: "jd_nome",
    Coluna.COUNTRY: "pais",
    Coluna.LOCATION: "localizacao",
    Coluna.ONSITE_REMOTE: "modalidade",
    Coluna.HEADCOUNT: "headcount",
    Coluna.START_DATE: "data_inicio",
    Coluna.SALARY_BUDGET: "faixa_salarial",
    Coluna.CURRENCY: "moeda",
    Coluna.SALARY_TYPE: "tipo_salario",
    Coluna.OTHER_BENEFITS: "beneficios",
    Coluna.RELOCATION_DETAILS: "realocacao",
    Coluna.KEY_REQUIREMENTS: "requisitos",
    Coluna.INTERNAL_NOTES: "notas_internas",
    Coluna.JD_PDF_URL: "jd_url",
}

LIMITE_POR_CAMPO: dict[str, int] = {
    "codigo": limites.MAX_CODIGO,
    "cliente": limites.MAX_CLIENTE,
    "cargo": limites.MAX_CARGO,
    "idioma": limites.MAX_IDIOMA,
    "pais": limites.MAX_PAIS,
    "localizacao": limites.MAX_LOCALIZACAO,
    "modalidade": limites.MAX_MODALIDADE,
    "headcount": limites.MAX_HEADCOUNT,
    "data_inicio": limites.MAX_TEXTO_LONGO,
    "faixa_salarial": limites.MAX_TEXTO_LONGO,
    "moeda": limites.MAX_MOEDA,
    "tipo_salario": limites.MAX_TIPO_SALARIO,
    "beneficios": limites.MAX_TEXTO_LONGO,
    "realocacao": limites.MAX_TEXTO_LONGO,
    "requisitos": limites.MAX_TEXTO_LONGO,
    "notas_internas": limites.MAX_TEXTO_LONGO,
    "jd_nome": limites.MAX_JD_NOME,
    "jd_url": limites.MAX_JD_URL,
}

_STATUS_POR_TEXTO: dict[str, StatusVaga] = {
    "OPEN": StatusVaga.ABERTA,
    "CLOSE": StatusVaga.FECHADA,
    "CLOSED": StatusVaga.FECHADA,
    "ON-HOLD": StatusVaga.PAUSADA,
    "ON HOLD": StatusVaga.PAUSADA,
    "HOLD": StatusVaga.PAUSADA,
    "PAUSED": StatusVaga.PAUSADA,
}

_PRIORIDADE_POR_TEXTO: dict[str, Prioridade] = {
    "URGENT": Prioridade.ALTA,
    "ACTIVE": Prioridade.MEDIA,
    "LOW PRIORITY": Prioridade.BAIXA,
}

_SINONIMOS_MOEDA: dict[str, str] = {"EURO": "EUR"}


@dataclass(frozen=True)
class VagaDaPlanilha:
    linha: int
    campos: dict[str, str | None]  # chaves de COLUNA_PARA_CAMPO presentes na planilha
    status: StatusVaga | None  # None = STATUS vazio (decisão P2 fica com quem aplica)
    prioridade: Prioridade | None  # None = vazia ou desconhecida (P4)


@dataclass(frozen=True)
class LinhaIgnorada:
    linha: int
    codigo: str | None
    cliente: str | None


@dataclass(frozen=True)
class ErroLinha:
    linha: int
    motivo: str


ResultadoLinha = VagaDaPlanilha | LinhaIgnorada | ErroLinha


def texto(valor: object) -> str | None:
    """Valor de célula como texto limpo; None para vazio, "NA" e "N/A"."""
    if valor is None:
        return None
    if isinstance(valor, datetime | date):
        return valor.strftime(_FORMATO_DATA)
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    limpo = str(valor).strip()
    return None if limpo.upper() in _VALORES_VAZIOS else limpo


def _chave_texto(valor: str) -> str:
    return re.sub(r"\s+", " ", valor).strip().upper()


def normalizar_moeda(valor: str | None) -> str | None:
    if valor is None:
        return None
    maiusculo = valor.upper()
    return _SINONIMOS_MOEDA.get(maiusculo, maiusculo)


def mapear_status(valor: str | None) -> StatusVaga | None:
    """None se vazio; levanta ValueError se o texto não é um status conhecido."""
    if valor is None:
        return None
    status = _STATUS_POR_TEXTO.get(_chave_texto(valor))
    if status is None:
        raise ValueError(f'STATUS "{valor}" não reconhecido (esperado OPEN, CLOSE/CLOSED ou ON-HOLD)')
    return status


def mapear_prioridade(valor: str | None) -> Prioridade | None:
    """None se vazio ou desconhecido — quem aplica decide o padrão (P4)."""
    if valor is None:
        return None
    return _PRIORIDADE_POR_TEXTO.get(_chave_texto(valor))


def normalizar_linha(linha: LinhaPlanilha) -> ResultadoLinha:
    campos = {
        campo: texto(linha.valores[coluna])
        for coluna, campo in COLUNA_PARA_CAMPO.items()
        if coluna in linha.valores
    }
    if campos.get("cargo") is None:
        return LinhaIgnorada(linha=linha.numero, codigo=campos.get("codigo"), cliente=campos.get("cliente"))
    if campos.get("cliente") is None:
        return ErroLinha(linha=linha.numero, motivo="cliente é obrigatório (coluna CLIENT vazia)")

    _aplicar_formatos(campos, linha)
    erro_tamanho = _validar_tamanhos(campos)
    if erro_tamanho is not None:
        return ErroLinha(linha=linha.numero, motivo=erro_tamanho)

    try:
        status = mapear_status(texto(linha.valores.get(Coluna.STATUS)))
    except ValueError as exc:
        return ErroLinha(linha=linha.numero, motivo=str(exc))

    return VagaDaPlanilha(
        linha=linha.numero,
        campos=campos,
        status=status,
        prioridade=mapear_prioridade(texto(linha.valores.get(Coluna.PRIORITY))),
    )


def _aplicar_formatos(campos: dict[str, str | None], linha: LinhaPlanilha) -> None:
    if "moeda" in campos:
        campos["moeda"] = normalizar_moeda(campos["moeda"])
    if "tipo_salario" in campos and campos["tipo_salario"] is not None:
        campos["tipo_salario"] = campos["tipo_salario"].upper()
    # link da JD: coluna "JD PDF URL"; vazia -> hyperlink da célula JD
    if campos.get("jd_url") is None and linha.jd_hyperlink:
        campos["jd_url"] = linha.jd_hyperlink.strip()


def _validar_tamanhos(campos: dict[str, str | None]) -> str | None:
    excedidos = [
        f"{campo} com {len(valor)} caracteres (limite {LIMITE_POR_CAMPO[campo]})"
        for campo, valor in campos.items()
        if valor is not None and len(valor) > LIMITE_POR_CAMPO[campo]
    ]
    return "; ".join(excedidos) if excedidos else None
