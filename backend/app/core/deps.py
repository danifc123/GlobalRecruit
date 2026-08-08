import uuid
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenType, decode_token
from app.db.base import get_db
from app.db.models.user import Role, User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise unauthorized from exc

    if payload.get("type") != TokenType.ACCESS.value:
        raise unauthorized

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise unauthorized

    return user


def require_roles(*roles: Role) -> Callable:
    async def dependency(user: User = Depends(get_current_user)) -> User:
        # developer tem acesso irrestrito — passa por qualquer checagem de
        # role, independente de quais roles a rota pediu
        if user.role != Role.DEVELOPER and user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para este recurso")
        return user

    return dependency
