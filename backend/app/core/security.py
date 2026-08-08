import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum

import bcrypt
import jwt

from app.core.config import get_settings

settings = get_settings()


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


# bcrypt trunca em 72 bytes por design — barrar senha maior explicitamente
# em vez de deixar truncar silenciosamente
_MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > _MAX_PASSWORD_BYTES:
        raise ValueError(f"Senha não pode passar de {_MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if len(plain_password.encode("utf-8")) > _MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def _create_token(subject: uuid.UUID, token_type: TokenType, expires_delta: timedelta, extra_claims: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
        **extra_claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: uuid.UUID, role: str, partner_project_id: uuid.UUID | None) -> str:
    return _create_token(
        user_id,
        TokenType.ACCESS,
        timedelta(minutes=settings.access_token_expire_minutes),
        {"role": role, "partner_project_id": str(partner_project_id) if partner_project_id else None},
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    return _create_token(
        user_id, TokenType.REFRESH, timedelta(days=settings.refresh_token_expire_days), {}
    )


def decode_token(token: str) -> dict:
    # jwt.decode já valida assinatura e expiração; exceções (ExpiredSignatureError,
    # InvalidSignatureError, etc.) sobem para quem chamar tratar como 401
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
