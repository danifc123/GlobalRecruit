"""Quais campos da vaga precisam de tradução e onde guardar o resultado.

Um campo está pendente quando tem texto e não há tradução guardada para o
texto atual (hash do original diferente ou ausente). Texto que não mudou
nunca é enviado de novo ao serviço (spec traducao-vagas).
"""

import hashlib
import logging
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.vaga import Vaga
from app.db.models.vaga_traducao import VagaTraducao
from app.services.traducao.tradutor import FalhaTraducao, Tradutor

logger = logging.getLogger(__name__)

# decisões P1–P3: sem cargo, nomes próprios/códigos e notas internas
CAMPOS_TRADUZIVEIS: tuple[str, ...] = (
    "requisitos",
    "beneficios",
    "realocacao",
    "modalidade",
    "data_inicio",
    "faixa_salarial",
)
IDIOMA_TRADUCAO = "pt-BR"


@dataclass
class ResumoTraducao:
    traduzidos: int = 0
    falhas: int = 0
    removidos: int = 0
    caracteres: int = 0
    # havia campos pendentes, mas o tradutor está desativado (sem chave)
    desativado: bool = False


@dataclass(frozen=True)
class _Pendente:
    vaga_id: uuid.UUID
    campo: str
    original: str


class VagaComTextos(Protocol):
    """Qualquer objeto com id e os campos traduzíveis (ORM ou linha de select)."""

    id: uuid.UUID


def hash_texto(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


async def traduzir_pendentes(
    db: AsyncSession, tradutor: Tradutor, vaga_ids: Sequence[uuid.UUID] | None = None
) -> ResumoTraducao:
    """Traduz os campos pendentes das vagas (todas, se `vaga_ids` for None).

    Só altera a sessão — quem chama faz o commit. Falha do serviço não levanta:
    os campos ficam pendentes para a próxima tentativa.
    """
    vagas = await _carregar_vagas(db, vaga_ids)
    existentes = await _traducoes_guardadas(db, [vaga.id for vaga in vagas])
    resumo = ResumoTraducao()
    pendentes: list[_Pendente] = []

    for vaga in vagas:
        for campo in CAMPOS_TRADUZIVEIS:
            original = getattr(vaga, campo)
            guardada = existentes.get((vaga.id, campo))
            if not original:
                if guardada is not None:
                    await db.delete(guardada)
                    resumo.removidos += 1
                continue
            if guardada is None or guardada.hash_original != hash_texto(original):
                pendentes.append(_Pendente(vaga.id, campo, original))

    if not pendentes:
        return resumo

    try:
        traduzidos = await tradutor.traduzir([pendente.original for pendente in pendentes])
    except FalhaTraducao as exc:
        logger.warning("tradução adiada para %s campos: %s", len(pendentes), exc)
        resumo.falhas = len(pendentes)
        return resumo
    if traduzidos is None:  # tradução desativada (sem chave)
        resumo.desativado = True
        return resumo

    for pendente, texto in zip(pendentes, traduzidos, strict=True):
        _gravar(db, existentes.get((pendente.vaga_id, pendente.campo)), pendente, texto)
        resumo.traduzidos += 1
        resumo.caracteres += len(pendente.original)
    await db.flush()
    return resumo


async def traducoes_por_vaga(
    db: AsyncSession, vagas: Iterable[VagaComTextos]
) -> dict[uuid.UUID, dict[str, str]]:
    """Traduções válidas para exibir: só as que correspondem ao texto atual."""
    lista = list(vagas)
    existentes = await _traducoes_guardadas(db, [vaga.id for vaga in lista])
    resultado: dict[uuid.UUID, dict[str, str]] = {vaga.id: {} for vaga in lista}
    for vaga in lista:
        for campo in CAMPOS_TRADUZIVEIS:
            original = getattr(vaga, campo, None)
            guardada = existentes.get((vaga.id, campo))
            if original and guardada is not None and guardada.hash_original == hash_texto(original):
                resultado[vaga.id][campo] = guardada.texto
    return resultado


async def _carregar_vagas(db: AsyncSession, vaga_ids: Sequence[uuid.UUID] | None) -> list[Vaga]:
    stmt = select(Vaga)
    if vaga_ids is not None:
        if not vaga_ids:
            return []
        stmt = stmt.where(Vaga.id.in_(vaga_ids))
    return list((await db.execute(stmt)).scalars().all())


async def _traducoes_guardadas(
    db: AsyncSession, vaga_ids: list[uuid.UUID]
) -> dict[tuple[uuid.UUID, str], VagaTraducao]:
    if not vaga_ids:
        return {}
    stmt = select(VagaTraducao).where(
        VagaTraducao.vaga_id.in_(vaga_ids), VagaTraducao.idioma == IDIOMA_TRADUCAO
    )
    return {(linha.vaga_id, linha.campo): linha for linha in (await db.execute(stmt)).scalars().all()}


def _gravar(db: AsyncSession, guardada: VagaTraducao | None, pendente: _Pendente, texto: str) -> None:
    if guardada is None:
        db.add(
            VagaTraducao(
                vaga_id=pendente.vaga_id,
                campo=pendente.campo,
                idioma=IDIOMA_TRADUCAO,
                hash_original=hash_texto(pendente.original),
                texto=texto,
            )
        )
        return
    guardada.hash_original = hash_texto(pendente.original)
    guardada.texto = texto
