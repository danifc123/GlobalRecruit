"""Integração de POST /api/vagas/importar — spec importacao-vagas.

Ids são guardados antes da chamada: o dry-run faz rollback na sessão
compartilhada com o teste, o que expira os objetos das fixtures.
"""

import uuid

from httpx import AsyncClient, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.importacao_vagas import TAMANHO_MAXIMO_BYTES
from app.db.models.pipeline_stage import Estagio
from app.db.models.user import Role, User
from app.db.models.vaga import Prioridade, StatusVaga, Vaga
from tests.conftest import (
    CriarCandidato,
    CriarProjeto,
    CriarUsuario,
    CriarVaga,
    auth_header,
    estagio_atual,
)
from tests.planilhas import linha_vaga, planilha_live

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def _importar(
    client: AsyncClient,
    user: User,
    projeto_id: uuid.UUID,
    conteudo: bytes,
    *,
    dry_run: bool = False,
    nome_arquivo: str = "vagas.xlsx",
) -> Response:
    return await client.post(
        "/api/vagas/importar",
        files={"file": (nome_arquivo, conteudo, _XLSX_MIME)},
        data={"projeto_id": str(projeto_id), "dry_run": str(dry_run).lower()},
        headers=auth_header(user),
    )


async def _vagas_do_projeto(db: AsyncSession, projeto_id: uuid.UUID) -> list[Vaga]:
    db.expire_all()
    stmt = select(Vaga).where(Vaga.projeto_id == projeto_id).order_by(Vaga.cargo)
    return list((await db.execute(stmt)).scalars().all())


async def _contar_vagas(db: AsyncSession, projeto_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(Vaga).where(Vaga.projeto_id == projeto_id)
    return (await db.execute(stmt)).scalar_one()


# --- Requirement: Somente admin e developer importam ---


async def test_recrutador_recebe_403_e_nada_e_gravado(
    client: AsyncClient, db_session: AsyncSession, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    projeto = await criar_projeto()
    projeto_id = projeto.id
    recrutador = await criar_usuario(Role.RECRUITER, projetos=[projeto])

    response = await _importar(client, recrutador, projeto_id, planilha_live(linha_vaga()))

    assert response.status_code == 403
    assert await _contar_vagas(db_session, projeto_id) == 0


async def test_sem_token_recebe_401(client: AsyncClient) -> None:
    response = await client.post(
        "/api/vagas/importar",
        files={"file": ("vagas.xlsx", planilha_live(linha_vaga()), _XLSX_MIME)},
        data={"projeto_id": str(uuid.uuid4())},
    )

    assert response.status_code == 401


async def test_developer_pode_importar(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    developer = await criar_usuario(Role.DEVELOPER)
    projeto = await criar_projeto()

    response = await _importar(client, developer, projeto.id, planilha_live(linha_vaga()))

    assert response.status_code == 200
    assert response.json()["criadas"] == 1


# --- Requirement: Arquivo aceito ---


async def test_extensao_diferente_de_xlsx_e_recusada(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    response = await _importar(client, admin, projeto.id, b"a,b\n1,2", nome_arquivo="vagas.csv")

    assert response.status_code == 400
    assert ".xlsx" in response.json()["detail"]


async def test_arquivo_acima_de_10_mb_e_recusado_com_413(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    response = await _importar(client, admin, projeto.id, b"0" * (TAMANHO_MAXIMO_BYTES + 1))

    assert response.status_code == 413
    assert "10 MB" in response.json()["detail"]


async def test_xlsx_corrompido_e_recusado_com_400(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    response = await _importar(client, admin, projeto.id, b"PK\x03\x04 lixo")

    assert response.status_code == 400
    assert "não pôde ser lido" in response.json()["detail"]


async def test_projeto_inexistente_recebe_404(client: AsyncClient, criar_usuario: CriarUsuario) -> None:
    admin = await criar_usuario(Role.ADMIN)

    response = await _importar(client, admin, uuid.uuid4(), planilha_live(linha_vaga()))

    assert response.status_code == 404
    assert response.json()["detail"] == "Projeto não encontrado"


# --- Requirement: Criar ou atualizar sem duplicar ---


async def test_reimportar_a_mesma_planilha_nao_duplica(
    client: AsyncClient, db_session: AsyncSession, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto_id = (await criar_projeto()).id
    conteudo = planilha_live(linha_vaga(ID="DSR-001"), linha_vaga(ID="DSR-002", ROLE="Team Lead"))

    primeira = await _importar(client, admin, projeto_id, conteudo)
    segunda = await _importar(client, admin, projeto_id, conteudo)

    assert primeira.json()["criadas"] == 2
    assert segunda.json()["criadas"] == 0
    assert segunda.json()["atualizadas"] == 2
    assert await _contar_vagas(db_session, projeto_id) == 2


async def test_mesmo_codigo_com_cargos_diferentes_cria_duas_vagas(
    client: AsyncClient, db_session: AsyncSession, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto_id = (await criar_projeto()).id
    conteudo = planilha_live(
        linha_vaga(ID="DSR-002", ROLE="Support Agent"), linha_vaga(ID="DSR-002", ROLE="Team Lead")
    )

    response = await _importar(client, admin, projeto_id, conteudo)

    assert response.json()["criadas"] == 2
    assert await _contar_vagas(db_session, projeto_id) == 2


async def test_chave_repetida_na_mesma_planilha_vira_erro_duplicada(
    client: AsyncClient, db_session: AsyncSession, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto_id = (await criar_projeto()).id
    conteudo = planilha_live(
        linha_vaga(ID="DSR-003", ROLE="Sales Agent"), linha_vaga(ID="dsr-003", ROLE="sales agent")
    )

    response = await _importar(client, admin, projeto_id, conteudo)

    assert response.json()["criadas"] == 1
    assert response.json()["erros"] == [{"linha": 3, "motivo": "duplicada da linha 2"}]
    assert await _contar_vagas(db_session, projeto_id) == 1


async def test_vaga_sem_codigo_existente_e_atualizada_por_cliente_e_cargo(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    projeto_id = projeto.id
    await criar_vaga(projeto, cliente="Acme", cargo="Support Agent")

    response = await _importar(
        client, admin, projeto_id, planilha_live(linha_vaga(CLIENT="ACME", ROLE="support agent", COUNTRY="Spain"))
    )

    assert response.json()["atualizadas"] == 1
    vagas = await _vagas_do_projeto(db_session, projeto_id)
    assert len(vagas) == 1
    assert vagas[0].pais == "Spain"


async def test_celula_vazia_apaga_campo_e_preserva_comissao(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    projeto_id = projeto.id
    await criar_vaga(projeto, codigo="DSR-004", beneficios="Meal card", comissao=300)

    await _importar(
        client, admin, projeto_id, planilha_live(linha_vaga(ID="DSR-004", **{"Other benefits": None}))
    )

    vaga = (await _vagas_do_projeto(db_session, projeto_id))[0]
    assert vaga.beneficios is None
    assert vaga.comissao == 300


async def test_status_e_prioridade_vazios_mantem_os_atuais_em_vaga_existente(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    projeto_id = projeto.id
    await criar_vaga(projeto, codigo="DSR-005", status=StatusVaga.PAUSADA, prioridade=Prioridade.ALTA)

    await _importar(client, admin, projeto_id, planilha_live(linha_vaga(ID="DSR-005", STATUS=None, Priority=None)))

    vaga = (await _vagas_do_projeto(db_session, projeto_id))[0]
    assert vaga.status == StatusVaga.PAUSADA
    assert vaga.prioridade == Prioridade.ALTA


async def test_status_e_prioridade_vazios_em_vaga_nova_viram_aberta_e_media(
    client: AsyncClient, db_session: AsyncSession, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto_id = (await criar_projeto()).id

    await _importar(client, admin, projeto_id, planilha_live(linha_vaga(STATUS=None, Priority="Someday")))

    vaga = (await _vagas_do_projeto(db_session, projeto_id))[0]
    assert vaga.status == StatusVaga.ABERTA
    assert vaga.prioridade == Prioridade.MEDIA


# --- Requirement: Vagas fora da planilha não mudam ---


async def test_vaga_fora_da_planilha_e_vaga_de_outro_projeto_ficam_inalteradas(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto_p = await criar_projeto(nome="P")
    projeto_q = await criar_projeto(nome="Q")
    projeto_p_id, projeto_q_id = projeto_p.id, projeto_q.id
    await criar_vaga(projeto_p, codigo="DSR-999", cargo="Fora", status=StatusVaga.FECHADA)
    await criar_vaga(projeto_q, codigo="DSR-001", cargo="Customer Support", pais="Brasil")

    response = await _importar(
        client, admin, projeto_p_id, planilha_live(linha_vaga(ID="DSR-001", ROLE="Customer Support", COUNTRY="Portugal"))
    )

    assert response.json()["criadas"] == 1
    vagas_p = await _vagas_do_projeto(db_session, projeto_p_id)
    fora = next(vaga for vaga in vagas_p if vaga.codigo == "DSR-999")
    assert fora.status == StatusVaga.FECHADA
    vagas_q = await _vagas_do_projeto(db_session, projeto_q_id)
    assert [(vaga.codigo, vaga.pais) for vaga in vagas_q] == [("DSR-001", "Brasil")]


# --- Requirement: Reabertura pela importação encerra candidatos em andamento ---


async def test_vaga_fechada_reaberta_pela_planilha_conclui_candidato_em_andamento(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    criar_candidato: CriarCandidato,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    vaga = await criar_vaga(projeto, codigo="DSR-010", status=StatusVaga.FECHADA)
    em_entrevista_id = (await criar_candidato(vaga, Estagio.ENTREVISTA)).id
    contratado_id = (await criar_candidato(vaga, Estagio.CONTRATADO)).id
    projeto_id = projeto.id

    await _importar(client, admin, projeto_id, planilha_live(linha_vaga(ID="DSR-010", STATUS="OPEN")))

    assert (await _vagas_do_projeto(db_session, projeto_id))[0].status == StatusVaga.ABERTA
    assert await estagio_atual(db_session, em_entrevista_id) == Estagio.CONCLUIDO
    assert await estagio_atual(db_session, contratado_id) == Estagio.CONTRATADO


async def test_vaga_ja_aberta_continua_com_candidato_em_triagem(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    criar_candidato: CriarCandidato,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    vaga = await criar_vaga(projeto, codigo="DSR-011", status=StatusVaga.ABERTA)
    em_triagem_id = (await criar_candidato(vaga, Estagio.TRIAGEM)).id

    await _importar(client, admin, projeto.id, planilha_live(linha_vaga(ID="DSR-011", STATUS="OPEN")))

    assert await estagio_atual(db_session, em_triagem_id) == Estagio.TRIAGEM


# --- Requirement: Pré-visualização sem gravar ---


async def test_pre_visualizacao_nao_grava_e_confirmacao_grava_136_vagas(
    client: AsyncClient, db_session: AsyncSession, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto_id = (await criar_projeto()).id
    conteudo = planilha_live(*[linha_vaga(ID=f"DSR-{indice:03d}") for indice in range(1, 137)])

    previa = await _importar(client, admin, projeto_id, conteudo, dry_run=True)
    vagas_apos_previa = await _contar_vagas(db_session, projeto_id)
    await db_session.refresh(admin)  # o rollback do dry-run expirou o objeto
    real = await _importar(client, admin, projeto_id, conteudo)

    assert previa.json()["dry_run"] is True
    assert previa.json()["criadas"] == 136
    assert vagas_apos_previa == 0
    assert real.json()["criadas"] == 136
    assert await _contar_vagas(db_session, projeto_id) == 136


async def test_pre_visualizacao_de_reabertura_nao_conclui_candidatos(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    criar_candidato: CriarCandidato,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    vaga = await criar_vaga(projeto, codigo="DSR-012", status=StatusVaga.FECHADA)
    em_entrevista_id = (await criar_candidato(vaga, Estagio.ENTREVISTA)).id

    await _importar(client, admin, projeto.id, planilha_live(linha_vaga(ID="DSR-012")), dry_run=True)

    assert await estagio_atual(db_session, em_entrevista_id) == Estagio.ENTREVISTA


# --- Requirement: Resumo da importação ---


async def test_resumo_com_mistura_de_resultados(
    client: AsyncClient,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    await criar_vaga(projeto, codigo="DSR-100", cargo="Existente")
    conteudo = planilha_live(
        linha_vaga(ID="DSR-101", ROLE="Nova 1"),
        linha_vaga(ID="DSR-102", ROLE="Nova 2"),
        linha_vaga(ID="DSR-100", ROLE="Existente"),
        linha_vaga(ID="DSR-103", ROLE=None),
        linha_vaga(ID="DSR-104", ROLE="Status ruim", STATUS="FILLED"),
    )

    response = await _importar(client, admin, projeto.id, conteudo)

    corpo = response.json()
    assert (corpo["criadas"], corpo["atualizadas"], corpo["ignoradas"]) == (2, 1, 1)
    assert [erro["linha"] for erro in corpo["erros"]] == [6]
    assert [(item["linha"], item["acao"]) for item in corpo["itens"]] == [
        (2, "criar"),
        (3, "criar"),
        (4, "atualizar"),
        (5, "ignorar"),
    ]
    assert corpo["itens"][0] == {
        "linha": 2,
        "codigo": "DSR-101",
        "cargo": "Nova 1",
        "cliente": "Acme",
        "acao": "criar",
    }
