from typing import Literal

from pydantic import BaseModel


class ErroLinhaOut(BaseModel):
    linha: int
    motivo: str


class ItemImportacaoOut(BaseModel):
    linha: int
    codigo: str | None
    cargo: str | None
    cliente: str | None
    acao: Literal["criar", "atualizar", "ignorar"]


class ResultadoImportacaoOut(BaseModel):
    """Resumo devolvido igual na pré-visualização (dry_run) e na importação real."""

    dry_run: bool
    aba: str
    criadas: int
    atualizadas: int
    ignoradas: int
    erros: list[ErroLinhaOut]
    itens: list[ItemImportacaoOut]
