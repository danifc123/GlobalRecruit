"""Integração: tradução disparada pela API e exposta em VagaOut — spec traducao-vagas.

Com ASGITransport, a tarefa em segundo plano roda antes de a chamada do
cliente retornar; por isso "a resposta não espera" é verificado pelo
conteúdo da resposta (ainda sem tradução), e a tradução aparece no GET seguinte.
"""

import uuid

from httpx import AsyncClient

from app.db.models.user import Role
from tests.conftest import CriarProjeto, CriarUsuario, CriarVaga, auth_header
from tests.fakes import FakeTradutor
from tests.planilhas import linha_vaga, planilha_live

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _payload(projeto_id: uuid.UUID, **extras: object) -> dict[str, object]:
    return {"projeto_id": str(projeto_id), "cliente": "Acme", "cargo": "Support Agent", "prioridade": "media", **extras}


async def test_criar_vaga_responde_sem_esperar_a_traducao_e_ela_aparece_depois(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, tradutor_fake: FakeTradutor
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    criada = await client.post(
        "/api/vagas",
        json=_payload(projeto.id, requisitos="Fluent German (C1)", notas_internas="Client prefers Lisbon"),
        headers=auth_header(admin),
    )
    lida = await client.get(f"/api/vagas/{criada.json()['id']}", headers=auth_header(admin))

    assert criada.status_code == 201
    assert criada.json()["traducoes"] == {}
    assert lida.json()["traducoes"] == {"requisitos": "PT:Fluent German (C1)"}
    assert lida.json()["requisitos"] == "Fluent German (C1)"
    assert "Client prefers Lisbon" not in tradutor_fake.textos_enviados


async def test_falha_do_tradutor_nao_altera_a_criacao(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, tradutor_fake: FakeTradutor
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    tradutor_fake.falhar = True

    criada = await client.post(
        "/api/vagas", json=_payload(projeto.id, requisitos="Fluent German (C1)"), headers=auth_header(admin)
    )
    lida = await client.get(f"/api/vagas/{criada.json()['id']}", headers=auth_header(admin))

    assert criada.status_code == 201
    assert lida.json()["traducoes"] == {}
    assert lida.json()["requisitos"] == "Fluent German (C1)"


async def test_editar_requisitos_retraduz_so_o_campo_alterado(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, tradutor_fake: FakeTradutor
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    criada = await client.post(
        "/api/vagas",
        json=_payload(projeto.id, requisitos="Fluent German (C1)", beneficios="Meal card"),
        headers=auth_header(admin),
    )
    vaga_id = criada.json()["id"]
    tradutor_fake.chamadas.clear()

    editada = await client.patch(
        f"/api/vagas/{vaga_id}",
        json=_payload(projeto.id, requisitos="English B2", beneficios="Meal card"),
        headers=auth_header(admin),
    )
    lida = await client.get(f"/api/vagas/{vaga_id}", headers=auth_header(admin))

    assert editada.status_code == 200
    assert tradutor_fake.textos_enviados == ["English B2"]
    assert lida.json()["traducoes"] == {"requisitos": "PT:English B2", "beneficios": "PT:Meal card"}


async def test_listagem_traz_traducoes_por_vaga(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    await client.post("/api/vagas", json=_payload(projeto.id, beneficios="Meal card"), headers=auth_header(admin))

    lista = await client.get("/api/vagas", headers=auth_header(admin))

    assert lista.json()["items"][0]["traducoes"] == {"beneficios": "PT:Meal card"}


async def test_importacao_real_traduz_e_previa_nao(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, tradutor_fake: FakeTradutor
) -> None:
    # header calculado antes: o rollback da prévia expira os objetos das fixtures
    headers = auth_header(await criar_usuario(Role.ADMIN))
    projeto_id = (await criar_projeto()).id
    conteudo = planilha_live(linha_vaga(ID="DSR-001", **{"KEY REQUIREMENTS": "Fluent German (C1)"}))

    async def importar(dry_run: bool):
        return await client.post(
            "/api/vagas/importar",
            files={"file": ("vagas.xlsx", conteudo, _XLSX_MIME)},
            data={"projeto_id": str(projeto_id), "dry_run": str(dry_run).lower()},
            headers=headers,
        )

    previa = await importar(True)
    chamadas_apos_previa = len(tradutor_fake.chamadas)
    real = await importar(False)
    lista = await client.get("/api/vagas", headers=headers)

    assert previa.json()["criadas"] == 1
    assert chamadas_apos_previa == 0
    assert real.json()["criadas"] == 1
    assert lista.json()["items"][0]["traducoes"]["requisitos"] == "PT:Fluent German (C1)"


async def test_traducao_desatualizada_nao_aparece_quando_tradutor_falha_na_edicao(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, tradutor_fake: FakeTradutor
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    criada = await client.post(
        "/api/vagas", json=_payload(projeto.id, requisitos="Fluent German (C1)"), headers=auth_header(admin)
    )
    tradutor_fake.falhar = True

    await client.patch(
        f"/api/vagas/{criada.json()['id']}",
        json=_payload(projeto.id, requisitos="English B2"),
        headers=auth_header(admin),
    )
    lida = await client.get(f"/api/vagas/{criada.json()['id']}", headers=auth_header(admin))

    assert lida.json()["requisitos"] == "English B2"
    assert lida.json()["traducoes"] == {}


async def test_vaga_sem_textos_traduziveis_nao_chama_o_tradutor(
    client: AsyncClient,
    criar_usuario: CriarUsuario,
    criar_projeto: CriarProjeto,
    criar_vaga: CriarVaga,
    tradutor_fake: FakeTradutor,
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    await client.post("/api/vagas", json=_payload(projeto.id, pais="Portugal"), headers=auth_header(admin))

    assert tradutor_fake.chamadas == []
