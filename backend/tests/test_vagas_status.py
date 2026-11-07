"""Caracterização de PATCH /vagas/{id}/status — regra de reabertura.

Escrito antes de extrair a regra para o service, para garantir que o
refactor não muda comportamento.
"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pipeline_stage import Estagio
from app.db.models.user import Role
from app.db.models.vaga import StatusVaga
from tests.conftest import (
    CriarCandidato,
    CriarProjeto,
    CriarUsuario,
    CriarVaga,
    auth_header,
    estagio_atual,
)


async def test_reabrir_vaga_fechada_conclui_candidatos_em_andamento_e_preserva_desfechos(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    criar_candidato: CriarCandidato,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    vaga = await criar_vaga(projeto, status=StatusVaga.FECHADA)
    em_triagem = await criar_candidato(vaga, Estagio.TRIAGEM)
    em_entrevista = await criar_candidato(vaga, Estagio.ENTREVISTA)
    em_proposta = await criar_candidato(vaga, Estagio.PROPOSTA)
    contratado = await criar_candidato(vaga, Estagio.CONTRATADO)
    rejeitado = await criar_candidato(vaga, Estagio.REJEITADO)

    response = await client.patch(
        f"/api/vagas/{vaga.id}/status", json={"status": "aberta"}, headers=auth_header(admin)
    )

    assert response.status_code == 200
    assert response.json()["status"] == "aberta"
    assert await estagio_atual(db_session, em_triagem.id) == Estagio.CONCLUIDO
    assert await estagio_atual(db_session, em_entrevista.id) == Estagio.CONCLUIDO
    assert await estagio_atual(db_session, em_proposta.id) == Estagio.CONCLUIDO
    assert await estagio_atual(db_session, contratado.id) == Estagio.CONTRATADO
    assert await estagio_atual(db_session, rejeitado.id) == Estagio.REJEITADO


async def test_marcar_vaga_ja_aberta_como_aberta_nao_mexe_nos_candidatos(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    criar_candidato: CriarCandidato,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    vaga = await criar_vaga(await criar_projeto(), status=StatusVaga.ABERTA)
    em_triagem = await criar_candidato(vaga, Estagio.TRIAGEM)

    response = await client.patch(
        f"/api/vagas/{vaga.id}/status", json={"status": "aberta"}, headers=auth_header(admin)
    )

    assert response.status_code == 200
    assert await estagio_atual(db_session, em_triagem.id) == Estagio.TRIAGEM


async def test_pausar_vaga_nao_mexe_nos_candidatos(
    client: AsyncClient,
    db_session: AsyncSession,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    criar_candidato: CriarCandidato,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    vaga = await criar_vaga(await criar_projeto(), status=StatusVaga.ABERTA)
    em_entrevista = await criar_candidato(vaga, Estagio.ENTREVISTA)

    response = await client.patch(
        f"/api/vagas/{vaga.id}/status", json={"status": "pausada"}, headers=auth_header(admin)
    )

    assert response.status_code == 200
    assert response.json()["status"] == "pausada"
    assert await estagio_atual(db_session, em_entrevista.id) == Estagio.ENTREVISTA


async def test_recrutador_nao_pode_mudar_status(
    client: AsyncClient,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
) -> None:
    projeto = await criar_projeto()
    recrutador = await criar_usuario(Role.RECRUITER, projetos=[projeto])
    vaga = await criar_vaga(projeto)

    response = await client.patch(
        f"/api/vagas/{vaga.id}/status", json={"status": "fechada"}, headers=auth_header(recrutador)
    )

    assert response.status_code == 403
