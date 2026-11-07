"""Gera .xlsx em memória imitando a planilha do cliente (DS Recruitment Solutions).

A planilha real não fica no repositório; estes construtores reproduzem as
variações observadas nela (cabeçalho na linha 1 ou 5, "Urgent " com espaço,
"NA", datas misturadas com texto, hyperlink na célula JD, IDs repetidos).
"""

from dataclasses import dataclass
from io import BytesIO

from openpyxl import Workbook

ABA_LIVE = "Active Roles - Live Data Feed"
ABA_MAIN = "Active Roles - MAIN"

CABECALHO_LIVE: tuple[str, ...] = (
    "STATUS", "ID", "CLIENT", "ROLE", "Priority", "LANGUAGE", "JD", "COUNTRY", "LOCATION",
    "ONSITE/REMOTE", "HEADCOUNT", "START DATE", "SALARY BUDGET", "CURRENCY", "Salary Type",
    "Other benefits", "RELOCATION DETAILS", "KEY REQUIREMENTS", "INTERNAL NOTES", "JD PDF URL (sync helper)",
)  # fmt: skip
CABECALHO_MAIN: tuple[str, ...] = CABECALHO_LIVE[:-1]


@dataclass(frozen=True)
class Link:
    """Célula com texto e hyperlink (ex.: nome do PDF da JD com link)."""

    texto: str
    url: str


Linha = dict[str, object]


def linha_vaga(**valores: object) -> Linha:
    """Linha mínima válida (STATUS OPEN, CLIENT Acme, ROLE Support Agent) com sobrescritas.

    Chaves com espaço/barra usam o cabeçalho literal via dict: linha_vaga(**{"START DATE": ...}).
    """
    return {"STATUS": "OPEN", "CLIENT": "Acme", "ROLE": "Support Agent", **valores}


@dataclass
class Aba:
    nome: str
    cabecalho: tuple[str, ...]
    linhas: list[Linha]
    linha_cabecalho: int = 1


def montar_xlsx(*abas: Aba) -> bytes:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for aba in abas:
        planilha = workbook.create_sheet(aba.nome)
        for coluna, titulo in enumerate(aba.cabecalho, 1):
            planilha.cell(row=aba.linha_cabecalho, column=coluna, value=titulo)
        for deslocamento, linha in enumerate(aba.linhas, 1):
            _escrever_linha(planilha, aba.linha_cabecalho + deslocamento, aba.cabecalho, linha)
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def planilha_live(*linhas: Linha) -> bytes:
    """Só a aba Live Data Feed, cabeçalho na linha 1."""
    return montar_xlsx(Aba(ABA_LIVE, CABECALHO_LIVE, list(linhas)))


def _escrever_linha(planilha, numero: int, cabecalho: tuple[str, ...], linha: Linha) -> None:
    for titulo, valor in linha.items():
        coluna = cabecalho.index(titulo) + 1
        celula = planilha.cell(row=numero, column=coluna)
        if isinstance(valor, Link):
            celula.value = valor.texto
            celula.hyperlink = valor.url
        else:
            celula.value = valor
