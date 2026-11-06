"""Leitura do .xlsx do cliente: acha a aba e o cabeçalho e extrai as linhas cruas.

Não interpreta valores (isso é da normalização) — só devolve, por linha, o
valor de cada coluna reconhecida e o hyperlink da célula JD, se houver.
"""

import enum
import re
import zipfile
from dataclasses import dataclass
from io import BytesIO

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from openpyxl.worksheet.worksheet import Worksheet

# a planilha do cliente tem o cabeçalho na linha 1 (Live Data Feed) ou na
# linha 5 (MAIN); 10 dá folga sem varrer a aba inteira
LINHAS_VARRIDAS_PARA_CABECALHO = 10


class Coluna(enum.Enum):
    ID = "ID"
    CLIENT = "CLIENT"
    ROLE = "ROLE"
    STATUS = "STATUS"
    PRIORITY = "PRIORITY"
    LANGUAGE = "LANGUAGE"
    JD = "JD"
    COUNTRY = "COUNTRY"
    LOCATION = "LOCATION"
    ONSITE_REMOTE = "ONSITE/REMOTE"
    HEADCOUNT = "HEADCOUNT"
    START_DATE = "START DATE"
    SALARY_BUDGET = "SALARY BUDGET"
    CURRENCY = "CURRENCY"
    SALARY_TYPE = "SALARY TYPE"
    OTHER_BENEFITS = "OTHER BENEFITS"
    RELOCATION_DETAILS = "RELOCATION DETAILS"
    KEY_REQUIREMENTS = "KEY REQUIREMENTS"
    INTERNAL_NOTES = "INTERNAL NOTES"
    JD_PDF_URL = "JD PDF URL"


# grafias aceitas além do próprio valor do enum (já normalizadas)
_ALIASES: dict[str, Coluna] = {
    "ROLE ID": Coluna.ID,
    "JD PDF URL (SYNC HELPER)": Coluna.JD_PDF_URL,
}


class PlanilhaInvalidaError(Exception):
    """O arquivo não pôde ser usado como planilha de vagas (vira HTTP 400)."""


@dataclass(frozen=True)
class LinhaPlanilha:
    numero: int  # número da linha como aparece no Excel (1 = primeira)
    valores: dict[Coluna, object]
    jd_hyperlink: str | None


@dataclass(frozen=True)
class PlanilhaLida:
    aba: str
    colunas: frozenset[Coluna]
    linhas: list[LinhaPlanilha]


def normalizar_cabecalho(texto: object) -> str:
    """Caixa alta, sem espaços nas pontas e com espaços internos únicos."""
    if texto is None:
        return ""
    return re.sub(r"\s+", " ", str(texto)).strip().upper()


def identificar_coluna(texto: object) -> Coluna | None:
    normalizado = normalizar_cabecalho(texto)
    if normalizado in _ALIASES:
        return _ALIASES[normalizado]
    try:
        return Coluna(normalizado)
    except ValueError:
        return None


def ler_planilha(conteudo: bytes) -> PlanilhaLida:
    """Abre o .xlsx e lê a aba de vagas com mais colunas reconhecidas.

    Levanta PlanilhaInvalidaError se o arquivo não abre ou se nenhuma aba tem
    ROLE e CLIENT nas primeiras linhas.
    """
    try:
        # read_only=False: hyperlink de célula só existe no modo completo
        workbook = load_workbook(BytesIO(conteudo), data_only=True)
    except (InvalidFileException, zipfile.BadZipFile, KeyError, ValueError, OSError) as exc:
        raise PlanilhaInvalidaError("O arquivo não pôde ser lido como planilha .xlsx.") from exc

    melhor = _escolher_aba(workbook.worksheets)
    if melhor is None:
        raise PlanilhaInvalidaError(
            f"Nenhuma aba tem as colunas ROLE e CLIENT nas {LINHAS_VARRIDAS_PARA_CABECALHO} primeiras linhas."
        )
    aba, linha_cabecalho, mapa = melhor
    return PlanilhaLida(
        aba=aba.title,
        colunas=frozenset(mapa.values()),
        linhas=list(_ler_linhas(aba, linha_cabecalho, mapa)),
    )


def _escolher_aba(abas: list[Worksheet]) -> tuple[Worksheet, int, dict[int, Coluna]] | None:
    melhor: tuple[Worksheet, int, dict[int, Coluna]] | None = None
    for aba in abas:
        cabecalho = _achar_cabecalho(aba)
        if cabecalho is None:
            continue
        # empate fica com a primeira aba encontrada
        if melhor is None or len(cabecalho[1]) > len(melhor[2]):
            melhor = (aba, cabecalho[0], cabecalho[1])
    return melhor


def _achar_cabecalho(aba: Worksheet) -> tuple[int, dict[int, Coluna]] | None:
    """Primeira linha (entre as varridas) com ROLE e CLIENT: (número, índice→coluna)."""
    for numero, linha in enumerate(aba.iter_rows(max_row=LINHAS_VARRIDAS_PARA_CABECALHO, values_only=True), 1):
        mapa: dict[int, Coluna] = {}
        for indice, texto in enumerate(linha):
            coluna = identificar_coluna(texto)
            if coluna is not None and coluna not in mapa.values():
                mapa[indice] = coluna
        if Coluna.ROLE in mapa.values() and Coluna.CLIENT in mapa.values():
            return numero, mapa
    return None


def _ler_linhas(aba: Worksheet, linha_cabecalho: int, mapa: dict[int, Coluna]):
    for numero, celulas in enumerate(aba.iter_rows(min_row=linha_cabecalho + 1), linha_cabecalho + 1):
        valores: dict[Coluna, object] = {}
        jd_hyperlink: str | None = None
        for indice, coluna in mapa.items():
            if indice >= len(celulas):
                continue
            celula = celulas[indice]
            valores[coluna] = celula.value
            if coluna == Coluna.JD and celula.hyperlink is not None:
                jd_hyperlink = celula.hyperlink.target
        if any(valor not in (None, "") for valor in valores.values()):
            yield LinhaPlanilha(numero=numero, valores=valores, jd_hyperlink=jd_hyperlink)
