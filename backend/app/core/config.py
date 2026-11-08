from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# parâmetros de URL do libpq (Neon, Render, Heroku...) que o asyncpg não
# entende — sslmode vira `ssl`, o resto é descartado
_SSLMODE_PARA_ASYNCPG = {"require": "require", "verify-ca": "verify-ca", "verify-full": "verify-full",
                         "prefer": "prefer", "allow": "allow", "disable": "disable"}
_PARAMS_SO_LIBPQ = {"sslmode", "channel_binding", "sslrootcert", "sslcert", "sslkey", "target_session_attrs"}


def normalizar_database_url(url: str) -> str:
    """Aceita a connection string \"crua\" dos provedores de Postgres
    (`postgres://` / `postgresql://...?sslmode=require&channel_binding=require`)
    e devolve no formato do SQLAlchemy async (`postgresql+asyncpg://...?ssl=require`).
    URL já no formato asyncpg passa sem mudança."""
    url = url.strip()
    for prefixo in ("postgres://", "postgresql://"):
        if url.startswith(prefixo):
            url = "postgresql+asyncpg://" + url[len(prefixo):]
            break
    if not url.startswith("postgresql+asyncpg://"):
        return url

    partes = urlsplit(url)
    params = parse_qsl(partes.query, keep_blank_values=True)
    sslmode = next((valor for chave, valor in params if chave == "sslmode"), None)
    novos = [(chave, valor) for chave, valor in params if chave not in _PARAMS_SO_LIBPQ]
    if sslmode in _SSLMODE_PARA_ASYNCPG and not any(chave == "ssl" for chave, _ in novos):
        novos.append(("ssl", _SSLMODE_PARA_ASYNCPG[sslmode]))
    return urlunsplit(partes._replace(query=urlencode(novos)))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:4200"
    environment: str = "development"
    # tradução automática dos textos das vagas (DeepL); sem chave = desativada
    deepl_api_key: str | None = None
    deepl_api_url: str = "https://api-free.deepl.com"

    @field_validator("database_url")
    @classmethod
    def _normalizar_database_url(cls, valor: str) -> str:
        return normalizar_database_url(valor)

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    # lru_cache garante que o .env só é lido uma vez por processo
    return Settings()
