"""Tradução disparada depois de salvar/importar, sem a resposta HTTP esperar (P9)."""

import uuid
from collections.abc import Callable, Sequence
from contextlib import AbstractAsyncContextManager
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.base import async_session_factory
from app.services.traducao.pendencias import traduzir_pendentes
from app.services.traducao.tradutor import DeepLTradutor, Tradutor, TradutorDesativado

FabricaSessao = Callable[[], AbstractAsyncContextManager[AsyncSession]]


@lru_cache
def _tradutor_configurado() -> Tradutor:
    # instância única por processo: o TradutorDesativado avisa no log uma vez só
    settings = get_settings()
    if not settings.deepl_api_key:
        return TradutorDesativado()
    return DeepLTradutor(chave=settings.deepl_api_key, url_base=settings.deepl_api_url)


def get_tradutor() -> Tradutor:
    """Dependência FastAPI (substituída por fake nos testes)."""
    return _tradutor_configurado()


def get_fabrica_sessao() -> FabricaSessao:
    """Dependência FastAPI: a tarefa em segundo plano abre sessão própria."""
    return async_session_factory


async def traduzir_vagas_em_segundo_plano(
    vaga_ids: Sequence[uuid.UUID], fabrica_sessao: FabricaSessao, tradutor: Tradutor
) -> None:
    if not vaga_ids:
        return
    async with fabrica_sessao() as db:
        await traduzir_pendentes(db, tradutor, list(vaga_ids))
        await db.commit()
