"""Infra comum dos testes do backend.

Banco: `globalrecruit_test` no Postgres do docker-compose (localhost:5434),
criado e migrado automaticamente na primeira execução. Cada teste roda dentro
de uma transação externa revertida no fim — o código da rota pode chamar
`commit()` à vontade (vira SAVEPOINT) e nada fica gravado entre testes.

Sobrescreva com a variável TEST_DATABASE_URL para apontar outro banco.
"""

import asyncio
import os
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path

# precisa vir antes de qualquer import de `app`: Settings é lido uma vez por
# processo e variável de ambiente tem prioridade sobre o .env
_TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://globalrecruit:globalrecruit@127.0.0.1:5434/globalrecruit_test",
)
os.environ["DATABASE_URL"] = _TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "segredo-apenas-para-testes-nunca-usar-em-producao")

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.base import get_db  # noqa: E402
from app.db.models.candidato import Candidato  # noqa: E402
from app.db.models.pipeline_stage import Estagio, PipelineStage  # noqa: E402
from app.db.models.projeto_parceiro import ProjetoParceiro  # noqa: E402
from app.db.models.user import Role, User  # noqa: E402
from app.db.models.vaga import Prioridade, StatusVaga, Vaga  # noqa: E402
from app.main import app  # noqa: E402

_BACKEND_DIR = Path(__file__).resolve().parent.parent


async def _create_database_if_missing(database_url: str) -> None:
    url = make_url(database_url)
    connection = await asyncpg.connect(
        user=url.username, password=url.password, host=url.host, port=url.port, database="postgres"
    )
    try:
        exists = await connection.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", url.database)
        if not exists:
            # nome vem da URL de teste (config local), não de input externo
            await connection.execute(f'CREATE DATABASE "{url.database}"')
    finally:
        await connection.close()


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> None:
    """Garante o banco de teste no schema mais recente (roda uma vez por sessão)."""
    asyncio.run(_create_database_if_missing(_TEST_DATABASE_URL))
    alembic_config = Config(str(_BACKEND_DIR / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    command.upgrade(alembic_config, "head")


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Sessão ligada a uma transação externa que é revertida no fim do teste."""
    engine = create_async_engine(_TEST_DATABASE_URL, poolclass=NullPool)
    connection = await engine.connect()
    outer_transaction = await connection.begin()
    session = AsyncSession(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        await session.close()
        await outer_transaction.rollback()
        await connection.close()
        await engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """Cliente HTTP da API usando a mesma sessão transacional do teste."""

    async def _override_get_db() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http_client:
            yield http_client
    finally:
        app.dependency_overrides.pop(get_db, None)


CriarProjeto = Callable[..., Awaitable[ProjetoParceiro]]
CriarUsuario = Callable[..., Awaitable[User]]


@pytest.fixture
def criar_projeto(db_session: AsyncSession) -> CriarProjeto:
    async def _criar(nome: str = "Projeto Teste", cliente: str = "Cliente Teste") -> ProjetoParceiro:
        projeto = ProjetoParceiro(nome=nome, cliente=cliente)
        db_session.add(projeto)
        await db_session.commit()
        return projeto

    return _criar


@pytest.fixture
def criar_usuario(db_session: AsyncSession) -> CriarUsuario:
    async def _criar(role: Role, projetos: list[ProjetoParceiro] | None = None) -> User:
        user = User(
            email=f"{role.value}-{uuid.uuid4().hex[:8]}@teste.local",
            hashed_password=hash_password("senha-de-teste"),
            role=role,
            projetos=projetos or [],
        )
        db_session.add(user)
        await db_session.commit()
        return user

    return _criar


CriarVaga = Callable[..., Awaitable[Vaga]]
CriarCandidato = Callable[..., Awaitable[Candidato]]

# estágios criados pelas fábricas ficam no passado: dentro da transação do
# teste o now() do Postgres é constante, e a regra de "estágio atual" ordena
# por updated_at — sem isso, um estágio novo empataria com os da fixture
_ESTAGIO_FIXTURE_UPDATED_AT = datetime(2020, 1, 1, tzinfo=timezone.utc)


@pytest.fixture
def criar_vaga(db_session: AsyncSession) -> CriarVaga:
    async def _criar(projeto: ProjetoParceiro, **campos: object) -> Vaga:
        valores: dict[str, object] = {
            "cliente": "Acme",
            "cargo": "Support Agent",
            "prioridade": Prioridade.MEDIA,
            "status": StatusVaga.ABERTA,
            **campos,
        }
        vaga = Vaga(projeto_id=projeto.id, **valores)
        db_session.add(vaga)
        await db_session.commit()
        return vaga

    return _criar


@pytest.fixture
def criar_candidato(db_session: AsyncSession) -> CriarCandidato:
    async def _criar(vaga: Vaga, estagio: Estagio) -> Candidato:
        candidato = Candidato(nome="Fulano", email=f"{uuid.uuid4().hex[:8]}@teste.local", vaga_id=vaga.id)
        db_session.add(candidato)
        await db_session.commit()
        db_session.add(
            PipelineStage(candidato_id=candidato.id, estagio=estagio, updated_at=_ESTAGIO_FIXTURE_UPDATED_AT)
        )
        await db_session.commit()
        return candidato

    return _criar


async def estagio_atual(db_session: AsyncSession, candidato_id: uuid.UUID) -> Estagio:
    """Estágio mais recente do candidato (mesma regra usada pela API)."""
    stmt = (
        select(PipelineStage.estagio)
        .where(PipelineStage.candidato_id == candidato_id)
        .order_by(PipelineStage.updated_at.desc())
        .limit(1)
    )
    return (await db_session.execute(stmt)).scalar_one()


def auth_header(user: User) -> dict[str, str]:
    """Header Authorization com access token válido para o usuário."""
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}
