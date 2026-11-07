"""Comando python -m app.traduzir_vagas — spec traducao-vagas, "Traduzir vagas já cadastradas"."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.traduzir_vagas import executar
from tests.conftest import CriarProjeto, CriarVaga
from tests.fakes import FakeTradutor


def _fabrica(db: AsyncSession):
    @asynccontextmanager
    async def _sessao() -> AsyncIterator[AsyncSession]:
        yield db

    return _sessao


async def test_primeira_execucao_traduz_pendentes_e_informa_o_resumo(
    db_session: AsyncSession,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    capsys: pytest.CaptureFixture[str],
) -> None:
    projeto = await criar_projeto()
    await criar_vaga(projeto, cargo="A", requisitos="Fluent German")
    await criar_vaga(projeto, cargo="B", beneficios="Meal card", notas_internas="segredo")
    tradutor = FakeTradutor()

    resumo = await executar(_fabrica(db_session), tradutor)

    saida = capsys.readouterr().out
    assert resumo.traduzidos == 2
    assert resumo.caracteres == len("Fluent German") + len("Meal card")
    assert "segredo" not in tradutor.textos_enviados
    assert "traduzidos: 2" in saida
    assert f"caracteres enviados: {resumo.caracteres}" in saida


async def test_segunda_execucao_nao_envia_nada(
    db_session: AsyncSession,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    capsys: pytest.CaptureFixture[str],
) -> None:
    await criar_vaga(await criar_projeto(), requisitos="Fluent German")
    await executar(_fabrica(db_session), FakeTradutor())
    segundo = FakeTradutor()

    resumo = await executar(_fabrica(db_session), segundo)

    assert segundo.chamadas == []
    assert resumo.traduzidos == 0
    assert "traduzidos: 0" in capsys.readouterr().out


async def test_tradutor_desativado_avisa_no_resumo(
    db_session: AsyncSession,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    capsys: pytest.CaptureFixture[str],
) -> None:
    await criar_vaga(await criar_projeto(), requisitos="Fluent German")

    await executar(_fabrica(db_session), FakeTradutor(desativado=True))

    assert "DEEPL_API_KEY" in capsys.readouterr().out
