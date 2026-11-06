"""Spec vagas: "Campos da vaga", "Limites de tamanho" e "Listagem de até 500"."""

import pytest
from httpx import AsyncClient

from app.db.models.user import Role
from app.db.models.vaga import StatusVaga
from tests.conftest import CriarProjeto, CriarUsuario, CriarVaga, auth_header

_REQUISITOS_MULTILINHA = "Fluent German (C1)\nEnglish B2\nCustomer service experience"


def _payload_base(projeto_id: str, **extras: object) -> dict[str, object]:
    return {"projeto_id": projeto_id, "cliente": "Acme", "cargo": "Support Agent", "prioridade": "media", **extras}


async def test_cadastro_com_campos_novos_devolve_valores_exatos_ao_abrir_a_vaga(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    campos_novos = {
        "codigo": "DSR-050",
        "localizacao": "Porto",
        "headcount": "multiple",
        "data_inicio": "ASAP (2 HC)",
        "faixa_salarial": "€1,700–€1,900/ month",
        "moeda": "EUR",
        "tipo_salario": "GROSS",
        "beneficios": "Meal card",
        "realocacao": "Flight + 2 weeks hotel",
        "requisitos": _REQUISITOS_MULTILINHA,
        "notas_internas": "Cliente prefere\ncandidatos em Lisboa",
        "jd_nome": "jd_support.pdf",
        "jd_url": "https://exemplo.com/jd.pdf",
    }

    created = await client.post(
        "/api/vagas", json=_payload_base(str(projeto.id), **campos_novos), headers=auth_header(admin)
    )
    fetched = await client.get(f"/api/vagas/{created.json()['id']}", headers=auth_header(admin))

    assert created.status_code == 201
    assert fetched.status_code == 200
    assert {campo: fetched.json()[campo] for campo in campos_novos} == campos_novos


async def test_cadastro_sem_campos_opcionais_cria_vaga_com_campos_novos_vazios(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    response = await client.post("/api/vagas", json=_payload_base(str(projeto.id)), headers=auth_header(admin))

    assert response.status_code == 201
    assert response.json()["codigo"] is None
    assert response.json()["requisitos"] is None
    assert response.json()["faixa_salarial"] is None


@pytest.mark.parametrize(
    ("campo", "limite"),
    [
        ("codigo", 50),
        ("localizacao", 200),
        ("headcount", 50),
        ("moeda", 30),
        ("tipo_salario", 50),
        ("jd_nome", 300),
        ("jd_url", 1000),
        ("idioma", 200),
        ("pais", 200),
        ("modalidade", 100),
        ("data_inicio", 10_000),
        ("faixa_salarial", 10_000),
        ("beneficios", 10_000),
        ("realocacao", 10_000),
        ("requisitos", 10_000),
        ("notas_internas", 10_000),
    ],
)
async def test_cadastro_recusa_valor_acima_do_limite_do_campo(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, campo: str, limite: int
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    response = await client.post(
        "/api/vagas", json=_payload_base(str(projeto.id), **{campo: "x" * (limite + 1)}), headers=auth_header(admin)
    )

    assert response.status_code == 422
    assert campo in str(response.json()["detail"])


@pytest.mark.parametrize(("campo", "limite"), [("idioma", 200), ("pais", 200), ("modalidade", 100)])
async def test_cadastro_aceita_valor_no_limite_dos_campos_ampliados(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, campo: str, limite: int
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()

    response = await client.post(
        "/api/vagas", json=_payload_base(str(projeto.id), **{campo: "x" * limite}), headers=auth_header(admin)
    )

    assert response.status_code == 201
    assert response.json()[campo] == "x" * limite


async def test_edicao_grava_campos_novos(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    vaga = await criar_vaga(projeto)

    response = await client.patch(
        f"/api/vagas/{vaga.id}",
        json=_payload_base(str(projeto.id), modalidade="Hybrid after training/probation", headcount="30 per mo"),
        headers=auth_header(admin),
    )

    assert response.status_code == 200
    assert response.json()["modalidade"] == "Hybrid after training/probation"
    assert response.json()["headcount"] == "30 per mo"


async def test_edicao_sem_salario_numerico_preserva_o_salario_legado(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    vaga = await criar_vaga(projeto, salario=2500, faixa_salarial="2500.00")

    response = await client.patch(
        f"/api/vagas/{vaga.id}", json=_payload_base(str(projeto.id), faixa_salarial="2500.00"), headers=auth_header(admin)
    )

    assert response.status_code == 200
    assert response.json()["salario"] == 2500
    assert response.json()["faixa_salarial"] == "2500.00"


async def test_listagem_aceita_500_por_pagina(client: AsyncClient, criar_usuario: CriarUsuario) -> None:
    admin = await criar_usuario(Role.ADMIN)

    response = await client.get("/api/vagas", params={"page_size": 500}, headers=auth_header(admin))

    assert response.status_code == 200
    assert response.json()["page_size"] == 500


async def test_listagem_recusa_501_por_pagina(client: AsyncClient, criar_usuario: CriarUsuario) -> None:
    admin = await criar_usuario(Role.ADMIN)

    response = await client.get("/api/vagas", params={"page_size": 501}, headers=auth_header(admin))

    assert response.status_code == 422


async def test_listagem_traz_136_vagas_abertas_numa_pagina_de_500(
    client: AsyncClient, criar_usuario: CriarUsuario, criar_projeto: CriarProjeto, criar_vaga: CriarVaga
) -> None:
    admin = await criar_usuario(Role.ADMIN)
    projeto = await criar_projeto()
    for indice in range(136):
        await criar_vaga(projeto, cargo=f"Cargo {indice}", status=StatusVaga.ABERTA)

    response = await client.get(
        "/api/vagas", params={"page_size": 500, "status": "aberta"}, headers=auth_header(admin)
    )

    assert response.json()["total"] == 136
    assert len(response.json()["items"]) == 136
