"""Regra de pendência e armazenamento das traduções — spec traducao-vagas."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.vaga_traducao import VagaTraducao
from app.services.traducao.pendencias import (
    CAMPOS_TRADUZIVEIS,
    IDIOMA_TRADUCAO,
    traducoes_por_vaga,
    traduzir_pendentes,
)
from tests.conftest import CriarProjeto, CriarVaga
from tests.fakes import FakeTradutor


async def _traducoes(db: AsyncSession, vaga_id) -> dict[str, str]:
    db.expire_all()
    linhas = (await db.execute(select(VagaTraducao).where(VagaTraducao.vaga_id == vaga_id))).scalars().all()
    return {linha.campo: linha.texto for linha in linhas}


def test_campos_traduziveis_sao_os_da_decisao_p1_p3_sem_notas_internas() -> None:
    assert set(CAMPOS_TRADUZIVEIS) == {
        "requisitos",
        "beneficios",
        "realocacao",
        "modalidade",
        "data_inicio",
        "faixa_salarial",
    }
    assert IDIOMA_TRADUCAO == "pt-BR"


async def test_traduz_so_campos_traduziveis_preenchidos(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    vaga = await criar_vaga(
        await criar_projeto(),
        cargo="Customer Support Agent",
        pais="Portugal",
        requisitos="Fluent German (C1)",
        beneficios="Meal card",
        notas_internas="Client prefers Lisbon",
    )
    tradutor = FakeTradutor()

    resumo = await traduzir_pendentes(db_session, tradutor, [vaga.id])
    await db_session.commit()

    assert sorted(tradutor.textos_enviados) == ["Fluent German (C1)", "Meal card"]
    assert await _traducoes(db_session, vaga.id) == {
        "requisitos": "PT:Fluent German (C1)",
        "beneficios": "PT:Meal card",
    }
    assert resumo.traduzidos == 2
    assert resumo.caracteres == len("Fluent German (C1)") + len("Meal card")


async def test_texto_que_nao_mudou_nao_e_traduzido_de_novo(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    vaga = await criar_vaga(await criar_projeto(), requisitos="Fluent German (C1)")
    await traduzir_pendentes(db_session, FakeTradutor(), [vaga.id])
    await db_session.commit()
    segundo = FakeTradutor()

    resumo = await traduzir_pendentes(db_session, segundo, [vaga.id])

    assert segundo.chamadas == []
    assert resumo.traduzidos == 0


async def test_texto_alterado_e_retraduzido_e_os_outros_nao(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    vaga = await criar_vaga(await criar_projeto(), requisitos="Fluent German (C1)", beneficios="Meal card")
    await traduzir_pendentes(db_session, FakeTradutor(), [vaga.id])
    await db_session.commit()
    vaga.requisitos = "English B2"
    await db_session.commit()
    segundo = FakeTradutor()

    await traduzir_pendentes(db_session, segundo, [vaga.id])
    await db_session.commit()

    assert segundo.textos_enviados == ["English B2"]
    assert (await _traducoes(db_session, vaga.id))["requisitos"] == "PT:English B2"


async def test_campo_esvaziado_perde_a_traducao(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    vaga = await criar_vaga(await criar_projeto(), requisitos="Fluent German (C1)", beneficios="Meal card")
    await traduzir_pendentes(db_session, FakeTradutor(), [vaga.id])
    await db_session.commit()
    vaga.beneficios = None
    await db_session.commit()

    resumo = await traduzir_pendentes(db_session, FakeTradutor(), [vaga.id])
    await db_session.commit()

    assert "beneficios" not in await _traducoes(db_session, vaga.id)
    assert resumo.removidos == 1


async def test_falha_do_servico_deixa_pendente_e_tenta_de_novo_depois(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    vaga = await criar_vaga(await criar_projeto(), requisitos="Fluent German (C1)")

    resumo_falha = await traduzir_pendentes(db_session, FakeTradutor(falhar=True), [vaga.id])
    await db_session.commit()
    resumo_ok = await traduzir_pendentes(db_session, FakeTradutor(), [vaga.id])
    await db_session.commit()

    assert resumo_falha.falhas == 1
    assert resumo_ok.traduzidos == 1
    assert (await _traducoes(db_session, vaga.id))["requisitos"] == "PT:Fluent German (C1)"


async def test_tradutor_desativado_nao_grava_nada(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    vaga = await criar_vaga(await criar_projeto(), requisitos="Fluent German (C1)")

    resumo = await traduzir_pendentes(db_session, FakeTradutor(desativado=True), [vaga.id])
    await db_session.commit()

    assert await _traducoes(db_session, vaga.id) == {}
    assert resumo.traduzidos == 0


async def test_sem_ids_traduz_pendentes_de_todas_as_vagas(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    projeto = await criar_projeto()
    primeira_id = (await criar_vaga(projeto, cargo="A", requisitos="Req A")).id
    segunda_id = (await criar_vaga(projeto, cargo="B", beneficios="Ben B")).id

    resumo = await traduzir_pendentes(db_session, FakeTradutor())
    await db_session.commit()

    assert resumo.traduzidos >= 2
    assert (await _traducoes(db_session, primeira_id)) == {"requisitos": "PT:Req A"}
    assert (await _traducoes(db_session, segunda_id)) == {"beneficios": "PT:Ben B"}


async def test_traducao_desatualizada_nao_e_exibida(
    db_session: AsyncSession, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    vaga = await criar_vaga(await criar_projeto(), requisitos="Fluent German (C1)", beneficios="Meal card")
    await traduzir_pendentes(db_session, FakeTradutor(), [vaga.id])
    await db_session.commit()
    vaga.requisitos = "English B2"  # tradução antiga ainda guardada, mas não vale mais
    await db_session.commit()

    exibidas = await traducoes_por_vaga(db_session, [vaga])

    assert exibidas[vaga.id] == {"beneficios": "PT:Meal card"}
