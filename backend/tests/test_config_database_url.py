import pytest

from app.core.config import normalizar_database_url


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        (
            "postgresql://u:p@ep-x-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
            "postgresql+asyncpg://u:p@ep-x-pooler.c-9.us-east-2.aws.neon.tech/neondb?ssl=require",
        ),
        ("postgres://u:p@host:5432/db", "postgresql+asyncpg://u:p@host:5432/db"),
        ("postgresql+asyncpg://u:p@127.0.0.1:5434/db", "postgresql+asyncpg://u:p@127.0.0.1:5434/db"),
        ("postgresql+asyncpg://u:p@h/db?ssl=require", "postgresql+asyncpg://u:p@h/db?ssl=require"),
        ("  postgresql://u:p@h/db?sslmode=verify-full  ", "postgresql+asyncpg://u:p@h/db?ssl=verify-full"),
    ],
)
def test_normaliza_connection_string_dos_provedores(entrada: str, esperado: str) -> None:
    assert normalizar_database_url(entrada) == esperado
