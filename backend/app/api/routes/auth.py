import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.models.user import User
from app.middleware.rate_limit import limiter
from app.schemas.auth import CurrentUserResponse, LoginRequest, LoginResponse, RefreshRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    # mensagem de erro idêntica para email inexistente e senha errada —
    # não dar dica de qual das duas está errada (evita enumeração de contas)
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas"
    )

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise invalid_credentials

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)
    return LoginResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh(
    request: Request, payload: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")
    try:
        claims = decode_token(payload.refresh_token)
    except jwt.PyJWTError as exc:
        raise unauthorized from exc

    if claims.get("type") != TokenType.REFRESH.value:
        raise unauthorized

    user = await db.get(User, uuid.UUID(claims["sub"]))
    if user is None or not user.is_active:
        raise unauthorized

    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=CurrentUserResponse)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
