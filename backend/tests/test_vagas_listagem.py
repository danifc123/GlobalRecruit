from httpx import AsyncClient

from app.db.models.user import Role
from tests.conftest import CriarUsuario, auth_header


async def test_listar_vagas_sem_token_retorna_401(client: AsyncClient) -> None:
    response = await client.get("/api/vagas")

    assert response.status_code == 401


async def test_listar_vagas_como_admin_retorna_pagina_vazia(
    client: AsyncClient, criar_usuario: CriarUsuario
) -> None:
    admin = await criar_usuario(Role.ADMIN)

    response = await client.get("/api/vagas", headers=auth_header(admin))

    assert response.status_code == 200
    assert response.json()["items"] == []
